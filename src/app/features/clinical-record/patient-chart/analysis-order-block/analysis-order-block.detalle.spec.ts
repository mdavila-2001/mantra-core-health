import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../../../../core/auth/session.store';
import {
  AnalysisOrderBlock,
  TARGET_CATEGORIA,
  TARGET_CONTRASTE,
  TARGET_ESTUDIO,
  TARGET_LATERALIDAD,
  TARGET_MODALIDAD,
  TARGET_MUESTRA,
  TARGET_REGION,
} from './analysis-order-block';

/**
 * El tipo de orden y su detalle (06/11/2026): laboratorio con tipo de análisis,
 * árbol y muestra; imagenología con tipo de imagen, región, lado y contraste.
 *
 * Contra el cliente HTTP real y respuestas de catálogo declaradas acá: el
 * simulador no entra. Lo que fijan, en los tres niveles del contrato:
 *
 * - **correcto**: qué viaja en el alta de cada tipo;
 * - **límite**: lo que no se manda porque la API lo rechazaría (lado sin región,
 *   contraste sin tipo de imagen) y lo que no se arrastra al cambiar de tipo;
 * - **inválido**: el 422 del detalle se muestra y no pierde lo cargado, y un
 *   catálogo sin publicar no inventa un valor.
 */

function opcion(conceptId: string, code: string, ordinal: number, displayEs?: string) {
  return { conceptId, code, display: code, ordinal, isDefault: false, ...(displayEs === undefined ? {} : { displayEs }) };
}

const ENUMS: Record<string, readonly ReturnType<typeof opcion>[]> = {
  [TARGET_ESTUDIO]: [
    opcion('e-hemo', 'LAB_HEMOGRAMA', 1, 'Hemograma completo'),
    opcion('e-orina', 'LAB_ORINA', 2, 'Orina completa'),
    opcion('e-rx-mano', 'IMG_RX_MIEMBRO_SUP', 3, 'Radiografía de miembro superior'),
    opcion('e-eco', 'IMG_ECO_ABDOMINAL', 4, 'Ecografía abdominal'),
    opcion('e-ecg', 'CAR_ECG', 5, 'Electrocardiograma'),
  ],
  [TARGET_CATEGORIA]: [opcion('cat-lab', 'SR_LAB', 1), opcion('cat-img', 'SR_IMAGING', 2)],
  [TARGET_MUESTRA]: [opcion('m-bldv', 'BLDV', 1), opcion('m-ur', 'UR', 2), opcion('m-stl', 'STL', 3)],
  [TARGET_MODALIDAD]: [
    opcion('mod-lab', 'DU_MODALITY_LAB', 1),
    opcion('mod-xray', 'DU_MODALITY_XRAY', 2),
    opcion('mod-us', 'DU_MODALITY_ULTRASOUND', 3),
  ],
  [TARGET_REGION]: [opcion('r-torax', 'SR_REGION_THORAX', 1), opcion('r-sup', 'SR_REGION_UPPER_LIMB', 2)],
  [TARGET_LATERALIDAD]: [opcion('l-izq', 'COND_LAT_LEFT', 1), opcion('l-der', 'COND_LAT_RIGHT', 2)],
  [TARGET_CONTRASTE]: [opcion('c-sin', 'SR_CONTRAST_NONE', 1), opcion('c-con', 'SR_CONTRAST_WITH', 2)],
};

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

describe('AnalysisOrderBlock · tipo de orden y detalle', () => {
  let fixture: ComponentFixture<AnalysisOrderBlock>;
  let c: AnalysisOrderBlock;
  let http: HttpTestingController;
  /** Los targets cuyo catálogo no está publicado (404). */
  let sinBinding: string[];

  beforeEach(() => {
    sinBinding = [];
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'], hpid: 'doc-1' }),
      refreshToken: 'r-1',
    });
    fixture = TestBed.createComponent(AnalysisOrderBlock);
    c = fixture.componentInstance;
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    fixture.componentRef.setInput('encounterId', 'enc-1');
  });

  afterEach(() => {
    responderCatalogos();
    for (const r of http.match((x) => x.url === '/consent/treatment-informed-consents')) {
      r.flush({ items: [] });
    }
    // El selector de región lee las piezas del atlas al montarse (Imagenología).
    for (const r of http.match((x) => x.url.startsWith('/anatomy-atlas-3d/'))) {
      r.flush([]);
    }
    http.verify();
  });

  function responderCatalogos(): void {
    for (const req of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      const target = req.request.params.get('target') ?? '';
      if (sinBinding.includes(target)) {
        req.flush({ message: 'sin binding' }, { status: 404, statusText: 'Not Found' });
        continue;
      }
      req.flush({
        code: target,
        name: target,
        definitionId: 'd',
        valueSetId: 'v',
        allowCustomValue: false,
        options: ENUMS[target] ?? [],
      });
    }
  }

  function responderCircuito(circuito: object = { patientProfileId: 'p-1', orders: [], reports: [], limit: 25, truncated: [] }): void {
    http.expectOne((r) => r.url === '/diagnostics/patients/p-1/orders').flush(circuito);
    for (const r of http.match((x) => x.url === '/terminology/concepts')) {
      r.flush({ items: [], total: 0 });
    }
  }

  /** La recomendación de ejecutor se pide al elegir el estudio: se responde sin sedes. */
  function responderEjecutor(): void {
    for (const r of http.match((x) => x.url === '/terminology/value-sets')) {
      r.flush({ items: [{ id: 'vs-perf', internalCode: 'service-request-performer-selection', name: 'x', description: '', defaultVersionId: 'v', memberCount: 3 }], count: 1, limit: 50, nextCursor: null });
    }
    for (const r of http.match((x) => x.url === '/terminology/value-sets/vs-perf/$expand')) {
      r.flush({
        valueSetId: 'vs-perf', valueSetVersionId: 'v', version: '1', count: 3, limit: 200, nextCursor: null,
        items: [
          { conceptId: 'c-self', code: 'SR_PERF_SELF', display: 'a', codeSystemVersionId: 'x' },
          { conceptId: 'c-org', code: 'SR_PERF_ORGANIZATION', display: 'b', codeSystemVersionId: 'x' },
          { conceptId: 'c-pat', code: 'SR_PERF_PATIENT_CHOICE', display: 'c', codeSystemVersionId: 'x' },
        ],
      });
    }
    for (const r of http.match((x) => x.url === '/practitioners/me/role-assignments')) {
      r.flush([]);
    }
    for (const r of http.match((x) => x.url === '/medical-centers/search')) {
      r.flush({ items: [], total: 0, limit: 20, offset: 0 });
    }
  }

  function abrir(): void {
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito();
    fixture.detectChanges();
  }

  function pedir(): { body: Record<string, unknown>; alta: ReturnType<HttpTestingController['expectOne']> } {
    c['pedir']();
    http.expectOne((r) => r.url === '/clinical/service-requests/duplicate-check').flush({
      isDuplicate: false, previousStudy: null, warningMessage: null, requiresJustification: false, pendingReport: false, windowDays: 30,
    });
    const alta = http.expectOne((r) => r.url === '/clinical/service-requests');
    return { body: alta.request.body as Record<string, unknown>, alta };
  }

  describe('correcto', () => {
    it('laboratorio: tipo de análisis → árbol → muestra; viaja la muestra y ningún dato de imagen', () => {
      abrir();
      c['elegirTipoDeOrden']('LAB');
      c['orden'].chooseLabType('BLOOD');
      fixture.detectChanges();

      const ramas = c['orden'].labTree();
      expect(ramas.map((r) => r.label)).toEqual(['Hematología']);
      expect(ramas[0].items[0]).toEqual({ value: 'e-hemo', label: 'Hemograma completo' });
      // La muestra se limita a las que la sangre admite: la orina no se ofrece.
      expect(c['orden'].specimenOptions().map((m) => m.label)).toEqual(['Sangre venosa']);

      c['estudio'].set('e-hemo');
      c['orden'].specimen.set('m-bldv');
      fixture.detectChanges();
      responderEjecutor();

      const { body, alta } = pedir();
      expect(body).toMatchObject({ codeConceptId: 'e-hemo', category: 'LAB', specimenTypeConceptId: 'm-bldv' });
      for (const k of ['modalityConceptId', 'bodySiteConceptId', 'lateralityConceptId', 'contrastConceptId']) {
        expect(k in body).toBe(false);
      }
      alta.flush({ id: 'sr-1', patientProfileId: 'p-1', status: 's', intent: 'i', createdAt: '2026-11-06T10:00:00.000Z' });
      responderCircuito();
    });

    it('imagenología: tipo de imagen, estudio, región, lado y contraste viajan con la categoría IMAGING', () => {
      abrir();
      c['elegirTipoDeOrden']('IMAGING');
      c['orden'].chooseModality('mod-xray');
      c['orden'].chooseImagingStudy('e-rx-mano');
      c['orden'].chooseRegion('R06');
      c['orden'].laterality.set('l-izq');
      c['orden'].contrast.set('c-sin');
      fixture.detectChanges();
      responderEjecutor();

      const { body, alta } = pedir();
      expect(body).toMatchObject({
        codeConceptId: 'e-rx-mano',
        category: 'IMAGING',
        modalityConceptId: 'mod-xray',
        bodySiteConceptId: 'r-sup',
        lateralityConceptId: 'l-izq',
        contrastConceptId: 'c-sin',
      });
      expect('specimenTypeConceptId' in body).toBe(false);
      alta.flush({ id: 'sr-2', patientProfileId: 'p-1', status: 's', intent: 'i', createdAt: '2026-11-06T10:00:00.000Z' });
      responderCircuito();
    });

    it('la ficha de imagen dice qué hace el estudio, qué revisar y que es un borrador interno', () => {
      abrir();
      c['elegirTipoDeOrden']('IMAGING');
      c['orden'].chooseModality('mod-xray');
      fixture.detectChanges();

      const ficha: HTMLElement = fixture.nativeElement.querySelector('[data-testid="imaging-guidance"]');
      expect(ficha.textContent).toContain('Rayos X: qué hace');
      expect(ficha.textContent).toContain('Para revisar antes de pedirlo');
      expect(ficha.textContent).toContain('pendiente de revisión clínica');
    });

    it('el histórico dice la muestra o la región, el lado y el tipo de imagen', () => {
      abrir();
      c['circuito'].set({
        status: 'ready',
        data: {
          patientProfileId: 'p-1',
          limit: 25,
          truncated: [],
          reports: [],
          orders: [
            { id: 'o1', patientProfileId: 'p-1', codeConceptId: 'e-rx-mano', statusConceptId: 's', createdAt: new Date(), modalityConceptId: 'mod-xray', bodySiteConceptId: 'r-sup', lateralityConceptId: 'l-izq' },
            { id: 'o2', patientProfileId: 'p-1', codeConceptId: 'e-hemo', statusConceptId: 's', createdAt: new Date(), specimenTypeConceptId: 'm-bldv' },
            { id: 'o3', patientProfileId: 'p-1', codeConceptId: 'e-ecg', statusConceptId: 's', createdAt: new Date() },
          ],
        },
      } as never);
      expect(c['estudios']().map((e) => e.detalle)).toEqual(['Rayos X · Miembro superior · Izquierdo', 'Sangre venosa', null]);
    });
  });

  describe('límite', () => {
    it('imagenología ofrece sólo estudios de imagen, filtrados por el tipo de imagen; elegir el estudio deduce el tipo', () => {
      abrir();
      c['elegirTipoDeOrden']('IMAGING');
      expect(c['orden'].imagingStudyOptions().map((o) => o.label)).toEqual(['Radiografía de miembro superior', 'Ecografía abdominal']);
      // La modalidad de laboratorio no es un tipo de imagen.
      expect(c['orden'].modalityOptions().map((o) => o.label)).toEqual(['Rayos X', 'Ecografía']);

      c['orden'].chooseImagingStudy('e-eco');
      expect(c['orden'].modality()).toBe('mod-us');
      c['orden'].chooseModality('mod-xray');
      expect(c['estudio']()).toBeNull();
      expect(c['orden'].imagingStudyOptions().map((o) => o.label)).toEqual(['Radiografía de miembro superior']);
    });

    it('no manda un lado sin región ni un contraste sin tipo de imagen: la API los rechazaría', () => {
      abrir();
      c['elegirTipoDeOrden']('IMAGING');
      c['estudio'].set('e-rx-mano');
      c['orden'].laterality.set('l-der');
      c['orden'].contrast.set('c-con');
      fixture.detectChanges();
      responderEjecutor();

      const { body, alta } = pedir();
      expect('lateralityConceptId' in body).toBe(false);
      expect('contrastConceptId' in body).toBe(false);
      expect('bodySiteConceptId' in body).toBe(false);
      alta.flush({ id: 'sr-3', patientProfileId: 'p-1', status: 's', intent: 'i', createdAt: '2026-11-06T10:00:00.000Z' });
      responderCircuito();
    });

    it('cambiar el tipo de orden no arrastra el estudio ni el detalle del anterior', () => {
      abrir();
      c['elegirTipoDeOrden']('IMAGING');
      c['orden'].chooseImagingStudy('e-rx-mano');
      c['orden'].chooseRegion('R06');
      c['orden'].laterality.set('l-izq');
      c['elegirTipoDeOrden']('LAB');
      expect(c['estudio']()).toBeNull();
      expect(c['orden'].region()).toBeNull();
      expect(c['orden'].laterality()).toBeNull();
      expect(c['orden'].modality()).toBeNull();
      expect(c['puedePedir']()).toBe(false);
    });

    it('«Genético» existe y está vacío: lo dice y no inventa estudios', () => {
      abrir();
      c['elegirTipoDeOrden']('LAB');
      c['orden'].chooseLabType('GENETIC');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="lab-tree-empty"]')).not.toBeNull();
      expect(c['orden'].labTree()).toEqual([]);
      expect(c['puedePedir']()).toBe(false);
    });

    it('«Otro estudio» conserva lo que ya se podía pedir: un estudio cardiológico', () => {
      abrir();
      c['elegirTipoDeOrden']('OTHER');
      c['estudio'].set('e-ecg');
      expect(c['puedePedir']()).toBe(true);
      const { body, alta } = pedir();
      expect(body['category']).toBe('OTHER');
      alta.flush({ id: 'sr-4', patientProfileId: 'p-1', status: 's', intent: 'i', createdAt: '2026-11-06T10:00:00.000Z' });
      responderCircuito();
    });
  });

  describe('inválido', () => {
    it('un 422 del detalle se muestra y no pierde lo cargado', () => {
      abrir();
      c['elegirTipoDeOrden']('IMAGING');
      c['orden'].chooseImagingStudy('e-rx-mano');
      c['orden'].chooseRegion('R06');
      fixture.detectChanges();
      responderEjecutor();

      const { alta } = pedir();
      alta.flush(
        { code: 'PRECONDITION_FAILED', message: 'Esos datos sólo corresponden a una orden de imagenología', details: { reason: 'SERVICE_REQUEST_DETAIL_NOT_FOR_CATEGORY' } },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      fixture.detectChanges();

      expect(c['errorDelPedido']()).not.toBeNull();
      expect(c['pidiendo']()).toBe(false);
      expect(c['estudio']()).toBe('e-rx-mano');
      expect(c['orden'].region()).toBe('R06');
    });

    it('sin el catálogo de regiones publicado no inventa un valor: la región no viaja', () => {
      sinBinding = [TARGET_REGION];
      abrir();
      c['elegirTipoDeOrden']('IMAGING');
      c['orden'].chooseImagingStudy('e-rx-mano');
      c['orden'].chooseRegion('R06');
      fixture.detectChanges();
      responderEjecutor();

      const { body, alta } = pedir();
      expect('bodySiteConceptId' in body).toBe(false);
      alta.flush({ id: 'sr-5', patientProfileId: 'p-1', status: 's', intent: 'i', createdAt: '2026-11-06T10:00:00.000Z' });
      responderCircuito();
    });

    it('sin tipo de orden elegido el formulario no ofrece ningún estudio ni se puede pedir', () => {
      abrir();
      expect(c['orden'].kind()).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="lab-type"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="imaging-study"]')).toBeNull();
      expect(c['puedePedir']()).toBe(false);
    });
  });
});

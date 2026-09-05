import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../../../../core/auth/session.store';
import { ProceduresBlock } from './procedures-block';

/**
 * Histórico de procedimientos en la ficha — punto 7. Lo que estas pruebas fijan:
 *
 * 1. **Las dos mitades son independientes.** Un `403` en lo quirúrgico no puede
 *    llevarse puesto el histórico odontológico, ni al revés: son permisos
 *    distintos y esconder la mitad legible sería el mismo defecto que ya cometió
 *    la agenda al confundir «no hay» con «no podés ver».
 * 2. **Lo que se recorta se dice.** Un histórico clínico truncado en silencio se
 *    lee como «no tuvo más cirugías».
 * 3. **Un detalle caído no tumba la lista.** Media lista de antecedentes sigue
 *    siendo más útil que un error donde había antecedentes.
 * 4. **Lo opcional sin elegir se omite.** El backend valida con
 *    `forbidNonWhitelisted`.
 * 5. **Después de escribir se relee.** El bloque no pinta lo que el servidor no
 *    le confirmó.
 */

const CATALOGO = {
  procedureCodes: [
    { conceptId: 'code-extraccion', code: 'DENT_EXTRACTION', display: 'Tooth extraction' },
  ],
  teeth: [{ conceptId: 'tooth-36', code: 'FDI_36', display: 'Tooth 36' }],
  quadrants: [{ conceptId: 'quad-3', code: 'FDI_Q3', display: 'Quadrant 3' }],
};

/** Una cabecera de caso, la forma que devuelve el listado. */
const CASO = {
  id: 'c-1',
  caseNumber: 'CQ-000001',
  patientProfileId: 'p-1',
  statusConceptId: 'st-completado',
  scheduledStartAt: '2026-08-10T13:00:00.000Z',
};

/** El detalle del caso, con el registro intraoperatorio que el punto 7 pedía. */
const DETALLE = {
  case: CASO,
  team: [{ id: 'tm-1', practitionerProfileId: 'hp-1', teamRoleConceptId: 'rol-cirujano', statusConceptId: 'st-1' }],
  operativeSteps: [
    {
      id: 's-1',
      stepNumber: 1,
      stepCodeConceptId: 'code-1',
      description: 'Abordaje',
      statusConceptId: 'st-1',
    },
  ],
  findings: [
    {
      id: 'f-1',
      findingCodeConceptId: 'code-2',
      findingText: 'Adherencias',
      recordedAt: '2026-08-10T13:30:00.000Z',
    },
  ],
  implants: [
    {
      id: 'i-1',
      procedureId: 'proc-1',
      implantDeviceId: 'dev-1',
      implantRoleConceptId: 'rol-implante',
      implantedAt: '2026-08-10T14:00:00.000Z',
      identifiers: [
        {
          id: 'id-1',
          identifierTypeConceptId: 'udi',
          identifierValue: '0123456789',
          lotNumber: 'L-42',
        },
      ],
    },
  ],
  operativeReports: [],
};

/** Un tratamiento odontológico del histórico. */
const TRATAMIENTO = {
  id: 'd-1',
  patientProfileId: 'p-1',
  procedureCodeConceptId: 'code-extraccion',
  statusConceptId: 'st-completado',
  noteText: 'Extracción sin complicaciones.',
  performedAt: '2026-08-11T10:00:00.000Z',
  createdAt: '2026-08-11T10:05:00.000Z',
  sites: [{ id: 'site-1', bodySiteConceptId: 'tooth-36', description: 'Cara oclusal' }],
};

/** base64url **sobre UTF-8**, como el token real. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

describe('ProceduresBlock', () => {
  let fixture: ComponentFixture<ProceduresBlock>;
  let componente: ProceduresBlock;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });

    fixture = TestBed.createComponent(ProceduresBlock);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('patientProfileId', 'p-1');
  });

  /**
   * La resolución de etiquetas se dispara cuando hay casos y no gobierna nada de
   * lo que se prueba acá: se drena para que `verify()` no tropiece con ella.
   */
  afterEach(() => {
    for (const pendiente of http.match((r) => r.url === '/terminology/concepts')) {
      pendiente.flush({ items: [] });
    }
    http.verify();
  });

  function señal<T>(nombre: string): WritableSignal<T> {
    return (componente as unknown as Record<string, WritableSignal<T>>)[nombre];
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  /**
   * Arranca el bloque y responde las tres lecturas iniciales.
   *
   * El catálogo se responde siempre: su fallo sólo apaga el formulario, y las
   * pruebas que lo necesitan apagado lo dicen.
   */
  function arrancar(
    opciones: {
      casos?: { items: unknown[]; total: number };
      detalles?: (unknown | 'falla')[];
      dental?: { items: unknown[]; total: number } | 'prohibido';
      catalogo?: unknown | 'falla';
    } = {},
  ): void {
    fixture.detectChanges();

    const lista = http.expectOne((r) => r.url === '/procedure-cases');
    lista.flush(opciones.casos ?? { items: [], total: 0 });

    // Los detalles salen en un `forkJoin`: se piden todos a la vez, así que se
    // recogen con `match` —`expectOne` fallaría al encontrar dos— y se responden
    // en el orden en que se pidieron, que es el de la lista.
    const detalles = opciones.detalles ?? [];
    if (detalles.length > 0) {
      const pedidos = http.match((r) => r.url.startsWith('/procedure-cases/'));
      expect(pedidos).toHaveLength(detalles.length);
      pedidos.forEach((req, i) => {
        const detalle = detalles[i];
        if (detalle === 'falla') {
          req.flush(
            { code: 'NOT_FOUND', message: '', timestamp: '', path: '' },
            { status: 404, statusText: 'Not Found' },
          );
        } else {
          req.flush(detalle as object);
        }
      });
    }

    const dental = http.expectOne((r) => r.url === '/dental-procedures');
    if (opciones.dental === 'prohibido') {
      dental.flush(
        { code: 'FORBIDDEN', message: 'Sin permiso', timestamp: '', path: '' },
        { status: 403, statusText: 'Forbidden' },
      );
    } else {
      dental.flush(opciones.dental ?? { items: [], total: 0 });
    }

    const catalogo = http.expectOne((r) => r.url === '/dental-procedures/catalog');
    if (opciones.catalogo === 'falla') {
      catalogo.flush(
        { code: 'INTERNAL', message: '', timestamp: '', path: '' },
        { status: 500, statusText: 'Server Error' },
      );
    } else {
      catalogo.flush((opciones.catalogo ?? CATALOGO) as object);
    }

    fixture.detectChanges();
  }

  describe('las dos lecturas', () => {
    it('acota las dos al paciente de la ficha', () => {
      fixture.detectChanges();

      const casos = http.expectOne((r) => r.url === '/procedure-cases');
      expect(casos.request.params.get('patientProfileId')).toBe('p-1');
      casos.flush({ items: [], total: 0 });

      const dental = http.expectOne((r) => r.url === '/dental-procedures');
      expect(dental.request.params.get('patientProfileId')).toBe('p-1');
      dental.flush({ items: [], total: 0 });

      http.expectOne((r) => r.url === '/dental-procedures/catalog').flush(CATALOGO);
    });

    it('pide el detalle de cada caso listado', () => {
      arrancar({ casos: { items: [CASO], total: 1 }, detalles: [DETALLE] });

      expect(texto()).toContain('CQ-000001');
      expect(texto()).toContain('Abordaje');
      expect(texto()).toContain('Adherencias');
    });

    /** El lote es lo que permite responder a un retiro del mercado. */
    it('muestra el lote del implante', () => {
      arrancar({ casos: { items: [CASO], total: 1 }, detalles: [DETALLE] });

      expect(texto()).toContain('lote L-42');
    });

    /**
     * Media lista de cirugías sigue siendo más útil que un error donde había
     * antecedentes: el caso cuyo detalle falla se descarta y los demás quedan.
     */
    it('un detalle caído no tumba el bloque', () => {
      arrancar({
        casos: { items: [CASO, { ...CASO, id: 'c-2', caseNumber: 'CQ-000002' }], total: 2 },
        detalles: [DETALLE, 'falla'],
      });

      expect(texto()).toContain('CQ-000001');
      expect(texto()).not.toContain('CQ-000002');
    });

    /**
     * S5 y no S3: «no hay cirugías» y «no podés ver las cirugías» son estados
     * opuestos, y confundirlos es el defecto que ya cometió la agenda.
     */
    it('un 403 en lo odontológico no esconde lo quirúrgico', () => {
      arrancar({
        casos: { items: [CASO], total: 1 },
        detalles: [DETALLE],
        dental: 'prohibido',
      });

      expect(texto()).toContain('CQ-000001');
      expect(texto()).toContain('No podés ver el histórico odontológico');
    });

    it('sin registros, cada mitad dice lo suyo', () => {
      arrancar();

      expect(texto()).toContain('Sin cirugías registradas');
      expect(texto()).toContain('Sin tratamientos odontológicos registrados');
    });

    /** Un histórico recortado en silencio se lee como «no tuvo más». */
    it('avisa cuántas cirugías quedaron sin mostrar', () => {
      arrancar({ casos: { items: [CASO], total: 24 }, detalles: [DETALLE] });

      expect(texto()).toContain('Quedaron 14 sin mostrar');
    });

    it('resuelve la pieza contra el catálogo', () => {
      arrancar({ dental: { items: [TRATAMIENTO], total: 1 } });

      expect(texto()).toContain('Tooth extraction');
      expect(texto()).toContain('Tooth 36');
      expect(texto()).toContain('Cara oclusal');
    });
  });

  /**
   * Cirugía y odontología ya no viven pegadas bajo «Procedimiento»: cada una
   * es su propia opción del selector, con su propio permiso de servidor. Sin
   * `modo`, alguien eligiendo odontología igual disparaba —y a veces
   * bloqueaba— la lectura quirúrgica, con el aviso de permiso denegado en
   * medio de un formulario que no pedía nada de eso.
   */
  describe('el modo acota qué mitad se pide y se dibuja', () => {
    it('con modo="odontologia" no pide ni dibuja lo quirúrgico', () => {
      fixture.componentRef.setInput('modo', 'odontologia');
      fixture.detectChanges();

      http.expectNone((r) => r.url === '/procedure-cases');
      expect(texto()).not.toContain('Cirugías');
      expect(texto()).not.toContain('No podés ver el histórico quirúrgico');

      http.expectOne((r) => r.url === '/dental-procedures').flush({ items: [], total: 0 });
      http.expectOne((r) => r.url === '/dental-procedures/catalog').flush(CATALOGO);
      fixture.detectChanges();

      expect(texto()).toContain('Odontología');
    });

    it('con modo="cirugia" no pide ni dibuja lo odontológico', () => {
      fixture.componentRef.setInput('modo', 'cirugia');
      fixture.detectChanges();

      http.expectNone((r) => r.url === '/dental-procedures');
      http.expectNone((r) => r.url === '/dental-procedures/catalog');
      expect(texto()).not.toContain('Odontología');

      http.expectOne((r) => r.url === '/procedure-cases').flush({ items: [], total: 0 });
      fixture.detectChanges();

      expect(texto()).toContain('Cirugías');
    });
  });

  describe('el alta odontológica', () => {
    /**
     * Sin catálogo los selectores estarían vacíos y el formulario mandaría un
     * código inexistente. Decirlo es más honesto que ofrecerlo roto — y el
     * histórico de arriba sigue en pie.
     */
    it('sin catálogo no se ofrece el formulario, y se dice por qué', () => {
      arrancar({ dental: { items: [TRATAMIENTO], total: 1 }, catalogo: 'falla' });

      // El histórico sigue legible porque las etiquetas caen a terminología: la
      // frase «el registro no está disponible, el histórico sí» tiene que ser
      // verdadera, no un consuelo.
      for (const pendiente of http.match((r) => r.url === '/terminology/concepts')) {
        pendiente.flush({
          items: [
            {
              conceptId: 'code-extraccion',
              code: 'DENT_EXTRACTION',
              display: 'Tooth extraction',
              codeSystemVersionId: 'v-1',
            },
            {
              conceptId: 'tooth-36',
              code: 'FDI_36',
              display: 'Tooth 36',
              codeSystemVersionId: 'v-1',
            },
          ],
        });
      }
      fixture.detectChanges();

      expect(texto()).toContain('Catálogo no disponible');
      expect(texto()).toContain('Tooth extraction');
      expect(texto()).toContain('Tooth 36');
    });

    it('manda sólo lo elegido: lo opcional vacío no viaja', () => {
      arrancar();
      señal<string | null>('codigo').set('code-extraccion');
      fixture.detectChanges();

      componente['registrar']();

      const req = http.expectOne(
        (r) => r.url === '/dental-procedures' && r.method === 'POST',
      );
      expect(req.request.body).toEqual({
        patientProfileId: 'p-1',
        procedureCodeConceptId: 'code-extraccion',
      });
      req.flush({
        id: 'd-1',
        patientProfileId: 'p-1',
        statusConceptId: 'st-1',
        createdAt: '2026-08-14T12:00:00.000Z',
      });
      http.expectOne((r) => r.url === '/dental-procedures').flush({ items: [], total: 0 });
    });

    it('manda la pieza y la cara cuando se eligieron', () => {
      arrancar();
      señal<string | null>('codigo').set('code-extraccion');
      señal<string | null>('pieza').set('tooth-36');
      señal<string | number | null>('cara').set('Oclusal');
      fixture.detectChanges();

      componente['registrar']();

      const req = http.expectOne(
        (r) => r.url === '/dental-procedures' && r.method === 'POST',
      );
      expect(req.request.body.toothSiteConceptId).toBe('tooth-36');
      expect(req.request.body.siteDetail).toBe('Oclusal');
      req.flush({
        id: 'd-1',
        patientProfileId: 'p-1',
        statusConceptId: 'st-1',
        createdAt: '2026-08-14T12:00:00.000Z',
      });
      http.expectOne((r) => r.url === '/dental-procedures').flush({ items: [], total: 0 });
    });

    /** El bloque no pinta lo que el servidor no le confirmó. */
    it('relee el histórico después de registrar', () => {
      arrancar();
      señal<string | null>('codigo').set('code-extraccion');
      fixture.detectChanges();

      componente['registrar']();
      http.expectOne((r) => r.url === '/dental-procedures' && r.method === 'POST').flush({
        id: 'd-1',
        patientProfileId: 'p-1',
        statusConceptId: 'st-1',
        createdAt: '2026-08-14T12:00:00.000Z',
      });

      const relectura = http.expectOne(
        (r) => r.url === '/dental-procedures' && r.method === 'GET',
      );
      relectura.flush({ items: [TRATAMIENTO], total: 1 });
      fixture.detectChanges();

      expect(texto()).toContain('Extracción sin complicaciones.');
    });

    /**
     * El 422 del sitio inválido es corregible desde el mismo formulario, así que
     * su mensaje tiene que llegar a la pantalla y no quedar en la consola.
     */
    it('un 422 del backend se muestra en el formulario', () => {
      arrancar();
      señal<string | null>('codigo').set('code-extraccion');
      fixture.detectChanges();

      componente['registrar']();
      http.expectOne((r) => r.url === '/dental-procedures' && r.method === 'POST').flush(
        {
          code: 'PRECONDITION_FAILED',
          message: 'El sitio tiene que ser una pieza dentaria o un cuadrante',
          timestamp: '',
          path: '',
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      fixture.detectChanges();

      expect(texto()).toContain('pieza dentaria o un cuadrante');
    });

    it('sin tratamiento elegido no se puede registrar', () => {
      arrancar();

      expect(componente['puedeRegistrar']()).toBe(false);
    });

    /**
     * `app-input` no acota el largo —no tiene `maxLength`—, así que el tope lo
     * comprueba el bloque: avisar antes de enviar es mejor que dejar que el 400
     * explique lo que el campo ya sabía.
     */
    it('una cara más larga que el tope bloquea el envío', () => {
      arrancar();
      señal<string | null>('codigo').set('code-extraccion');
      señal<string | null>('pieza').set('tooth-36');
      señal<string | number | null>('cara').set('x'.repeat(201));
      fixture.detectChanges();

      expect(componente['caraDemasiadoLarga']()).toBe(true);
      expect(componente['puedeRegistrar']()).toBe(false);
    });
  });

  describe('adjuntar un archivo a un tratamiento (ALV-033, odontología)', () => {
    /**
     * A diferencia del diagnóstico, este histórico ya llega completo en cada
     * carga: la acción se ofrece por fila y no sólo tras el alta, así que un
     * tratamiento viejo —no sólo el recién registrado— puede recibir un adjunto.
     */
    it('«Adjuntar archivo» muestra el subidor para ESE tratamiento y no para otro', () => {
      arrancar({
        dental: {
          items: [TRATAMIENTO, { ...TRATAMIENTO, id: 'd-2' }],
          total: 2,
        },
      });

      componente['alternarAdjuntos']('d-1');
      fixture.detectChanges();

      const html = fixture.nativeElement as HTMLElement;
      const uploaders = html.querySelectorAll('app-attachment-uploader');
      expect(uploaders).toHaveLength(1);
      expect(uploaders[0].getAttribute('ownerType')).toBe('PROCEDURE');
    });

    it('volver a tocar «Adjuntar archivo» en la misma fila lo cierra', () => {
      arrancar({ dental: { items: [TRATAMIENTO], total: 1 } });

      componente['alternarAdjuntos']('d-1');
      fixture.detectChanges();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('app-attachment-uploader'),
      ).not.toBeNull();

      componente['alternarAdjuntos']('d-1');
      fixture.detectChanges();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('app-attachment-uploader'),
      ).toBeNull();
    });

    it('el vínculo del adjunto pasa por `clinical`, no por el genérico de `common`', () => {
      arrancar({ dental: { items: [TRATAMIENTO], total: 1 } });

      const enlazar = componente['enlazarAdjuntoAlTratamiento'] as (
        fileId: string,
        procedureId: string,
      ) => { subscribe: (o: unknown) => void };
      enlazar('file-1', 'd-1').subscribe({ next: () => undefined });

      http
        .expectOne('/clinical/procedures/d-1/attachments')
        .flush({ id: 'link-1', fileId: 'file-1', ownerId: 'd-1', createdAt: '2026-01-01' });
    });
  });
});

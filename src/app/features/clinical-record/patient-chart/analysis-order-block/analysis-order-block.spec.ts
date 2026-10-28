import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../../../../core/auth/session.store';
import { AnalysisOrderBlock, TARGET_CATEGORIA, TARGET_ESTUDIO } from './analysis-order-block';

/**
 * Pedir un laboratorio o una imagen desde la ficha, y ver qué volvió — punto 10
 * del reclamo. Lo que estas pruebas fijan:
 *
 * 1. **El bloque lee lo suyo.** El circuito diagnóstico no sale del resumen
 *    clínico: es otra lectura y otro módulo, y el bloque la hace suya para que
 *    el expediente no tenga que cambiar.
 * 2. **El alta pega contra `clinical`.** Una orden diagnóstica es una orden de
 *    servicio con categoría; sus invariantes no viven en `diagnostics`.
 * 3. **La categoría viaja siempre y sale del estudio.** No se elige aparte: es
 *    lo que hace que el pedido vuelva a aparecer en el histórico, y un segundo
 *    selector dejaba pedir un hemograma como imagen.
 * 4. **«Con resultado» quiere decir liberado, no redactado.** Un informe con
 *    versión vigente pero sin liberar es un borrador, y mostrarlo como
 *    resultado sería mostrar un borrador como diagnóstico.
 * 5. **Después de pedir se relee.** El bloque no pinta lo que el servidor no le
 *    confirmó.
 */

const CATALOGO = {
  code: 'service-request-code',
  name: 'Estudio',
  definitionId: 'def-1',
  valueSetId: 'vs-1',
  allowCustomValue: false,
  options: [
    { conceptId: 'code-hemograma', code: 'LAB_CBC', display: 'Hemograma', ordinal: 1 },
    { conceptId: 'code-rx', code: 'IMG_RX_TORAX', display: 'Rx tórax', ordinal: 2 },
    { conceptId: 'code-ecg', code: 'CAR_ECG', display: 'ECG', ordinal: 3 },
    { conceptId: 'code-raro', code: 'ESTUDIO_NUEVO', display: 'Nuevo', ordinal: 4 },
    { conceptId: 'proc-colonoscopia', code: 'PRO_COLONOSCOPIA', display: 'Colonoscopía', ordinal: 5 },
    { conceptId: 'proc-endoscopia', code: 'PRO_ENDOSCOPIA_ALTA', display: 'Endoscopía', ordinal: 6 },
  ],
};

/** Las categorías que publica el catálogo: el tipo de la orden viaja como su concepto. */
const CATEGORIAS = {
  ...CATALOGO,
  code: 'service-request-category',
  options: [
    { conceptId: 'cat-lab', code: 'SR_LAB', display: 'Lab', ordinal: 1 },
    { conceptId: 'cat-img', code: 'SR_IMAGING', display: 'Img', ordinal: 2 },
  ],
};

const CIRCUITO_VACIO = {
  patientProfileId: 'p-1',
  orders: [],
  reports: [],
  limit: 25,
  truncated: [],
};

const ORDEN = {
  id: 'sr-1',
  patientProfileId: 'p-1',
  encounterId: 'enc-1',
  codeConceptId: 'code-hemograma',
  categoryConceptId: 'cat-lab',
  statusConceptId: 'st-activa',
  createdAt: '2026-08-14T10:00:00.000Z',
};

/** Un informe **liberado**: tiene versión liberada, no sólo vigente. */
const INFORME_LIBERADO = {
  id: 'dr-1',
  patientProfileId: 'p-1',
  serviceRequestId: 'sr-1',
  codeConceptId: 'code-hemograma',
  lifecycleStatusConceptId: 'st-final',
  currentVersionId: 'v-1',
  currentReleasedVersionId: 'v-1',
  createdAt: '2026-08-14T11:00:00.000Z',
};

/** El mismo informe **sin liberar**: redactado y todavía no validado. */
const INFORME_BORRADOR = {
  ...INFORME_LIBERADO,
  currentReleasedVersionId: undefined,
};

/**
 * El estudio previo, tal como lo manda el servidor (antiduplicación de
 * estudios, v4.2.17, T-26): forma de transporte, con `null` en vez de
 * ausente y `performedAt` como texto, no `Date`.
 */
const PREVIOUS_STUDY_WIRE = {
  reportId: 'dr-previo',
  serviceRequestId: null,
  studyName: 'Hemograma completo',
  providerName: 'Laboratorio Central',
  performedAt: '2026-08-01T10:00:00.000Z',
  daysAgo: 13,
  resultsAvailable: true,
  conclusionText: null,
  reportDownloadUrl: null,
  sameOrganization: true,
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

describe('AnalysisOrderBlock', () => {
  let fixture: ComponentFixture<AnalysisOrderBlock>;
  let componente: AnalysisOrderBlock;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'], hpid: 'doc-1' }),
      refreshToken: 'r-1',
    });

    fixture = TestBed.createComponent(AnalysisOrderBlock);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    fixture.componentRef.setInput('encounterId', 'enc-1');
  });

  /**
   * Responde **todos** los catálogos pendientes, no sólo el del estudio.
   *
   * Son tres targets distintos y se piden a la vez: el bloque pregunta por el
   * suyo al construirse, y el formulario —que se pinta mientras la respuesta
   * viaja, porque `catalogoListo` arranca en `null`— monta los tres selectores.
   * Esperar uno solo acá fallaría por los otros dos, que no tienen nada de malo.
   *
   * @param estudio - Si el catálogo del estudio responde o no tiene binding.
   */
  function responderCatalogos(estudio: 'ok' | 'sin-binding' = 'ok'): void {
    for (const req of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      if (req.request.params.get('target') === TARGET_ESTUDIO && estudio === 'sin-binding') {
        // Sin binding declarado la API responde 404: es un dato que falta en el
        // catálogo, no un fallo transitorio.
        req.flush({ message: 'sin binding' }, { status: 404, statusText: 'Not Found' });
        continue;
      }
      req.flush(req.request.params.get('target') === TARGET_CATEGORIA ? CATEGORIAS : CATALOGO);
    }
  }

  /** Responde la lectura del circuito y la de etiquetas que la sigue. */
  function responderCircuito(circuito: object = CIRCUITO_VACIO): void {
    http.expectOne((r) => r.url === '/diagnostics/patients/p-1/orders').flush(circuito);

    // Las etiquetas sólo se piden si hay conceptos que traducir.
    for (const req of http.match((r) => r.url === '/terminology/concepts')) {
      req.flush({ items: [], total: 0 });
    }
  }

  /**
   * Responde `POST /clinical/service-requests/duplicate-check`.
   *
   * Sin duplicado, sólo `isDuplicate: false` importa —el resto no se lee—.
   * Con duplicado, siempre el mismo estudio previo: es el que las pruebas de
   * reutilizar/repetir esperan de vuelta en el alta.
   */
  function responderChequeo(isDuplicate: boolean): void {
    const req = http.expectOne((r) => r.url === '/clinical/service-requests/duplicate-check');
    expect(req.request.method).toBe('POST');
    req.flush(
      isDuplicate
        ? {
            isDuplicate: true,
            previousStudy: PREVIOUS_STUDY_WIRE,
            warningMessage: 'Ya se hizo este estudio hace poco.',
            requiresJustification: true,
            pendingReport: false,
            windowDays: 30,
          }
        : {
            isDuplicate: false,
            previousStudy: null,
            warningMessage: null,
            requiresJustification: false,
            pendingReport: false,
            windowDays: 30,
          },
    );
  }

  afterEach(() => {
    // Los selectores que se montaron al final de la prueba dejan su pedido de
    // catálogo abierto; drenarlos deja que `verify()` hable de lo que importa.
    responderCatalogos();
    http.verify();
  });

  it('lee el circuito del paciente al arrancar: es otra lectura que el resumen clínico', () => {
    fixture.detectChanges();
    responderCatalogos();

    const req = http.expectOne((r) => r.url === '/diagnostics/patients/p-1/orders');
    expect(req.request.params.get('limit')).toBe('25');

    req.flush(CIRCUITO_VACIO);
  });

  it('sin estudios lo dice, en vez de mostrar una lista vacía', () => {
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito();
    fixture.detectChanges();

    const vacio = fixture.nativeElement.querySelector('[data-testid="estudios-vacio"]');
    expect(vacio).not.toBeNull();
    expect(componente['estudios']().length).toBe(0);
  });

  it('un informe liberado marca su orden con resultado', () => {
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito({
      ...CIRCUITO_VACIO,
      orders: [ORDEN],
      reports: [INFORME_LIBERADO],
    });
    fixture.detectChanges();

    const estudios = componente['estudios']();
    expect(estudios.length).toBe(1);
    expect(estudios[0].conResultado).toBe(true);
  });

  /**
   * La distinción que hace que la pantalla no mienta: `currentVersionId` dice
   * que hay algo redactado, `currentReleasedVersionId` que alguien lo validó.
   */
  it('un informe sin liberar NO cuenta como resultado: es un borrador', () => {
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito({
      ...CIRCUITO_VACIO,
      orders: [ORDEN],
      reports: [INFORME_BORRADOR],
    });
    fixture.detectChanges();

    expect(componente['estudios']()[0].conResultado).toBe(false);
  });

  /**
   * Un resultado que llega en papel de un laboratorio externo no tiene orden en
   * el sistema. Esconderlo sería perder el dato clínico por prolijidad.
   */
  it('muestra los informes que no cuelgan de ninguna orden', () => {
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito({
      ...CIRCUITO_VACIO,
      orders: [],
      reports: [{ ...INFORME_LIBERADO, serviceRequestId: undefined }],
    });
    fixture.detectChanges();

    expect(componente['informesSueltos']().length).toBe(1);
  });

  it('avisa cuando el histórico quedó recortado por el tope', () => {
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito({ ...CIRCUITO_VACIO, orders: [ORDEN], truncated: ['orders'] });
    fixture.detectChanges();

    expect(componente['recortado']()).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[data-testid="estudios-recortado"]'),
    ).not.toBeNull();
  });

  it('sin encuentro abierto no ofrece el formulario, pero sí el histórico', () => {
    fixture.componentRef.setInput('encounterId', null);
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito();
    fixture.detectChanges();

    expect(componente['hayEncuentro']()).toBe(false);
    expect(componente['puedePedir']()).toBe(false);
    // El histórico se ve igual: mirar qué se pidió antes no requiere atender.
    expect(fixture.nativeElement.querySelector('[data-testid="estudios-vacio"]')).not.toBeNull();
  });

  it('sin catálogo declarado no ofrece el formulario y lo dice', () => {
    fixture.detectChanges();
    responderCatalogos('sin-binding');
    responderCircuito();
    fixture.detectChanges();

    expect(componente['catalogoListo']()).toBe(false);
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  /** El tipo no se elige: sale del estudio, y sin estudio no hay pedido. */
  it('no ofrece un selector de tipo: lo deduce del estudio', () => {
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito();
    fixture.detectChanges();

    const etiquetas = [...fixture.nativeElement.querySelectorAll('label')].map((l: Element) =>
      l.textContent?.trim(),
    );
    expect(etiquetas.some((t: string | undefined) => t?.startsWith('Tipo'))).toBe(false);
    expect(componente['puedePedir']()).toBe(false);

    componente['estudio'].set('code-hemograma');
    expect(componente['tipo'].label()).toBe('Laboratorio');
    expect(componente['puedePedir']()).toBe(true);

    componente['estudio'].set('code-rx');
    expect(componente['tipo'].label()).toBe('Imagenología');
    componente['estudio'].set('code-raro');
    expect(componente['tipo'].label()).toContain('Otro estudio');
  });

  /** Todo viaja como el concepto publicado: en `test` el alta no acepta `category`. */
  it.each([
    ['code-hemograma', 'cat-lab'],
    ['code-rx', 'cat-img'],
  ])('el estudio %s manda la categoría %s', (estudio, esperado) => {
    fixture.detectChanges();
    for (const req of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      req.flush(
        req.request.params.get('target') === TARGET_CATEGORIA
          ? {
              ...CATALOGO,
              options: [
                { conceptId: 'cat-lab', code: 'SR_LAB', display: 'Lab', ordinal: 1 },
                { conceptId: 'cat-img', code: 'SR_IMAGING', display: 'Img', ordinal: 2 },
              ],
            }
          : CATALOGO,
      );
    }
    responderCircuito();

    componente['estudio'].set(estudio);
    componente['pedir']();
    responderChequeo(false);

    const req = http.expectOne((r) => r.url === '/clinical/service-requests');
    expect(req.request.body.categoryConceptId).toBe(esperado);
    expect('category' in req.request.body).toBe(false);
  });

  it('un estudio sin categoría publicada no se puede pedir', () => {
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito();

    componente['estudio'].set('code-raro');
    expect(componente['tipo'].label()).toContain('Otro estudio');
    expect(componente['puedePedir']()).toBe(false);
  });

  it('un estudio cardiológico manda el concepto de la categoría publicada', () => {
    fixture.detectChanges();
    for (const req of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      req.flush(
        req.request.params.get('target') === TARGET_CATEGORIA
          ? { ...CATALOGO, options: [{ conceptId: 'cat-cardio', code: 'SR_CARDIO', display: 'Cardio', ordinal: 1 }] }
          : CATALOGO,
      );
    }
    responderCircuito();

    componente['estudio'].set('code-ecg');
    expect(componente['tipo'].label()).toBe('Estudio cardiológico');
    componente['pedir']();
    responderChequeo(false);

    const req = http.expectOne((r) => r.url === '/clinical/service-requests');
    expect(req.request.body.categoryConceptId).toBe('cat-cardio');
    expect('category' in req.request.body).toBe(false);
  });

  it('el alta conserva las invariantes de clinical y emite cambio solo tras guardarse', () => {
    const changed = vi.fn();
    componente.cambio.subscribe(changed);
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito();

    componente['estudio'].set('code-hemograma');
    componente['pedir']();

    // Primero pregunta si es un duplicado; sin uno, el alta sigue directo.
    responderChequeo(false);

    const req = http.expectOne((r) => r.url === '/clinical/service-requests');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.codeConceptId).toBe('code-hemograma');
    expect(req.request.body.categoryConceptId).toBe('cat-lab');
    expect(req.request.body.encounterId).toBe('enc-1');
    expect(req.request.body.custodianTenantId).toBe('t-1');
    // La prioridad no se eligió: la clave se omite, no viaja en null.
    expect('priorityConceptId' in req.request.body).toBe(false);
    expect(changed).not.toHaveBeenCalled();

    req.flush({
      id: 'sr-1',
      patientProfileId: 'p-1',
      status: 'st-activa',
      intent: 'st-orden',
      createdAt: '2026-08-14T10:00:00.000Z',
    });

    // Y se relee: no se pinta lo que el servidor no confirmó.
    responderCircuito({ ...CIRCUITO_VACIO, orders: [ORDEN] });
    fixture.detectChanges();
    expect(componente['estudios']().length).toBe(1);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('A3: sale de un formulario libre firmado: manda basedOnNoteIds y no formInstanceId', () => {
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito();

    componente['estudio'].set('code-hemograma');
    componente['notaDelFormularioLibre'].set('nota-libre-1');
    componente['pedir']();
    responderChequeo(false);

    const req = http.expectOne((r) => r.url === '/clinical/service-requests');
    expect(req.request.body.basedOnNoteIds).toEqual(['nota-libre-1']);
    expect('formInstanceId' in req.request.body).toBe(false);
    req.flush({
      id: 'sr-1',
      patientProfileId: 'p-1',
      status: 'st-activa',
      intent: 'st-orden',
      createdAt: '2026-08-14T10:00:00.000Z',
    });
    responderCircuito({ ...CIRCUITO_VACIO, orders: [ORDEN] });
  });

  /**
   * Antiduplicación de estudios (v4.2.17, T-26). Cuatro casos, sobre el mismo
   * `pedir()` de arriba: el chequeo encuentra un duplicado y abre el diálogo
   * en vez de mandar el alta; reutilizar y repetir mandan la decisión que
   * corresponde; el chequeo fallando no manda nada (fail closed); y la
   * carrera entre el chequeo y el alta reabre el diálogo con lo que vino en
   * el propio 422.
   */
  describe('antiduplicación de estudios', () => {
    beforeEach(() => {
      fixture.detectChanges();
      responderCatalogos();
      responderCircuito();
      componente['estudio'].set('code-hemograma');
    });

    it('con duplicado abre el diálogo y no manda el alta', () => {
      componente['pedir']();
      responderChequeo(true);
      fixture.detectChanges();

      expect(componente['duplicateCheck']()).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="duplicate-study-warning-dialog"]'),
      ).not.toBeNull();
      http.expectNone((r) => r.url === '/clinical/service-requests');
    });

    it('reutilizar manda `reusePreviousReport` y el informe previo', () => {
      componente['pedir']();
      responderChequeo(true);
      fixture.detectChanges();

      componente['confirmReuse']();

      const req = http.expectOne((r) => r.url === '/clinical/service-requests');
      expect(req.request.body.previousDiagnosticReportId).toBe('dr-previo');
      expect(req.request.body.reusePreviousReport).toBe(true);
      expect('duplicateOverrideReason' in req.request.body).toBe(false);
      req.flush({
        id: 'sr-2',
        patientProfileId: 'p-1',
        status: 'st-satisfecha',
        intent: 'st-orden',
        createdAt: '2026-08-14T10:00:00.000Z',
      });
      responderCircuito();
    });

    it('repetir manda la justificación', () => {
      componente['pedir']();
      responderChequeo(true);
      fixture.detectChanges();

      componente['confirmRepeat']('Sospecha de anemia aguda, hay que repetirlo hoy mismo.');

      const req = http.expectOne((r) => r.url === '/clinical/service-requests');
      expect(req.request.body.previousDiagnosticReportId).toBe('dr-previo');
      expect(req.request.body.duplicateOverrideReason).toBe(
        'Sospecha de anemia aguda, hay que repetirlo hoy mismo.',
      );
      expect('reusePreviousReport' in req.request.body).toBe(false);
      req.flush({
        id: 'sr-3',
        patientProfileId: 'p-1',
        status: 'st-activa',
        intent: 'st-orden',
        createdAt: '2026-08-14T10:00:00.000Z',
      });
      responderCircuito();
    });

    it('repetir sobre una orden activa sin informe manda sólo la justificación (la API enlaza la orden)', () => {
      componente['pedir']();
      const chequeo = http.expectOne((r) => r.url === '/clinical/service-requests/duplicate-check');
      chequeo.flush({
        isDuplicate: true,
        previousStudy: { ...PREVIOUS_STUDY_WIRE, reportId: null, serviceRequestId: 'sr-previa' },
        warningMessage: 'Hay una orden activa de este estudio, sin informe.',
        requiresJustification: true,
        pendingReport: true,
        windowDays: 30,
      });
      fixture.detectChanges();

      componente['confirmRepeat']('Muestra anterior hemolizada, hay que repetirla hoy.');

      const req = http.expectOne((r) => r.url === '/clinical/service-requests');
      expect('previousDiagnosticReportId' in req.request.body).toBe(false);
      expect(req.request.body.duplicateOverrideReason).toBe(
        'Muestra anterior hemolizada, hay que repetirla hoy.',
      );
      req.flush({
        id: 'sr-4',
        patientProfileId: 'p-1',
        status: 'st-activa',
        intent: 'st-orden',
        createdAt: '2026-08-14T10:00:00.000Z',
        previousServiceRequestId: 'sr-previa',
        duplicateOverrideReason: 'Muestra anterior hemolizada, hay que repetirla hoy.',
      });
      responderCircuito();
    });

    it('el histórico muestra la justificación guardada de una orden repetida sobre otra orden', () => {
      componente['pedir']();
      responderChequeo(false);
      http.expectOne((r) => r.url === '/clinical/service-requests').flush({
        id: 'sr-5',
        patientProfileId: 'p-1',
        status: 'st-activa',
        intent: 'st-orden',
        createdAt: '2026-08-14T10:00:00.000Z',
      });
      responderCircuito({
        ...CIRCUITO_VACIO,
        orders: [
          {
            ...ORDEN,
            id: 'sr-5',
            previousServiceRequestId: 'sr-previa',
            duplicateOverrideReason: 'Muestra anterior hemolizada, hay que repetirla hoy.',
            previousDiagnosticReportId: null,
          },
        ],
      });
      fixture.detectChanges();

      expect(componente['estudios']()[0].duplicado).toBe('repeated');
      const texto = fixture.nativeElement.querySelector('[data-testid="estudios-justificacion"]');
      expect(texto?.textContent).toContain('Muestra anterior hemolizada');
    });

    it('no emite cambio si el servidor rechaza el alta', () => {
      const changed = vi.fn();
      componente.cambio.subscribe(changed);
      componente['pedir']();
      responderChequeo(false);
      http.expectOne((r) => r.url === '/clinical/service-requests')
        .flush({ message: 'Fallo sintético' }, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(componente['errorDelPedido']()).not.toBeNull();
      expect(changed).not.toHaveBeenCalled();
    });

    it('si el chequeo falla, no manda el alta (fail closed)', () => {
      componente['pedir']();

      http
        .expectOne((r) => r.url === '/clinical/service-requests/duplicate-check')
        .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect(componente['duplicateCheck']()).toBeNull();
      expect(componente['errorDelPedido']()).not.toBeNull();
      http.expectNone((r) => r.url === '/clinical/service-requests');
    });

    it('la carrera entre el chequeo y el alta reabre el diálogo con el 422', () => {
      componente['pedir']();
      responderChequeo(false);

      const alta = http.expectOne((r) => r.url === '/clinical/service-requests');
      alta.flush(
        {
          code: 'PRECONDITION_FAILED',
          message: 'Ya existe un estudio igual reciente.',
          timestamp: '2026-08-14T10:00:00.000Z',
          path: '/clinical/service-requests',
          details: {
            reason: 'DUPLICATE_STUDY_DETECTED',
            previousStudy: PREVIOUS_STUDY_WIRE,
          },
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      fixture.detectChanges();

      expect(componente['duplicateCheck']()?.previousStudy?.reportId).toBe('dr-previo');
    });
  });

  it('el fallo del histórico no impide pedir', () => {
    fixture.detectChanges();
    responderCatalogos();
    http
      .expectOne((r) => r.url === '/diagnostics/patients/p-1/orders')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(componente['errorDelHistorico']()).not.toBeNull();

    componente['estudio'].set('code-hemograma');
    expect(componente['puedePedir']()).toBe(true);
  });
  /**
   * Quién realiza el procedimiento. El selector sólo existe en una orden
   * de procedimiento, y lo que viaja del ejecutor depende del modo elegido: con
   * «Que elija el paciente» no viaja ningún médico ni sede, y en ningún modo
   * viaja `performerTenantId` (la recomendación no le da al centro la orden).
   */
  describe('selector de ejecutor', () => {
    const PROCEDIMIENTO = 'proc-colonoscopia';
    const SEDE_PROPIA = { practiceSiteId: 's-1', name: 'Centro Norte', addressText: 'Av. 1' };
    const SEDE_AJENA = { practiceSiteId: 's-2', name: 'Centro Sur', addressText: null };
    const selector = (): Element | null =>
      fixture.nativeElement.querySelector('[data-testid="performer-selector"]');

    /** Responde las categorías (con la de procedimiento bajo `codigo`) y el resto de los catálogos. */
    function responderCategorias(codigo: string): void {
      for (const req of http.match((r) => r.url === '/system-context/dynamic-enums')) {
        req.flush(
          req.request.params.get('target') === TARGET_CATEGORIA
            ? {
                ...CATALOGO,
                code: 'service-request-category',
                options: [
                  { conceptId: 'cat-lab', code: 'SR_LAB', display: 'Lab', ordinal: 1 },
                  { conceptId: 'cat-proc', code: codigo, display: 'Procedure', ordinal: 2 },
                ],
              }
            : CATALOGO,
        );
      }
    }

    /** Responde la expansión del conjunto de modos, las vinculaciones y la búsqueda. */
    function responderSedes(): void {
      http
        .expectOne((r) => r.url === '/terminology/value-sets')
        .flush({
          items: [{ id: 'vs-perf', internalCode: 'service-request-performer-selection', name: 'x', description: '', defaultVersionId: 'v', memberCount: 3 }],
          count: 1,
          limit: 50,
          nextCursor: null,
        });
      http.expectOne((r) => r.url === '/terminology/value-sets/vs-perf/$expand').flush({
        valueSetId: 'vs-perf',
        valueSetVersionId: 'v',
        version: '1',
        count: 3,
        limit: 200,
        nextCursor: null,
        items: [
          { conceptId: 'c-self', code: 'SR_PERF_SELF', display: 'a', codeSystemVersionId: 'x' },
          { conceptId: 'c-org', code: 'SR_PERF_ORGANIZATION', display: 'b', codeSystemVersionId: 'x' },
          { conceptId: 'c-pat', code: 'SR_PERF_PATIENT_CHOICE', display: 'c', codeSystemVersionId: 'x' },
        ],
      });
      http.expectOne('/practitioners/me/role-assignments').flush([
        { id: 'r-1', practiceSiteId: 's-1', serviceConceptId: PROCEDIMIENTO, statusCode: 'ROLE_ASG_ACTIVE' },
      ]);
      const busqueda = http.expectOne((r) => r.url === '/medical-centers/search');
      expect(busqueda.request.params.get('procedureConceptIds')).toBe(PROCEDIMIENTO);
      busqueda.flush({ items: [SEDE_AJENA, SEDE_PROPIA], total: 2, limit: 20, offset: 0 });
    }

    /** Abre el formulario con un procedimiento o un laboratorio elegido: el tipo sale del estudio. */
    function abrir(categoria: 'cat-lab' | 'cat-proc', codigoProcedimiento = 'SR_PROCEDURE'): void {
      fixture.detectChanges();
      responderCategorias(codigoProcedimiento);
      responderCircuito();
      fixture.detectChanges();
      componente['estudio'].set(categoria === 'cat-proc' ? PROCEDIMIENTO : 'code-hemograma');
      fixture.detectChanges();
    }

    /** Pide, deja pasar el chequeo y devuelve el cuerpo del alta. */
    function pedirYLeerCuerpo(): { body: Record<string, unknown>; alta: ReturnType<HttpTestingController['expectOne']> } {
      componente['pedir']();
      responderChequeo(false);
      const alta = http.expectOne((r) => r.url === '/clinical/service-requests');
      return { body: alta.request.body as Record<string, unknown>, alta };
    }

    it.each(['SRQ-PROCEDURE', 'SR_PROCEDURE', 'clinical:SERVICE_REQUEST_CATEGORY_PROCEDURE'])(
      'con la categoría de código %s se monta el selector y se leen las sedes',
      (codigo) => {
        abrir('cat-proc', codigo);
        expect(selector()).not.toBeNull();
        responderSedes();
      },
    );

    it('con laboratorio no se monta el selector ni se lee nada de sedes', () => {
      abrir('cat-lab');

      expect(selector()).toBeNull();
      http.expectNone((r) => r.url === '/medical-centers/search');
      http.expectNone('/practitioners/me/role-assignments');
    });

    it('«Que elija el paciente» viene marcada y no manda médico ni sede', () => {
      abrir('cat-proc');
      responderSedes();
      fixture.detectChanges();

      expect(componente['performer'].choice()).toEqual({ mode: 'PATIENT_CHOICE', siteId: null });
      expect(componente['puedePedir']()).toBe(true);
      const { body } = pedirYLeerCuerpo();
      expect(body['performerSelectionConceptId']).toBe('c-pat');
      expect('performerPractitionerProfileId' in body).toBe(false);
      expect('suggestedPracticeSiteId' in body).toBe(false);
      expect('performerTenantId' in body).toBe(false);
    });

    it('«Lo hago yo» manda el concepto SELF, el médico que pide y la sede', () => {
      abrir('cat-proc');
      responderSedes();
      componente['performer'].choice.set({ mode: 'SELF', siteId: 's-1' });
      fixture.detectChanges();

      const { body } = pedirYLeerCuerpo();
      expect(body['performerSelectionConceptId']).toBe('c-self');
      expect(body['performerPractitionerProfileId']).toBe('doc-1');
      expect(body['suggestedPracticeSiteId']).toBe('s-1');
      expect('performerTenantId' in body).toBe(false);
    });

    it('«En este centro» manda el concepto ORGANIZATION y la sede, sin médico', () => {
      abrir('cat-proc');
      responderSedes();
      componente['performer'].choice.set({ mode: 'ORGANIZATION', siteId: 's-2' });
      fixture.detectChanges();

      const { body } = pedirYLeerCuerpo();
      expect(body['performerSelectionConceptId']).toBe('c-org');
      expect(body['suggestedPracticeSiteId']).toBe('s-2');
      expect('performerPractitionerProfileId' in body).toBe(false);
      expect('performerTenantId' in body).toBe(false);
    });

    it('una orden de laboratorio no lleva ninguna clave de ejecutor', () => {
      abrir('cat-lab');

      const { body } = pedirYLeerCuerpo();
      for (const clave of ['performerSelectionConceptId', 'performerPractitionerProfileId', 'suggestedPracticeSiteId', 'performerTenantId']) {
        expect(clave in body, clave).toBe(false);
      }
    });

    it('no deja pedir con un modo de sede sin sede elegida, y nada se manda', () => {
      abrir('cat-proc');
      responderSedes();
      componente['performer'].choice.set({ mode: 'ORGANIZATION', siteId: null });
      fixture.detectChanges();

      expect(componente['puedePedir']()).toBe(false);
      componente['pedir']();
      http.expectNone((r) => r.url === '/clinical/service-requests/duplicate-check');
    });

    it('si las sedes no se pueden leer lo dice y no inventa sedes; sigue pudiendo pedir sin recomendar', () => {
      abrir('cat-proc');
      http.expectOne((r) => r.url === '/terminology/value-sets').flush({ items: [], count: 0, limit: 50, nextCursor: null });
      http.match(() => true);
      fixture.detectChanges();

      expect(componente['performer'].sites().error).not.toBeNull();
      expect(componente['performer'].sites().own).toEqual([]);
      expect(componente['performer'].sites().center).toEqual([]);
      const { body } = pedirYLeerCuerpo();
      expect('suggestedPracticeSiteId' in body).toBe(false);
    });

    it('un 422 de la API se muestra y el formulario conserva lo elegido', () => {
      abrir('cat-proc');
      responderSedes();
      componente['performer'].choice.set({ mode: 'SELF', siteId: 's-1' });
      fixture.detectChanges();

      const { alta } = pedirYLeerCuerpo();
      alta.flush(
        {
          code: 'PRECONDITION_FAILED',
          message: 'La sede no ofrece el procedimiento con precio.',
          timestamp: '2026-08-14T10:00:00.000Z',
          path: '/clinical/service-requests',
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      fixture.detectChanges();

      expect(componente['errorDelPedido']()).toBe('La sede no ofrece el procedimiento con precio.');
      expect(componente['performer'].choice()).toEqual({ mode: 'SELF', siteId: 's-1' });
      expect(componente['estudio']()).toBe(PROCEDIMIENTO);
      expect(selector()).not.toBeNull();
    });

    it('cambiar de procedimiento descarta la recomendación anterior y relee las sedes', () => {
      abrir('cat-proc');
      responderSedes();
      componente['performer'].choice.set({ mode: 'ORGANIZATION', siteId: 's-2' });
      fixture.detectChanges();

      componente['estudio'].set('proc-endoscopia');
      fixture.detectChanges();

      expect(componente['performer'].choice()).toEqual({ mode: 'PATIENT_CHOICE', siteId: null });
      const busqueda = http.expectOne((r) => r.url === '/medical-centers/search');
      expect(busqueda.request.params.get('procedureConceptIds')).toBe('proc-endoscopia');
      http.expectOne('/practitioners/me/role-assignments');
    });

    it('tras pedir, el siguiente pedido arranca otra vez en «Que elija el paciente»', () => {
      abrir('cat-proc');
      responderSedes();
      componente['performer'].choice.set({ mode: 'SELF', siteId: 's-1' });

      const { alta } = pedirYLeerCuerpo();
      alta.flush({ id: 'sr-1', patientProfileId: 'p-1', status: 's', intent: 'i', createdAt: '2026-08-14T10:00:00.000Z' });
      responderCircuito();

      expect(componente['performer'].choice()).toEqual({ mode: 'PATIENT_CHOICE', siteId: null });
    });
  });
});

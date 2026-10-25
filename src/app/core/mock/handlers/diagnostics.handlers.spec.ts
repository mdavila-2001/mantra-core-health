import { HttpHeaders } from '@angular/common/http';

import { orderList, type SimulatedOrder } from '../fixtures/clinic';
import { STATUS, ESTUDIO, ORDER_CATEGORY } from '../fixtures/concepts';
import { PERFORMER_MODE } from '../fixtures/performer-concepts';
import { MEDICAL, PACIENTE, professionalById } from '../fixtures/people';
import { MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { uuid } from '../mock-store';
import { registrarDiagnostico } from './diagnostics.handlers';

/**
 * `POST /clinical/service-requests/duplicate-check` (antiduplicación de
 * estudios, v4.2.17, T-26, subtarea 3.2). Lo que estas pruebas fijan:
 *
 * 1. Un estudio con informe liberado reciente del mismo paciente es
 *    duplicado; uno sin informe previo no lo es.
 * 2. La conclusión sólo viaja cuando quien pide comparte organización con el
 *    informe — el resto de los datos (fecha, prestador, días) siempre va.
 * 3. La ventana es configurable y el default es 30 días.
 *
 * `PACIENTE` ya trae, por construcción de la bóveda de fixtures, un Hemograma
 * liberado por `TENANT_LABORATORIO` (otra organización que la de `medica`) y
 * un Perfil lipídico liberado por `TENANT_CLINICA` (la organización de
 * `medica`) — el caso cruzado y el intra-organización, sin sembrar nada
 * nuevo. Ver `patient-coverage-copays.spec.ts`, que exige exactamente 4
 * órdenes para este mismo paciente.
 */
describe('POST /clinical/service-requests/duplicate-check', () => {
  const router = new MockRouter();
  const medica = buscarUsuario('medica')!;

  registrarDiagnostico(router);

  function call<T>(method: MockMethod, path: string, body: unknown, user: MockUser | null = medica): T {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user,
    }) as T;
  }

  interface ResultadoWire {
    readonly isDuplicate: boolean;
    readonly previousStudy: {
      readonly reportId: string;
      readonly studyName: string;
      readonly providerName: string;
      readonly daysAgo: number;
      readonly resultsAvailable: boolean;
      readonly conclusionText: string | null;
      readonly sameOrganization: boolean;
    } | null;
    readonly requiresJustification: boolean;
    readonly pendingReport: boolean;
    readonly windowDays: number;
  }

  it('diagnostics registra el alta trasladada sin depender de registrarClinica', () => {
    expect(router.rutas().filter(({ method, pattern }) =>
      method === 'POST' && pattern === '/clinical/service-requests',
    )).toEqual([{ method: 'POST', pattern: '/clinical/service-requests' }]);
  });

  it('un estudio ya liberado hace poco es duplicado', () => {
    const resultado = call<ResultadoWire>('POST', '/clinical/service-requests/duplicate-check', {
      patientProfileId: PACIENTE.id,
      codeConceptId: ESTUDIO['STUDY-HEMOGRAMA'],
      encounterId: 'enc-1',
    });

    expect(resultado.isDuplicate).toBe(true);
    expect(resultado.previousStudy).not.toBeNull();
    expect(resultado.previousStudy?.studyName).toBe('Hemograma completo');
    expect(resultado.previousStudy?.resultsAvailable).toBe(true);
    expect(resultado.previousStudy?.daysAgo).toBeGreaterThanOrEqual(0);
    expect(resultado.previousStudy?.daysAgo).toBeLessThanOrEqual(5);
    expect(resultado.requiresJustification).toBe(true);
    expect(resultado.windowDays).toBe(30);
  });

  it('cruzando organizaciones, no manda la conclusión', () => {
    // El Hemograma de PACIENTE lo liberó TENANT_LABORATORIO; los tenants de
    // `medica` son TENANT_CLINICA y TENANT_HOSPITAL — organizaciones
    // distintas.
    const resultado = call<ResultadoWire>('POST', '/clinical/service-requests/duplicate-check', {
      patientProfileId: PACIENTE.id,
      codeConceptId: ESTUDIO['STUDY-HEMOGRAMA'],
      encounterId: 'enc-1',
    });

    expect(resultado.previousStudy?.sameOrganization).toBe(false);
    expect(resultado.previousStudy?.conclusionText).toBeNull();
  });

  it('en la misma organización, sí manda la conclusión', () => {
    // El Perfil lipídico de PACIENTE lo liberó TENANT_CLINICA — la misma
    // organización que `medica`.
    const resultado = call<ResultadoWire>('POST', '/clinical/service-requests/duplicate-check', {
      patientProfileId: PACIENTE.id,
      codeConceptId: ESTUDIO['STUDY-PERFIL-LIPIDICO'],
      encounterId: 'enc-1',
    });

    expect(resultado.previousStudy?.sameOrganization).toBe(true);
    expect(resultado.previousStudy?.conclusionText).not.toBeNull();
  });

  it('sin informe previo del mismo estudio, no hay duplicado', () => {
    const resultado = call<ResultadoWire>('POST', '/clinical/service-requests/duplicate-check', {
      patientProfileId: PACIENTE.id,
      codeConceptId: ESTUDIO['STUDY-TAC-CRANEO'],
      encounterId: 'enc-1',
    });

    expect(resultado.isDuplicate).toBe(false);
    expect(resultado.previousStudy).toBeNull();
    expect(resultado.requiresJustification).toBe(false);
  });

  it('una ventana más angosta que el estudio previo lo deja pasar', () => {
    // El informe está a `iso(-2, 9)`: siempre más de un día atrás, así que
    // una ventana de 0 días nunca lo alcanza — sin depender del momento
    // exacto de la corrida.
    const resultado = call<ResultadoWire>('POST', '/clinical/service-requests/duplicate-check', {
      patientProfileId: PACIENTE.id,
      codeConceptId: ESTUDIO['STUDY-HEMOGRAMA'],
      encounterId: 'enc-1',
      windowDays: 0,
    });

    expect(resultado.isDuplicate).toBe(false);
    expect(resultado.windowDays).toBe(0);
  });
});

/**
 * `GET /diagnostics/patients/:id/imaging-studies` (CL-56).
 *
 * Antes se fabricaba un `studyInstanceUid` para toda orden de RX/ECO/TAC/RMN,
 * estuviera o no completada. Un estudio DICOM sólo existe una vez que el
 * equipo lo produjo (STOW-RS): una orden pendiente no tiene nada que mostrar.
 */
describe('GET /diagnostics/patients/:id/imaging-studies', () => {
  const router = new MockRouter();
  registrarDiagnostico(router);

  function call<T>(path: string): T {
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    return match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(),
      body: undefined,
      headers: new HttpHeaders(),
      user: null,
    }) as T;
  }

  interface EstudioWire {
    readonly serviceRequestId: string;
    readonly statusConceptId: string;
    readonly studyInstanceUid: string;
  }

  const IMAGENOLOGIA = [
    ESTUDIO['STUDY-ECO-ABD']!,
    ESTUDIO['STUDY-RX-TORAX']!,
    ESTUDIO['STUDY-TAC-CRANEO']!,
    ESTUDIO['STUDY-RMN-RODILLA']!,
  ];

  it('aceptado: una orden de imagen completada trae su estudio', () => {
    // El fixture sólo siembra RX/ECO/TAC/RMN en estado PENDIENTE (la orden que
    // el caso "límite" verifica); se agrega una completada para probar el
    // camino contrario sin tocar las demás pruebas del corpus.
    const completada = orderList.agregar({
      id: 'orden-imagen-completada-test',
      patientProfileId: PACIENTE.id,
      codeConceptId: ESTUDIO['STUDY-RX-TORAX']!,
      categoryConceptId: ESTUDIO['STUDY-RX-TORAX']!,
      priorityConceptId: ESTUDIO['STUDY-RX-TORAX']!,
      statusConceptId: STATUS['ST-COMPLETED']!,
      requesterProfileId: MEDICAL.id,
      reasonText: 'Control',
      createdAt: '2026-01-01T00:00:00.000Z',
    } satisfies SimulatedOrder);

    const items = call<EstudioWire[]>(`/diagnostics/patients/${PACIENTE.id}/imaging-studies`);
    const encontrado = items.find((i) => i.serviceRequestId === completada.id);
    expect(encontrado).toBeDefined();
    expect(encontrado?.studyInstanceUid).toMatch(/^1\.2\.826\.0\.1\./);
  });

  it('límite: una orden de imagen pendiente no aparece (CL-56)', () => {
    const pendiente = orderList
      .todos()
      .find((o) => o.patientProfileId === PACIENTE.id && o.statusConceptId !== STATUS['ST-COMPLETED'] && IMAGENOLOGIA.includes(o.codeConceptId));
    expect(pendiente).toBeDefined();

    const items = call<EstudioWire[]>(`/diagnostics/patients/${PACIENTE.id}/imaging-studies`);
    expect(items.some((i) => i.serviceRequestId === pendiente!.id)).toBe(false);
  });

  it('inválido: un paciente sin órdenes de imagen no trae ningún estudio', () => {
    const items = call<EstudioWire[]>('/diagnostics/patients/paciente-sin-ordenes/imaging-studies');
    expect(items).toEqual([]);
  });
});

/**
 * `POST /diagnostic-results/me/:id/shares` (CL-48/CL-50): el cuerpo trae
 * `practitionerProfileId`, nunca una cuenta tipeada, y el mock resuelve el
 * nombre por el mismo camino que `GET /authz/me/access`.
 */
describe('POST /diagnostic-results/me/:id/shares', () => {
  const router = new MockRouter();
  const paciente = buscarUsuario('paciente')!;
  registrarDiagnostico(router);

  function call<T>(body: unknown): T {
    const match = router.match('POST', '/diagnostic-results/me/report-1/shares');
    if (match === null) throw new Error('No existe la ruta de compartir');
    const respuesta = match.handler({
      method: 'POST',
      path: '/diagnostic-results/me/report-1/shares',
      params: { id: 'report-1' },
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user: paciente,
    }) as { status: number; body: T };
    return respuesta.body;
  }

  interface ShareWire {
    readonly practitionerUserId: string;
    readonly practitionerName?: string;
  }

  it('aceptado: resuelve el nombre del profesional a partir de su perfil', () => {
    const profesional = professionalById(MEDICAL.id)!;
    const compartido = call<ShareWire>({
      practitionerProfileId: profesional.id,
      validUntil: '2030-01-01T00:00:00.000Z',
    });

    expect(compartido.practitionerUserId).toBe(profesional.userId);
    expect(compartido.practitionerName).toBe(profesional.displayName);
  });

  it('límite: un perfil que no existe no rompe, cae al profesional por defecto', () => {
    const compartido = call<ShareWire>({
      practitionerProfileId: 'perfil-inexistente',
      validUntil: '2030-01-01T00:00:00.000Z',
    });

    expect(compartido.practitionerUserId).toBe(MEDICAL.userId);
  });
});

/** `GET /diagnostic-units/search` (CL-45/CL-51): moneda real, nunca "Bs" literal. */
describe('GET /diagnostic-units/search', () => {
  const router = new MockRouter();
  registrarDiagnostico(router);

  interface ItemWire {
    readonly minAmount: number | null;
    readonly minAmountCurrency: string | null;
  }

  it('aceptado: cada centro con tarifa trae su código de moneda', () => {
    const match = router.match('GET', '/diagnostic-units/search');
    if (match === null) throw new Error('No existe el buscador');
    const { items } = match.handler({
      method: 'GET',
      path: '/diagnostic-units/search',
      params: {},
      query: new URLSearchParams(),
      body: undefined,
      headers: new HttpHeaders(),
      user: null,
    }) as { items: ItemWire[] };

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      if (item.minAmount !== null) {
        expect(item.minAmountCurrency).not.toBeNull();
      }
    }
  });
});

/**
 * «Mis órdenes» con procedimientos (CM-10): `GET /diagnostic-results/me/orders`
 * devuelve los cuatro campos del ejecutor y dos órdenes de procedimiento de la
 * paciente de ejemplo, y `POST /clinical/service-requests` guarda los tres que
 * manda el médico.
 */
describe('el ejecutor de la orden en «Mis órdenes» (CM-10)', () => {
  const router = new MockRouter();
  const medica = buscarUsuario('medica')!;
  const patient = buscarUsuario('paciente')!;

  registrarDiagnostico(router);

  interface OrdenPropia {
    readonly id: string;
    readonly codeConceptId: string;
    readonly categoryConceptId: string;
    readonly performerSelectionConceptId?: string;
    readonly performerPractitionerProfileId?: string;
    readonly suggestedPracticeSiteId?: string;
    readonly suggestedPracticeSiteName?: string | null;
  }

  function call<T>(method: MockMethod, path: string, body: unknown, user: MockUser | null): T {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user,
    }) as T;
  }

  const propias = () =>
    call<{ items: readonly OrdenPropia[] }>('GET', '/diagnostic-results/me/orders', undefined, patient).items;

  it('devuelve las dos órdenes de procedimiento de la paciente con sus campos', () => {
    const endoscopia = propias().find((o) => o.id === uuid('order-proc-endoscopia-alta'));
    const colonoscopia = propias().find((o) => o.id === uuid('order-proc-colonoscopia'));

    expect(endoscopia).toMatchObject({
      categoryConceptId: ORDER_CATEGORY['SRQ-PROCEDURE'],
      performerSelectionConceptId: PERFORMER_MODE['SR_PERF_ORGANIZATION'],
      suggestedPracticeSiteId: uuid('site-cm-sur-1'),
      suggestedPracticeSiteName: 'Centro Médico Sur — Sede Central',
    });
    expect(colonoscopia?.performerSelectionConceptId).toBe(PERFORMER_MODE['SR_PERF_PATIENT_CHOICE']);
    expect('suggestedPracticeSiteId' in (colonoscopia ?? {})).toBe(false);
  });

  it('las órdenes de laboratorio e imagen no traen campos de ejecutor', () => {
    const otras = propias().filter((o) => o.categoryConceptId !== ORDER_CATEGORY['SRQ-PROCEDURE']);

    expect(otras.length).toBeGreaterThan(0);
    for (const o of otras) {
      expect('performerSelectionConceptId' in o).toBe(false);
      expect('suggestedPracticeSiteName' in o).toBe(false);
    }
  });

  it('un alta con el modo SELF guarda los tres campos y la lista los devuelve con el nombre de la sede', () => {
    const creada = call<{ status: number; body: { id: string } }>(
      'POST',
      '/clinical/service-requests',
      {
        patientProfileId: PACIENTE.id,
        codeConceptId: uuid('proc-colonoscopia'),
        categoryConceptId: ORDER_CATEGORY['SRQ-PROCEDURE'],
        performerSelectionConceptId: PERFORMER_MODE['SR_PERF_SELF'],
        performerPractitionerProfileId: medica.practitionerProfileId,
        suggestedPracticeSiteId: uuid('site-cm-norte-1'),
      },
      medica,
    );
    expect(creada.status).toBe(201);

    const guardada = propias().find((o) => o.id === creada.body.id);
    expect(guardada).toMatchObject({
      performerSelectionConceptId: PERFORMER_MODE['SR_PERF_SELF'],
      performerPractitionerProfileId: medica.practitionerProfileId,
      suggestedPracticeSiteId: uuid('site-cm-norte-1'),
      suggestedPracticeSiteName: 'Centro Médico Norte — Sede Central',
    });
  });

  it('una sede que el doble no conoce vuelve con nombre null, nunca con el uuid', () => {
    const creada = call<{ body: { id: string } }>(
      'POST',
      '/clinical/service-requests',
      {
        patientProfileId: PACIENTE.id,
        codeConceptId: uuid('proc-endoscopia-alta'),
        categoryConceptId: ORDER_CATEGORY['SRQ-PROCEDURE'],
        performerSelectionConceptId: PERFORMER_MODE['SR_PERF_ORGANIZATION'],
        suggestedPracticeSiteId: uuid('site-desconocida'),
      },
      medica,
    );

    expect(propias().find((o) => o.id === creada.body.id)?.suggestedPracticeSiteName).toBeNull();
  });
});

import { HttpHeaders } from '@angular/common/http';

import type { ClinicalNoteVersionRef } from '../../data-access/chart-notes/chart-notes.types';
import { condiciones, notas, NOTA_TIPO_EVOLUCION, type CondicionSimulada, type NotaSimulada } from '../fixtures/clinica';
import { ESTADO, ESTUDIO, MEDICAMENTO, VERIFICACION_DX } from '../fixtures/conceptos';
import { PACIENTE } from '../fixtures/personas';
import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { Coleccion } from '../mock-store';
import { registrarClinica } from './clinical.handlers';
import { registrarDiagnostico } from './diagnostics.handlers';
import { registerMedicalNotes } from './medical-notes.handlers';

interface OrdenWire {
  readonly id: string;
  readonly codeConceptId: string;
  readonly statusConceptId: string;
  readonly previousDiagnosticReportId?: string;
  readonly duplicateOverrideReason?: string;
}

/**
 * `POST /clinical/service-requests` con la decisión de antiduplicación de
 * estudios (v4.2.17, T-26, subtarea 3.2). Lo que estas pruebas fijan:
 *
 * 1. Sin decisión y con un duplicado real, el alta se rechaza — la UI no es
 *    la barrera, el mock tampoco.
 * 2. Reutilizar guarda el enlace y nace `ST-SATISFIED-BY-PRIOR`, sin
 *    justificación.
 * 3. Repetir guarda el enlace **y** la justificación, y nace activa.
 * 4. Sin duplicado, el alta sigue igual que siempre.
 *
 * El router registra `clinical` **y** `diagnostics`: diagnóstico escribe y
 * relee la orden para comprobar qué quedó guardado; clínica conserva las
 * otras escrituras del encuentro. El alta sólo devuelve `id`/`status`.
 */
describe('POST /clinical/service-requests · antiduplicación de estudios', () => {
  const router = new MockRouter();
  const medica = buscarUsuario('medica')!;

  registrarClinica(router);
  registrarDiagnostico(router);

  function call<T>(method: MockMethod, path: string, body: unknown): T {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user: medica as MockUser,
    }) as T;
  }

  function ordenesDe(patientProfileId: string): readonly OrdenWire[] {
    return call<{ orders: readonly OrdenWire[] }>(
      'GET',
      `/diagnostics/patients/${patientProfileId}/orders`,
      null,
    ).orders;
  }

  it('sin decisión, un estudio duplicado se rechaza con el detalle del informe previo', () => {
    const respuesta = call<MockReply>('POST', '/clinical/service-requests', {
      patientProfileId: PACIENTE.id,
      codeConceptId: ESTUDIO['STUDY-HEMOGRAMA'],
      categoryConceptId: 'cat-lab',
      encounterId: 'enc-1',
    });

    // 422, no 412 (H2.S1.M2, 2026-09-26): la API responde las precondiciones
    // de negocio con `PreconditionFailedException`, que es 422.
    expect(respuesta.status).toBe(422);
    const body = respuesta.body as {
      code: string;
      details: { reason: string; previousStudy: { studyName: string } };
    };
    expect(body.code).toBe('PRECONDITION_FAILED');
    expect(body.details.reason).toBe('DUPLICATE_STUDY_DETECTED');
    expect(body.details.previousStudy.studyName).toBe('Hemograma completo');
  });

  it('reutilizar el informe previo nace satisfecha, con el enlace y sin justificación', () => {
    // El handler envuelve el alta en `{ status: 201, body }` — `status` acá
    // es el código HTTP, no el estado de negocio, que vive en `body.status`.
    const respuesta = call<MockReply>('POST', '/clinical/service-requests', {
      patientProfileId: PACIENTE.id,
      codeConceptId: ESTUDIO['STUDY-HEMOGRAMA'],
      categoryConceptId: 'cat-lab',
      encounterId: 'enc-1',
      previousDiagnosticReportId: 'dr-previo',
      reusePreviousReport: true,
    });
    expect(respuesta.status).toBe(201);
    const cuerpo = respuesta.body as { id: string; status: string };
    expect(cuerpo.status).toBe('SATISFIED_BY_PRIOR');

    const nueva = ordenesDe(PACIENTE.id).find((o) => o.id === cuerpo.id)!;
    expect(nueva.previousDiagnosticReportId).toBe('dr-previo');
    expect(nueva.duplicateOverrideReason).toBeUndefined();
  });

  it('repetir con justificación nace activa, con el enlace y la razón guardados', () => {
    const razon = 'Sospecha de anemia aguda, se repite por deterioro clínico.';
    const respuesta = call<MockReply>('POST', '/clinical/service-requests', {
      patientProfileId: PACIENTE.id,
      codeConceptId: ESTUDIO['STUDY-HEMOGRAMA'],
      categoryConceptId: 'cat-lab',
      encounterId: 'enc-1',
      previousDiagnosticReportId: 'dr-previo',
      duplicateOverrideReason: razon,
    });
    expect(respuesta.status).toBe(201);
    const cuerpo = respuesta.body as { id: string; status: string };
    expect(cuerpo.status).toBe('ACTIVE');

    const nueva = ordenesDe(PACIENTE.id).find((o) => o.id === cuerpo.id)!;
    expect(nueva.previousDiagnosticReportId).toBe('dr-previo');
    expect(nueva.duplicateOverrideReason).toBe(razon);
  });

  it('sin duplicado, el alta sigue como siempre', () => {
    const respuesta = call<MockReply>('POST', '/clinical/service-requests', {
      patientProfileId: PACIENTE.id,
      codeConceptId: ESTUDIO['STUDY-TAC-CRANEO'],
      categoryConceptId: 'cat-imaging',
      encounterId: 'enc-1',
    });

    expect(respuesta.status).toBe(201);
    expect((respuesta.body as { status: string }).status).toBe('ACTIVE');
  });
});

/**
 * C5 — la receta siempre se liga a un diagnóstico **confirmado**, o a un
 * motivo escrito. Pedido literal del propietario: «en todo momento se puede
 * linkear a un diagnóstico confirmado o por motivo plano».
 */
describe('POST /clinical/medication-requests · sólo diagnóstico confirmado o motivo (C5)', () => {
  const router = new MockRouter();
  const medica = buscarUsuario('medica')!;

  registrarClinica(router);

  function call<T>(method: MockMethod, path: string, body: unknown): T {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user: medica as MockUser,
    }) as T;
  }

  function condicion(overrides: Partial<CondicionSimulada> = {}): CondicionSimulada {
    const base: CondicionSimulada = {
      id: `cond-${Math.random().toString(36).slice(2)}`,
      patientProfileId: PACIENTE.id,
      codeConceptId: 'concept-faringitis',
      categoryConceptId: 'cat-dx',
      clinicalStatusConceptId: 'active',
      verificationStatusConceptId: VERIFICACION_DX['DXV-CONFIRMED']!,
      severityConceptId: 'sev-mild',
      onsetAt: '2026-01-01T00:00:00.000Z',
      noteText: '',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    return { ...base, ...overrides };
  }

  const CUERPO_BASE = { patientProfileId: PACIENTE.id, medicationConceptId: 'med-amoxi' };

  it('sin indicationConditionId ni indicationText: 400', () => {
    const respuesta = call<MockReply>('POST', '/clinical/medication-requests', CUERPO_BASE);

    expect(respuesta.status).toBe(400);
    expect((respuesta.body as { code: string }).code).toBe('VALIDATION_FAILED');
  });

  it('indicationConditionId de un diagnóstico presuntivo/provisional: 400', () => {
    const presuntivo = condicion({ verificationStatusConceptId: VERIFICACION_DX['DXV-PROVISIONAL']! });
    condiciones.agregar(presuntivo);

    const respuesta = call<MockReply>('POST', '/clinical/medication-requests', {
      ...CUERPO_BASE,
      indicationConditionId: presuntivo.id,
    });

    expect(respuesta.status).toBe(400);
  });

  it('indicationConditionId de un diagnóstico confirmado: 201', () => {
    const confirmado = condicion();
    condiciones.agregar(confirmado);

    const respuesta = call<MockReply>('POST', '/clinical/medication-requests', {
      ...CUERPO_BASE,
      indicationConditionId: confirmado.id,
    });

    expect(respuesta.status).toBe(201);
  });

  it('indicationText con un motivo escrito: 201', () => {
    const respuesta = call<MockReply>('POST', '/clinical/medication-requests', {
      ...CUERPO_BASE,
      indicationText: 'Control de síntomas',
    });

    expect(respuesta.status).toBe(201);
  });

  it('con los dos, gana la condición y el texto se descarta (criterio P24)', () => {
    const confirmado = condicion();
    condiciones.agregar(confirmado);

    const respuesta = call<MockReply>('POST', '/clinical/medication-requests', {
      ...CUERPO_BASE,
      indicationConditionId: confirmado.id,
      indicationText: 'Este texto no debería guardarse',
    });

    expect(respuesta.status).toBe(201);
  });

  it('/:id/edit sobre una receta emitida: 409', () => {
    const confirmado = condicion();
    condiciones.agregar(confirmado);
    const creada = call<MockReply>('POST', '/clinical/medication-requests', {
      ...CUERPO_BASE,
      indicationConditionId: confirmado.id,
    });
    const id = (creada.body as { id: string }).id;
    call('POST', `/clinical/medication-requests/${id}/sign`, {});
    call('POST', `/clinical/medication-requests/${id}/issue`, {});

    const respuesta = call<MockReply>('POST', `/clinical/medication-requests/${id}/edit`, {
      indicationText: 'Otro motivo',
    });

    expect(respuesta.status).toBe(409);
  });
});

describe('/charts/notes · contrato tras mudar el handler', () => {
  const router = new MockRouter();
  const doctor = buscarUsuario('medica')!;

  registrarClinica(router);
  registerMedicalNotes(router);

  function call<T>(method: MockMethod, path: string, body: unknown): T {
    // C1 lista por query: el helper la separa de la ruta, como hace el router.
    const [ruta = path, query = ''] = path.split('?');
    const match = router.match(method, ruta);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path: ruta,
      params: match.params,
      query: new URLSearchParams(query),
      body,
      headers: new HttpHeaders(),
      user: doctor,
    }) as T;
  }

  function createNote(body: unknown = { patientProfileId: PACIENTE.id }) {
    return call<{ status: number; body: ClinicalNoteVersionRef }>('POST', '/charts/notes', body);
  }

  it('las cinco rutas pertenecen a notas; clínica deja de registrar notas y órdenes', () => {
    const notesRouter = new MockRouter();
    registerMedicalNotes(notesRouter);
    // C1 sumó la lista y la firma a las tres de C0.
    expect(notesRouter.rutas()).toEqual([
      { method: 'GET', pattern: '/charts/notes' },
      { method: 'POST', pattern: '/charts/notes' },
      { method: 'PUT', pattern: '/charts/notes/:id/versions' },
      { method: 'POST', pattern: '/charts/notes/:id/versions' },
      { method: 'POST', pattern: '/charts/notes/:id/versions/:versionId/sign' },
    ]);

    const clinicalRouter = new MockRouter();
    registrarClinica(clinicalRouter);
    expect(clinicalRouter.rutas().some(({ pattern }) => pattern.startsWith('/charts/notes'))).toBe(false);
    expect(clinicalRouter.match('POST', '/clinical/service-requests')).toBeNull();
  });

  it('conserva el 201, los campos de la nota, la lectura del expediente y la persistencia', () => {
    const input = {
      patientProfileId: PACIENTE.id,
      authorProfileId: doctor.practitionerProfileId!,
      encounterId: 'c0-note-contract-encounter',
      noteTypeConceptId: 'c0-note-type',
      chiefComplaintText: 'Motivo sintético C0',
      subjectiveText: 'Subjetivo sintético C0',
      objectiveText: 'Objetivo sintético C0',
      assessmentText: 'Apreciación sintética C0',
      planText: 'Plan sintético C0',
    };
    const response = createNote(input);
    expect(response).toEqual({
      status: 201,
      body: {
        noteId: expect.any(String),
        versionId: expect.any(String),
        versionNumber: 1,
        lifecycleStatusConceptId: ESTADO['ST-DRAFT'],
        versionStatusConceptId: ESTADO['ST-DRAFT'],
      },
    });
    const { patientProfileId: _patientId, ...chartInput } = input;
    const chart = call<{ notes: readonly Omit<NotaSimulada, 'patientProfileId' | 'id'>[] }>(
      'GET', `/charts/patients/${PACIENTE.id}/chart`, null,
    );
    expect(chart.notes.find((note) => note.noteId === response.body.noteId)).toMatchObject({
      ...chartInput,
      currentVersionId: response.body.versionId,
      versionNumber: 1,
      signedAt: null,
      releasedToPatient: false,
    });
    const restored = new Coleccion<NotaSimulada>([], 'mock.clinica.notas-medicas');
    expect(restored.get(response.body.noteId)).toMatchObject(input);
  });

  // C1: una nota vacía ya no se guarda. Sin paciente, o sin ninguna fila ni
  // texto, el simulador responde 422 —lo mismo que va a responder el backend—.
  it('un cuerpo vacío es 400: sin paciente, o sin filas ni texto, no hay nota', () => {
    expect(createNote({}).status).toBe(400);
    const sinContenido = call<MockReply>('POST', '/charts/notes', { patientProfileId: PACIENTE.id });
    expect(sinContenido.status).toBe(400);
    expect((sinContenido.body as { message: string }).message).toContain('al menos una fila o un texto');
  });

  it('con sólo texto libre conserva los valores por omisión anteriores', () => {
    const response = createNote({ patientProfileId: PACIENTE.id, subjectiveText: 'Sólo texto' });
    expect(response.status).toBe(201);
    expect(notas.get(response.body.noteId)).toMatchObject({
      patientProfileId: PACIENTE.id,
      authorProfileId: doctor.practitionerProfileId,
      noteTypeConceptId: NOTA_TIPO_EVOLUCION,
      lifecycleStatusConceptId: ESTADO['ST-DRAFT'],
      entries: [],
      chiefComplaintText: '',
      subjectiveText: 'Sólo texto',
      objectiveText: '',
      assessmentText: '',
      planText: '',
    });
  });

  it('valida cada fila: campo y valor obligatorios, sin campos repetidos', () => {
    const repetido = call<MockReply>('POST', '/charts/notes', {
      patientProfileId: PACIENTE.id,
      entries: [
        { label: 'Presión arterial', value: '120/80' },
        { label: 'presion ARTERIAL', value: '130/85' },
      ],
    });
    expect(repetido.status).toBe(400);
    expect(
      (repetido.body as { details: { violations: readonly string[] } }).details.violations[0],
    ).toMatch(/^label\b/);

    const sinValor = call<MockReply>('POST', '/charts/notes', {
      patientProfileId: PACIENTE.id,
      entries: [{ label: 'Peso', value: '   ' }],
    });
    expect(sinValor.status).toBe(400);

    const bien = createNote({
      patientProfileId: PACIENTE.id,
      entries: [{ label: '  Peso ', value: ' 68 kg ' }],
    });
    expect(bien.status).toBe(201);
    expect(notas.get(bien.body.noteId)?.entries).toEqual([{ label: 'Peso', value: '68 kg' }]);
  });

  it('lista las notas de una persona, firma la vigente y no deja pisar una firmada sin motivo', () => {
    const creada = createNote({
      patientProfileId: PACIENTE.id,
      encounterId: 'c1-encounter',
      entries: [{ label: 'Dolor', value: 'Lumbar, 6/10' }],
    });
    const lista = call<{ items: readonly { noteId: string; entries?: unknown }[]; count: number }>(
      'GET', `/charts/notes?patientProfileId=${PACIENTE.id}&encounterId=c1-encounter`, undefined,
    );
    expect(lista.items.map((n) => n.noteId)).toEqual([creada.body.noteId]);
    expect(lista.items[0]!.entries).toEqual([{ label: 'Dolor', value: 'Lumbar, 6/10' }]);

    const firmada = call<{ noteId: string; signedAt: string | null }>(
      'POST', `/charts/notes/${creada.body.noteId}/versions/${creada.body.versionId}/sign`, {},
    );
    expect(firmada.noteId).toBe(creada.body.noteId);
    expect(firmada.signedAt).not.toBeNull();

    const pisada = call<MockReply>('PUT', `/charts/notes/${creada.body.noteId}/versions`, { planText: 'x' });
    expect(pisada.status).toBe(409);
    const enmendada = call<{ status: number }>('PUT', `/charts/notes/${creada.body.noteId}/versions`, {
      planText: 'x',
      amendmentReasonText: 'Error de tipeo',
    });
    expect(enmendada.status).toBe(201);
  });

  for (const method of ['PUT', 'POST'] as const) {
    it(`${method} agrega una versión, conserva la nota y persiste el cambio`, () => {
      const initial = createNote({ patientProfileId: PACIENTE.id, subjectiveText: 'Texto inicial sintético' });
      const response = call<{ status: number; body: ClinicalNoteVersionRef }>(
        method, `/charts/notes/${initial.body.noteId}/versions`, { planText: 'Plan actualizado sintético' },
      );
      expect(response).toEqual({
        status: 201,
        body: {
          ...initial.body,
          versionId: expect.any(String),
          versionNumber: 2,
        },
      });
      expect(response.body.versionId).not.toBe(initial.body.versionId);
      const restored = new Coleccion<NotaSimulada>([], 'mock.clinica.notas-medicas');
      expect(restored.get(initial.body.noteId)).toMatchObject({
        noteId: initial.body.noteId,
        patientProfileId: PACIENTE.id,
        subjectiveText: 'Texto inicial sintético',
        planText: 'Plan actualizado sintético',
        currentVersionId: response.body.versionId,
        versionNumber: 2,
      });
    });

    it(`${method} conserva el 404 de una nota inexistente`, () => {
      expect(call<MockReply>(method, '/charts/notes/c0-missing-note/versions', {})).toEqual({
        status: 404,
        body: { statusCode: 404, code: 'NOT_FOUND', message: 'Nota no encontrada', error: 'Not Found' },
      });
    });
  }
});

/**
 * `POST /clinical/diagnostic-reports/:id/release` (D-E, BR-17/CL-46).
 *
 * Este camino ya no libera nada: no alimenta `informes` de
 * `diagnostics.handlers.ts`, así que "liberar" por acá nunca hacía aparecer
 * el resultado en «Mis resultados». El mock imita ahora el mismo contrato que
 * el backend real desde D-E: 422 siempre, con el endpoint canónico en el
 * mensaje.
 */
describe('POST /clinical/diagnostic-reports/:id/release (D-E, deprecado)', () => {
  const router = new MockRouter();
  const medica = buscarUsuario('medica')!;
  registrarClinica(router);

  function call<T>(): T {
    const match = router.match('POST', '/clinical/diagnostic-reports/report-1/release');
    if (match === null) throw new Error('No existe la ruta de liberación clínica');
    return match.handler({
      method: 'POST',
      path: '/clinical/diagnostic-reports/report-1/release',
      params: { id: 'report-1' },
      query: new URLSearchParams(),
      body: {},
      headers: new HttpHeaders(),
      user: medica,
    }) as T;
  }

  it('inválido: cualquier intento de liberar por acá da 422, nunca 200', () => {
    const respuesta = call<MockReply>();
    expect(respuesta.status).toBe(422);
    expect((respuesta.body as { code: string }).code).toBe('PRECONDITION_FAILED');
    expect((respuesta.body as { details: { canonicalEndpoint: string } }).details.canonicalEndpoint).toContain(
      'versions/:versionId/release',
    );
  });
});


/**
 * BR-14 en el simulador: el CDS respeta `@Roles` + guard de acceso de la API,
 * el cierre compara `expectedRowVersion` y la enmienda exige su nota.
 */
describe('BR-14 · seguridad clínica en el simulador', () => {
  const router = new MockRouter();
  const medica = buscarUsuario('medica')!;
  const paciente = buscarUsuario('paciente')!;

  registrarClinica(router);

  function call(method: MockMethod, path: string, body: unknown, user: MockUser): MockReply {
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
    }) as MockReply;
  }

  const cuerpoDe = (r: MockReply): Record<string, unknown> => r.body as Record<string, unknown>;

  it('un paciente recibe 403 al chequear interacciones', () => {
    const r = call('POST', '/cds/check-interactions', { patientProfileId: PACIENTE.id, substanceConceptIds: ['a', 'b'] }, paciente as MockUser);
    expect(r.status).toBe(403);
  });

  it('sin patientProfileId el chequeo falla la validación', () => {
    const r = call('POST', '/cds/check-interactions', { substanceConceptIds: ['a', 'b'] }, medica as MockUser);
    expect(r.status).toBe(400);
  });

  it('un par sin regla declarada no genera alerta; uno declarado sí', () => {
    const sin = call('POST', '/cds/check-interactions', { patientProfileId: PACIENTE.id, substanceConceptIds: ['x', 'y'] }, medica as MockUser);
    expect(cuerpoDe(sin)['count']).toBe(0);

    const con = call('POST', '/cds/check-interactions', { patientProfileId: PACIENTE.id, substanceConceptIds: [MEDICAMENTO['MED-ENALAPRIL'], MEDICAMENTO['MED-LOSARTAN']] }, medica as MockUser);
    expect(cuerpoDe(con)['count']).toBe(1);
  });

  it('cerrar con una versión vieja responde 409 y con la vigente cierra', () => {
    const abierto = call('POST', '/clinical/encounters/check-in', { patientProfileId: PACIENTE.id, reasonText: 'Control' }, medica as MockUser);
    const id = cuerpoDe(abierto)['id'] as string;

    const viejo = call('POST', `/clinical/encounters/${id}/close`, { expectedRowVersion: 9 }, medica as MockUser);
    expect(viejo.status).toBe(409);

    const bueno = call('POST', `/clinical/encounters/${id}/close`, { expectedRowVersion: 1 }, medica as MockUser);
    expect(bueno.status ?? 200).toBe(200);
  });

  it('enmendar sin nota falla; con nota sube la versión', () => {
    const creada = call('POST', '/clinical/observations', { patientProfileId: PACIENTE.id, codeConceptId: 'obs', quantityValue: 100 }, medica as MockUser);
    const id = cuerpoDe(creada)['id'] as string;

    expect(call('PATCH', `/clinical/observations/${id}/amend`, { quantityValue: 110 }, medica as MockUser).status).toBe(400);

    const ok = call('PATCH', `/clinical/observations/${id}/amend`, { quantityValue: 110, note: 'Error de tipeo' }, medica as MockUser);
    expect(cuerpoDe(ok)['rowVersion']).toBe(2);

    const choque = call('PATCH', `/clinical/observations/${id}/amend`, { quantityValue: 111, note: 'Otra', expectedRowVersion: 1 }, medica as MockUser);
    expect(choque.status).toBe(409);
  });
});

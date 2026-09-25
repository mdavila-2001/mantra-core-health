import { HttpHeaders } from '@angular/common/http';

import type { ClinicalNoteVersionRef } from '../../data-access/chart-notes/chart-notes.types';
import { condiciones, notas, NOTA_TIPO_EVOLUCION, type CondicionSimulada, type NotaSimulada } from '../fixtures/clinica';
import { ESTADO, ESTUDIO, VERIFICACION_DX } from '../fixtures/conceptos';
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

    expect(respuesta.status).toBe(412);
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

  it('sin indicationConditionId ni indicationText: 422', () => {
    const respuesta = call<MockReply>('POST', '/clinical/medication-requests', CUERPO_BASE);

    expect(respuesta.status).toBe(422);
    expect((respuesta.body as { code: string }).code).toBe('VALIDATION_FAILED');
  });

  it('indicationConditionId de un diagnóstico presuntivo/provisional: 422', () => {
    const presuntivo = condicion({ verificationStatusConceptId: VERIFICACION_DX['DXV-PROVISIONAL']! });
    condiciones.agregar(presuntivo);

    const respuesta = call<MockReply>('POST', '/clinical/medication-requests', {
      ...CUERPO_BASE,
      indicationConditionId: presuntivo.id,
    });

    expect(respuesta.status).toBe(422);
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
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user: doctor,
    }) as T;
  }

  function createNote(body: unknown = { patientProfileId: PACIENTE.id }) {
    return call<{ status: number; body: ClinicalNoteVersionRef }>('POST', '/charts/notes', body);
  }

  it('las tres rutas pertenecen a notas; clínica deja de registrar notas y órdenes', () => {
    const notesRouter = new MockRouter();
    registerMedicalNotes(notesRouter);
    expect(notesRouter.rutas()).toEqual([
      { method: 'POST', pattern: '/charts/notes' },
      { method: 'PUT', pattern: '/charts/notes/:id/versions' },
      { method: 'POST', pattern: '/charts/notes/:id/versions' },
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
    const restored = new Coleccion<NotaSimulada>([], 'mock.clinica.notas');
    expect(restored.get(response.body.noteId)).toMatchObject(input);
  });

  it('un cuerpo vacío conserva los valores por omisión anteriores', () => {
    const response = createNote({});
    expect(response.status).toBe(201);
    expect(notas.get(response.body.noteId)).toMatchObject({
      patientProfileId: '',
      authorProfileId: doctor.practitionerProfileId,
      noteTypeConceptId: NOTA_TIPO_EVOLUCION,
      lifecycleStatusConceptId: ESTADO['ST-DRAFT'],
      chiefComplaintText: '',
      subjectiveText: '',
      objectiveText: '',
      assessmentText: '',
      planText: '',
    });
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
      const restored = new Coleccion<NotaSimulada>([], 'mock.clinica.notas');
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

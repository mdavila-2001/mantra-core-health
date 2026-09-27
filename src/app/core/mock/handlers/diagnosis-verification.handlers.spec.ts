import { HttpHeaders } from '@angular/common/http';

import {
  CATEGORIA_DX,
  condiciones,
  notas,
  ordenes,
  type CondicionSimulada,
  type VerificacionSimulada,
} from '../fixtures/clinica';
import {
  CURSO_CLINICO,
  DIAGNOSTICO,
  ESTADO_CONDICION,
  SEVERIDAD,
  VERIFICACION_DX,
} from '../fixtures/conceptos';
import { PACIENTE, PACIENTES } from '../fixtures/personas';
import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { uuid } from '../mock-store';
import { registerDiagnosisVerification } from './diagnosis-verification.handlers';
import { informes } from './diagnostics.handlers';

interface CondicionWire {
  readonly id: string;
  readonly patientProfileId?: string;
  readonly clinicalStatusConceptId: string;
  readonly verificationStatusConceptId: string;
  readonly clinicalCourseConceptId?: string;
  readonly onsetAt: string;
  readonly expectedResolutionAt?: string;
  readonly resolvedAt?: string;
  readonly verification?: VerificacionSimulada;
}

interface Fallo {
  readonly code: string;
  readonly message: string;
  readonly details?: { readonly violations?: readonly string[] };
}

/**
 * `POST /clinical/conditions/:id/verification` — C3, contrato §3.4 del plan
 * maestro. Lo que estas pruebas fijan:
 *
 * 1. Sólo un presuntivo se decide; decidido, es 409. Inexistente, 404.
 * 2. Sin motivo **y** sin evidencia no hay decisión (422). La evidencia tiene
 *    que existir y ser de esta persona (422).
 * 3. Confirmar exige fin esperado o curso crónico (422); confirmado queda
 *    activo con su inicio y su fin. Rechazado queda cerrado (`resolvedAt`).
 * 4. Lo que vuelve es la condición pública, sin `patientProfileId`, con la
 *    decisión y la evidencia **resueltas** (la nota trae su consulta, el
 *    informe trae su orden).
 */
describe('POST /clinical/conditions/:id/verification · C3', () => {
  const router = new MockRouter();
  const medica = buscarUsuario('medica')!;

  registerDiagnosisVerification(router);

  function call<T>(path: string, body: unknown): T {
    const method: MockMethod = 'POST';
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

  const verificar = (id: string, body: unknown) =>
    call<MockReply | CondicionWire>(`/clinical/conditions/${id}/verification`, body);

  const estado = (respuesta: MockReply | CondicionWire): number =>
    'status' in respuesta ? respuesta.status : 200;
  const fallo = (respuesta: MockReply | CondicionWire): Fallo =>
    (respuesta as MockReply).body as Fallo;
  const condicion = (respuesta: MockReply | CondicionWire): CondicionWire =>
    respuesta as CondicionWire;

  let contador = 0;

  /** Un presuntivo nuevo por prueba: la colección es un singleton del módulo. */
  function presuntivo(patientProfileId = PACIENTE.id): CondicionSimulada {
    contador += 1;
    const fila: CondicionSimulada = {
      id: uuid(`spec-c3-${contador}`),
      patientProfileId,
      codeConceptId: DIAGNOSTICO['I10']!,
      categoryConceptId: CATEGORIA_DX,
      clinicalStatusConceptId: ESTADO_CONDICION['COND-ACTIVE']!,
      verificationStatusConceptId: VERIFICACION_DX['DXV-PROVISIONAL']!,
      severityConceptId: SEVERIDAD['SEV-MILD']!,
      onsetAt: '2026-09-01T10:00:00.000Z',
      noteText: 'Presuntivo de prueba',
      createdAt: '2026-09-01T10:00:00.000Z',
    };
    condiciones.agregar(fila);
    return fila;
  }

  const otroPaciente = PACIENTES.find((p) => p.id !== PACIENTE.id)!;
  const ordenDe = (patientProfileId: string) =>
    ordenes.todos().find((o) => o.patientProfileId === patientProfileId)!;
  const notaDe = (patientProfileId: string) =>
    notas.todos().find((n) => n.patientProfileId === patientProfileId)!;

  it('un diagnóstico inexistente es 404', () => {
    expect(estado(verificar('no-existe', { outcome: 'REFUTED', reasonText: 'x' }))).toBe(404);
  });

  it('sin motivo y sin evidencia no hay decisión: 400 sobre el motivo', () => {
    const respuesta = verificar(presuntivo().id, { outcome: 'REFUTED' });

    expect(estado(respuesta)).toBe(400);
    expect(fallo(respuesta).code).toBe('VALIDATION_FAILED');
    expect(fallo(respuesta).details?.violations?.[0]).toMatch(/^reasonText\b/);
  });

  it('un resultado que no es CONFIRMED ni REFUTED es 400', () => {
    expect(estado(verificar(presuntivo().id, { outcome: 'MAYBE', reasonText: 'x' }))).toBe(400);
  });

  it('la evidencia ajena o inexistente es 400: una orden de otra persona, una nota que no existe', () => {
    const ajena = verificar(presuntivo().id, {
      outcome: 'REFUTED',
      basedOn: { kind: 'ANALYSIS', serviceRequestId: ordenDe(otroPaciente.id).id },
    });
    expect(estado(ajena)).toBe(400);
    expect(fallo(ajena).details?.violations?.[0]).toMatch(/^basedOn\b/);

    const fantasma = verificar(presuntivo().id, {
      outcome: 'REFUTED',
      basedOn: { kind: 'NOTE', noteId: 'nota-que-no-existe' },
    });
    expect(estado(fantasma)).toBe(400);

    const rara = verificar(presuntivo().id, {
      outcome: 'REFUTED',
      basedOn: { kind: 'OTRA', noteId: notaDe(PACIENTE.id).noteId },
    });
    expect(estado(rara)).toBe(400);
  });

  it('confirmar sin fin esperado ni curso crónico es 400', () => {
    const respuesta = verificar(presuntivo().id, {
      outcome: 'CONFIRMED',
      reasonText: 'Cuadro compatible',
    });

    expect(estado(respuesta)).toBe(400);
    expect(fallo(respuesta).details?.violations?.[0]).toMatch(/^expectedResolutionAt\b/);
  });

  it('confirmar con motivo y fin esperado deja la condición activa y confirmada, y una segunda decisión es 409', () => {
    const fila = presuntivo();
    const respuesta = verificar(fila.id, {
      outcome: 'CONFIRMED',
      reasonText: 'Cuadro clínico compatible y respuesta al tratamiento',
      onsetAt: '2026-09-05T00:00:00.000Z',
      expectedResolutionAt: '2026-10-05T00:00:00.000Z',
    });

    expect(estado(respuesta)).toBe(200);
    const decidida = condicion(respuesta);
    expect(decidida.verificationStatusConceptId).toBe(VERIFICACION_DX['DXV-CONFIRMED']);
    expect(decidida.clinicalStatusConceptId).toBe(ESTADO_CONDICION['COND-ACTIVE']);
    expect(decidida.onsetAt).toBe('2026-09-05T00:00:00.000Z');
    expect(decidida.expectedResolutionAt).toBe('2026-10-05T00:00:00.000Z');
    expect(decidida.verification?.outcome).toBe('CONFIRMED');
    expect(decidida.verification?.reasonText).toContain('compatible');
    expect(decidida.verification?.basedOn).toBeNull();
    expect(decidida.verification?.decidedByProfileId).toBeDefined();
    expect('patientProfileId' in decidida).toBe(false);

    // Terminal: no se vuelve a decidir.
    expect(estado(verificar(fila.id, { outcome: 'REFUTED', reasonText: 'x' }))).toBe(409);
  });

  it('confirmar como crónica no exige fin esperado, y la nota trae su consulta', () => {
    const nota = notaDe(PACIENTE.id);
    const respuesta = verificar(presuntivo().id, {
      outcome: 'CONFIRMED',
      basedOn: { kind: 'NOTE', noteId: nota.noteId },
      clinicalCourseConceptId: CURSO_CLINICO['COND_COURSE_CHRONIC'],
    });

    expect(estado(respuesta)).toBe(200);
    const decidida = condicion(respuesta);
    expect(decidida.clinicalCourseConceptId).toBe(CURSO_CLINICO['COND_COURSE_CHRONIC']);
    expect(decidida.expectedResolutionAt).toBeUndefined();
    expect(decidida.verification?.reasonText).toBeNull();
    expect(decidida.verification?.basedOn).toEqual({
      kind: 'NOTE',
      noteId: nota.noteId,
      ...(nota.encounterId === undefined ? {} : { encounterId: nota.encounterId }),
    });
  });

  it('rechazar con un informe cierra la condición y resuelve la orden del informe', () => {
    const informe = informes.todos().find((r) => r.patientProfileId === PACIENTE.id)!;
    const respuesta = verificar(presuntivo().id, {
      outcome: 'REFUTED',
      basedOn: { kind: 'ANALYSIS', diagnosticReportId: informe.id },
    });

    expect(estado(respuesta)).toBe(200);
    const decidida = condicion(respuesta);
    expect(decidida.verificationStatusConceptId).toBe(VERIFICACION_DX['DXV-REFUTED']);
    expect(decidida.resolvedAt).toBeDefined();
    expect(decidida.verification?.basedOn).toEqual({
      kind: 'ANALYSIS',
      serviceRequestId: informe.serviceRequestId,
      diagnosticReportId: informe.id,
    });
  });

  it('el motivo tiene tope de 500 caracteres', () => {
    expect(
      estado(verificar(presuntivo().id, { outcome: 'REFUTED', reasonText: 'x'.repeat(501) })),
    ).toBe(400);
    expect(
      estado(verificar(presuntivo().id, { outcome: 'REFUTED', reasonText: 'x'.repeat(500) })),
    ).toBe(200);
  });
});

import { HttpHeaders } from '@angular/common/http';

import { registrarAgenda } from './scheduling.handlers';
import { RECURSO_MEDICA, reservas } from '../fixtures/agenda';
import { encuentros } from '../fixtures/clinica';
import { ESTADO_ENCUENTRO, ESTADO_RESERVA } from '../fixtures/conceptos';
import { PACIENTE, pacientePorId } from '../fixtures/personas';
import { MockRouter, isMockReply, preconditionFailed, validation, type MockReply } from '../mock-router';
import { buscarUsuario } from '../mock-session';

/**
 * El estado HTTP de cada familia de rechazo sale de los ayudantes del
 * simulador y no se escribe a mano: `mockup` todavía responde las
 * precondiciones con 412 y la validación con 422, y `test` ya con 422 y 400
 * (H2.S1.M2). La prueba fija la familia, no el número de una rama.
 */
const PRECONDITION = preconditionFailed('').status;
const INVALID = validation('').status;

/** Los textos de validación, en la forma de cada rama: `details.violations` o `issues`. */
function messagesOf(body: unknown): readonly string[] {
  const wire = body as { details?: { violations?: string[] }; issues?: { field?: string; message: string }[] };
  return wire.details?.violations ?? (wire.issues ?? []).map((issue) => `${issue.field} ${issue.message}`);
}

/**
 * `POST /scheduling/appointments/walk-in` — el turno de mostrador (AC-3.3).
 *
 * Lo que estas pruebas fijan, en los tres niveles del contrato:
 *
 * - **correcto**: alta del paciente, reserva `IN_PROGRESS` y encuentro abierto,
 *   todo visible después por las lecturas de siempre;
 * - **límite**: la misma `Idempotency-Key` repetida devuelve la misma
 *   respuesta sin dar de alta a nadie más;
 * - **inválido**: 400 por datos faltantes, 404 por agenda inexistente, 409 por
 *   documento ya registrado, 422 por choque de horario y por clave reciclada.
 */
describe('POST /scheduling/appointments/walk-in', () => {
  const router = new MockRouter();
  registrarAgenda(router);
  const medica = buscarUsuario('medica')!;
  const path = '/scheduling/appointments/walk-in';

  function post(body: unknown, headers = new HttpHeaders()): MockReply {
    const match = router.match('POST', path);
    if (match === null) throw new Error(`No existe POST ${path}`);
    const result = match.handler({
      method: 'POST',
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers,
      user: medica,
    });
    if (!isMockReply(result)) throw new Error('Se esperaba una respuesta con status');
    return result;
  }

  /** Un turno en un horario que ninguna semilla ocupa. */
  let minute = 0;
  function body(nationalId: string, overrides: Record<string, unknown> = {}) {
    minute += 1;
    return {
      patient: { name: 'Rosa', lastName: 'Vaca', nationalId, phone: '+591 70000000' },
      resourceId: RECURSO_MEDICA,
      startAt: new Date(Date.UTC(2031, 2, 3, 12, minute * 40)).toISOString(),
      durationMinutes: 20,
      reasonText: 'Dolor de garganta',
      ...overrides,
    };
  }

  interface Created {
    readonly patientProfileId: string;
    readonly patientCode: string;
    readonly bookingId: string;
    readonly encounterId: string;
    readonly statusConceptId: string;
    readonly retractedSlots: number;
  }

  it('correcto — da de alta al paciente, deja la reserva en consulta y el encuentro abierto', () => {
    const result = post(body('9100001'));

    expect(result.status).toBe(201);
    const created = result.body as Created;
    expect(created.statusConceptId).toBe(ESTADO_RESERVA['BK-IN-PROGRESS']);
    expect(created.patientCode).toMatch(/^PAT-/);

    const patient = pacientePorId(created.patientProfileId);
    expect(patient?.nationalId).toBe('9100001');
    expect(patient?.displayName).toBe('Rosa Vaca');
    expect(patient?.identityVerified).toBe(false);

    const booking = reservas.get(created.bookingId);
    expect(booking?.patientProfileId).toBe(created.patientProfileId);
    expect(booking?.reasonText).toBe('Dolor de garganta');

    const encounter = encuentros.get(created.encounterId);
    expect(encounter?.patientProfileId).toBe(created.patientProfileId);
    expect(encounter?.statusConceptId).toBe(ESTADO_ENCUENTRO['ENCST-IN-PROGRESS']);
  });

  it('límite — la misma Idempotency-Key repetida devuelve la misma respuesta y no duplica al paciente', () => {
    const request = body('9100002');
    const headers = new HttpHeaders({ 'Idempotency-Key': 'walk-in-9100002' });

    const first = post(request, headers);
    const second = post(request, headers);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(second.headers?.['Idempotent-Replayed']).toBe('true');
    expect(reservas.todos().filter((r) => r.patientName === 'Rosa Vaca' && r.startAt === request.startAt)).toHaveLength(1);
  });

  it('límite — sin cabecera, el mismo cuerpo repetido sí choca: la idempotencia es opt-in', () => {
    const request = body('9100003');
    expect(post(request).status).toBe(201);
    // El segundo es otro intento: el documento ya quedó registrado.
    expect(post(request).status).toBe(409);
  });

  it('inválido — la misma clave con otro cuerpo es 422 IDEMPOTENCY_KEY_REUSED', () => {
    const headers = new HttpHeaders({ 'Idempotency-Key': 'walk-in-reused' });
    expect(post(body('9100004'), headers).status).toBe(201);

    const reused = post(body('9100005'), headers);

    expect(reused.status).toBe(422);
    expect((reused.body as { code: string }).code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('inválido — un rechazo no se recuerda: corregido el dato, la misma clave vuelve a intentar', () => {
    const headers = new HttpHeaders({ 'Idempotency-Key': 'walk-in-retry' });
    expect(post(body(PACIENTE.nationalId), headers).status).toBe(409);
    expect(post(body('9100006'), headers).status).toBe(201);
  });

  it('inválido — validación si falta la cédula o el teléfono del paciente', () => {
    const result = post({ ...body('x'), patient: { name: 'Rosa', lastName: 'Vaca', nationalId: '', phone: '' } });

    expect(result.status).toBe(INVALID);
    const violations = messagesOf(result.body);
    expect(violations).toContain('patient.nationalId should not be empty');
    expect(violations).toContain('patient.phone should not be empty');
  });

  it('inválido — validación si viene el teléfono del tutor sin su nombre', () => {
    const request = body('9100007');
    const result = post({ ...request, patient: { ...request.patient, guardianPhone: '+591 71111111' } });

    expect(result.status).toBe(INVALID);
  });

  it('inválido — 404 si la agenda no existe', () => {
    expect(post(body('9100008', { resourceId: 'agenda-que-no-existe' })).status).toBe(404);
  });

  it('inválido — 409 si el documento ya está registrado, sin crear nada', () => {
    const before = reservas.todos().length;

    const result = post(body(PACIENTE.nationalId));

    expect(result.status).toBe(409);
    expect((result.body as { code: string }).code).toBe('CONFLICT');
    expect(reservas.todos()).toHaveLength(before);
  });

  it('inválido — precondición si el horario pisa otro turno vivo de la misma agenda', () => {
    const first = body('9100009');
    expect(post(first).status).toBe(201);

    const clash = post({ ...body('9100010'), startAt: first.startAt });

    expect(clash.status).toBe(PRECONDITION);
    expect((clash.body as { code: string; message: string }).message).toContain('Rosa Vaca');
  });
});

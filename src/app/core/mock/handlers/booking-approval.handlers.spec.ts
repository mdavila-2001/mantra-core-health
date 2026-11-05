import { HttpHeaders } from '@angular/common/http';

import { RECURSO_CONSULTORIO_MEDICA, cupos, reservas } from '../fixtures/agenda';
import { BOOKING_STATUS } from '../fixtures/concepts';
import { PACIENTE } from '../fixtures/people';
import { MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario, TENANT_CONSULTORIO } from '../mock-session';
import { registerBookingApproval } from './booking-approval.handlers';
import { registrarAgenda } from './scheduling.handlers';

describe('handlers de confirmación automática de solicitudes (v4.2.88)', () => {
  const router = new MockRouter();
  registrarAgenda(router);
  registerBookingApproval(router);
  const doctor = buscarUsuario('medica')!;
  const patient = buscarUsuario('paciente')!;
  const otherDoctor = {
    ...doctor,
    practitionerProfileId: 'otro-profesional',
    roles: ['PRACTITIONER'],
  };

  function call<T>(method: MockMethod, path: string, user: typeof doctor, body: unknown = {}) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const result = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams({ tenantId: TENANT_CONSULTORIO }),
      body,
      headers: new HttpHeaders(),
      user,
    });
    return result !== null && typeof result === 'object' && 'status' in result && 'body' in result
      ? (result as { status: number; body: T })
      : { status: 200, body: result as T };
  }

  const mine = () =>
    call<{ items: readonly { id: string; requiresApproval: boolean }[] }>(
      'GET',
      '/scheduling/my-resources',
      doctor,
    ).body.items.find((r) => r.id === RECURSO_CONSULTORIO_MEDICA);
  const freeSlot = () =>
    cupos.filtrar((c) => c.resourceId === RECURSO_CONSULTORIO_MEDICA && c.remainingCapacity > 0)[0];

  afterEach(() => {
    call('PATCH', `/scheduling/resources/${RECURSO_CONSULTORIO_MEDICA}`, doctor, {
      requiresApproval: true,
    });
  });

  it('lista las agendas propias y por omisión exigen aceptación, como la API', () => {
    expect(mine()?.requiresApproval).toBe(true);
  });

  it('el profesional cambia la suya y la lectura lo refleja', () => {
    const edited = call<{ requiresApproval: boolean }>(
      'PATCH',
      `/scheduling/resources/${RECURSO_CONSULTORIO_MEDICA}`,
      doctor,
      {
        requiresApproval: false,
      },
    );
    expect(edited.status).toBe(200);
    expect(edited.body.requiresApproval).toBe(false);
    expect(mine()?.requiresApproval).toBe(false);
  });

  it('otro profesional no toca una agenda ajena: 403', () => {
    const { status } = call(
      'PATCH',
      `/scheduling/resources/${RECURSO_CONSULTORIO_MEDICA}`,
      otherDoctor,
      { requiresApproval: false },
    );
    expect(status).toBe(403);
    expect(mine()?.requiresApproval).toBe(true);
  });

  it('un recurso que no existe: 404', () => {
    expect(
      call('PATCH', '/scheduling/resources/no-existe', doctor, { requiresApproval: false }).status,
    ).toBe(404);
  });

  it('con la agenda confirmando sola, la solicitud nace confirmada y con confirmedAt', () => {
    const slot = freeSlot();
    expect(slot).toBeDefined();
    call('PATCH', `/scheduling/resources/${RECURSO_CONSULTORIO_MEDICA}`, doctor, {
      requiresApproval: false,
    });

    const { status, body } = call<{ id: string; statusConceptId: string; confirmedAt?: string }>(
      'POST',
      `/scheduling/holds/hold.${slot!.id}/request`,
      patient,
      { patientProfileId: PACIENTE.id, channel: 'PORTAL' },
    );

    expect(status).toBe(201);
    expect(body.statusConceptId).toBe(BOOKING_STATUS['BK-CONFIRMED']);
    expect(typeof body.confirmedAt).toBe('string');
    expect(reservas.get(body.id)?.statusConceptId).toBe(BOOKING_STATUS['BK-CONFIRMED']);
  });

  it('con la agenda exigiendo aceptación, la solicitud sigue naciendo pendiente', () => {
    const slot = freeSlot();
    const { body } = call<{ statusConceptId: string; confirmedAt?: string }>(
      'POST',
      `/scheduling/holds/hold.${slot!.id}/request`,
      patient,
      { patientProfileId: PACIENTE.id, channel: 'PORTAL' },
    );

    expect(body.statusConceptId).toBe(BOOKING_STATUS['BK-REQUESTED']);
    expect(body.confirmedAt).toBeUndefined();
  });
});

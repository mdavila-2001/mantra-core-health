import { HttpHeaders } from '@angular/common/http';

import { PACIENTE } from '../fixtures/people';
import { isMockReply, type MockMethod } from '../mock-router';
import { buscarUsuario, TENANT_HOSPITAL, type MockUser } from '../mock-session';
import { uuid } from '../mock-store';
import { crearRouterSimulado } from './index';

/**
 * El traslado en el simulador (v4274): las mismas reglas y `reason` que la
 * API al emitir y al completar la salida, la fusión (omitido conserva, `null`
 * borra) y la llegada sólo para el destino —quien no lo es recibe 404, como
 * si no existiera—.
 */
describe('traslado de derivaciones en el mock (v4274)', () => {
  const router = crearRouterSimulado();
  const doctor = buscarUsuario('medica@alovida.mock')!;

  function send(method: MockMethod, path: string, body: unknown = {}, user: MockUser = doctor, tenant: string | null = TENANT_HOSPITAL) {
    const url = new URL(path, 'http://localhost');
    const route = router.match(method, url.pathname);
    if (!route) throw new Error(`Falta ruta ${method} ${path}`);
    const output = route.handler({
      method,
      path: url.pathname,
      params: route.params,
      query: url.searchParams,
      body,
      headers: tenant === null ? new HttpHeaders() : new HttpHeaders({ 'X-Tenant-Id': tenant }),
      user,
    });
    return isMockReply(output) ? output : { status: 200, body: output };
  }
  const reasonOf = (r: { body: unknown }): string => (r.body as { reason: string }).reason;
  const fieldsOf = (r: { body: unknown }): string[] => (r.body as { details: { fields: string[] } }).details.fields;

  const base = {
    patientProfileId: PACIENTE.id,
    referralType: 'HOSPITALIZATION',
    targetExternalName: 'Hospital de Clínicas',
    requestedServiceText: 'Internación en terapia intensiva',
    clinicalSummary: 'Sepsis de foco urinario.',
  };
  const critical = {
    required: true,
    transportMode: 'AMBULANCE_ADVANCED',
    departureCondition: 'CRITICAL',
    escortProfessionalName: 'Dr. Vaca',
    receiverContacted: true,
    receiverContactName: 'Guardia de terapia',
    departedAt: '2026-10-30T10:00:00.000Z',
  };

  it('emite con traslado y lo devuelve en la vista', () => {
    const created = send('POST', '/referrals', { ...base, transfer: critical });
    expect(created.status).toBe(201);
    const id = (created.body as { id: string }).id;
    expect((send('GET', `/referrals/${id}`).body as { transfer: unknown }).transfer).toMatchObject(critical);
  });

  it('sin traslado la vista trae transfer en null', () => {
    const created = send('POST', '/referrals', base).body as { transfer: unknown };
    expect(created.transfer).toBeNull();
  });

  it('crítico en vehículo particular y sin personal: 400 TRANSFER_UNSAFE_TRANSPORT con los dos campos', () => {
    const r = send('POST', '/referrals', {
      ...base,
      transfer: { ...critical, transportMode: 'PRIVATE_VEHICLE', escortProfessionalName: undefined },
    });
    expect(r.status).toBe(400);
    expect(reasonOf(r)).toBe('TRANSFER_UNSAFE_TRANSPORT');
    expect(fieldsOf(r)).toEqual(['transfer.transportMode', 'transfer.escortProfessionalName']);
  });

  it('el resto de las reglas, con su reason', () => {
    const post = (transfer: object) => send('POST', '/referrals', { ...base, transfer });
    expect(reasonOf(post({ required: true }))).toBe('TRANSFER_INCOMPLETE');
    expect(reasonOf(post({ required: true, transportMode: 'OTHER', departureCondition: 'STABLE' }))).toBe(
      'TRANSFER_DETAIL_REQUIRED',
    );
    expect(reasonOf(post({ ...critical, vitals: { systolicBp: 90, diastolicBp: 95 } }))).toBe(
      'TRANSFER_VITALS_OUT_OF_RANGE',
    );
    expect(reasonOf(post({ ...critical, receiverContacted: false }))).toBe('TRANSFER_RECEIVER_NOT_CONTACTED');
  });

  it('completar la salida fusiona: omitido conserva, null borra, y se vuelve a validar', () => {
    const id = (send('POST', '/referrals', { ...base, transfer: critical }).body as { id: string }).id;
    const updated = send('PATCH', `/referrals/${id}/transfer`, {
      companionName: 'María Pérez',
      vitals: { heartRate: 120 },
      departedAt: null,
    });
    expect(updated.status).toBe(200);
    expect((updated.body as { transfer: Record<string, unknown> }).transfer).toMatchObject({
      transportMode: 'AMBULANCE_ADVANCED',
      companionName: 'María Pérez',
      vitals: { heartRate: 120 },
      departedAt: null,
    });
    const unsafe = send('PATCH', `/referrals/${id}/transfer`, { escortProfessionalName: null });
    expect(reasonOf(unsafe)).toBe('TRANSFER_UNSAFE_TRANSPORT');
  });

  it('la llegada: sólo el destino; quien no lo es recibe 404 REFERRAL_NOT_FOUND', () => {
    const toOther = send('POST', '/referrals', {
      ...base,
      targetExternalName: undefined,
      targetProfileId: '00000000-0000-4000-a000-000000000777',
      transfer: critical,
    }).body as { id: string };
    const r = send('PATCH', `/referrals/${toOther.id}/arrival`, {
      arrivedAt: '2026-10-30T11:00:00.000Z',
      arrivalCondition: 'STABLE',
    });
    expect(r.status).toBe(404);
    expect(reasonOf(r)).toBe('REFERRAL_NOT_FOUND');
  });

  it('el destino registra la llegada una sola vez, no antes de la salida, y después no se corrige la salida', () => {
    const id = uuid('referral-paciente-entrante');
    const noTenant = send(
      'PATCH',
      `/referrals/${id}/arrival`,
      { arrivedAt: new Date().toISOString(), arrivalCondition: 'STABLE' },
      doctor,
      null,
    );
    expect(noTenant.status).toBe(404);
    expect(reasonOf(noTenant)).toBe('REFERRAL_NOT_FOUND');
    const before = send('PATCH', `/referrals/${id}/arrival`, {
      arrivedAt: '2000-01-01T00:00:00.000Z',
      arrivalCondition: 'STABLE',
    });
    expect(reasonOf(before)).toBe('TRANSFER_ARRIVAL_BEFORE_DEPARTURE');
    const ok = send('PATCH', `/referrals/${id}/arrival`, {
      arrivedAt: new Date().toISOString(),
      arrivalCondition: 'UNSTABLE',
      arrivalNotes: ' Llegó con SatO2 90 % ',
    });
    expect(ok.status).toBe(200);
    expect((ok.body as { transfer: Record<string, unknown> }).transfer).toMatchObject({
      arrivalCondition: 'UNSTABLE',
      arrivalNotes: 'Llegó con SatO2 90 %',
      transportMode: 'AMBULANCE_ADVANCED',
    });
    const again = send('PATCH', `/referrals/${id}/arrival`, {
      arrivedAt: new Date().toISOString(),
      arrivalCondition: 'STABLE',
    });
    expect(again.status).toBe(422);
    expect(reasonOf(again)).toBe('REFERRAL_ARRIVAL_ALREADY_RECORDED');
    expect(reasonOf(send('PATCH', `/referrals/${id}/transfer`, { companionName: 'x' }))).toBe(
      'REFERRAL_ARRIVAL_ALREADY_RECORDED',
    );
  });

  it('una anulada no admite traslado ni llegada (422 REFERRAL_ALREADY_CLOSED)', () => {
    const id = (send('POST', '/referrals', { ...base, transfer: critical }).body as { id: string }).id;
    send('PATCH', `/referrals/${id}/cancel`);
    expect(reasonOf(send('PATCH', `/referrals/${id}/transfer`, { companionName: 'x' }))).toBe('REFERRAL_ALREADY_CLOSED');
    expect(
      reasonOf(send('PATCH', `/referrals/${id}/arrival`, { arrivedAt: new Date().toISOString(), arrivalCondition: 'STABLE' })),
    ).toBe('REFERRAL_ALREADY_CLOSED');
  });
});

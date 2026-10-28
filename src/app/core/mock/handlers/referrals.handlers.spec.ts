import { HttpHeaders } from '@angular/common/http';

import { PACIENTE } from '../fixtures/people';
import { isMockReply, MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario, TENANT_HOSPITAL, TENANT_LABORATORIO, type MockUser } from '../mock-session';
import { REFERRAL_STATUS, registerReferrals } from './referrals.handlers';

/**
 * Las derivaciones del simulador. Lo que se fija: que lo emitido se relee
 * (la mutación se puede demostrar de punta a punta en `mockup`), que una
 * equivalente es 409 como en la API, que sin destino no hay alta, y que sólo
 * el rol clínico entra.
 */
describe('derivaciones en el mock', () => {
  const router = new MockRouter();
  registerReferrals(router);
  const doctor = buscarUsuario('medica@alovida.mock')!;
  const patientUser = buscarUsuario('paciente@alovida.mock')!;

  function send(method: MockMethod, path: string, body: unknown = null, user: MockUser = doctor) {
    const url = new URL(path, 'http://localhost');
    const route = router.match(method, url.pathname);
    if (!route) throw new Error(`Falta ruta ${method} ${path}`);
    const output = route.handler({
      method,
      path: url.pathname,
      params: route.params,
      query: url.searchParams,
      body,
      headers: new HttpHeaders(),
      user,
    });
    return isMockReply(output) ? output : { status: 200, body: output };
  }

  it('busca organizaciones por nombre, sin tildes, desde dos letras', () => {
    expect(send('GET', '/referrals/targets?q=s&kind=ORGANIZATION').status).toBe(400);
    const { body } = send('GET', '/referrals/targets?q=lucas&kind=ORGANIZATION') as {
      body: { items: { id: string; kind: string }[] };
    };
    expect(body.items.map((i) => i.id)).toEqual([TENANT_HOSPITAL]);
    expect(body.items[0]?.kind).toBe('ORGANIZATION');
  });

  it('no ofrece a quien busca entre los profesionales', () => {
    const { body } = send('GET', '/referrals/targets?q=ro&kind=PRACTITIONER') as {
      body: { items: { id: string }[] };
    };
    expect(body.items.some((i) => i.id === doctor.practitionerProfileId)).toBe(false);
  });

  it('un destino sin catálogo devuelve una lista vacía, no un error', () => {
    const { status, body } = send('GET', `/referrals/target-services?targetTenantId=${TENANT_LABORATORIO}`) as {
      status: number;
      body: { items: unknown[] };
    };
    expect(status).toBe(200);
    expect(body.items).toEqual([]);
  });

  it('emite, se relee en la lista y una equivalente es 409', () => {
    const offered = send('GET', `/referrals/target-services?targetTenantId=${TENANT_HOSPITAL}`)
      .body as { items: { id: string; name: string }[] };
    const service = offered.items[0]!;
    const payload = {
      patientProfileId: PACIENTE.id,
      sourceEncounterId: 'enc-prueba-derivacion',
      targetTenantId: TENANT_HOSPITAL,
      targetServiceCatalogId: service.id,
      referralType: 'TREATMENT',
      reasonText: 'Rehabilitación',
    };

    const createdReply = send('POST', '/referrals', payload) as {
      status: number;
      body: { id: string; statusConceptId: string };
    };
    expect(createdReply.status).toBe(201);
    expect(createdReply.body.statusConceptId).toBe(REFERRAL_STATUS['REF_REQUESTED']);

    const list = send('GET', `/referrals?patientProfileId=${PACIENTE.id}`).body as {
      id: string;
      referralType: string;
      targetDisplayName: string;
      targetServiceName: string;
    }[];
    const reread = list.find((d) => d.id === createdReply.body.id);
    expect(reread?.referralType).toBe('TREATMENT');
    expect(reread?.targetDisplayName).toBe('Hospital San Lucas');
    expect(reread?.targetServiceName).toBe(service.name);
    // La más reciente primero.
    expect(list[0]?.id).toBe(createdReply.body.id);

    expect(send('POST', '/referrals', payload).status).toBe(409);
  });

  it('sin destino no hay alta', () => {
    expect(send('POST', '/referrals', { patientProfileId: PACIENTE.id }).status).toBe(400);
  });

  it('sólo el rol clínico entra', () => {
    expect(send('GET', `/referrals?patientProfileId=${PACIENTE.id}`, null, patientUser).status).toBe(403);
  });
});

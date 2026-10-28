import { HttpHeaders } from '@angular/common/http';

import { PACIENTE } from '../fixtures/people';
import { isMockReply, MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario, TENANT_HOSPITAL, TENANT_LABORATORIO, type MockUser } from '../mock-session';
import { REFERRAL_STATUS, registrarDerivaciones } from './referrals.handlers';

/**
 * Las derivaciones del simulador. Lo que se fija: que lo emitido se relee
 * (la mutación se puede demostrar de punta a punta en `mockup`), que una
 * equivalente es 409 como en la API, que sin destino no hay alta, y que sólo
 * el rol clínico entra.
 */
describe('derivaciones en el mock', () => {
  const router = new MockRouter();
  registrarDerivaciones(router);
  const medica = buscarUsuario('medica@alovida.mock')!;
  const paciente = buscarUsuario('paciente@alovida.mock')!;

  function pedir(method: MockMethod, path: string, body: unknown = null, user: MockUser = medica) {
    const url = new URL(path, 'http://localhost');
    const route = router.match(method, url.pathname);
    if (!route) throw new Error(`Falta ruta ${method} ${path}`);
    const salida = route.handler({
      method,
      path: url.pathname,
      params: route.params,
      query: url.searchParams,
      body,
      headers: new HttpHeaders(),
      user,
    });
    return isMockReply(salida) ? salida : { status: 200, body: salida };
  }

  it('busca organizaciones por nombre, sin tildes, desde dos letras', () => {
    expect(pedir('GET', '/referrals/targets?q=s&kind=ORGANIZATION').status).toBe(400);
    const { body } = pedir('GET', '/referrals/targets?q=lucas&kind=ORGANIZATION') as {
      body: { items: { id: string; kind: string }[] };
    };
    expect(body.items.map((i) => i.id)).toEqual([TENANT_HOSPITAL]);
    expect(body.items[0]?.kind).toBe('ORGANIZATION');
  });

  it('no ofrece a quien busca entre los profesionales', () => {
    const { body } = pedir('GET', '/referrals/targets?q=ro&kind=PRACTITIONER') as {
      body: { items: { id: string }[] };
    };
    expect(body.items.some((i) => i.id === medica.practitionerProfileId)).toBe(false);
  });

  it('un destino sin catálogo devuelve una lista vacía, no un error', () => {
    const { status, body } = pedir('GET', `/referrals/target-services?targetTenantId=${TENANT_LABORATORIO}`) as {
      status: number;
      body: { items: unknown[] };
    };
    expect(status).toBe(200);
    expect(body.items).toEqual([]);
  });

  it('emite, se relee en la lista y una equivalente es 409', () => {
    const servicios = pedir('GET', `/referrals/target-services?targetTenantId=${TENANT_HOSPITAL}`)
      .body as { items: { id: string; name: string }[] };
    const servicio = servicios.items[0]!;
    const alta = {
      patientProfileId: PACIENTE.id,
      sourceEncounterId: 'enc-prueba-derivacion',
      targetTenantId: TENANT_HOSPITAL,
      targetServiceCatalogId: servicio.id,
      referralType: 'TREATMENT',
      reasonText: 'Rehabilitación',
    };

    const creada = pedir('POST', '/referrals', alta) as {
      status: number;
      body: { id: string; statusConceptId: string };
    };
    expect(creada.status).toBe(201);
    expect(creada.body.statusConceptId).toBe(REFERRAL_STATUS['REF_REQUESTED']);

    const lista = pedir('GET', `/referrals?patientProfileId=${PACIENTE.id}`).body as {
      id: string;
      referralType: string;
      targetDisplayName: string;
      targetServiceName: string;
    }[];
    const releida = lista.find((d) => d.id === creada.body.id);
    expect(releida?.referralType).toBe('TREATMENT');
    expect(releida?.targetDisplayName).toBe('Hospital San Lucas');
    expect(releida?.targetServiceName).toBe(servicio.name);
    // La más reciente primero.
    expect(lista[0]?.id).toBe(creada.body.id);

    expect(pedir('POST', '/referrals', alta).status).toBe(409);
  });

  it('sin destino no hay alta', () => {
    expect(pedir('POST', '/referrals', { patientProfileId: PACIENTE.id }).status).toBe(400);
  });

  it('sólo el rol clínico entra', () => {
    expect(pedir('GET', `/referrals?patientProfileId=${PACIENTE.id}`, null, paciente).status).toBe(403);
  });
});

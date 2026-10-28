import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { uuid } from '../mock-store';
import { registrarAuth } from './auth.handlers';
import {
  registerPractitionerInsurerRequests,
  solicitudesAAseguradoras,
} from './practitioner-insurer-requests.handlers';

interface Fila {
  readonly id: string;
  readonly carrierId: string;
  readonly carrierName: string;
  readonly status: string;
  readonly decisionReasonText: string | null;
}

describe('simulador de la solicitud médico → aseguradora', () => {
  const router = new MockRouter();
  registrarAuth(router);
  registerPractitionerInsurerRequests(router);
  const medica = buscarUsuario('medica@alovida.mock')!;
  const aseguradora = buscarUsuario('aseguradora@alovida.mock')!;
  const paciente = buscarUsuario('paciente@alovida.mock')!;
  const ANDINA = uuid('carrier-andina');
  const CNS = uuid('carrier-cns');

  function call<T>(
    method: MockMethod,
    path: string,
    body: unknown = null,
    user: MockUser | null = medica,
  ): { status: number; body: T } {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const output = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user,
    });
    return isMockReply(output)
      ? { status: output.status, body: output.body as T }
      : { status: 200, body: output as T };
  }

  it('la médica demo ve las suyas con nombre de aseguradora y una de cada estado', () => {
    const { status, body } = call<{ items: Fila[] }>('GET', '/practitioners/me/insurer-requests');

    expect(status).toBe(200);
    expect(body.items.map((i) => i.status).sort()).toEqual(['APPROVED', 'PENDING', 'REJECTED']);
    expect(body.items.every((i) => i.carrierName !== '')).toBe(true);
    expect(body.items.find((i) => i.status === 'REJECTED')?.decisionReasonText).toContain(
      'especialidad',
    );
  });

  it('sin perfil profesional responde 422, no una lista vacía', () => {
    expect(call('GET', '/practitioners/me/insurer-requests', null, paciente).status).toBe(422);
  });

  it('pedir una nueva la deja PENDIENTE; pedirla otra vez es 409', () => {
    const primera = call<{ items: Fila[] }>('POST', '/practitioners/me/insurer-requests', {
      carrierIds: [CNS],
    });
    expect(primera.status).toBe(201);
    expect(primera.body.items.find((i) => i.carrierId === CNS)?.status).toBe('PENDING');

    const segunda = call('POST', '/practitioners/me/insurer-requests', { carrierIds: [CNS] });
    expect(segunda.status).toBe(409);
  });

  it('una aseguradora que no está en el catálogo es 422', () => {
    expect(
      call('POST', '/practitioners/me/insurer-requests', { carrierIds: ['no-existe'] }).status,
    ).toBe(422);
  });

  it('la aseguradora ve sólo las suyas, pendientes primero, y decide con motivo', () => {
    const bandeja = call<{ items: { id: string; status: string }[] }>(
      'GET',
      '/insurance/practitioner-requests',
      null,
      aseguradora,
    );
    expect(bandeja.status).toBe(200);
    expect(bandeja.body.items.length).toBeGreaterThan(0);
    expect(bandeja.body.items[0]!.status).toBe('PENDING');
    const todasDeAndina = bandeja.body.items.every(
      (i) => solicitudesAAseguradoras.get(i.id)?.carrierId === ANDINA,
    );
    expect(todasDeAndina).toBe(true);

    const id = bandeja.body.items[0]!.id;
    const rechazo = call<{ status: string; decisionReasonText: string }>(
      'POST',
      `/insurance/practitioner-requests/${id}/reject`,
      { reason: '  Sin convenio vigente  ' },
      aseguradora,
    );
    expect(rechazo.status).toBe(200);
    expect(rechazo.body.status).toBe('REJECTED');
    expect(rechazo.body.decisionReasonText).toBe('Sin convenio vigente');

    // Lo decidido no se vuelve a decidir.
    expect(
      call('POST', `/insurance/practitioner-requests/${id}/approve`, null, aseguradora).status,
    ).toBe(422);
  });

  it('quien no es la aseguradora no ve ni decide la bandeja', () => {
    expect(call('GET', '/insurance/practitioner-requests', null, medica).status).toBe(403);
  });

  it('el médico retira una pendiente propia, y no la de otro', () => {
    const mias = call<{ items: Fila[] }>('GET', '/practitioners/me/insurer-requests').body.items;
    const pendiente = mias.find((i) => i.status === 'PENDING')!;

    const retirada = call<Fila>(
      'POST',
      `/practitioners/me/insurer-requests/${pendiente.id}/withdraw`,
    );
    expect(retirada.status).toBe(200);
    expect(retirada.body.status).toBe('WITHDRAWN');

    const ajena = solicitudesAAseguradoras.filtrar(
      (s) => s.practitionerProfileId !== medica.practitionerProfileId,
    )[0]!;
    expect(call('POST', `/practitioners/me/insurer-requests/${ajena.id}/withdraw`).status).toBe(
      404,
    );
  });

  it('el alta de médico crea las solicitudes elegidas y devuelve sus ids', () => {
    const alta = call<{ insurerRequestIds?: string[]; affiliationIds?: string[] }>(
      'POST',
      '/iam/auth/register-practitioner',
      {
        email: 'nueva.medica@alovida.mock',
        institutionSlugs: ['clinica-foianini'],
        insurerCarrierIds: [ANDINA],
      },
      null,
    );

    expect(alta.status).toBe(200);
    expect(alta.body.insurerRequestIds).toHaveLength(1);
    expect(alta.body.affiliationIds).toHaveLength(1);
  });

  it('el alta con una aseguradora inexistente es 422 y no crea la cuenta', () => {
    const alta = call(
      'POST',
      '/iam/auth/register-practitioner',
      {
        email: 'otra.medica@alovida.mock',
        insurerCarrierIds: ['no-existe'],
      },
      null,
    );

    expect(alta.status).toBe(422);
  });
});

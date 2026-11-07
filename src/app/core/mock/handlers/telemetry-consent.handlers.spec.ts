import { HttpHeaders } from '@angular/common/http';

import { isMockReply, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { crearRouterSimulado } from './index';
import { trackingConsents } from './telemetry-consent.handlers';

/**
 * Tracking consent in the simulator (M28): always about the signed-in user,
 * append-only, and somebody else's consent answers 404.
 */
describe('tracking consent in the mock', () => {
  const router = crearRouterSimulado();
  const ana = buscarUsuario('paciente@alovida.mock')!;
  const doctor = buscarUsuario('medica@alovida.mock')!;
  const PURPOSE = '9889b3b6-4293-5266-bba2-b27fa26bec2e';

  function send(
    method: MockMethod,
    path: string,
    { body = null, user = ana }: { body?: unknown; user?: MockUser | null } = {},
  ): MockReply {
    const url = new URL(path, 'http://localhost');
    const route = router.match(method, url.pathname);
    if (!route) throw new Error(`Missing route ${method} ${path}`);
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

  const mine = (user: MockUser | null = ana) =>
    send('GET', `/telemetry/tracking-consents/me?purposeDefinitionId=${PURPOSE}`, { user });
  const grant = (user: MockUser | null = ana) =>
    send('POST', '/telemetry/tracking-consents', { body: { purposeDefinitionId: PURPOSE, consentVersion: 'v1' }, user });

  beforeEach(() => trackingConsents.reiniciar());

  it('starts with no decision, grants, and reports the consent id to withdraw', () => {
    expect(mine().body).toEqual({ status: 'NONE', purposeDefinitionId: PURPOSE });

    const granted = grant();
    expect(granted.status).toBe(201);
    const consent = granted.body as { id: string; userId: string; grantedAt: string };
    expect(consent.userId).toBe(ana.id);
    expect(Object.keys(consent)).not.toContain('consentVersion');

    expect(mine().body).toEqual({ status: 'GRANTED', consentId: consent.id, purposeDefinitionId: PURPOSE });
  });

  it('withdraws without deleting: the grant is kept and the status becomes WITHDRAWN', () => {
    const { id } = grant().body as { id: string };

    const withdrawn = send('POST', `/telemetry/tracking-consents/${id}/withdraw`);
    expect(withdrawn.status).toBe(201);
    expect((withdrawn.body as { withdrawnAt?: string }).withdrawnAt).toBeDefined();
    expect(mine().body).toEqual({ status: 'WITHDRAWN', purposeDefinitionId: PURPOSE });
    expect(trackingConsents.tamano).toBe(1);
  });

  it('granting twice does not add a second record; granting after a withdrawal does', () => {
    const first = grant().body as { id: string };
    expect((grant().body as { id: string }).id).toBe(first.id);
    expect(trackingConsents.tamano).toBe(1);

    send('POST', `/telemetry/tracking-consents/${first.id}/withdraw`);
    const second = grant().body as { id: string };
    expect(second.id).not.toBe(first.id);
    expect(trackingConsents.tamano).toBe(2);
    expect(mine().body).toMatchObject({ status: 'GRANTED', consentId: second.id });
  });

  it('withdrawing twice is idempotent and answers the same record', () => {
    const { id } = grant().body as { id: string };
    const once = send('POST', `/telemetry/tracking-consents/${id}/withdraw`).body as { withdrawnAt: string };
    const twice = send('POST', `/telemetry/tracking-consents/${id}/withdraw`);
    expect(twice.status).toBe(201);
    expect((twice.body as { withdrawnAt: string }).withdrawnAt).toBe(once.withdrawnAt);
  });

  it('one person never sees or withdraws another person’s consent (404, not 403)', () => {
    const { id } = grant().body as { id: string };

    expect(mine(doctor).body).toEqual({ status: 'NONE', purposeDefinitionId: PURPOSE });
    expect(send('POST', `/telemetry/tracking-consents/${id}/withdraw`, { user: doctor }).status).toBe(404);
    expect(mine().body).toMatchObject({ status: 'GRANTED' });
  });

  it('rejects a malformed purpose, a missing version and a userId key', () => {
    expect(send('GET', '/telemetry/tracking-consents/me?purposeDefinitionId=nope').status).toBe(400);
    expect(send('GET', '/telemetry/tracking-consents/me').status).toBe(400);

    const post = (body: unknown) => send('POST', '/telemetry/tracking-consents', { body });
    expect(post({ purposeDefinitionId: 'nope', consentVersion: 'v1' }).status).toBe(400);
    expect(post({ purposeDefinitionId: PURPOSE }).status).toBe(400);
    expect(post({ purposeDefinitionId: PURPOSE, consentVersion: '   ' }).status).toBe(400);
    expect(post({ purposeDefinitionId: PURPOSE, consentVersion: 'v1', userId: doctor.id }).status).toBe(400);
    expect(trackingConsents.tamano).toBe(0);
  });

  it('answers 401 without a session on the three routes and 404 for an unknown consent', () => {
    expect(mine(null).status).toBe(401);
    expect(grant(null).status).toBe(401);
    expect(send('POST', '/telemetry/tracking-consents/x/withdraw', { user: null }).status).toBe(401);
    expect(send('POST', '/telemetry/tracking-consents/inexistente/withdraw').status).toBe(404);
  });
});

import { HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { MockRouter } from '../mock-router';
import { buscarUsuario, TENANT_FARMACIA, TENANT_LABORATORIO } from '../mock-session';
import {
  registerOrganizationPracticeHandlers,
  UNVERIFIED_TENANT_ID,
} from './medical-center-onboarding.handlers';

describe('handler del alta de práctica de una organización (CM-11)', () => {
  const router = new MockRouter();
  registerOrganizationPracticeHandlers(router);

  const farmacia = buscarUsuario('farmacia')!;
  const admin = buscarUsuario('admin')!;

  interface Respuesta {
    readonly status: number;
    readonly body: Record<string, unknown>;
  }

  function crear(tenantId: string, body: unknown, quien: typeof farmacia | null = farmacia): Respuesta {
    const path = `/tenants/${tenantId}/practices`;
    const match = router.match('POST', path);
    if (match === null) throw new Error(`No existe POST ${path}`);
    const resultado = match.handler({
      method: 'POST',
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user: quien,
    });
    return resultado as Respuesta;
  }

  const cuerpoValido = (nombre = 'Centro Médico Norte') => ({
    name: nombre,
    site: {
      name: 'Sede Norte',
      addressText: 'Av. San Martín 123',
      latitude: -17.78,
      longitude: -63.18,
    },
  });

  it('crea la práctica y la sede con ids estables', () => {
    const res = crear(TENANT_FARMACIA, cuerpoValido());
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ practiceId: expect.any(String), practiceSiteId: expect.any(String) });
    expect(res.body['practiceId']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4/);
  });

  it('la misma práctica otra vez responde 409', () => {
    crear(TENANT_LABORATORIO, cuerpoValido('Centro Repetido'), admin);
    expect(crear(TENANT_LABORATORIO, cuerpoValido('Centro Repetido'), admin).status).toBe(409);
  });

  it('sin sesión responde 401', () => {
    expect(crear(TENANT_FARMACIA, cuerpoValido(), null).status).toBe(401);
  });

  it('la sesión de otra organización responde 403', () => {
    expect(crear(TENANT_LABORATORIO, cuerpoValido()).status).toBe(403);
  });

  it('una organización que no existe responde 404', () => {
    expect(crear('00000000-0000-4000-8000-000000000000', cuerpoValido(), admin).status).toBe(404);
  });

  it('una organización sin verificar responde 422', () => {
    const res = crear(UNVERIFIED_TENANT_ID, cuerpoValido(), admin);
    expect(res.status).toBe(422);
    expect(res.body['code']).toBe('PRECONDITION_FAILED');
  });

  it('coordenadas fuera de rango responden 400', () => {
    const body = cuerpoValido('Centro Rango');
    const res = crear(TENANT_FARMACIA, { ...body, site: { ...body.site, latitude: 91 } });
    expect(res.status).toBe(400);
  });

  it('sin la sede responde 400', () => {
    expect(crear(TENANT_FARMACIA, { name: 'Centro Sin Sede' }).status).toBe(400);
  });
});

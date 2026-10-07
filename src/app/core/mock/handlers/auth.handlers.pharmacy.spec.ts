import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
import { registrarAuth } from './auth.handlers';
import { registrarDirectorio } from './directory.handlers';
import { TENANT_FARMACIA, usuarioDeAccessToken } from '../mock-session';

/**
 * El alta pública de farmacia contra el simulador (carril de farmacia,
 * 2026-09-29): `POST /iam/auth/register-organization` con
 * `tenantType: 'PHARMACY'` + el bloque `pharmacy.branches` que el cliente
 * inventa (ver el JSDoc de `PharmacyOrganizationRegistration` en
 * `iam.types.ts` y `PENDIENTES-BACKEND.md`, P49). Se ejercita el router
 * directo, como hace `diagnostic-registration.handlers.spec.ts`, para no
 * depender del `HttpClient` real ni de la pantalla.
 */
describe('alta pública de farmacia en el simulador', () => {
  const router = new MockRouter();
  registrarAuth(router);
  registrarDirectorio(router);

  // El alta ahora guarda la cuenta (y un correo repetido es 409): cada caso es
  // una farmacia distinta, con su propio correo, salvo que el caso traiga uno
  // a propósito.
  let altas = 0;
  function conCorreoPropio(body: unknown): unknown {
    const owner = (body as { owner?: { email?: string } } | null)?.owner;
    if (owner?.email !== CUERPO_MINIMO.owner.email) return body;
    altas += 1;
    return { ...(body as object), owner: { ...owner, email: `legal+${altas}@farmacia.test` } };
  }

  function call(method: MockMethod, path: string, body: unknown = null) {
    if (path === '/iam/auth/register-organization') body = conCorreoPropio(body);
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const result = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      // El alta es anónima: nadie inició sesión todavía.
      user: null,
    });
    return isMockReply(result) ? result : { status: 200, body: result };
  }

  const CUERPO_MINIMO = {
    organization: {
      code: 'FARM-1023456789',
      legalName: 'Farmacia San Martín S.R.L.',
      legalEntityType: 'SRL',
      tenantType: 'PHARMACY',
      legalRepresentative: { fullName: 'Mariana Siles', email: 'legal@farmacia.test' },
    },
    owner: { email: 'legal@farmacia.test', password: 'secreto12', displayName: 'Mariana Siles' },
  };

  it('correcto — acepta tenantType PHARMACY y devuelve lo mismo que para la aseguradora', () => {
    const { status, body } = call('POST', '/iam/auth/register-organization', CUERPO_MINIMO);

    expect(status).toBe(200);
    expect(body).toMatchObject({
      code: 'FARM-1023456789',
      status: 'PENDING_VERIFICATION',
      emailVerificationSent: true,
    });
    expect(typeof (body as { tenantId: string }).tenantId).toBe('string');
  });

  it('límite — legalRepresentative sin idNumber ni powerOfAttorneyFileId no es un 400', () => {
    // A diferencia de la aseguradora, el registro de procesos de farmacia no
    // pide la cédula del representante: el simulador lo relaja a propósito
    // (ver el comentario del handler).
    const { status } = call('POST', '/iam/auth/register-organization', CUERPO_MINIMO);

    expect(status).toBe(200);
  });

  it('límite — pharmacy.latitude y pharmacy.longitude juntas, en rango, pasan', () => {
    const cuerpo = {
      ...CUERPO_MINIMO,
      organization: { ...CUERPO_MINIMO.organization, pharmacy: { latitude: -17.78, longitude: -63.18 } },
    };

    const { status } = call('POST', '/iam/auth/register-organization', cuerpo);

    expect(status).toBe(200);
  });

  it('inválido — pharmacy.latitude sin longitude es 400, igual que en el bloque payer', () => {
    const cuerpo = {
      ...CUERPO_MINIMO,
      organization: { ...CUERPO_MINIMO.organization, pharmacy: { latitude: -17.78 } },
    };

    const { status, body } = call('POST', '/iam/auth/register-organization', cuerpo);

    expect(status).toBe(400);
    expect((body as { details: { messages: string[] } }).details.messages).toContain(
      'organization.pharmacy.longitude must be a number',
    );
  });

  it('inválido — una coordenada fuera de rango en pharmacy.branches es 400', () => {
    const cuerpo = {
      ...CUERPO_MINIMO,
      organization: {
        ...CUERPO_MINIMO.organization,
        pharmacy: { branches: [{ name: 'Sucursal Norte', latitude: 200, longitude: -63.18 }] },
      },
    };

    const { status, body } = call('POST', '/iam/auth/register-organization', cuerpo);

    expect(status).toBe(400);
    expect((body as { details: { messages: string[] } }).details.messages).toContain(
      'organization.pharmacy.branches.0.latitude must not be greater than 90',
    );
  });

  it('inválido — un tipo societario fuera del diccionario sigue siendo 400', () => {
    const cuerpo = {
      ...CUERPO_MINIMO,
      organization: { ...CUERPO_MINIMO.organization, legalEntityType: 'NO_EXISTE' },
    };

    const { status } = call('POST', '/iam/auth/register-organization', cuerpo);

    expect(status).toBe(400);
  });

  it('inválido — el correo del owner repetido es 409, no un 200 silencioso', () => {
    const cuerpo = {
      ...CUERPO_MINIMO,
      // La cuenta de demostración del paciente ya existe en `MOCK_USERS`.
      owner: { ...CUERPO_MINIMO.owner, email: 'paciente@alovida.mock' },
    };

    const { status } = call('POST', '/iam/auth/register-organization', cuerpo);

    expect(status).toBe(409);
  });

  it('correcto — la farmacia registrada entra con el correo del representante', () => {
    const correo = 'mariela@farmacia-nueva.test';
    const alta = call('POST', '/iam/auth/register-organization', {
      ...CUERPO_MINIMO,
      owner: { ...CUERPO_MINIMO.owner, email: correo },
    });
    expect(alta.status).toBe(200);

    const sesion = call('POST', '/iam/auth/login', { email: correo, password: 'secreto12' });
    expect(sesion.status).toBe(200);
    const usuario = usuarioDeAccessToken((sesion.body as { accessToken: string }).accessToken);
    expect(usuario?.email).toBe(correo);
    expect(usuario?.tenants).toEqual([TENANT_FARMACIA]);
    expect(usuario?.tenantNames[TENANT_FARMACIA]).toBe('Farmacia San Martín S.R.L.');

    // Y no se puede registrar dos veces el mismo correo.
    const otra = call('POST', '/iam/auth/register-organization', {
      ...CUERPO_MINIMO,
      owner: { ...CUERPO_MINIMO.owner, email: correo },
    });
    expect(otra.status).toBe(409);
  });

  it('correcto — «farmacia@su-dominio» no choca con la cuenta demo y entra a la suya', () => {
    const correo = 'farmacia@sanmartin.test';
    expect(
      call('POST', '/iam/auth/register-organization', {
        ...CUERPO_MINIMO,
        owner: { ...CUERPO_MINIMO.owner, email: correo },
      }).status,
    ).toBe(200);

    const sesion = call('POST', '/iam/auth/login', { email: correo, password: 'secreto12' });
    const usuario = usuarioDeAccessToken((sesion.body as { accessToken: string }).accessToken);
    expect(usuario?.email).toBe(correo);
  });

  it('correcto — la sesión de la farmacia registrada se renueva con su refresh token', () => {
    const correo = 'renueva@farmacia-nueva.test';
    call('POST', '/iam/auth/register-organization', {
      ...CUERPO_MINIMO,
      owner: { ...CUERPO_MINIMO.owner, email: correo },
    });
    const sesion = call('POST', '/iam/auth/login', { email: correo, password: 'secreto12' });
    const renovada = call('POST', '/iam/auth/token/refresh', {
      refreshToken: (sesion.body as { refreshToken: string }).refreshToken,
    });

    expect(renovada.status).toBe(200);
    expect(usuarioDeAccessToken((renovada.body as { accessToken: string }).accessToken)?.email).toBe(correo);
  });

  it('correcto — las sucursales del alta quedan en «Sucursales»', () => {
    const cuerpo = {
      ...CUERPO_MINIMO,
      organization: {
        ...CUERPO_MINIMO.organization,
        pharmacy: { branches: [{ name: 'Sucursal Urubó', latitude: -17.748, longitude: -63.235 }] },
      },
    };
    expect(call('POST', '/iam/auth/register-organization', cuerpo).status).toBe(200);

    const { body } = call('GET', `/tenants/${TENANT_FARMACIA}/branches`);
    const nombres = (body as { items: readonly { name: string }[] }).items.map((b) => b.name);
    expect(nombres).toContain('Sucursal Urubó');
    expect(nombres.filter((n) => n === 'Sucursal Urubó')).toHaveLength(1);
  });
});

import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
import { registrarAuth } from './auth.handlers';
import { registrarDirectorio } from './directory.handlers';
import { TENANT_LABORATORIO, usuarioDeAccessToken } from '../mock-session';

/**
 * El alta pública de laboratorio contra el simulador (carril A de la cuenta de
 * laboratorio, 2026-09-30): `POST /iam/auth/register-organization` con
 * `tenantType: 'DIAGNOSTIC_CENTER'` y el bloque `diagnosticUnit` que el DTO
 * real ya declara, más `diagnosticUnit.branches`, que el cliente le suma (ver
 * `PENDIENTES-BACKEND.md`, P51). Se ejercita el router directo, como el spec
 * de farmacia, para no depender del `HttpClient` real ni de la pantalla.
 */
describe('alta pública de laboratorio en el simulador', () => {
  const router = new MockRouter();
  registrarAuth(router);
  registrarDirectorio(router);

  // El alta ahora guarda la cuenta (y un correo repetido es 409): cada caso es
  // un laboratorio distinto, con su propio correo, salvo que el caso traiga
  // uno a propósito.
  let altas = 0;
  function conCorreoPropio(body: unknown): unknown {
    const owner = (body as { owner?: { email?: string } } | null)?.owner;
    if (owner?.email !== 'legal@labsur.test') return body;
    altas += 1;
    return { ...(body as object), owner: { ...owner, email: `legal+${altas}@labsur.test` } };
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
      code: 'LAB-1023456789',
      legalName: 'Laboratorio Clínico del Sur S.R.L.',
      legalEntityType: 'SRL',
      tenantType: 'DIAGNOSTIC_CENTER',
      diagnosticUnit: {
        name: 'Laboratorio Clínico del Sur S.R.L.',
        primarySite: { name: 'Casa central', address: { lines: ['Av. Cañoto esq. Ballivián 234'] } },
      },
      legalRepresentative: { fullName: 'Ana Paz Rojas', email: 'legal@labsur.test' },
    },
    owner: { email: 'legal@labsur.test', password: 'secreto12', displayName: 'Ana Paz Rojas' },
  };

  /** El cuerpo mínimo con otra unidad diagnóstica. */
  function conUnidad(diagnosticUnit: unknown) {
    return { ...CUERPO_MINIMO, organization: { ...CUERPO_MINIMO.organization, diagnosticUnit } };
  }

  function mensajes(body: unknown): string[] {
    return (body as { details: { messages: string[] } }).details.messages;
  }

  it('correcto — acepta DIAGNOSTIC_CENTER y devuelve la unidad que nació con el alta', () => {
    const { status, body } = call('POST', '/iam/auth/register-organization', CUERPO_MINIMO);

    expect(status).toBe(200);
    expect(body).toMatchObject({
      code: 'LAB-1023456789',
      status: 'PENDING_VERIFICATION',
      emailVerificationSent: true,
    });
    expect(typeof (body as { diagnosticUnitId: string }).diagnosticUnitId).toBe('string');
  });

  it('correcto — la central georreferenciada y una sucursal completa pasan', () => {
    const cuerpo = conUnidad({
      ...CUERPO_MINIMO.organization.diagnosticUnit,
      primarySite: {
        name: 'Casa central',
        address: { lines: ['Av. Cañoto 234'], latitude: -17.78, longitude: -63.18 },
      },
      branches: [
        { name: 'Equipetrol', addressLines: ['Av. San Martín 456'], latitude: -17.76, longitude: -63.19 },
      ],
    });

    const { status } = call('POST', '/iam/auth/register-organization', cuerpo);

    expect(status).toBe(200);
  });

  it('límite — una sucursal sin punto en el mapa pasa: las coordenadas son ambas o ninguna', () => {
    const cuerpo = conUnidad({
      ...CUERPO_MINIMO.organization.diagnosticUnit,
      branches: [{ name: 'Equipetrol', addressLines: [] }],
    });

    const { status } = call('POST', '/iam/auth/register-organization', cuerpo);

    expect(status).toBe(200);
  });

  it('límite — sin bloque diagnosticUnit el alta pasa, pero no nace ninguna unidad', () => {
    const { diagnosticUnit: _sinUnidad, ...organizacion } = CUERPO_MINIMO.organization;

    const { status, body } = call('POST', '/iam/auth/register-organization', {
      ...CUERPO_MINIMO,
      organization: organizacion,
    });

    expect(status).toBe(200);
    expect(body).not.toHaveProperty('diagnosticUnitId');
  });

  it('inválido — la latitud de la central sin longitud es 400', () => {
    const cuerpo = conUnidad({
      ...CUERPO_MINIMO.organization.diagnosticUnit,
      primarySite: { name: 'Casa central', address: { lines: ['Av. Cañoto 234'], latitude: -17.78 } },
    });

    const { status, body } = call('POST', '/iam/auth/register-organization', cuerpo);

    expect(status).toBe(400);
    expect(mensajes(body)).toContain(
      'organization.diagnosticUnit.primarySite.address.longitude must be a number',
    );
  });

  it('inválido — una coordenada fuera de rango en una sucursal es 400', () => {
    const cuerpo = conUnidad({
      ...CUERPO_MINIMO.organization.diagnosticUnit,
      branches: [{ name: 'Norte', addressLines: [], latitude: 200, longitude: -63.18 }],
    });

    const { status, body } = call('POST', '/iam/auth/register-organization', cuerpo);

    expect(status).toBe(400);
    expect(mensajes(body)).toContain(
      'organization.diagnosticUnit.branches.0.latitude must not be greater than 90',
    );
  });

  it('inválido — una sucursal sin nombre es 400', () => {
    const cuerpo = conUnidad({
      ...CUERPO_MINIMO.organization.diagnosticUnit,
      branches: [{ name: '', addressLines: ['Av. San Martín 456'] }],
    });

    const { status, body } = call('POST', '/iam/auth/register-organization', cuerpo);

    expect(status).toBe(400);
    expect(mensajes(body)).toContain('organization.diagnosticUnit.branches.0.name should not be empty');
  });

  it('inválido — diagnosticUnit con otro tipo de organización es 422, como en la API', () => {
    const cuerpo = {
      ...CUERPO_MINIMO,
      organization: { ...CUERPO_MINIMO.organization, tenantType: 'PHARMACY' },
    };

    const { status } = call('POST', '/iam/auth/register-organization', cuerpo);

    expect(status).toBe(422);
  });

  it('inválido — un tipo societario fuera del diccionario (un rótulo) es 400', () => {
    const cuerpo = {
      ...CUERPO_MINIMO,
      organization: { ...CUERPO_MINIMO.organization, legalEntityType: 'S.R.L.' },
    };

    const { status } = call('POST', '/iam/auth/register-organization', cuerpo);

    expect(status).toBe(400);
  });

  it('inválido — el correo del owner repetido es 409', () => {
    const cuerpo = {
      ...CUERPO_MINIMO,
      // La cuenta de demostración del paciente ya existe en `MOCK_USERS`.
      owner: { ...CUERPO_MINIMO.owner, email: 'paciente@alovida.mock' },
    };

    const { status } = call('POST', '/iam/auth/register-organization', cuerpo);

    expect(status).toBe(409);
  });

  it('correcto — el laboratorio registrado entra con el correo del representante, a su panel', () => {
    const correo = 'ana.paz@labsur.test';
    const alta = call('POST', '/iam/auth/register-organization', {
      ...CUERPO_MINIMO,
      owner: { ...CUERPO_MINIMO.owner, email: correo },
    });
    expect(alta.status).toBe(200);

    const sesion = call('POST', '/iam/auth/login', { email: correo, password: 'secreto12' });
    const usuario = usuarioDeAccessToken((sesion.body as { accessToken: string }).accessToken);
    expect(usuario?.email).toBe(correo);
    expect(usuario?.tenants).toEqual([TENANT_LABORATORIO]);
    expect(usuario?.tenantNames[TENANT_LABORATORIO]).toBe('Laboratorio Clínico del Sur S.R.L.');
  });

  it('correcto — las sucursales del alta quedan en «Sucursales», junto a la sede principal', () => {
    const cuerpo = conUnidad({
      ...CUERPO_MINIMO.organization.diagnosticUnit,
      branches: [{ name: 'Toma de muestras Equipetrol', addressLines: ['Av. San Martín 456'], latitude: -17.76, longitude: -63.19 }],
    });
    expect(call('POST', '/iam/auth/register-organization', cuerpo).status).toBe(200);

    const { body } = call('GET', `/tenants/${TENANT_LABORATORIO}/branches`);
    const sucursales = (body as { items: readonly { name: string; description?: string }[] }).items;
    expect(sucursales.map((b) => b.name)).toEqual(expect.arrayContaining(['Sede principal', 'Toma de muestras Equipetrol']));
    expect(sucursales.find((b) => b.name === 'Toma de muestras Equipetrol')?.description).toBe('Av. San Martín 456');
  });
});

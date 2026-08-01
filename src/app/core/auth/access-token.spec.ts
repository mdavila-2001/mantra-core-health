import { decodeAccessToken, isAccessTokenExpired } from './access-token';

/**
 * Codifica como lo hace un JWT real: JSON → **bytes UTF-8** → base64url.
 *
 * El paso por UTF-8 no es adorno. `btoa` sobre la cadena directamente escribe
 * la `ñ` como un solo byte Latin-1, que no es UTF-8 válido, y el decodificador
 * la recibe rota. Es justo el error que este helper tenía y que la prueba de
 * caracteres no ASCII destapó.
 */
function encode(value: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeToken(claims: Record<string, unknown>): string {
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.firma`;
}

describe('decodeAccessToken', () => {
  it('lee los claims que emite la API', () => {
    const claims = decodeAccessToken(
      makeToken({ sub: 'u-1', sid: 's-1', roles: ['USER', 'SECURITY_ADMIN'], tenants: ['t-1'] }),
    );

    expect(claims).toEqual({
      sub: 'u-1',
      sid: 's-1',
      roles: ['USER', 'SECURITY_ADMIN'],
      tenants: ['t-1'],
    });
  });

  it('sobrevive a caracteres no ASCII', () => {
    const claims = decodeAccessToken(
      makeToken({ sub: 'Ana Peña', sid: 's-1', roles: [], tenants: [] }),
    );

    expect(claims?.sub).toBe('Ana Peña');
  });

  it('trata las listas ausentes como vacías, no como error', () => {
    const claims = decodeAccessToken(makeToken({ sub: 'u-1', sid: 's-1' }));

    expect(claims?.roles).toEqual([]);
    expect(claims?.tenants).toEqual([]);
  });

  it('descarta lo que no sea texto dentro de las listas', () => {
    const claims = decodeAccessToken(
      makeToken({ sub: 'u-1', sid: 's-1', roles: ['USER', 42, null], tenants: [] }),
    );

    expect(claims?.roles).toEqual(['USER']);
  });

  it('conserva exp cuando viene', () => {
    const claims = decodeAccessToken(makeToken({ sub: 'u-1', sid: 's-1', exp: 1800000000 }));

    expect(claims?.exp).toBe(1800000000);
  });

  /**
   * El backend declara `sid` y `tenants` opcionales en `jwt-payload.interface.ts`.
   * Exigirlos seria ser mas estricto que el contrato, y un token valido sin
   * `sid` sacaria al login a alguien con sesion abierta.
   */
  it('acepta un token sin `sid`, que el contrato declara opcional', () => {
    const claims = decodeAccessToken(makeToken({ sub: 'u-1', roles: ['USER'] }));

    expect(claims).not.toBeNull();
    expect(claims?.sub).toBe('u-1');
    expect(claims?.sid).toBeUndefined();
  });

  it('lee `name` y `tenantNames` cuando el token los trae', () => {
    const claims = decodeAccessToken(
      makeToken({
        sub: 'u-1',
        sid: 's-1',
        name: 'Ana Peña',
        tenants: ['t-1'],
        tenantNames: { 't-1': 'Hospital Central' },
      }),
    );

    expect(claims?.name).toBe('Ana Peña');
    expect(claims?.tenantNames?.['t-1']).toBe('Hospital Central');
  });

  it('descarta un `tenantNames` que no sea un mapa de textos', () => {
    const claims = decodeAccessToken(
      makeToken({ sub: 'u-1', tenantNames: ['no', 'es', 'un', 'mapa'] }),
    );

    expect(claims?.tenantNames).toBeUndefined();
  });

  describe('devuelve null en vez de lanzar', () => {
    it('ante un token con partes de menos', () => {
      expect(decodeAccessToken('solo.dos')).toBeNull();
    });

    it('ante base64 corrupta', () => {
      expect(decodeAccessToken('cabecera.@@@no-es-base64@@@.firma')).toBeNull();
    });

    it('ante un payload sin `sub`, que es lo único imprescindible', () => {
      expect(decodeAccessToken(makeToken({ roles: ['USER'] }))).toBeNull();
    });

    it('ante una cadena vacía', () => {
      expect(decodeAccessToken('')).toBeNull();
    });
  });
});

describe('isAccessTokenExpired', () => {
  const ahora = new Date('2026-08-01T12:00:00.000Z');
  const enSegundos = (fecha: string): number => new Date(fecha).getTime() / 1000;

  it('un token que vence en una hora está vigente', () => {
    const claims = { sub: 'u', sid: 's', roles: [], tenants: [], exp: enSegundos('2026-08-01T13:00:00.000Z') };

    expect(isAccessTokenExpired(claims, ahora)).toBe(false);
  });

  it('un token vencido se detecta', () => {
    const claims = { sub: 'u', sid: 's', roles: [], tenants: [], exp: enSegundos('2026-08-01T11:59:00.000Z') };

    expect(isAccessTokenExpired(claims, ahora)).toBe(true);
  });

  it('el margen evita mandar uno que expira durante el viaje', () => {
    // Vence en 5 s: con el margen de 10 s se considera ya vencido.
    const claims = { sub: 'u', sid: 's', roles: [], tenants: [], exp: enSegundos('2026-08-01T12:00:05.000Z') };

    expect(isAccessTokenExpired(claims, ahora)).toBe(true);
  });

  it('sin exp se considera vigente: no se inventa una expiración', () => {
    expect(isAccessTokenExpired({ sub: 'u', sid: 's', roles: [], tenants: [] }, ahora)).toBe(false);
  });
});

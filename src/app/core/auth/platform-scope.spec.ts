import { decodeAccessToken } from './access-token';
import { hasPlatformScope, PLATFORM_SCOPE_ROLES } from './platform-scope';
import { safeReturnUrl } from './return-url';

function claimsOf(payload: Record<string, unknown>) {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return decodeAccessToken(`${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'u-1', sid: 's-1', ...payload })}.firma`);
}

describe('hasPlatformScope', () => {
  it.each(PLATFORM_SCOPE_ROLES)('%s global da alcance de plataforma', (rol) => {
    expect(hasPlatformScope(claimsOf({ roles: [rol], tenants: ['t-1', 't-2'] }))).toBe(true);
  });

  it('alcanza con uno entre varios roles', () => {
    expect(hasPlatformScope(claimsOf({ roles: ['USER', 'PLATFORM_ADMIN'] }))).toBe(true);
  });

  it('límite: el mismo código con ámbito de organización NO cuenta (la API lo trata como de ese tenant)', () => {
    const claims = claimsOf({
      roles: ['USER', 'PLATFORM_ADMIN'],
      tenants: ['t-1', 't-2'],
      scopedRoles: { 't-1': ['PLATFORM_ADMIN'] },
    });
    expect(hasPlatformScope(claims)).toBe(false);
  });

  it('límite: ámbito sobre OTRO rol no le quita el alcance al global', () => {
    const claims = claimsOf({ roles: ['PLATFORM_ADMIN', 'PRACTITIONER'], scopedRoles: { 't-1': ['PRACTITIONER'] } });
    expect(hasPlatformScope(claims)).toBe(true);
  });

  it.each([
    ['SECURITY_ADMIN solo', ['SECURITY_ADMIN']],
    ['BUSINESS_ADMIN', ['BUSINESS_ADMIN']],
    ['REPORTING_ADMIN', ['REPORTING_ADMIN']],
    ['médica', ['PRACTITIONER']],
    ['SRE (fuera por ahora, A-2)', ['SRE']],
    ['sin roles', []],
    ['nombre parecido', ['platform_admin', 'PLATFORM_ADMIN_X']],
  ])('NEGATIVO: %s no tiene alcance de plataforma', (_n, roles) => {
    expect(hasPlatformScope(claimsOf({ roles, tenants: ['t-1', 't-2'] }))).toBe(false);
  });

  it('sin claims no hay alcance', () => {
    expect(hasPlatformScope(null)).toBe(false);
  });
});

describe('safeReturnUrl', () => {
  it.each([['/superadmin/observability'], ['/a?b=1'], ['/']])('acepta la ruta interna %s', (u) => {
    expect(safeReturnUrl(u)).toBe(u);
  });

  it.each([[null], [undefined], [''], ['https://otro.sitio'], ['//evil.com'], ['/\\evil.com'], ['dashboard']])(
    'rechaza %s',
    (u) => {
      expect(safeReturnUrl(u)).toBeNull();
    },
  );
});

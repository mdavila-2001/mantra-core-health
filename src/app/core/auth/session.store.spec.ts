import { TestBed } from '@angular/core/testing';

import { SessionStore } from './session.store';

function makeToken(claims: Record<string, unknown>): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.firma`;
}

const UNO = makeToken({ sub: 'u-1', sid: 's-1', roles: ['USER'], tenants: ['t-1'] });
const VARIOS = makeToken({ sub: 'u-1', sid: 's-1', roles: ['USER'], tenants: ['t-1', 't-2'] });
const RENOVADO = makeToken({ sub: 'u-1', sid: 's-2', roles: ['USER'], tenants: ['t-1', 't-2'] });

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(SessionStore);
  });

  it('arranca sin sesión', () => {
    expect(store.isAuthenticated()).toBe(false);
    expect(store.userId()).toBeNull();
    expect(store.activeTenantId()).toBeNull();
  });

  it('deriva el usuario y los roles del token, sin pedir /me', () => {
    store.start({ accessToken: UNO, refreshToken: 'r-1' });

    expect(store.isAuthenticated()).toBe(true);
    expect(store.userId()).toBe('u-1');
    expect(store.roles()).toEqual(['USER']);
  });

  it('un token ilegible deja la sesión como no autenticada', () => {
    store.start({ accessToken: 'no-es-un-jwt', refreshToken: 'r-1' });

    expect(store.isAuthenticated()).toBe(false);
  });

  describe('organizaciones que niegan ahora', () => {
    const CON_NEGADAS = makeToken({ sub: 'u-1', roles: ['USER'], tenants: ['t-1'], deniedTenants: { 't-2': 'OUTSIDE_ALLOWED_HOURS' } });

    it('las organizaciones que niegan no están en `tenants` y se listan con su motivo', () => {
      store.start({ accessToken: CON_NEGADAS, refreshToken: 'r-1' });
      expect(store.tenants()).toEqual(['t-1']);
      expect(store.deniedTenants()).toEqual([{ tenantId: 't-2', reason: 'OUTSIDE_ALLOWED_HOURS' }]);
      // Entra a las demás: no cuenta como sesión restringida.
      expect(store.limitedToEnrollment()).toBe(false);
      expect(store.isAuthenticated()).toBe(true);
    });

    it('sin el claim no hay ninguna', () => {
      store.start({ accessToken: UNO, refreshToken: 'r-1' });
      expect(store.deniedTenants()).toEqual([]);
    });

    it('un refresco que cambia la lista la actualiza sin tocar la organización elegida', () => {
      store.start({ accessToken: VARIOS, refreshToken: 'r-1' });
      store.selectTenant('t-2');
      store.renew({ accessToken: CON_NEGADAS, refreshToken: 'r-2' });
      expect(store.deniedTenants()).toHaveLength(1);
    });
  });

  describe('token de alcance limitado', () => {
    const LIMITADO = makeToken({ sub: 'u-1', roles: [], tenants: [], mfaEnrollment: true });

    it('abre la sesión restringida y la deja así tras renovar con el mismo token', () => {
      store.start({ accessToken: LIMITADO, refreshToken: 'r-1' });
      expect(store.limitedToEnrollment()).toBe(true);
      expect(store.mfaEnrollment()).toBe('required');
      store.renew({ accessToken: LIMITADO, refreshToken: 'r-2' });
      expect(store.mfaEnrollment()).toBe('required');
    });

    it('el refresco con el token completo levanta la restricción', () => {
      store.start({ accessToken: LIMITADO, refreshToken: 'r-1' });
      store.renew({ accessToken: UNO, refreshToken: 'r-2' });
      expect(store.limitedToEnrollment()).toBe(false);
      expect(store.mfaEnrollment()).toBe('done');
    });
  });

  describe('organización activa', () => {
    it('con un solo tenant se resuelve sola', () => {
      store.start({ accessToken: UNO, refreshToken: 'r-1' });

      expect(store.activeTenantId()).toBe('t-1');
      expect(store.needsTenantSelection()).toBe(false);
    });

    it('con varios no adivina: exige elegir', () => {
      store.start({ accessToken: VARIOS, refreshToken: 'r-1' });

      expect(store.activeTenantId()).toBeNull();
      expect(store.needsTenantSelection()).toBe(true);
    });

    it('respeta la elección', () => {
      store.start({ accessToken: VARIOS, refreshToken: 'r-1' });
      store.selectTenant('t-2');

      expect(store.activeTenantId()).toBe('t-2');
      expect(store.needsTenantSelection()).toBe(false);
    });

    it('un `ownTenantId` en el token no decide nada: la API no lo firma (TX-11)', () => {
      const conPropia = makeToken({ sub: 'u-1', tenants: ['t-1', 't-propio'], ownTenantId: 't-propio' });
      store.start({ accessToken: conPropia, refreshToken: 'r-1' });

      expect(store.activeTenantId()).toBeNull();
      expect(store.needsTenantSelection()).toBe(true);

      // Elegir sigue mandando.
      store.selectTenant('t-1');
      expect(store.activeTenantId()).toBe('t-1');
    });

    it('ignora un tenant que el token no incluye', () => {
      store.start({ accessToken: VARIOS, refreshToken: 'r-1' });
      store.selectTenant('t-ajeno');

      expect(store.activeTenantId()).toBeNull();
    });
  });

  describe('roles efectivos (TX-15)', () => {
    /** Misma tabla de verdad que `roles.guard.ts` de la API. */
    const CON_ROLES = makeToken({
      sub: 'u-1',
      roles: ['USER', 'RECEPTIONIST', 'CLINICIAN'],
      tenants: ['t-a', 't-b'],
      // RECEPTIONIST sólo en la clínica A; CLINICIAN no figura: es global.
      scopedRoles: { 't-a': ['RECEPTIONIST'] },
    });

    it('un rol concedido en A vale en A', () => {
      store.start({ accessToken: CON_ROLES, refreshToken: 'r-1' });
      store.selectTenant('t-a');

      expect(store.roles()).toEqual(['USER', 'RECEPTIONIST', 'CLINICIAN']);
    });

    it('un rol concedido sólo en A NO vale con el tenant activo B', () => {
      store.start({ accessToken: CON_ROLES, refreshToken: 'r-1' });
      store.selectTenant('t-b');

      expect(store.roles()).toEqual(['USER', 'CLINICIAN']);
    });

    it('sin organización activa los roles con ámbito no valen; los globales sí', () => {
      store.start({ accessToken: CON_ROLES, refreshToken: 'r-1' });

      expect(store.activeTenantId()).toBeNull();
      expect(store.roles()).toEqual(['USER', 'CLINICIAN']);
    });

    it('SUPERADMIN es comodín: conserva todos aunque haya ámbito', () => {
      const superadmin = makeToken({
        sub: 'u-1',
        roles: ['SUPERADMIN', 'RECEPTIONIST'],
        tenants: ['t-a', 't-b'],
        scopedRoles: { 't-a': ['RECEPTIONIST'] },
      });
      store.start({ accessToken: superadmin, refreshToken: 'r-1' });
      store.selectTenant('t-b');

      expect(store.roles()).toEqual(['SUPERADMIN', 'RECEPTIONIST']);
    });

    it('sin `scopedRoles` es exactamente la lista `roles` del token', () => {
      store.start({ accessToken: VARIOS, refreshToken: 'r-1' });

      expect(store.roles()).toEqual(['USER']);
    });
  });

  describe('canRefresh', () => {
    it('con refresh token guardado se puede renovar', () => {
      store.start({ accessToken: UNO, refreshToken: 'r-1' });

      expect(store.canRefresh()).toBe(true);
    });

    it('sin refresh token y sin modo cookie, no (el cuerpo trae `refreshToken` vacío)', () => {
      store.start({ accessToken: UNO, refreshToken: '' });

      expect(store.canRefresh()).toBe(false);
    });

    it('sin sesión no hay nada que renovar', () => {
      expect(store.canRefresh()).toBe(false);
    });
  });

  describe('tipo de la organización activa', () => {
    it('con un tenant y su tipo en el token, lo resuelve solo', () => {
      const conTipo = makeToken({
        sub: 'u-1',
        tenants: ['t-1'],
        tenantTypes: { 't-1': 'PAYER' },
      });
      store.start({ accessToken: conTipo, refreshToken: 'r-1' });

      expect(store.activeTenantType()).toBe('PAYER');
    });

    it('con varios tenants sin elegir, es null: no hay organización activa', () => {
      const varios = makeToken({
        sub: 'u-1',
        tenants: ['t-1', 't-2'],
        tenantTypes: { 't-1': 'PAYER', 't-2': 'PROVIDER' },
      });
      store.start({ accessToken: varios, refreshToken: 'r-1' });

      expect(store.activeTenantType()).toBeNull();

      store.selectTenant('t-2');
      expect(store.activeTenantType()).toBe('PROVIDER');
    });

    it('sin el claim `tenantTypes` en el token, es null: el menú de hoy', () => {
      store.start({ accessToken: UNO, refreshToken: 'r-1' });

      expect(store.activeTenantType()).toBeNull();
    });

    it('un tipo declarado para un tenant que no está en `tenants` no cuenta', () => {
      const conTipoAjeno = makeToken({
        sub: 'u-1',
        tenants: ['t-1'],
        tenantTypes: { 't-9': 'PAYER' },
      });
      store.start({ accessToken: conTipoAjeno, refreshToken: 'r-1' });

      expect(store.activeTenantType()).toBeNull();
    });

    it('sin sesión, es null', () => {
      expect(store.activeTenantType()).toBeNull();
    });
  });

  it('renovar conserva la organización elegida', () => {
    store.start({ accessToken: VARIOS, refreshToken: 'r-1' });
    store.selectTenant('t-2');

    store.renew({ accessToken: RENOVADO, refreshToken: 'r-2' });

    // La rotación del token es transparente: sacarla de su organización sería
    // una interrupción que la persona no pidió.
    expect(store.activeTenantId()).toBe('t-2');
    expect(store.refreshToken()).toBe('r-2');
  });

  it('abrir una sesión nueva descarta la elección anterior', () => {
    store.start({ accessToken: VARIOS, refreshToken: 'r-1' });
    store.selectTenant('t-2');

    store.start({ accessToken: VARIOS, refreshToken: 'r-9' });

    expect(store.activeTenantId()).toBeNull();
  });

  it('clear deja todo vacío', () => {
    store.start({ accessToken: UNO, refreshToken: 'r-1' });
    store.clear();

    expect(store.isAuthenticated()).toBe(false);
    expect(store.accessToken()).toBeNull();
    expect(store.refreshToken()).toBeNull();
  });

  describe('cuenta de organización', () => {
    const sesion = (claims: Record<string, unknown>): void =>
      store.start({
        accessToken: makeToken({ sub: 'u-1', roles: ['USER'], tenants: ['t-1'], ...claims }),
        refreshToken: 'r-1',
      });

    it('sin sesión no es una cuenta de organización', () => {
      expect(store.isOrganizationAccount()).toBe(false);
    });

    it('el claim accountKind manda sobre la deducción', () => {
      sesion({ accountKind: 'ORGANIZATION' });
      expect(store.isOrganizationAccount()).toBe(true);

      sesion({ accountKind: 'PERSON', tenantTypes: { 't-1': 'PHARMACY' } });
      expect(store.isOrganizationAccount()).toBe(false);
    });

    it('el hospital en modo organización firma ORGANIZATION para todos: quien entra como personal de apoyo o como doctor es una persona, la cuenta del hospital no', () => {
      sesion({ accountKind: 'ORGANIZATION', roles: ['USER', 'SUPPORT_STAFF'], scopedRoles: { 't-1': ['SUPPORT_STAFF'] } });
      expect(store.isOrganizationAccount()).toBe(false);

      sesion({ accountKind: 'ORGANIZATION', roles: ['USER', 'PRACTITIONER'], hpid: 'h-1' });
      expect(store.isOrganizationAccount()).toBe(false);

      // La cuenta del hospital: solo `USER`, sin ningún rol de persona.
      sesion({ accountKind: 'ORGANIZATION', roles: ['USER'] });
      expect(store.isOrganizationAccount()).toBe(true);
    });

    it('sin el claim, una farmacia, un laboratorio o una aseguradora sin perfil de persona lo son', () => {
      for (const tipo of ['PHARMACY', 'DIAGNOSTIC_CENTER', 'PAYER']) {
        sesion({ tenantTypes: { 't-1': tipo } });
        expect(store.isOrganizationAccount()).toBe(true);
      }
    });

    it('sin el claim, quien tiene perfil de paciente o profesional sigue siendo una persona', () => {
      sesion({ tenantTypes: { 't-1': 'PHARMACY' }, pid: 'p-1' });
      expect(store.isOrganizationAccount()).toBe(false);

      sesion({ tenantTypes: { 't-1': 'PHARMACY' }, hpid: 'h-1' });
      expect(store.isOrganizationAccount()).toBe(false);
    });

    it('una clínica (PROVIDER) no es una cuenta de organización: la usan personas', () => {
      sesion({ tenantTypes: { 't-1': 'PROVIDER' } });
      expect(store.isOrganizationAccount()).toBe(false);
    });

    it('un hospital es una cuenta de organización cuando el token lo declara', () => {
      sesion({ accountKind: 'ORGANIZATION', tenantTypes: { 't-1': 'HOSPITAL' } });
      expect(store.isOrganizationAccount()).toBe(true);
      expect(store.activeTenantType()).toBe('HOSPITAL');
    });

    it('un hospital sin el claim sigue siendo una persona: no se deduce, se declara', () => {
      // Pasa por un interruptor por organización (`org_account_mode`): hasta que
      // la API lo emita, un token anterior no cambia de significado.
      sesion({ tenantTypes: { 't-1': 'HOSPITAL' } });
      expect(store.isOrganizationAccount()).toBe(false);
    });

    it('el personal del hospital (PERSON) no hereda la cuenta de organización', () => {
      sesion({ accountKind: 'PERSON', tenantTypes: { 't-1': 'HOSPITAL' } });
      expect(store.isOrganizationAccount()).toBe(false);
    });

    it('farmacia, laboratorio y aseguradora siguen siendo cuenta de organización con el claim', () => {
      for (const tipo of ['PHARMACY', 'DIAGNOSTIC_CENTER', 'PAYER']) {
        sesion({ accountKind: 'ORGANIZATION', tenantTypes: { 't-1': tipo } });
        expect(store.isOrganizationAccount()).toBe(true);
      }
    });
  });
});

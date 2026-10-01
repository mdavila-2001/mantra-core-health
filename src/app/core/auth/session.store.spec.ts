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

    it('con varios y organización propia, arranca en la propia («Mi consultorio»)', () => {
      const conPropia = makeToken({ sub: 'u-1', tenants: ['t-1', 't-propio'], ownTenantId: 't-propio' });
      store.start({ accessToken: conPropia, refreshToken: 'r-1' });

      expect(store.activeTenantId()).toBe('t-propio');
      expect(store.needsTenantSelection()).toBe(false);

      // Y elegir otra sigue mandando.
      store.selectTenant('t-1');
      expect(store.activeTenantId()).toBe('t-1');
    });

    it('una organización propia que no está en el token no se usa', () => {
      const ajena = makeToken({ sub: 'u-1', tenants: ['t-1', 't-2'], ownTenantId: 't-ajeno' });
      store.start({ accessToken: ajena, refreshToken: 'r-1' });

      expect(store.activeTenantId()).toBeNull();
      expect(store.needsTenantSelection()).toBe(true);
    });

    it('ignora un tenant que el token no incluye', () => {
      store.start({ accessToken: VARIOS, refreshToken: 'r-1' });
      store.selectTenant('t-ajeno');

      expect(store.activeTenantId()).toBeNull();
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
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../auth/session.store';
import type { MyUiVisibility } from '../data-access/ui-visibility/ui-visibility.types';
import { UiVisibilityService } from './ui-visibility.service';

/**
 * El motor de visibilidad: carga al abrir sesión, recarga al cambiar de sesión u organización y falla ABIERTO.
 * **La visibilidad no es autorización**: nada de esto protege un endpoint; la API autoriza cada petición.
 */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

const URL = '/me/ui-visibility';

function reglas(hiddenKeys: string[], version = 'v1'): MyUiVisibility {
  return { hiddenKeys, version, generatedAt: '2026-10-31T10:00:00.000Z' };
}

describe('UiVisibilityService', () => {
  let service: UiVisibilityService;
  let session: SessionStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(UiVisibilityService);
    service.start();
    session = TestBed.inject(SessionStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  function abrir(sub: string, extra: Record<string, unknown> = { tenants: ['t-1'] }): void {
    session.start({ accessToken: jwt({ sub, roles: ['USER'], ...extra }), refreshToken: 'r' });
    TestBed.tick();
  }

  it('no sale a la red hasta que se lo arranca: una pantalla que sólo pregunta no pide por su cuenta', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const sinArrancar = TestBed.inject(UiVisibilityService);
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['USER'], tenants: ['t-1'] }),
      refreshToken: 'r',
    });
    TestBed.tick();
    TestBed.inject(HttpTestingController).expectNone(URL);
    expect(sinArrancar.isVisible('nav.pharmacy-orders')).toBe(true);
  });

  it('sin sesión no pide nada y todo es visible (S1: la ruta todavía no autorizó)', () => {
    TestBed.tick();
    http.expectNone(URL);
    expect(service.state().status).toBe('route-auth-pending');
    expect(service.isVisible('nav.pharmacy-orders')).toBe(true);
    expect(service.hiddenKeys()).toEqual([]);
    expect(service.diagnostic().m34).toBe('S1');
  });

  it('al abrir sesión pide las reglas (S2 mientras llega) y oculta sólo lo que el servidor dice', () => {
    abrir('u-1');
    expect(service.state().status).toBe('loading');
    expect(service.isVisible('nav.pharmacy-orders')).toBe(true);

    http.expectOne(URL).flush(reglas(['nav.pharmacy-orders', 'dashboard.today-agenda'], 'v7'));

    expect(service.state().status).toBe('ready');
    expect(service.isVisible('nav.pharmacy-orders')).toBe(false);
    expect(service.isVisible('dashboard.today-agenda')).toBe(false);
    expect(service.isVisible('nav.dashboard')).toBe(true);
    expect(service.version()).toBe('v7');
    expect(service.failedOpen()).toBe(false);
    expect(service.diagnostic()).toMatchObject({ status: 'ready', m34: null, hiddenCount: 2, version: 'v7' });
  });

  it('la cascada de ancestros la resuelve el servidor: el cliente no la recalcula', () => {
    abrir('u-1');
    // El servidor sólo mandó el grupo; el cliente NO deduce que sus pantallas también se ocultan.
    http.expectOne(URL).flush(reglas(['nav.group.atencion']));
    expect(service.isVisible('nav.group.atencion')).toBe(false);
    expect(service.isVisible('nav.schedule')).toBe(true);
  });

  describe('política de fallo: abierto', () => {
    it('un 500 no oculta nada y el estado queda visible (S9 con el id de la petición)', () => {
      abrir('u-1');
      http
        .expectOne(URL)
        .flush({ code: 'INTERNAL', message: 'x', correlationId: 'req-9' }, { status: 500, statusText: 'x' });

      expect(service.state().status).toBe('error');
      expect(service.failedOpen()).toBe(true);
      expect(service.hiddenKeys()).toEqual([]);
      expect(service.isVisible('nav.pharmacy-orders')).toBe(true);
      expect(service.diagnostic()).toMatchObject({ status: 'error', m34: 'S9', failedOpen: true, requestId: 'req-9' });
    });

    it('sin red (status 0) queda offline (S8) y tampoco oculta nada', () => {
      abrir('u-1');
      http.expectOne(URL).error(new ProgressEvent('error'));
      expect(service.state().status).toBe('offline');
      expect(service.failedOpen()).toBe(true);
      expect(service.isVisible('nav.pharmacy-orders')).toBe(true);
    });

    it('un 403 o un 404 del endpoint (backend viejo) tampoco ocultan nada', () => {
      abrir('u-1');
      http.expectOne(URL).flush({ code: 'NOT_FOUND', message: 'x' }, { status: 404, statusText: 'x' });
      expect(service.failedOpen()).toBe(true);
      expect(service.hiddenKeys()).toEqual([]);
    });

    it('un refresco que falla conserva las reglas de ESTA sesión como S7 con su antigüedad', () => {
      abrir('u-1');
      http.expectOne(URL).flush(reglas(['nav.pharmacy-orders']));

      service.refresh();
      http.expectOne(URL).flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'x' });

      expect(service.state().status).toBe('stale');
      expect(service.diagnostic().m34).toBe('S7');
      expect(service.isVisible('nav.pharmacy-orders')).toBe(false);
      expect(service.failedOpen()).toBe(false);
    });
  });

  describe('cambio de sesión', () => {
    it('al cerrar sesión se olvidan las reglas: no pasan a la persona siguiente', () => {
      abrir('u-1');
      http.expectOne(URL).flush(reglas(['nav.pharmacy-orders']));
      expect(service.isVisible('nav.pharmacy-orders')).toBe(false);

      session.clear();
      TestBed.tick();

      expect(service.state().status).toBe('route-auth-pending');
      expect(service.isVisible('nav.pharmacy-orders')).toBe(true);
    });

    it('otra persona en la misma pestaña recibe SUS reglas, no las de la anterior', () => {
      abrir('u-1');
      http.expectOne(URL).flush(reglas(['nav.pharmacy-orders']));
      session.clear();
      TestBed.tick();

      abrir('u-2');
      http.expectOne(URL).flush(reglas(['nav.billing']));

      expect(service.isVisible('nav.pharmacy-orders')).toBe(true);
      expect(service.isVisible('nav.billing')).toBe(false);
    });

    it('una respuesta tardía de la sesión anterior se descarta', () => {
      abrir('u-1');
      const tardia = http.expectOne(URL);
      session.clear();
      TestBed.tick();
      abrir('u-2');
      const vigente = http.expectOne(URL);

      vigente.flush(reglas(['nav.billing']));
      expect(tardia.cancelled).toBe(true);
      expect(service.isVisible('nav.billing')).toBe(false);
    });

    it('al cambiar de organización vuelve a pedir (las reglas TENANT dependen de ella)', () => {
      // Con dos organizaciones y ninguna elegida todavía, ya hay un primer pedido (sin organización activa).
      abrir('u-1', { tenants: ['t-1', 't-2'] });
      session.selectTenant('t-1');
      TestBed.tick();
      const pedidos = http.match(URL);
      expect(pedidos).toHaveLength(2);
      expect(pedidos[0]?.cancelled).toBe(true);
      pedidos[1]?.flush(reglas(['nav.pharmacy-orders']));

      session.selectTenant('t-2');
      TestBed.tick();
      http.expectOne(URL).flush(reglas([]));

      expect(service.isVisible('nav.pharmacy-orders')).toBe(true);
    });

    it('renovar el token de la misma sesión no vuelve a pedir', () => {
      abrir('u-1');
      http.expectOne(URL).flush(reglas([]));
      session.renew({ accessToken: jwt({ sub: 'u-1', roles: ['USER'], tenants: ['t-1'] }), refreshToken: 'r2' });
      TestBed.tick();
      http.expectNone(URL);
    });

    it('con el token de alcance limitado (alta del segundo factor) no pide nada', () => {
      abrir('u-1', { mfaEnrollment: true });
      http.expectNone(URL);
      expect(service.state().status).toBe('route-auth-pending');
    });
  });

  describe('invalidación por versión', () => {
    it('una versión igual no cuesta una petición', () => {
      abrir('u-1');
      http.expectOne(URL).flush(reglas(['nav.billing'], 'v1'));
      service.noteVersion('v1');
      http.expectNone(URL);
    });

    it('una versión distinta recarga y aplica las reglas nuevas', () => {
      abrir('u-1');
      http.expectOne(URL).flush(reglas(['nav.billing'], 'v1'));
      service.noteVersion('v2');
      http.expectOne(URL).flush(reglas([], 'v2'));
      expect(service.version()).toBe('v2');
      expect(service.isVisible('nav.billing')).toBe(true);
    });

    it('un refresco con las mismas reglas no cambia lo que se oculta', () => {
      abrir('u-1');
      http.expectOne(URL).flush(reglas(['nav.billing'], 'v1'));
      service.refresh();
      http.expectOne(URL).flush(reglas(['nav.billing'], 'v1'));
      expect(service.hiddenKeys()).toEqual(['nav.billing']);
    });
  });

  describe('whenSettled (lo que espera la guarda)', () => {
    it('se resuelve cuando llega la respuesta', async () => {
      abrir('u-1');
      let resuelta = false;
      void service.whenSettled().then(() => (resuelta = true));
      await Promise.resolve();
      expect(resuelta).toBe(false);

      http.expectOne(URL).flush(reglas([]));
      await Promise.resolve();
      expect(resuelta).toBe(true);
    });

    it('se resuelve igual tras el plazo si el servidor no contesta: ante la duda, abierto', async () => {
      vi.useFakeTimers();
      abrir('u-1');
      let resuelta = false;
      void service.whenSettled(1000).then(() => (resuelta = true));
      await vi.advanceTimersByTimeAsync(1000);
      expect(resuelta).toBe(true);
      expect(service.isVisible('nav.billing')).toBe(true);
      http.expectOne(URL);
    });

    it('se resuelve ya si no hay nada en vuelo', async () => {
      await expect(service.whenSettled()).resolves.toBeUndefined();
    });
  });
});

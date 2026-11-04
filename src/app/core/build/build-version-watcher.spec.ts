import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GuardsCheckEnd, Router, type Event as RouterEvent } from '@angular/router';
import { Subject } from 'rxjs';

import { BUILD_INFO } from './build-info';
import { BUILD_VERSION_URL, BuildVersionWatcher } from './build-version-watcher';

const PROPIA = { version: '0.1.0', commit: 'abc1234', builtAt: '2026-11-04T10:00:00.000Z' };
const NUEVA = { commit: 'def5678', builtAt: '2026-11-04T12:00:00.000Z' };

function montar(respuesta: () => Promise<Response>, platform = 'browser', extras: { replaceUrl?: boolean } = {}) {
  const events = new Subject<RouterEvent>();
  const abort = vi.fn();
  const currentNavigation = () => ({ extras, abort });
  const fetch = vi.fn(respuesta);
  const location = { assign: vi.fn(), replace: vi.fn() };
  const listeners = new Map<string, () => void>();
  const doc = {
    visibilityState: 'visible',
    addEventListener: (tipo: string, fn: () => void) => listeners.set(tipo, fn),
    removeEventListener: vi.fn(),
    defaultView: {
      fetch,
      location,
      setInterval: vi.fn(() => 1),
      clearInterval: vi.fn(),
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
    },
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: DOCUMENT, useValue: doc },
      { provide: PLATFORM_ID, useValue: platform },
      { provide: BUILD_INFO, useValue: PROPIA },
      { provide: Router, useValue: { events, currentNavigation } },
    ],
  });
  const watcher = TestBed.inject(BuildVersionWatcher);
  return { watcher, events, fetch, location, listeners, abort };
}

const json = (cuerpo: unknown, status = 200) => () =>
  Promise.resolve(new Response(JSON.stringify(cuerpo), { status }));

const guardias = (url: string, shouldActivate = true) =>
  new GuardsCheckEnd(2, url, url, null as never, shouldActivate);

describe('BuildVersionWatcher', () => {
  it('pregunta sin caché y no marca nada si el servidor tiene la misma construcción', async () => {
    const { watcher, fetch } = montar(json({ commit: PROPIA.commit, builtAt: PROPIA.builtAt }));

    await watcher.check();

    expect(fetch).toHaveBeenCalledWith(BUILD_VERSION_URL, expect.objectContaining({ cache: 'no-store' }));
    expect(watcher.outdated()).toBe(false);
  });

  it('una construcción distinta en el servidor marca la pestaña como desactualizada', async () => {
    const { watcher } = montar(json(NUEVA));

    await watcher.check();

    expect(watcher.outdated()).toBe(true);
  });

  it.each([
    ['un 404', json({}, 404)],
    ['un JSON sin forma', json({ hola: 1 })],
    ['HTML en vez de JSON', () => Promise.resolve(new Response('<!doctype html>', { status: 200 }))],
    ['la red caída', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('%s no cambia nada', async (_nombre, respuesta) => {
    const { watcher } = montar(respuesta);

    await watcher.check();

    expect(watcher.outdated()).toBe(false);
  });

  it('desactualizada, la próxima navegación (con los guards superados) es una carga completa', async () => {
    const { watcher, events, location } = montar(json(NUEVA));
    watcher.start();
    await watcher.check();

    events.next(guardias('/my-account/dependents'));

    expect(location.assign).toHaveBeenCalledWith('/my-account/dependents');
  });

  it('aborta la navegación de la SPA vieja: no corren resolvers ni el constructor de la pantalla', async () => {
    const { watcher, events, abort } = montar(json(NUEVA));
    watcher.start();
    await watcher.check();

    events.next(guardias('/invitacion/aceptar'));

    expect(abort).toHaveBeenCalledTimes(1);
  });

  it('respeta replaceUrl: la carga completa reemplaza la entrada del historial', async () => {
    const { watcher, events, location } = montar(json(NUEVA), 'browser', { replaceUrl: true });
    watcher.start();
    await watcher.check();

    events.next(guardias('/dashboard'));

    expect(location.replace).toHaveBeenCalledWith('/dashboard');
    expect(location.assign).not.toHaveBeenCalled();
  });

  it('no recarga si un guard frenó la navegación: lo que se estaba escribiendo sigue ahí', async () => {
    const { watcher, events, location } = montar(json(NUEVA));
    watcher.start();
    await watcher.check();

    events.next(guardias('/my-account/dependents', false));

    expect(location.assign).not.toHaveBeenCalled();
  });

  it('al día, navegar no recarga', async () => {
    const { watcher, events, location } = montar(json({ commit: PROPIA.commit, builtAt: PROPIA.builtAt }));
    watcher.start();
    await watcher.check();

    events.next(guardias('/dashboard'));

    expect(location.assign).not.toHaveBeenCalled();
  });

  it('nunca recarga por su cuenta: volver a la pestaña sólo pregunta', async () => {
    const { watcher, listeners, location, fetch } = montar(json(NUEVA));
    watcher.start();

    listeners.get('visibilitychange')?.();
    await watcher.check();

    expect(fetch).toHaveBeenCalled();
    expect(watcher.outdated()).toBe(true);
    expect(location.assign).not.toHaveBeenCalled();
  });

  it('no hace nada en el servidor', async () => {
    const { watcher, fetch } = montar(json(NUEVA), 'server');

    watcher.start();
    await watcher.check();

    expect(fetch).not.toHaveBeenCalled();
  });
});

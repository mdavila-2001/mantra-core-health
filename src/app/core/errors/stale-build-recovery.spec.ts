import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { BUILD_INFO } from '../build/build-info';
import { BuildVersionWatcher } from '../build/build-version-watcher';
import {
  buildFingerprint,
  isStaleBuildError,
  RECOVERY_KEY,
  recordRouteChunkFailure,
  StaleBuildRecovery,
  takeRouteChunkFailure,
} from './stale-build-recovery';

const BUILD = { version: '0.1.0', commit: 'abc1234', builtAt: '2026-11-04T10:00:00.000Z' };

/** Un documento con `location` y `sessionStorage` controlados por la prueba. */
function documentoFalso(storage: Storage | 'rompe') {
  const location = { assign: vi.fn(), reload: vi.fn() };
  const defaultView = {
    location,
    get sessionStorage(): Storage {
      if (storage === 'rompe') throw new DOMException('denegado', 'SecurityError');
      return storage;
    },
  };
  return { doc: { defaultView } as unknown as Document, location };
}

function memoria(): Storage {
  const datos = new Map<string, string>();
  return {
    get length() {
      return datos.size;
    },
    clear: () => datos.clear(),
    getItem: (k) => datos.get(k) ?? null,
    key: (i) => [...datos.keys()][i] ?? null,
    removeItem: (k) => void datos.delete(k),
    setItem: (k, v) => void datos.set(k, v),
  };
}

interface WatcherFalso {
  check: () => Promise<void>;
  outdated: () => boolean;
  msSinceNavigation: () => number;
}

function montar(
  doc: Document,
  platform = 'browser',
  build = BUILD,
  watcher: WatcherFalso = { check: async () => undefined, outdated: () => false, msSinceNavigation: () => 0 },
): StaleBuildRecovery {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: DOCUMENT, useValue: doc },
      { provide: PLATFORM_ID, useValue: platform },
      { provide: BUILD_INFO, useValue: build },
      { provide: BuildVersionWatcher, useValue: watcher },
    ],
  });
  return TestBed.inject(StaleBuildRecovery);
}

const CHUNK_404 = new TypeError(
  'Failed to fetch dynamically imported module: https://test.alovida.bo/chunk-CT2XDVRL.js',
);

describe('isStaleBuildError', () => {
  it.each([
    ['Chromium', CHUNK_404],
    ['Firefox', new TypeError('error loading dynamically imported module: /chunk-GNVP2HJ5.js')],
    ['Safari', new TypeError('Importing a module script failed.')],
    ['Angular @defer (mensaje de producción)', new Error('NG0750')],
    ['Angular @defer (mensaje largo)', new Error('NG0750: Loading dependencies for `@defer` block failed')],
    ['Angular @defer (código)', Object.assign(new Error('x'), { code: -750 })],
    ['ChunkLoadError', Object.assign(new Error('Loading chunk 42 failed.'), { name: 'ChunkLoadError' })],
    ['texto suelto', 'Failed to fetch dynamically imported module: /chunk-A.js'],
    ['envuelto en cause', new Error('navegación', { cause: CHUNK_404 })],
    ['promesa no atendida', { rejection: CHUNK_404 }],
  ])('reconoce %s', (_nombre, error) => {
    expect(isStaleBuildError(error)).toBe(true);
  });

  it.each([
    ['un error cualquiera', new Error('roto al pintar')],
    ['otro código de Angular', new Error('NG07500 algo')],
    ['NG0100', new Error('NG0100: ExpressionChangedAfterItHasBeenChecked')],
    ['un fallo HTTP', { status: 404, message: 'Http failure response for /patients/me: 404' }],
    ['null', null],
    ['undefined', undefined],
  ])('no confunde %s', (_nombre, error) => {
    expect(isStaleBuildError(error)).toBe(false);
  });

  it('no entra en bucle con causas circulares', () => {
    const a: { message: string; cause?: unknown } = { message: 'a' };
    a.cause = a;
    expect(isStaleBuildError(a)).toBe(false);
  });
});

describe('StaleBuildRecovery', () => {
  it('recarga hacia la URL de destino y deja la huella de la construcción', () => {
    const storage = memoria();
    const { doc, location } = documentoFalso(storage);

    expect(montar(doc).recoverFrom(CHUNK_404, '/dashboard')).toBe(true);

    expect(location.assign).toHaveBeenCalledWith('/dashboard');
    expect(location.reload).not.toHaveBeenCalled();
    expect(storage.getItem(RECOVERY_KEY)).toBe(buildFingerprint(BUILD));
  });

  it('sin destino recarga la página actual', () => {
    const { doc, location } = documentoFalso(memoria());

    expect(montar(doc).recoverFrom(new Error('NG0750'))).toBe(true);

    expect(location.reload).toHaveBeenCalledTimes(1);
  });

  it('una sola vez por construcción: si recargar trajo la misma, no vuelve a recargar', () => {
    const storage = memoria();
    const { doc, location } = documentoFalso(storage);
    const recovery = montar(doc);

    expect(recovery.recoverFrom(CHUNK_404, '/dashboard')).toBe(true);
    // La página «recargó» y sigue siendo la misma construcción: el trozo falta
    // de verdad. Se deja pasar el fallo en vez de recargar en bucle.
    expect(montar(doc).recoverFrom(CHUNK_404, '/dashboard')).toBe(false);
    expect(location.assign).toHaveBeenCalledTimes(1);
  });

  it('una construcción nueva sí tiene su propio intento', () => {
    const storage = memoria();
    const { doc, location } = documentoFalso(storage);

    montar(doc).recoverFrom(CHUNK_404, '/dashboard');
    const nueva = { ...BUILD, commit: 'def5678', builtAt: '2026-11-04T12:00:00.000Z' };
    expect(montar(doc, 'browser', nueva).recoverFrom(CHUNK_404, '/dashboard')).toBe(true);

    expect(location.assign).toHaveBeenCalledTimes(2);
  });

  it('no hace nada con un fallo que no es de versión vieja', () => {
    const storage = memoria();
    const { doc, location } = documentoFalso(storage);

    expect(montar(doc).recoverFrom(new Error('roto al pintar'), '/dashboard')).toBe(false);

    expect(location.assign).not.toHaveBeenCalled();
    expect(storage.getItem(RECOVERY_KEY)).toBeNull();
  });

  it('no hace nada en el servidor', () => {
    const { doc, location } = documentoFalso(memoria());

    expect(montar(doc, 'server').recoverFrom(CHUNK_404, '/dashboard')).toBe(false);

    expect(location.assign).not.toHaveBeenCalled();
  });

  it('sin sessionStorage prefiere mostrar el fallo antes que arriesgar un bucle', () => {
    const { doc, location } = documentoFalso('rompe');

    expect(montar(doc).recoverFrom(CHUNK_404, '/dashboard')).toBe(false);

    expect(location.assign).not.toHaveBeenCalled();
  });
});

describe('StaleBuildRecovery · fallo fuera de una navegación (@defer, simulador)', () => {
  const vigilante = (outdated: boolean, msSinceNavigation: number) => ({
    check: vi.fn(async () => undefined),
    outdated: () => outdated,
    msSinceNavigation: () => msSinceNavigation,
  });

  it('pantalla recién abierta y construcción nueva confirmada: recarga (el caso del panel tras el login)', async () => {
    const { doc, location } = documentoFalso(memoria());
    const watcher = vigilante(true, 1_500);

    expect(await montar(doc, 'browser', BUILD, watcher).recoverFromBackground(new Error('NG0750'))).toBe(true);

    expect(watcher.check).toHaveBeenCalled();
    expect(location.reload).toHaveBeenCalledTimes(1);
  });

  it('a mitad de un formulario no recarga: queda para el próximo cambio de pantalla', async () => {
    const { doc, location } = documentoFalso(memoria());

    expect(await montar(doc, 'browser', BUILD, vigilante(true, 60_000)).recoverFromBackground(new Error('NG0750'))).toBe(false);

    expect(location.reload).not.toHaveBeenCalled();
  });

  it('un corte de red (el servidor no confirma otra construcción) no recarga', async () => {
    const { doc, location } = documentoFalso(memoria());

    expect(await montar(doc, 'browser', BUILD, vigilante(false, 500)).recoverFromBackground(CHUNK_404)).toBe(false);

    expect(location.reload).not.toHaveBeenCalled();
  });

  it('otro tipo de fallo ni siquiera pregunta al servidor', async () => {
    const { doc } = documentoFalso(memoria());
    const watcher = vigilante(true, 500);

    await montar(doc, 'browser', BUILD, watcher).recoverFromBackground(new Error('roto al pintar'));

    expect(watcher.check).not.toHaveBeenCalled();
  });
});

describe('recordRouteChunkFailure / takeRouteChunkFailure', () => {
  afterEach(() => vi.useRealTimers());

  it('entrega el fallo una sola vez', () => {
    recordRouteChunkFailure(CHUNK_404);
    expect(takeRouteChunkFailure()?.error).toBe(CHUNK_404);
    expect(takeRouteChunkFailure()).toBeNull();
  });

  it('descarta un fallo viejo de una navegación que no terminó', () => {
    vi.useFakeTimers();
    recordRouteChunkFailure(CHUNK_404);
    vi.advanceTimersByTime(20_000);
    expect(takeRouteChunkFailure()).toBeNull();
  });
});

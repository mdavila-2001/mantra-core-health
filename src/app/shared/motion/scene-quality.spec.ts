import { TestBed } from '@angular/core/testing';

import { SceneQuality } from './scene-quality';

/**
 * Lo que estas pruebas fijan: cuándo la escena pasa a su versión quieta.
 *
 * La medición real depende del equipo, así que acá los cuadros los entrega la
 * prueba con la marca de tiempo que quiere: un equipo que dibuja cada 16,7 ms
 * y otro que dibuja cada 84 ms, que son las dos medianas medidas en `/auth`.
 */

/** `sessionStorage` en memoria: jsdom con origen opaco no da uno usable. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

function setNavigator(hints: { cores?: number; memoryGb?: number; saveData?: boolean }): void {
  Object.defineProperty(navigator, 'hardwareConcurrency', { value: hints.cores ?? 8, configurable: true });
  Object.defineProperty(navigator, 'deviceMemory', { value: hints.memoryGb, configurable: true });
  Object.defineProperty(navigator, 'connection', {
    value: hints.saveData === undefined ? undefined : { saveData: hints.saveData },
    configurable: true,
  });
}

describe('SceneQuality', () => {
  let frames: FrameRequestCallback[];
  let storage: Storage;

  beforeEach(() => {
    vi.useFakeTimers();
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    storage = memoryStorage();
    vi.stubGlobal('sessionStorage', storage);
    setNavigator({});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  /** Entrega cuadros cada `frameMs` durante la ventana de medición. */
  function deliverFrames(frameMs: number): void {
    vi.advanceTimersByTime(500);
    for (let now = 0; now < 1000; now += frameMs) {
      const pending = frames;
      frames = [];
      for (const frame of pending) {
        frame(now);
      }
    }
    vi.advanceTimersByTime(1000);
  }

  it('con cuadros de 16,7 ms la escena corre completa', async () => {
    const quality = TestBed.inject(SceneQuality);
    const verdict = quality.assess();
    deliverFrames(16.7);

    expect(await verdict).toBe(false);
    expect(quality.lite()).toBe(false);
    expect(storage.getItem('alovida:scene-lite')).toBeNull();
  });

  it('con cuadros de 84 ms pasa a la versión liviana y lo recuerda en la sesión', async () => {
    const quality = TestBed.inject(SceneQuality);
    const verdict = quality.assess();
    deliverFrames(84);

    expect(await verdict).toBe(true);
    expect(quality.lite()).toBe(true);
    expect(storage.getItem('alovida:scene-lite')).toBe('1');
  });

  it('un equipo que declara dos núcleos no se mide: liviana de entrada', async () => {
    setNavigator({ cores: 2 });
    const quality = TestBed.inject(SceneQuality);

    expect(await quality.assess()).toBe(true);
    expect(frames).toHaveLength(0);
  });

  it('el ahorro de datos también la pide liviana', async () => {
    setNavigator({ saveData: true });
    expect(await TestBed.inject(SceneQuality).assess()).toBe(true);
  });

  it('arranca liviana si la sesión ya lo había decidido en otra pantalla', () => {
    vi.stubGlobal('sessionStorage', memoryStorage({ 'alovida:scene-lite': '1' }));
    expect(TestBed.inject(SceneQuality).lite()).toBe(true);
  });

  it('dos escenas que preguntan a la vez comparten una sola medición', async () => {
    const quality = TestBed.inject(SceneQuality);
    const first = quality.assess();
    const second = quality.assess();

    expect(second).toBe(first);
    deliverFrames(16.7);
    await first;
  });
});

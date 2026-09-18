import { parkLoops, pauseLoops, resumeLoops } from './scene-loops';

/**
 * jsdom no implementa la Web Animations API, así que el host devuelve
 * animaciones falsas con lo único que estas funciones leen y escriben: la
 * temporización calculada, `pause`/`play` y `currentTime`.
 */
interface FakeAnimation {
  effect: { getComputedTiming: () => ComputedEffectTiming };
  pause: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  currentTime: number | null;
}

function fakeAnimation(timing: { iterations: number; delay?: number; duration?: number }): FakeAnimation {
  return {
    effect: {
      getComputedTiming: () =>
        ({ iterations: timing.iterations, delay: timing.delay ?? 0, duration: timing.duration ?? 1000 }) as ComputedEffectTiming,
    },
    pause: vi.fn(),
    play: vi.fn(),
    currentTime: null,
  };
}

function sceneWith(animations: FakeAnimation[]): HTMLElement {
  const root = document.createElement('div');
  root.getAnimations = () => animations as unknown as Animation[];
  return root;
}

describe('scene-loops', () => {
  it('pausa y reanuda solo los bucles infinitos, nunca una animación de una vez', () => {
    const loop = fakeAnimation({ iterations: Infinity });
    const intro = fakeAnimation({ iterations: 1 });
    const root = sceneWith([loop, intro]);

    pauseLoops(root);
    resumeLoops(root);

    expect(loop.pause).toHaveBeenCalledOnce();
    expect(loop.play).toHaveBeenCalledOnce();
    expect(intro.pause).not.toHaveBeenCalled();
    expect(intro.play).not.toHaveBeenCalled();
  });

  it('estaciona cada bucle al 0 % de su ciclo, compensando retardos negativos', () => {
    const withoutDelay = fakeAnimation({ iterations: Infinity, delay: 0, duration: 23_000 });
    const positiveDelay = fakeAnimation({ iterations: Infinity, delay: 400, duration: 5200 });
    // Una esfera desfasada 11 s en un ciclo de 29 s vuelve al 0 % a los 18 s.
    const negativeDelay = fakeAnimation({ iterations: Infinity, delay: -11_000, duration: 29_000 });
    const intro = fakeAnimation({ iterations: 1 });

    parkLoops(sceneWith([withoutDelay, positiveDelay, negativeDelay, intro]));

    expect(withoutDelay.currentTime).toBe(0);
    expect(positiveDelay.currentTime).toBe(400);
    expect(negativeDelay.currentTime).toBe(18_000);
    expect(negativeDelay.pause).toHaveBeenCalledOnce();
    expect(intro.currentTime).toBeNull();
  });

  it('no falla donde no hay Web Animations API (SSR, jsdom)', () => {
    const root = document.createElement('div');
    expect(() => {
      pauseLoops(root);
      resumeLoops(root);
      parkLoops(root);
    }).not.toThrow();
  });
});

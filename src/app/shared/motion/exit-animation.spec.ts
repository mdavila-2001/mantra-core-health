import { vi } from 'vitest';

import { playExitAnimation } from './exit-animation';

/**
 * Lo que estas pruebas fijan: la salida de una superficie nunca la deja
 * abierta. Si no hay nada que animar, cierra en el acto (y en el mismo turno,
 * para que quien la usa no cambie de comportamiento); si hay, cierra al
 * terminar la animación, y una sola vez.
 */
describe('playExitAnimation', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function fijarReducedMotion(activo: boolean): void {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (consulta: string) => ({
        matches: activo && consulta.includes('prefers-reduced-motion'),
        media: consulta,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
  }

  function superficie(animaciones: Partial<Animation>[] | null): HTMLElement {
    const elemento = document.createElement('div');
    if (animaciones !== null) {
      elemento.getAnimations = () => animaciones as Animation[];
    }
    return elemento;
  }

  it('sin getAnimations (servidor, jsdom) cierra en el acto', () => {
    fijarReducedMotion(false);
    const done = vi.fn();
    const elemento = document.createElement('div');
    Object.defineProperty(elemento, 'getAnimations', { value: undefined });

    playExitAnimation(elemento, 'pulse-leaving', done);

    expect(done).toHaveBeenCalledTimes(1);
  });

  it('con movimiento reducido cierra en el acto y no marca la salida', () => {
    fijarReducedMotion(true);
    const done = vi.fn();
    const elemento = superficie([{ finished: new Promise(() => undefined) }]);

    playExitAnimation(elemento, 'pulse-leaving', done);

    expect(done).toHaveBeenCalledTimes(1);
    expect(elemento.classList).not.toContain('pulse-leaving');
  });

  it('si la clase no anima nada, cierra en el acto y la quita', () => {
    fijarReducedMotion(false);
    const done = vi.fn();
    const elemento = superficie([]);

    playExitAnimation(elemento, 'pulse-leaving', done);

    expect(done).toHaveBeenCalledTimes(1);
    expect(elemento.classList).not.toContain('pulse-leaving');
  });

  it('con animación, espera a que termine y cierra una sola vez', async () => {
    fijarReducedMotion(false);
    const done = vi.fn();
    let terminar!: () => void;
    const finished = new Promise<Animation>((resolve) => {
      terminar = () => resolve({} as Animation);
    });
    const elemento = superficie([{ finished }]);

    playExitAnimation(elemento, 'pulse-leaving', done);
    expect(elemento.classList).toContain('pulse-leaving');
    expect(done).not.toHaveBeenCalled();

    terminar();
    await finished;
    await Promise.resolve();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('si la animación nunca termina, el techo cierra igual', () => {
    vi.useFakeTimers();
    fijarReducedMotion(false);
    const done = vi.fn();
    const elemento = superficie([{ finished: new Promise(() => undefined) }]);

    playExitAnimation(elemento, 'pulse-leaving', done);
    expect(done).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(done).toHaveBeenCalledTimes(1);
  });
});

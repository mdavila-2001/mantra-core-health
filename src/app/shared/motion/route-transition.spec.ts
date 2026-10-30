import { readFileSync } from 'node:fs';

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withViewTransitions } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { prefersReducedMotion } from './motion-tokens';
import { ROUTE_VIEW_TRANSITION_OPTIONS } from './route-transition';

/**
 * Lo que estas pruebas fijan (issue #1449).
 *
 * Con `prefers-reduced-motion: reduce` la app saltaba cada transición de ruta
 * con `transition.skipTransition()`. Según la especificación eso rechaza
 * `ready` con `AbortError: Transition was skipped`, y el router —que engancha
 * un `.catch` a `ready`, `finished` y `updateCallbackDone`— lo escribía con
 * `console.error` en cada navegación.
 *
 * jsdom no tiene `document.startViewTransition`, así que se instala un doble
 * que sigue la parte de la especificación que importa acá: `skipTransition()`
 * antes de que `ready` resuelva lo rechaza con `AbortError`. El router real es
 * el de Angular; lo único simulado es el navegador.
 */

@Component({ selector: 'app-vacio', template: '' })
class Vacio {}

/** Doble de `ViewTransition` con la semántica de rechazo de la especificación. */
interface TransicionFalsa {
  readonly ready: Promise<undefined>;
  readonly finished: Promise<undefined>;
  readonly updateCallbackDone: Promise<undefined>;
  readonly skipTransition: ReturnType<typeof vi.fn>;
  /** `true` cuando `ready` terminó resuelta y no rechazada. */
  readonly readyResuelta: () => boolean;
}

function instalarStartViewTransition(): TransicionFalsa[] {
  const creadas: TransicionFalsa[] = [];

  (document as unknown as { startViewTransition: unknown }).startViewTransition = vi.fn(
    (actualizar: () => Promise<void> | void) => {
      let resolverReady!: () => void;
      let rechazarReady!: (motivo: unknown) => void;
      let resolverFinished!: () => void;
      let resuelta = false;
      let asentada = false;

      const ready = new Promise<undefined>((resolve, reject) => {
        resolverReady = () => resolve(undefined);
        rechazarReady = reject;
      });
      const finished = new Promise<undefined>((resolve) => {
        resolverFinished = () => resolve(undefined);
      });
      const updateCallbackDone = new Promise<undefined>((resolve) => {
        // El navegador llama a la función de actualización en el cuadro
        // siguiente, no dentro de `startViewTransition`.
        queueMicrotask(() => {
          void Promise.resolve(actualizar()).then(() => {
            if (!asentada) {
              asentada = true;
              resuelta = true;
              resolverReady();
            }
            resolverFinished();
            resolve(undefined);
          });
        });
      });

      const skipTransition = vi.fn(() => {
        if (asentada) return;
        asentada = true;
        // Lo que dice la especificación: saltar antes de `ready` lo rechaza.
        rechazarReady(new DOMException('Transition was skipped', 'AbortError'));
        resolverFinished();
      });

      const transicion: TransicionFalsa = {
        ready,
        finished,
        updateCallbackDone,
        skipTransition,
        readyResuelta: () => resuelta,
      };
      creadas.push(transicion);
      return transicion;
    },
  );

  return creadas;
}

function fijarReducedMotion(activo: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (consulta: string) => ({
      matches: activo && consulta.includes('prefers-reduced-motion'),
      media: consulta,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
    }),
  });
}

/** Deja correr las promesas y los `setTimeout` del router tras navegar. */
async function asentar(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 20));
}

describe('transición entre rutas con movimiento reducido (#1449)', () => {
  let errores: ReturnType<typeof vi.spyOn>;
  let transiciones: TransicionFalsa[];

  beforeEach(() => {
    errores = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    transiciones = instalarStartViewTransition();
  });

  afterEach(() => {
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  function configurar(opciones: Parameters<typeof withViewTransitions>[0]): Router {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'a', component: Vacio },
            { path: 'b', component: Vacio },
            { path: 'c', component: Vacio },
          ],
          withViewTransitions(opciones),
        ),
      ],
    });
    return TestBed.inject(Router);
  }

  it('el doble reproduce el bug: saltar la transición sí deja AbortError en la consola', async () => {
    // Control de la prueba: con el comportamiento anterior (saltar con
    // movimiento reducido) el router registra el rechazo. Sin esto, un doble
    // que nunca rechazara haría pasar las pruebas de abajo sin probar nada.
    fijarReducedMotion(true);
    const router = configurar({
      skipInitialTransition: true,
      onViewTransitionCreated: ({ transition }) => {
        if (prefersReducedMotion()) {
          transition.skipTransition();
        }
      },
    });

    await router.navigateByUrl('/a');
    await router.navigateByUrl('/b');
    await asentar();

    const abortos = errores.mock.calls.filter(([motivo]: unknown[]) =>
      /Transition was skipped/u.test(String((motivo as Error | undefined)?.message ?? motivo)),
    );
    expect(abortos.length).toBeGreaterThan(0);
  });

  it('con movimiento reducido NO se salta la transición ni se escribe nada en la consola', async () => {
    fijarReducedMotion(true);
    const router = configurar(ROUTE_VIEW_TRANSITION_OPTIONS);

    await router.navigateByUrl('/a');
    await router.navigateByUrl('/b');
    await router.navigateByUrl('/c');
    await asentar();

    // La navegación ocurrió y las transiciones se crearon: el comportamiento
    // de navegación no cambia, sólo deja de rechazarse `ready`.
    expect(router.url).toBe('/c');
    expect(transiciones.length).toBeGreaterThanOrEqual(2);
    for (const transicion of transiciones) {
      expect(transicion.skipTransition).not.toHaveBeenCalled();
      expect(transicion.readyResuelta()).toBe(true);
      await expect(transicion.ready).resolves.toBeUndefined();
    }
    expect(errores).not.toHaveBeenCalled();
  });

  it('sin movimiento reducido tampoco se salta ni se registra nada', async () => {
    fijarReducedMotion(false);
    const router = configurar(ROUTE_VIEW_TRANSITION_OPTIONS);

    await router.navigateByUrl('/a');
    await router.navigateByUrl('/b');
    await asentar();

    expect(router.url).toBe('/b');
    expect(transiciones.length).toBeGreaterThanOrEqual(1);
    for (const transicion of transiciones) {
      expect(transicion.skipTransition).not.toHaveBeenCalled();
    }
    expect(errores).not.toHaveBeenCalled();
  });

  it('la primera navegación sigue sin transición (skipInitialTransition)', async () => {
    fijarReducedMotion(false);
    const router = configurar(ROUTE_VIEW_TRANSITION_OPTIONS);

    await router.navigateByUrl('/a');
    await asentar();
    expect(transiciones).toHaveLength(0);

    await router.navigateByUrl('/b');
    await asentar();
    expect(transiciones).toHaveLength(1);
  });

  it('las opciones no traen un onViewTransitionCreated que salte transiciones', () => {
    expect(ROUTE_VIEW_TRANSITION_OPTIONS.skipInitialTransition).toBe(true);
    expect(ROUTE_VIEW_TRANSITION_OPTIONS.onViewTransitionCreated).toBeUndefined();
  });

  describe('app.config y styles.css', () => {
    it('app.config usa las opciones compartidas y no vuelve a llamar skipTransition', () => {
      const config = readFileSync('src/app/app.config.ts', 'utf8');

      expect(config).toContain('withViewTransitions(ROUTE_VIEW_TRANSITION_OPTIONS)');
      expect(config).not.toMatch(/\.skipTransition\s*\(/u);
    });

    /**
     * jsdom no evalúa las media queries de una hoja: la regla se verifica sobre
     * el archivo, igual que en el Spinner y el Skeleton. Es lo que reemplaza al
     * salto: sin esta regla la transición correría con su fundido.
     */
    it('el bloque prefers-reduced-motion apaga la animación de todas las pseudo-capas', () => {
      const css = readFileSync('src/styles.css', 'utf8');
      const bloque = css
        .split('@media (prefers-reduced-motion: reduce)')
        .find((trozo) => trozo.includes('::view-transition-group(*)'));

      expect(bloque, 'falta la regla de pseudo-capas en un bloque reduce').toBeDefined();
      if (bloque === undefined) return;
      for (const capa of ['group', 'old', 'new']) {
        expect(bloque).toContain(`::view-transition-${capa}(*)`);
      }
      expect(bloque).toMatch(/::view-transition-new\(\*\)[^}]*animation:\s*none\s*!important/u);
    });
  });
});

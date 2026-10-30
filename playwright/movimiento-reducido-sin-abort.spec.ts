/**
 * Issue #1449 — con `prefers-reduced-motion: reduce` la navegación del router
 * no debe dejar «AbortError: Transition was skipped» en la consola.
 *
 * El router de Angular engancha un `.catch` que hace `console.error` (en
 * desarrollo) a `ready`, `finished` y `updateCallbackDone` de cada
 * `ViewTransition`. Llamar a `transition.skipTransition()` rechaza `ready` con
 * ese `AbortError`, así que saltar la transición para respetar el movimiento
 * reducido ensuciaba la consola en cada navegación. La app ya no la salta: la
 * deja correr con las animaciones de las pseudo-capas apagadas
 * (`src/styles.css`, bloque `prefers-reduced-motion`).
 *
 * Corre contra `ng serve` en modo demo (simulador), por ejemplo:
 *
 *   yarn ng serve --configuration development,demo --port 4321 --no-hmr
 *   E2E_BASE_URL=http://localhost:4321 yarn playwright test \
 *     playwright/movimiento-reducido-sin-abort.spec.ts
 *
 * Nunca se espera `networkidle` (con HMR no llega: CLAUDE.md §5).
 */
import { expect, test, type Page } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';

/** Lo que la consola y la página reportan: errores en general y AbortError en particular. */
interface Consola {
  /** `AbortError` / «Transition was skipped», sea cual sea el nivel del mensaje. */
  readonly abortos: string[];
  /** Cualquier otro error de consola o de página (se informa, no es el tema del issue). */
  readonly otros: string[];
}

function recogerConsola(page: Page): Consola {
  const consola: Consola = { abortos: [], otros: [] };
  const registrar = (texto: string): void => {
    (/AbortError|Transition was skipped/u.test(texto) ? consola.abortos : consola.otros).push(texto);
  };
  page.on('pageerror', (error) => registrar(`pageerror: ${error.message}`));
  page.on('console', (msg) => {
    const texto = msg.text();
    if (msg.type() === 'error' || /AbortError|Transition was skipped/u.test(texto)) {
      registrar(`console.${msg.type()}: ${texto}`);
    }
  });
  // Un 404 de recurso no dice qué recurso en la consola: se anota la URL.
  page.on('response', (respuesta) => {
    if (respuesta.status() >= 400) consola.otros.push(`HTTP ${respuesta.status()} ${respuesta.url()}`);
  });
  return consola;
}

/**
 * Navega por el router —clic en enlaces internos, no `goto`— a unas cuantas
 * rutas distintas. Cada clic es una navegación con su `startViewTransition`.
 */
async function navegarPorElRouter(page: Page, veces: number): Promise<string[]> {
  const visitadas: string[] = [];
  for (let i = 0; i < veces; i += 1) {
    const destinos = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]'))
        .map((a) => a.getAttribute('href') ?? '')
        .filter((href) => href !== '' && !href.startsWith('/auth') && !href.includes('#')),
    );
    const actual = new URL(page.url()).pathname;
    const siguiente = destinos.find((href) => href.split('?')[0] !== actual && !visitadas.includes(href));
    if (!siguiente) break;
    visitadas.push(siguiente);
    await page.locator(`a[href="${siguiente}"]`).first().click();
    await page.waitForURL((url) => url.pathname + url.search === siguiente || url.pathname === siguiente.split('?')[0]);
    await esperarAQueSeAsiente(page);
  }
  return visitadas;
}

test.describe('Issue #1449 — movimiento reducido y View Transitions', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('navegar con movimiento reducido no deja AbortError en la consola', async ({ page }) => {
    const consola = recogerConsola(page);

    // La preferencia está de verdad emulada; si no, la prueba no prueba nada.
    await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' });
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);

    await entrarAlSimulador(page, 'paciente', BASE);
    await esperarAQueSeAsiente(page);

    const visitadas = await navegarPorElRouter(page, 5);
    // Sin navegaciones del router no hubo transiciones que vigilar.
    expect(visitadas.length).toBeGreaterThanOrEqual(3);

    // Otros errores (un 404 de un recurso de la maqueta, por ejemplo) no son el
    // tema de este issue: se adjuntan al informe, no lo tumban.
    if (consola.otros.length > 0) {
      test.info().annotations.push({ type: 'otros errores de consola', description: consola.otros.join('\n') });
    }
    expect(
      consola.abortos,
      `AbortError con movimiento reducido:\n${consola.abortos.join('\n')}`,
    ).toEqual([]);
  });

  /**
   * Control de la propia captura: reintroduce el comportamiento anterior desde
   * fuera (envuelve `startViewTransition` y salta cada transición apenas se
   * crea, como hacía `onViewTransitionCreated`). Si la consola de la app real
   * no mostrara el `AbortError`, la prueba de arriba pasaría sin probar nada.
   */
  test('control: saltar cada transición SÍ deja AbortError en la consola', async ({ page }) => {
    await page.addInitScript(() => {
      const original = Document.prototype.startViewTransition;
      Document.prototype.startViewTransition = function (this: Document, ...args: unknown[]) {
        const transicion = (original as (...a: unknown[]) => ViewTransition).apply(this, args);
        queueMicrotask(() => transicion.skipTransition());
        return transicion;
      } as typeof Document.prototype.startViewTransition;
    });
    const consola = recogerConsola(page);

    await entrarAlSimulador(page, 'paciente', BASE);
    await esperarAQueSeAsiente(page);
    await navegarPorElRouter(page, 3);

    expect(consola.abortos.length).toBeGreaterThan(0);
    expect(consola.abortos.join('\n')).toContain('Transition was skipped');
  });

  test('las pseudo-capas de la transición no animan con movimiento reducido', async ({ page }) => {
    await entrarAlSimulador(page, 'paciente', BASE);
    await esperarAQueSeAsiente(page);

    // Se dispara una transición propia y se mide la animación que el navegador
    // le aplica al contenido. `ready` resuelve: es la transición que el router
    // ya no salta.
    const medido = await page.evaluate(async () => {
      const transicion = document.startViewTransition(() => undefined);
      await transicion.ready;
      const animaciones = document.getAnimations().filter((a) => {
        const objetivo = (a.effect as KeyframeEffect | null)?.pseudoElement ?? '';
        return objetivo.startsWith('::view-transition');
      });
      const resultado = animaciones.map((a) => ({
        pseudo: (a.effect as KeyframeEffect).pseudoElement,
        ms: a.effect?.getComputedTiming().duration,
      }));
      await transicion.finished;
      return resultado;
    });

    // Con la regla puesta no queda ninguna animación de pseudo-capa corriendo.
    expect(medido).toEqual([]);
  });
});

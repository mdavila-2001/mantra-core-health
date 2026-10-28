import { expect, type Page } from '@playwright/test';

/**
 * Una captura que sirve de evidencia: la pantalla destino quieta y entera.
 *
 * Tres cosas la arruinaban (revisión visual del 28/10/2026):
 *
 * - **Las transiciones de vista** (`withViewTransitions`): una captura tomada
 *   en medio pinta la pantalla vieja y la nueva superpuestas. La app las salta
 *   con `prefers-reduced-motion`, así que las specs de evidencia corren con
 *   `reducedMotion: 'reduce'`; acá además se espera a que no quede ninguna
 *   animación viva.
 * - **`fullPage`** sobre un área con scroll interno (`.app-main`): Playwright
 *   agranda la ventana y el armazón se recompone a medias. Se captura la
 *   ventana; quien necesita ver todo usa una ventana más alta.
 * - **El nombre**: el archivo dice el ancho; se comprueba que sea el real.
 */
export async function capturar(page: Page, ruta: string): Promise<void> {
  const ancho = /-(\d{3,4})\.png$/.exec(ruta)?.[1];
  if (ancho !== undefined) {
    expect(page.viewportSize()?.width, `el nombre ${ruta} no coincide con la ventana`).toBe(
      Number(ancho),
    );
  }
  await page.evaluate(async () => {
    const cuadro = () => new Promise<void>((listo) => requestAnimationFrame(() => listo()));
    for (let intento = 0; intento < 40; intento++) {
      await cuadro();
      await cuadro();
      const vivas = document
        .getAnimations()
        .filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity);
      if (vivas.length === 0) return;
    }
  });
  await page.screenshot({ path: ruta, animations: 'disabled', caret: 'hide' });
}

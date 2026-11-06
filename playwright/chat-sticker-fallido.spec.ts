import { expect, test, type Page } from '@playwright/test';

import { entrar } from './support/sesion';

/**
 * A failed sticker has no bubble behind it: «No se envió · Reintentar ·
 * Descartar» used to inherit the white text of the own bubble and vanished
 * on the light background. It now sits on its own error surface.
 *
 * The mockup never fails a send, so the chat client is made to fail from the
 * page (dev build exposes `window.ng`): the store then walks its real error
 * path, the same one a rejected request takes.
 */
async function fallarEnvios(page: Page): Promise<void> {
  await page.evaluate(() => {
    interface Composer { store: { community: { sendMessage: unknown } } }
    const ng = (window as unknown as { ng: { getComponent(el: Element): Composer } }).ng;
    const composer = ng.getComponent(document.querySelector('app-composer')!);
    composer.store.community.sendMessage = () => ({
      subscribe: (o: { error?: (e: unknown) => void }) => {
        o.error?.(new Error('Envío rechazado'));
        return { unsubscribe: () => undefined };
      },
    });
  });
}

const luminancia = (rgb: string): number => {
  const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

test('un sticker que no se envió deja legible «No se envió» y sus acciones', async ({ page }) => {
  await entrar(page, { rol: 'paciente', identificador: 'paciente@alovida.mock', clave: 'mockup', nombre: 'Paciente' });
  await page.goto('/messaging');
  await page.getByTestId('conversacion').first().click();
  await expect(page.locator('app-composer')).toBeVisible({ timeout: 30_000 });

  await fallarEnvios(page);
  await page.getByTestId('composer-emojis').click();
  await page.getByTestId('composer-solapa-stickers').click();
  await page.getByTestId('composer-sticker').first().click();

  const reintento = page.locator('.hilo__burbuja.is-sticker .hilo__reintento').last();
  await expect(reintento).toContainText('No se envió');
  await expect(reintento.getByTestId('hilo-reintentar')).toBeVisible();
  await expect(reintento.getByTestId('hilo-descartar')).toBeVisible();

  // The background actually behind the text: the first non-transparent one up the tree.
  const { color, fondo } = await reintento.evaluate((el) => {
    let nodo: Element | null = el;
    let fondo = 'rgb(255, 255, 255)';
    while (nodo) {
      const bg = getComputedStyle(nodo).backgroundColor;
      if (bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) {
        fondo = bg;
        break;
      }
      nodo = nodo.parentElement;
    }
    return { color: getComputedStyle(el).color, fondo };
  });
  const [claro, oscuro] = [luminancia(color), luminancia(fondo)].sort((a, b) => b - a);
  expect((claro! + 0.05) / (oscuro! + 0.05)).toBeGreaterThanOrEqual(4.5);

  await reintento.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/playwright/chat-sticker-fallido.png' });
});

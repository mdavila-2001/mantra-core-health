import { expect, test, type Page } from '@playwright/test';

import { entrar } from './support/sesion';

/**
 * Forward several messages to several chats at once.
 *
 * «Seleccionar» in a message's menu enters selection mode; more messages are
 * chosen by tapping them; the bar forwards them; the dialog takes several
 * chats. Each destination receives them in thread order. Proved end to end:
 * UI → send → the mockup's persistence (sessionStorage) → reload → UI.
 */
const TEXTO = `Reenvío de prueba ${Date.now()}`;

async function abrirChat(page: Page, nombre: RegExp): Promise<void> {
  await page.getByTestId('conversacion').filter({ hasText: nombre }).first().click();
  await expect(page.locator('app-composer')).toBeVisible({ timeout: 30_000 });
}

/** The thread's bubbles, top to bottom: their text, or «sticker». */
const ultimas = (page: Page, n: number) =>
  page.getByTestId('mensaje').evaluateAll(
    (burbujas, cuantas) =>
      burbujas.slice(-cuantas).map((b) => (b.classList.contains('is-sticker') ? 'sticker' : (b.querySelector('.hilo__texto')?.textContent ?? '').trim())),
    n,
  );

test('selecciona un texto y un sticker y los reenvía, en orden, a dos chats', async ({ page }) => {
  await entrar(page, { rol: 'paciente', identificador: 'paciente@alovida.mock', clave: 'mockup', nombre: 'Paciente' });
  await page.goto('/messaging');
  await abrirChat(page, /Andrés Pérez/);

  await page.getByTestId('hilo-texto').fill(TEXTO);
  await page.getByTestId('hilo-enviar').click();
  await page.getByTestId('composer-emojis').click();
  await page.getByTestId('composer-solapa-stickers').click();
  await page.getByTestId('composer-sticker').first().click();
  await expect.poll(() => ultimas(page, 2)).toEqual([TEXTO, 'sticker']);
  // Both acknowledged by the server: only those can be forwarded.
  await expect(page.getByTestId('hilo-menu-mensaje')).not.toHaveCount(0);

  const texto = page.getByTestId('mensaje').filter({ hasText: TEXTO });
  await texto.getByTestId('hilo-menu-mensaje').click();
  await page.getByTestId('hilo-seleccionar').click();
  await expect(page.getByTestId('hilo-seleccion-cuenta')).toHaveText('1 seleccionado');
  // While selecting, the composer gives way to the selection bar.
  await expect(page.locator('app-composer')).toHaveCount(0);

  await page.locator('.hilo__burbuja.is-sticker').last().getByTestId('hilo-seleccionar-mensaje').click();
  await expect(page.getByTestId('hilo-seleccion-cuenta')).toHaveText('2 seleccionados');
  await page.screenshot({ path: 'artifacts/playwright/chat-reenviar-seleccion.png' });
  await page.getByTestId('hilo-seleccion-reenviar').click();

  const dialogo = page.getByTestId('thread-forward-dialog');
  await expect(dialogo).toContainText('Reenviar 2 mensajes');
  await dialogo.getByTestId('reenvio-buscar').fill('farmacia');
  await dialogo.getByTestId('hilo-reenviar-destino').filter({ hasText: /Farmacia Vida/ }).click();
  await dialogo.getByTestId('reenvio-buscar').fill('rodrigo');
  await dialogo.getByTestId('hilo-reenviar-destino').filter({ hasText: /Rodrigo Paz/ }).click();
  await expect(dialogo.getByTestId('reenvio-enviar')).toHaveText('Reenviar a 2 chats');
  await dialogo.getByTestId('reenvio-buscar').fill('');
  await page.screenshot({ path: 'artifacts/playwright/chat-reenviar-dialogo.png' });
  await dialogo.getByTestId('reenvio-enviar').click();

  await expect(page.getByTestId('hilo-aviso')).toContainText('Reenviado a 2 chats');
  await expect(page.getByTestId('hilo-barra-seleccion')).toHaveCount(0);
  await expect(page.locator('app-composer')).toBeVisible();

  for (const destino of [/Farmacia Vida/, /Rodrigo Paz/]) {
    await abrirChat(page, destino);
    await expect.poll(() => ultimas(page, 2)).toEqual([TEXTO, 'sticker']);
  }
  // Persisted, not only drawn: still there after a reload.
  await page.reload();
  await expect.poll(() => ultimas(page, 2), { timeout: 30_000 }).toEqual([TEXTO, 'sticker']);
  await page.screenshot({ path: 'artifacts/playwright/chat-reenviar-varios.png' });
});

import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

import { esperarAplicacionLista } from './support/sesion';

/**
 * Browser evidence for the messaging fixes of 2026-11-06 (against the mock).
 *
 * 1. The message menu is readable (dark text) and never clipped by the thread.
 * 2. A pointer outside the message menu, the header ⋮ menu or the row ⋮ menu
 *    closes it.
 * 3. «Fondo de pantalla» applies a Full HD wallpaper and keeps it on reload.
 * 4. WhatsApp Web shortcuts: Ctrl+/ help, Ctrl+Alt+Shift+F search in chat,
 *    Esc closes the chat.
 */
const EVIDENCIA = 'docs/frontend/evidence/chat-menus-fondos-2026-11-06';
const CUENTA = { usuario: 'medica@alovida.mock', clave: 'alovida' };
const VIEWPORTS = [
  { nombre: '390x844', width: 390, height: 844 },
  { nombre: '768x1024', width: 768, height: 1024 },
  { nombre: '1440x900', width: 1440, height: 900 },
] as const;

test.describe.configure({ mode: 'serial' });

let page: Page;
const erroresDeConsola: string[] = [];

const foto = async (nombre: string) => {
  // Dialogs fade in: shoot once every running animation finished.
  await page.evaluate(() =>
    Promise.race([
      Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
      new Promise((listo) => setTimeout(listo, 800)),
    ]),
  );
  await page.screenshot({ path: `${EVIDENCIA}/${nombre}.png` });
};

async function abrirPrimerChat(): Promise<void> {
  await page.goto('/messaging');
  await esperarAplicacionLista(page);
  await page.getByTestId('conversacion').first().click();
  await expect(page.getByTestId('hilo-menu')).toBeVisible({ timeout: 30_000 });
}

/** Opens the menu of the first own bubble on screen and returns the menu. */
async function abrirMenuDelPrimerPropio() {
  const burbuja = page.locator('li[data-propio="true"][data-testid="mensaje"]').first();
  await burbuja.scrollIntoViewIfNeeded();
  await burbuja.hover();
  await burbuja.getByTestId('hilo-menu-mensaje').click();
  const menu = page.locator('.hilo__menu--mensaje');
  await expect(menu).toBeVisible();
  return menu;
}

test.beforeAll(async ({ browser }) => {
  mkdirSync(EVIDENCIA, { recursive: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => m.type() === 'error' && erroresDeConsola.push(m.text()));
  page.on('pageerror', (e) => erroresDeConsola.push(`pageerror: ${e.message}`));
  await page.goto('/auth');
  await esperarAplicacionLista(page);
  await page.getByTestId('login-identifier').fill(CUENTA.usuario);
  await page.getByTestId('login-password').fill(CUENTA.clave);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
});

test.afterAll(async () => {
  await page?.evaluate(() => localStorage.removeItem('alovida.chat-wallpaper'));
  await page?.close();
});

for (const vp of VIEWPORTS) {
  test(`1 · message menu readable and inside the thread · ${vp.nombre}`, async () => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await abrirPrimerChat();
    // The oldest own message: the case that used to open upwards and get clipped.
    await page.locator('.hilo__mensajes-marco').evaluate((el) => el.scrollTo(0, 0));
    const menu = await abrirMenuDelPrimerPropio();

    const marco = await page.locator('.hilo__mensajes-marco').boundingBox();
    const caja = await menu.boundingBox();
    expect(caja && marco).toBeTruthy();
    expect(caja!.y).toBeGreaterThanOrEqual(marco!.y - 1);
    expect(caja!.y + caja!.height).toBeLessThanOrEqual(marco!.y + marco!.height + 1);
    expect(caja!.x).toBeGreaterThanOrEqual(0);
    expect(caja!.x + caja!.width).toBeLessThanOrEqual(vp.width);

    // Items are dark on the white card, not white on white.
    const color = await page.getByTestId('hilo-responder').evaluate((b) => getComputedStyle(b).color);
    const fondo = await menu.evaluate((m) => getComputedStyle(m).backgroundColor);
    expect(color).not.toBe(fondo);
    expect(color).not.toBe('rgb(255, 255, 255)');
    await foto(`1-menu-mensaje-${vp.nombre}`);

    await page.mouse.click(5, vp.height - 5);
    await expect(menu).toBeHidden();
  });
}

test('2 · a click outside closes the header ⋮ menu and the inbox row ⋮ menu', async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrirPrimerChat();
  await page.getByTestId('hilo-menu').click();
  await expect(page.getByTestId('hilo-favorito')).toBeVisible();
  await foto('2-menu-cabecera-abierto');
  await page.locator('.hilo__mensajes-marco').click({ position: { x: 40, y: 40 } });
  await expect(page.getByTestId('hilo-favorito')).toBeHidden();

  await page.getByTestId('conversacion-menu').first().click();
  await expect(page.locator('.conversaciones__menu')).toBeVisible();
  await page.locator('.hilo__mensajes-marco').click({ position: { x: 40, y: 40 } });
  await expect(page.locator('.conversaciones__menu')).toBeHidden();
  await foto('2-menus-cerrados');
});

test('3 · «Fondo de pantalla» applies a Full HD wallpaper and survives a reload', async () => {
  await abrirPrimerChat();
  await page.getByTestId('hilo-menu').click();
  await page.getByTestId('hilo-fondo').click();
  await expect(page.getByRole('dialog', { name: 'Fondo de pantalla' })).toBeVisible();
  await foto('3-selector-de-fondo');
  await page.locator('[data-fondo="petroleo"]').click();
  await page.keyboard.press('Escape');

  const fondo = page.locator('app-thread');
  await expect(fondo).toHaveClass(/con-fondo/);
  const tam = await page.evaluate(async () => {
    const img = new Image();
    img.src = '/chat-fondos/petroleo.jpg';
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  });
  expect(tam).toEqual([1920, 1080]);
  await page.reload();
  await esperarAplicacionLista(page);
  await expect(page.locator('app-thread')).toHaveClass(/con-fondo/, { timeout: 30_000 });
  await expect(page.getByTestId('mensaje').first()).toBeVisible({ timeout: 30_000 });
  await foto('3-fondo-petroleo-tras-recargar');
  // A light one too, to see the bubbles and chips over both kinds.
  await page.evaluate(() => localStorage.setItem('alovida.chat-wallpaper', 'arena'));
  await page.reload();
  await expect(page.getByTestId('mensaje').first()).toBeVisible({ timeout: 30_000 });
  await foto('3-fondo-arena');
});

test('4 · WhatsApp Web shortcuts: Ctrl+/, Ctrl+Alt+Shift+F and Esc', async () => {
  await abrirPrimerChat();
  await page.locator('.hilo__mensajes-marco').click({ position: { x: 40, y: 40 } });
  await page.keyboard.press('Control+/');
  await expect(page.getByRole('dialog', { name: 'Atajos de teclado' })).toBeVisible();
  await foto('4-ayuda-de-atajos');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Atajos de teclado' })).toBeHidden();

  await page.keyboard.press('Control+Alt+Shift+KeyF');
  await expect(page.getByTestId('hilo-buscar')).toBeVisible();
  await expect(page.getByTestId('hilo-buscar').locator('input')).toBeFocused();
  // First Esc closes the search, not the chat (WhatsApp order).
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('hilo-buscar')).toBeHidden();
  await expect(page).toHaveURL(/\/messaging\/.+/);

  // Esc with a menu open closes the menu only; the chat stays.
  const menu = await abrirMenuDelPrimerPropio();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(page).toHaveURL(/\/messaging\/.+/);
  await page.getByTestId('conversacion-menu').first().click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.conversaciones__menu')).toBeHidden();
  await expect(page).toHaveURL(/\/messaging\/.+/);

  // With nothing open, Esc closes the chat (WhatsApp).
  await page.locator('.hilo__mensajes-marco').click({ position: { x: 40, y: 40 } });
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/messaging$/);
});

test('no console errors during the run', () => {
  // `setViewportSize` (this test) aborts a running view transition: not an app error.
  const ruido = /favicon|Failed to load resource.*404|Transition was aborted.*Viewport size changed/;
  expect(erroresDeConsola.filter((e) => !ruido.test(e))).toEqual([]);
});

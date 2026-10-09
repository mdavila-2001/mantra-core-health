import { mkdir } from 'node:fs/promises';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { esperarAplicacionLista, irA } from './support/sesion';

/**
 * H2.S3.M10 · demo explícita, sin page.route ni escritura directa del almacenamiento.
 * Ejecutar sobre start:demo con Chromium, --workers=1 --retries=0.
 *
 * Complementa sidebar-toggle.spec.ts (ratón y ancho de escritorio) y
 * b1-dependientes.spec.ts (aceptación desde Dependientes). Las acciones desde
 * campana sólo tenían cobertura unitaria en notification-bell.acciones.spec.ts.
 *
 * Titular y destinatario pertenecen a PACIENTES_ESCRITOS de people.ts:
 * datos sintéticos, ajenos a pacientesRegistrados/USUARIO_PACIENTES_1.md.
 * La solicitud se crea por UI y se acepta por UI; persistencia de demo en
 * sessionStorage. Esto no certifica el contrato de dependientes en API real.
 */

const SYNTHETIC_DEPENDENT = { name: 'Jorge Luis Mamani Choque', nationalId: '5009871' };
const DEPENDENTS = '/my-account/dependents';
const NOTIFICATIONS = '/notification-center';
const ACTION_SUBJECT = 'Le quieren registrar como dependiente';
const ACCEPTED_MESSAGE = 'Aceptó la solicitud: ya puede actuar por usted.';

async function signInDemo(page: Page, identifier: string): Promise<void> {
  await page.goto('/auth');
  await esperarAplicacionLista(page);
  await expect(page.getByRole('complementary', { name: 'Modo de demostración' })).toBeVisible();
  await page.getByTestId('login-identifier').fill(identifier);
  await page.getByTestId('login-password').fill('mock');
  await expect(page.getByTestId('login-identifier')).toHaveValue(identifier);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/);
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/);
  }
  await esperarAplicacionLista(page);
}

async function signOut(page: Page): Promise<void> {
  await page.getByTestId('header-cuenta').click();
  await page.getByTestId('header-cerrar-sesion').click();
  await page.waitForURL(/\/auth(?:[/?]|$)/);
}

function observeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function capture(page: Page, name: string, width: number, info: TestInfo): Promise<void> {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    name + ': sin desborde horizontal',
  ).toBe(false);
  const path = 'artifacts/playwright/hito2/' + name + '-' + width + '.png';
  await mkdir('artifacts/playwright/hito2', { recursive: true });
  await page.screenshot({ path, fullPage: true });
  await info.attach(name + '-' + width, { path, contentType: 'image/png' });
}

async function expectLiveRegions(page: Page): Promise<void> {
  const notices = page.getByTestId('avisos-region');
  const errors = page.getByTestId('avisos-region-errores');
  await expect(notices).toHaveCount(1);
  await expect(notices).toHaveAttribute('role', 'status');
  await expect(notices).toHaveAttribute('aria-live', 'polite');
  await expect(errors).toHaveCount(1);
  await expect(errors).toHaveAttribute('role', 'alert');
  await expect(errors).toHaveAttribute('aria-live', 'assertive');
  await expect(page.locator('app-toast[role], app-toast[aria-live]')).toHaveCount(0);
  await expect(page.locator('app-badge[role="status"], app-badge[aria-live]')).toHaveCount(0);
}

async function expectFocusInside(panel: Locator): Promise<void> {
  await expect.poll(() => panel.evaluate((element) => element.contains(document.activeElement))).toBe(true);
}

async function expectPanelInsideViewport(panel: Locator, page: Page): Promise<void> {
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(box!.x, 'el panel queda dentro del borde izquierdo').toBeGreaterThanOrEqual(0);
  expect(box!.y, 'el panel queda dentro del borde superior').toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, 'el panel queda dentro del borde derecho').toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height, 'el panel queda dentro del borde inferior').toBeLessThanOrEqual(viewport.height);
}

function requestInBell(page: Page): Locator {
  return page.locator('#panel-notificaciones li').filter({
    has: page.getByTestId('campana-item').filter({ hasText: ACTION_SUBJECT }),
  });
}

async function requestSyntheticDependent(page: Page): Promise<void> {
  await irA(page, DEPENDENTS);
  await page.getByTestId('dependents-nuevo').click();
  const dialog = page.getByRole('dialog', { name: 'Registrar dependiente', exact: true });
  await dialog.getByRole('radio', { name: 'Por nombre', exact: true }).click();
  await expect(dialog.getByTestId('dependent-submit')).toBeDisabled();
  await dialog.getByRole('textbox', { name: 'Buscar por nombre' }).fill(SYNTHETIC_DEPENDENT.name);
  const candidate = dialog.getByTestId('dependent-candidate').filter({ hasText: SYNTHETIC_DEPENDENT.name });
  await expect(candidate).toHaveCount(1);
  await expect(dialog.getByRole('status')).toContainText('1 cuenta encontrada');
  await candidate.focus();
  await page.keyboard.press('Enter');
  await expect(candidate).toBeChecked();
  await expect(dialog.getByTestId('dependent-submit')).toBeEnabled();
  await dialog.getByTestId('dependent-submit').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('avisos-region')).toContainText('Enviamos la solicitud a ' + SYNTHETIC_DEPENDENT.name);
}

test.describe('Hito 2 · accesibilidad y acciones de notificación · solo demo', () => {
  test.describe.configure({ retries: 0 });

  test('drawer móvil: teclado, foco encerrado, Escape y fondo inerte sin silenciar avisos', async ({ page }, info) => {
    const errors = observeErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await signInDemo(page, 'paciente@alovida.mock');
    await irA(page, NOTIFICATIONS);
    await expect(page.getByTestId('avisos-pestanas')).toBeVisible();
    const announcement = page.locator('output.solo-lectores[aria-live="polite"]');
    await expect(announcement).toHaveText('Notificaciones cargada');
    await expectLiveRegions(page);

    const toggle = page.getByTestId('header-menu');
    const nav = page.locator('#app-side-nav');
    const main = page.locator('#contenido-principal');
    await expect(toggle).toHaveAttribute('aria-controls', 'app-side-nav');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(nav).toHaveAttribute('inert', '');
    await toggle.focus();
    await page.keyboard.press('Enter');

    await expect(nav).toHaveAttribute('role', 'dialog');
    await expect(nav).toHaveAttribute('aria-modal', 'true');
    await expect(nav).toHaveAttribute('aria-label', 'Navegación principal');
    await expect(nav).not.toHaveAttribute('inert', '');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.app-main')).toHaveAttribute('inert', '');
    const firstLink = nav.getByRole('link', { name: 'AloVida — ir al panel', exact: true });
    await expect(firstLink).toBeFocused();

    // Tab avanza y ambos extremos del ciclo permanecen dentro del drawer.
    await page.keyboard.press('Tab');
    await expectFocusInside(nav);
    await expect(firstLink).not.toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(firstLink).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expectFocusInside(nav);
    await expect(firstLink).not.toBeFocused();
    await page.keyboard.press('Tab');
    await expect(firstLink).toBeFocused();

    // Un intento de enfocar el fondo no atraviesa inert.
    await main.focus();
    await expect(firstLink).toBeFocused();
    for (const region of [announcement, page.getByTestId('avisos-region'), page.getByTestId('avisos-region-errores')]) {
      expect(await region.evaluate((element) => element.closest('[inert]') === null)).toBe(true);
    }
    await capture(page, 'accessibility-drawer-keyboard', 390, info);

    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(nav).toHaveAttribute('inert', '');
    await expect(nav).not.toHaveAttribute('role', 'dialog');
    await expect(nav).not.toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('.app-main')).not.toHaveAttribute('inert', '');
    await main.focus();
    await expect(main).toBeFocused();
    await expectLiveRegions(page);
    expect(errors, 'errores durante la navegación con teclado').toEqual([]);
  });

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test('campana: acción por teclado, badge y anuncio persistente a ' + viewport.width + ' px', async ({ page }, info) => {
      const errors = observeErrors(page);
      await page.setViewportSize(viewport);
      await signInDemo(page, 'paciente@alovida.mock');
      await requestSyntheticDependent(page);
      await signOut(page);
      await signInDemo(page, SYNTHETIC_DEPENDENT.nationalId);
      await irA(page, NOTIFICATIONS);
      await expect(page.getByTestId('avisos-pestanas')).toBeVisible();
      await expectLiveRegions(page);

      const bell = page.getByTestId('campana');
      await bell.focus();
      await page.keyboard.press('Enter');
      await expect(bell).toHaveAttribute('aria-expanded', 'true');
      const panel = page.locator('#panel-notificaciones');
      await expect(panel).toBeVisible();
      let request = requestInBell(page);
      await expect(request).toHaveCount(1);
      await expect(request.getByRole('group', { name: 'Acciones de la notificación' })).toBeVisible();
      await expect(request.getByTestId('notificacion-accion-accept')).toBeVisible();
      await expect(request.getByTestId('notificacion-accion-reject')).toBeVisible();
      await expect(request.getByTestId('campana-item')).toHaveClass(/is-sin-leer/);

      const badge = page.getByTestId('campana-badge');
      await expect(badge).toHaveAttribute('role', 'img');
      await expect(badge).toHaveAttribute('aria-label', /^\d+ notificaciones sin leer$/);
      const initialUnread = Number((await badge.getAttribute('aria-label'))!.split(' ')[0]);
      expect(initialUnread).toBeGreaterThan(0);
      await expect(bell).toHaveAttribute('aria-label', 'Notificaciones. Tiene ' + initialUnread + ' sin leer');
      await expectPanelInsideViewport(panel, page);
      await capture(page, 'accessibility-notification-before-action', viewport.width, info);

      const originalUrl = page.url();
      await request.getByTestId('notificacion-accion-accept').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('avisos-region')).toContainText(ACCEPTED_MESSAGE);
      await expect(request.getByTestId('notificacion-accion-accept')).toHaveCount(0);
      await expect(request.getByTestId('notificacion-accion-reject')).toHaveCount(0);
      await expect(request.getByTestId('campana-item')).not.toHaveClass(/is-sin-leer/);
      await expect(page).toHaveURL(originalUrl);
      await expect(bell).toHaveAttribute('aria-expanded', 'true');
      const remaining = initialUnread - 1;
      if (remaining === 0) {
        await expect(badge).toHaveCount(0);
        await expect(bell).toHaveAttribute('aria-label', 'Notificaciones. No tiene ninguna sin leer');
      } else {
        await expect(badge).toHaveAttribute('aria-label', remaining + ' notificaciones sin leer');
        await expect(bell).toHaveAttribute('aria-label', 'Notificaciones. Tiene ' + remaining + ' sin leer');
      }
      await expectLiveRegions(page);
      await capture(page, 'accessibility-notification-action-announced', viewport.width, info);

      await page.reload();
      await esperarAplicacionLista(page);
      await expect(page.getByTestId('avisos-pestanas')).toBeVisible();
      await bell.click();
      request = requestInBell(page);
      await expect(request).toHaveCount(1);
      await expect(request.getByTestId('campana-item')).not.toHaveClass(/is-sin-leer/);
      await expect(page.getByTestId('notificacion-accion-accept')).toHaveCount(0);
      await expect(page.getByTestId('notificacion-accion-reject')).toHaveCount(0);
      await bell.click();

      // La decisión se demuestra también en la cuenta que pidió el vínculo.
      await signOut(page);
      await signInDemo(page, 'paciente@alovida.mock');
      await irA(page, DEPENDENTS);
      await expect(page.getByTestId('dependents-lista')).toContainText(SYNTHETIC_DEPENDENT.name);
      await page.reload();
      await esperarAplicacionLista(page);
      await expect(page.getByTestId('dependents-lista')).toContainText(SYNTHETIC_DEPENDENT.name);
      expect(errors, 'errores del recorrido de notificación con acción').toEqual([]);
    });
  }
});

import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

const base = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const photos = join('..', 'docs', 'progress', 'evidence', 'lane-41', 'fotos', 'despues');
const sizes = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'desktop-1440', width: 1440, height: 900 },
] as const;

/** Un PNG válido de 1×1: el comprobante es obligatorio para avisar el pago. */
const proofFile = {
  name: 'comprobante-transferencia.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  ),
};

test('QR del paciente y contabilidad en móvil y escritorio', async ({ browser }) => {
  mkdirSync(photos, { recursive: true });
  for (const size of sizes) {
    const patient = await browser.newContext({
      viewport: { width: size.width, height: size.height },
    });
    const patientPage = await patient.newPage();
    await entrarAlSimulador(patientPage, 'paciente', base);
    await patientPage.goto(`${base}/my-account/appointments`);
    await patientPage.getByTestId('mis-citas-ver-pago').first().click();
    const panel = patientPage.getByTestId('session-payment');
    await expect(panel.locator('canvas')).toBeVisible();
    await expect(panel.getByRole('button', { name: /Enviar comprobante/ })).toBeVisible();
    const darkPixels = await panel.locator('canvas').evaluate((canvas) => {
      const ctx = (canvas as HTMLCanvasElement).getContext('2d');
      const pixels = ctx?.getImageData(0, 0, 176, 176).data;
      if (!pixels) return 0;
      let dark = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i]! < 100 && pixels[i + 1]! < 100 && pixels[i + 2]! < 100) dark++;
      }
      return dark;
    });
    expect(darkPixels).toBeGreaterThan(500);
    await panel.screenshot({ path: join(photos, `qr-paciente-${size.name}.png`) });
    await expect
      .poll(() => patientPage.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(1);
    await panel.getByTestId('session-payment-proof').setInputFiles(proofFile);
    await expect(panel.getByTestId('session-payment-chosen')).toBeVisible();
    await panel.getByRole('button', { name: /Enviar comprobante/ }).click();
    await expect(panel.getByText(/pendiente de confirmación/)).toBeVisible();
    await expect(panel.getByTestId('session-payment-sent')).toContainText(proofFile.name);
    await panel.screenshot({ path: join(photos, `pago-recibido-${size.name}.png`) });
    await patient.close();

    const doctor = await browser.newContext({
      viewport: { width: size.width, height: size.height },
    });
    const accountingPage = await doctor.newPage();
    await entrarAlSimulador(accountingPage, 'medica', base);
    await accountingPage.goto(`${base}/administration/accounting`);
    await esperarAQueSeAsiente(accountingPage);
    await expect(accountingPage.getByTestId('pagos-confirmados-contabilidad')).toBeVisible();
    await accountingPage.screenshot({ path: join(photos, `contabilidad-${size.name}.png`) });
    await expect
      .poll(() => accountingPage.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(1);
    await doctor.close();
  }
});

test('el aviso QR llega a Ver pagos y vuelve confirmado a la paciente en móvil', async ({ browser }) => {
  mkdirSync(photos, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const login = async (email: string): Promise<void> => {
    await page.getByTestId('login-identifier').fill(email);
    await page.getByTestId('login-password').fill('cualquiera');
    await page.getByTestId('login-submit').click();
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'));
  };
  const logout = async (): Promise<void> => {
    await page.locator('.app-header__account').click();
    await page.getByTestId('header-cerrar-sesion').click();
    await page.waitForURL((url) => url.pathname.startsWith('/auth'));
  };

  await page.goto(`${base}/auth`);
  await login('paciente@alovida.mock');
  await page.goto(`${base}/my-account/appointments`);
  const ownAppointment = page.locator('li.turnos__item').filter({ hasText: 'Consultorio propio · Valeria Rojas Mendoza' });
  await ownAppointment.getByTestId('mis-citas-ver-pago').click();
  await ownAppointment.getByTestId('session-payment-proof').setInputFiles(proofFile);
  await expect(ownAppointment.getByTestId('session-payment-chosen')).toBeVisible();
  await ownAppointment.getByRole('button', { name: /Enviar comprobante/ }).click();
  await expect(ownAppointment.getByText(/pendiente de confirmación/)).toBeVisible();

  await logout();
  await login('medica@alovida.mock');
  await page.goto(`${base}/medical-records/c2aa6dda-67d6-46a6-aa79-a40ca7e62ee0/consultation`);
  await page.getByText('Ver pagos', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirmar recepción' })).toBeVisible();
  await page.screenshot({ path: join(photos, 'ver-pagos-pendiente-mobile-390.png') });
  await page.getByRole('button', { name: 'Confirmar recepción' }).click();
  await expect(page.getByText(/Pagado Bs.*250,00 de Bs.*250,00/)).toBeVisible();
  await page.screenshot({ path: join(photos, 'ver-pagos-confirmado-mobile-390.png') });

  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.goto(`${base}/administration/accounting`);
  const received = page.getByTestId('pagos-confirmados-contabilidad');
  await expect(received.getByText('FAC-2026-0308', { exact: false })).toBeVisible();
  await received.screenshot({ path: join(photos, 'pago-confirmado-contabilidad-mobile-390.png') });
  await logout();
  await login('paciente@alovida.mock');
  await page.goto(`${base}/my-account/appointments`);
  await page.locator('li.turnos__item').filter({ hasText: 'Consultorio propio · Valeria Rojas Mendoza' })
    .getByTestId('mis-citas-ver-pago').click();
  await expect(page.getByTestId('session-payment').getByText(/Pago confirmado/)).toBeVisible();
  await page.getByTestId('session-payment').screenshot({ path: join(photos, 'pago-confirmado-paciente-mobile-390.png') });
  await context.close();
});

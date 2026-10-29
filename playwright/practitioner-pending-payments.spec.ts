import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

/**
 * «Pagos por registrar» y «Monto recibido» — la médica registra un pago sin
 * entrar al día de cada cita.
 *
 * Corre contra la maqueta (`mockBackend: true`), con la cuenta `medica`. Cubre:
 *
 * 1. La lista «Pagos por registrar» arriba del calendario de `/schedule`, con
 *    al menos una cita.
 * 2. «Registrar pago» abre el modal de comprobantes de esa cita.
 * 3. «Pagada» con un monto de 150: el aviso «Guardado solo en este equipo…»
 *    está junto al campo, la fila sale de la lista y el monto sigue guardado
 *    después de recargar.
 *
 * La paciente no tiene esta lista: se comprueba que su pantalla no la ofrece.
 *
 * Las fotos quedan en `docs/frontend/evidence/pagos-por-registrar/`, nunca de
 * página entera: de la pantalla visible o de la pieza que se mira.
 */

const EVIDENCE_DIR = join('docs', 'frontend', 'evidence', 'pagos-por-registrar');
const SCHEDULE_ROUTE = '/schedule';
const AMOUNT_NOTICE = /Guardado solo en este equipo: todavía no se envía al servidor\./;

const VIEWPORTS = [
  { name: '1280', width: 1280, height: 900 },
  { name: '360', width: 360, height: 800 },
] as const;
const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
});

/** Errores de consola de la propia pantalla y respuestas 5xx. */
function watchForProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`);
  });
  return problems;
}

async function useTheme(page: Page, theme: Theme): Promise<void> {
  const root = page.locator('html');
  if ((await root.getAttribute('data-theme')) !== theme) {
    await page.getByTestId('header-theme-toggle').click();
  }
  await expect(root).toHaveAttribute('data-theme', theme);
}

/** Con el modal abierto el interruptor del encabezado queda tapado: se fija el tema en la raíz. */
async function forceTheme(page: Page, theme: Theme): Promise<void> {
  await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

async function snapshot(target: Page | Locator, name: string): Promise<void> {
  await target.screenshot({ path: join(EVIDENCE_DIR, `${name}.png`) });
}

/** Abre `/schedule` y espera a que la lista termine de cargar. */
async function openSchedule(page: Page): Promise<Locator> {
  await page.goto(SCHEDULE_ROUTE, { waitUntil: 'domcontentloaded' });
  const block = page.getByTestId('pending-payments');
  await expect(block).toBeVisible();
  await expect(page.getByTestId('pending-payments-loading')).toBeHidden();
  await esperarAQueSeAsiente(page);
  return block;
}

test('médica · la lista muestra citas por registrar, en claro y oscuro, a 1280 y 360', async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await entrarAlSimulador(page, 'medica', '');
  const block = await openSchedule(page);

  await expect(page.getByTestId('pending-payments-toggle')).toHaveText(/Pagos por registrar \(\d+\)/);
  await expect(block.getByTestId('pending-payment-row').first()).toBeVisible();
  await expect(
    block.getByTestId('pending-payment-register').first(),
  ).toHaveAccessibleName(/^Registrar pago: .+, \d\d:\d\d$/);

  for (const theme of THEMES) {
    await useTheme(page, theme);
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await esperarAQueSeAsiente(page);
      await block.scrollIntoViewIfNeeded();
      await snapshot(page, `lista-${vp.name}-${theme}`);
    }
  }
  expect(problems).toEqual([]);
});

test('médica · registra «Pagada» con monto 150: aviso visible, la fila sale y el monto sigue tras recargar', async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await entrarAlSimulador(page, 'medica', '');
  const block = await openSchedule(page);
  await useTheme(page, 'light');

  const first = block.getByTestId('pending-payment-register').first();
  const accessibleName = (await first.getAttribute('aria-label')) ?? '';
  expect(accessibleName).toMatch(/^Registrar pago: /);
  const rowsBefore = await block.getByTestId('pending-payment-row').count();

  await first.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('payment-receipts-dialog')).toBeVisible();

  await dialog.getByTestId('payment-receipts-manual-toggle').click();
  await dialog.getByTestId('payment-manual-PAID').click();

  const amount = dialog.getByTestId('payment-amount');
  await expect(amount).toBeVisible();
  await expect(amount.getByText(AMOUNT_NOTICE)).toBeVisible();

  // El error va en el campo, y guardar espera a un monto válido.
  await dialog.getByTestId('payment-amount-input').fill('0');
  await expect(amount.getByText(/Escriba un monto mayor que 0/)).toBeVisible();
  await expect(dialog.getByTestId('payment-amount-save')).toBeDisabled();

  await dialog.getByTestId('payment-amount-input').fill('150');
  await dialog.getByTestId('payment-amount-save').click();
  await expect(dialog.getByTestId('payment-amount-saved')).toContainText('Recibido: Bs 150,00');
  await expect(amount.getByText(AMOUNT_NOTICE)).toBeVisible();

  for (const theme of THEMES) {
    await forceTheme(page, theme);
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await amount.scrollIntoViewIfNeeded();
      await snapshot(dialog, `monto-${vp.name}-${theme}`);
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await forceTheme(page, 'light');

  // Al cerrar, esa cita ya no está entre los pagos por registrar.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(block.getByRole('button', { name: accessibleName })).toHaveCount(0);
  const rowsAfter = await block.getByTestId('pending-payment-row').count();
  expect(rowsAfter).toBe(rowsBefore - 1);

  // El monto es de este navegador: sobrevive a la recarga.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('pending-payments')).toBeVisible();
  await expect(page.getByTestId('pending-payments-loading')).toBeHidden();
  const stored = await page.evaluate(() =>
    Object.entries(localStorage)
      .filter(([key]) => key.startsWith('alovida.receivedAmount.v1.'))
      .map(([, value]) => JSON.parse(value) as { amount: number; currency: string }),
  );
  expect(stored).toEqual([expect.objectContaining({ amount: 150, currency: 'BOB' })]);
  expect(problems).toEqual([]);
});

test('paciente · no ve «Pagos por registrar»', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await entrarAlSimulador(page, 'paciente', '');
  await page.goto(SCHEDULE_ROUTE, { waitUntil: 'domcontentloaded' });
  await esperarAQueSeAsiente(page);

  await expect(page.getByTestId('pending-payments')).toHaveCount(0);
  await expect(page.getByText('Pagos por registrar')).toHaveCount(0);
});

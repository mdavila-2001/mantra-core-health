import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

// C0: solo simulador y cuentas sintéticas declaradas; no API externa ni rutas interceptadas.
const OUTPUT = join('docs', 'trabajo', '2026-09-25-encuentro-clinico', 'c0', 'evidencia', 'visual');
const DOCTOR: Actor = { rol: 'doctora', identificador: 'medica@alovida.mock', clave: 'mock', nombre: 'Médica' };
const PATIENT: Actor = { rol: 'paciente', identificador: 'paciente@alovida.mock', clave: 'mock', nombre: 'Paciente' };
const TILES = [
  { key: 'notas', title: 'Nota médica', modal: 'Escribir una nota médica' },
  { key: 'ordenes', title: 'Orden de análisis', modal: 'Pedir un análisis' },
  { key: 'diagnosticos', title: 'Diagnóstico', modal: 'Nuevo diagnóstico' },
  { key: 'reconsulta', title: 'Reconsulta', modal: 'Agendar la reconsulta' },
  { key: 'medicacion', title: 'Receta', modal: 'Prescribir medicación' },
  { key: 'alergias', title: 'Alergia', modal: 'Nueva alergia' },
  { key: 'observaciones', title: 'Medición', modal: 'Registrar una medición' },
  { key: 'planes', title: 'Plan de cuidados', modal: 'Abrir un plan de cuidados' },
  { key: 'documentos', title: 'Documento', modal: 'Registrar un documento' },
  { key: 'formulario', title: 'Formulario clínico', modal: 'Llenar un formulario clínico' },
  { key: 'internacion', title: 'Internación', modal: 'Registrar una internación' },
  { key: 'pagos', title: 'Pagos', modal: 'Pagos de la persona' },
] as const;
const VIEWPORTS = [
  { width: 390, height: 844 }, { width: 768, height: 1024 },
  { width: 1024, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 },
] as const;

test.beforeEach(async ({ page }) => {
  test.setTimeout(90_000);
  mkdirSync(OUTPUT, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on('requestfailed', (request) => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') {
      errors.push(`${request.failure()?.errorText} ${new URL(request.url()).pathname}`);
    }
  });
  await page.exposeFunction('c0RuntimeErrors', () => [...errors]);
});

test.afterEach(async ({ page }) => {
  const errors = await page.evaluate(() => (window as unknown as { c0RuntimeErrors: () => Promise<string[]> }).c0RuntimeErrors());
  expect(errors, 'Consola y red del simulador').toEqual([]);
});

async function openConsultation(page: Page): Promise<void> {
  await entrar(page, DOCTOR);
  await irA(page, '/schedule');
  const cards = page.locator('.dia__bloque[data-tipo="cita"]');
  await expect(cards.first()).toBeVisible();
  const ongoing = cards.filter({ has: page.locator('.dia__estado').filter({ hasText: /en (curso|consulta)/i }) });
  const confirmed = cards.filter({ has: page.locator('.dia__estado').filter({ hasText: /confirmad/i }) });
  const card = (await ongoing.count()) > 0 ? ongoing.first() : confirmed.first();
  const attend = card.getByTestId('dia-ir-a-atender');
  await attend.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/medical-records\/[^/]+\/consultation\?/, { timeout: 30_000 });
  await expect(page.getByTestId('consulta-rejilla')).toBeVisible();
  const open = page.getByTestId('consulta-abrir-encuentro');
  if (await open.isVisible()) await open.click();
  await expect(page.getByTestId('encuentros-en-curso')).toBeVisible();
}

async function assertNoOverflow(page: Page): Promise<void> {
  expect(await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth))).toBe(0);
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.addInitScript((value) => localStorage.setItem('mantra-core-health.theme', value), theme);
}

async function checkTile(page: Page, tile: (typeof TILES)[number], capture?: string): Promise<void> {
  const button = page.getByTestId(`consulta-casilla-${tile.key}`);
  await button.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('content-dialog-title')).toHaveText(tile.modal);
  await expect(dialog.getByTestId('content-dialog-title')).toBeVisible();
  if (tile.key === 'notas') await expect(dialog.getByText('En construcción (C1)', { exact: true })).toBeVisible();
  if (tile.key === 'ordenes') {
    await expect(dialog.locator('app-analysis-order-block')).toBeVisible();
    await expect(dialog.locator('.estudios__formulario')).toBeVisible();
    await expect(dialog.locator('[data-testid="estudios-lista"], [data-testid="estudios-vacio"]')).toBeVisible();
    await expect(dialog.getByTestId('estudios-error')).toHaveCount(0);
    await expect(dialog.getByTestId('estudios-historico-error')).toHaveCount(0);
  }
  if (tile.key === 'reconsulta') {
    await expect(dialog.locator('app-follow-up-block')).toBeVisible();
    await expect(dialog.locator('[data-testid="reconsulta-fecha"], [data-testid="reconsulta-ya-agendada"]')).toBeVisible();
    await expect(dialog.getByTestId('reconsulta-sin-cita')).toHaveCount(0);
  }
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  if (capture) await page.screenshot({ path: join(OUTPUT, `${capture}.png`), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  // El dialog nativo se cierra antes de que Angular retire su host.
  await expect(page.getByTestId('consulta-modal')).toHaveCount(0);
  await expect(button).toBeFocused();
}

test.describe('C0 · contrato de la consulta', () => {
  test('doce acciones, modales y encuentro persistente al recargar', async ({ page }) => {
    await openConsultation(page);
    await expect(page.locator('.consulta__casilla-titulo')).toHaveText(TILES.map((tile) => tile.title));
    await expect(page.locator('[data-testid^="consulta-casilla-"]')).toHaveCount(12);
    const open = page.getByTestId('consulta-abrir-encuentro');
    if (await open.isVisible()) await open.click();
    await expect(page.getByTestId('encuentros-en-curso')).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('encuentros-en-curso')).toBeVisible();
    for (const tile of TILES) await test.step(tile.title, () => checkTile(page, tile));
    await assertNoOverflow(page);
  });

  for (const viewport of VIEWPORTS) {
    for (const theme of ['light', 'dark'] as const) {
      test(`rejilla y tres modales ${viewport.width} ${theme}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await setTheme(page, theme);
        await openConsultation(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('.consulta__casilla-titulo')).toHaveText(TILES.map((tile) => tile.title));
        await assertNoOverflow(page);
        for (const close of await page.getByTestId('toast-cerrar').all()) await close.click();
        await page.screenshot({ path: join(OUTPUT, `grid-${viewport.width}-${theme}.png`), fullPage: true, animations: 'disabled' });
        for (const key of ['notas', 'ordenes', 'reconsulta']) {
          const tile = TILES.find((candidate) => candidate.key === key)!;
          await checkTile(page, tile, `${key}-${viewport.width}-${theme}`);
        }
      });

      test(`historia conserva tres grupos ${viewport.width} ${theme}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await setTheme(page, theme);
        await entrar(page, PATIENT);
        await irA(page, '/my-account/medical-record');
        await page.getByRole('tab', { name: /Diagnósticos/ }).click();
        for (const id of ['historia-en-estudio', 'historia-activas', 'historia-historicos']) {
          await expect(page.getByTestId(id)).toBeVisible();
        }
        for (const close of await page.getByTestId('toast-cerrar').all()) await close.click();
        await page.screenshot({ path: join(OUTPUT, `history-${viewport.width}-${theme}.png`), fullPage: true, animations: 'disabled' });
        await assertNoOverflow(page);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('tab', { name: /Diagnósticos/ })).toHaveAttribute('aria-selected', 'true');
      });
    }
  }

  for (const viewport of VIEWPORTS) {
    for (const theme of ['light', 'dark'] as const) {
      test(`stock registra Nota médica, órdenes y reconsulta ${viewport.width} ${theme}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await setTheme(page, theme);
        await entrar(page, DOCTOR);
        await irA(page, '/design-system/stock');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        const search = page.getByPlaceholder('Buscar componente…');
        for (const name of ['MedicalNoteBlock', 'AnalysisOrderBlock', 'FollowUpBlock']) {
          await search.fill(name);
          await expect(page.locator('a').filter({ has: page.locator('.lista__clase').getByText(name, { exact: true }) })).toBeVisible();
        }
        await search.fill('MedicalNoteBlock');
        await page.getByRole('link', { name: 'MedicalNoteBlock', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'MedicalNoteBlock', exact: true })).toBeVisible();
        const preview = page.frameLocator('iframe[title="Vista del componente"]');
        await expect(preview.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(preview.getByText('En construcción (C1)', { exact: true })).toBeVisible();
        await page.locator('.marco-zona__caja').evaluate((element) => element.scrollIntoView({ block: 'start' }));
        await page.screenshot({ path: join(OUTPUT, `stock-medical-note-${viewport.width}-${theme}.png`), fullPage: true, animations: 'disabled' });
      });
    }
  }
});

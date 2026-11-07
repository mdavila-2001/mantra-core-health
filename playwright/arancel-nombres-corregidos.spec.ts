import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';
import { irA } from './support/sesion';

/**
 * Fee schedule with corrected names (2026-11-07), in "Mis servicios -> Importar".
 *
 * The client asked to drop "invasivo" from service names and to fix the names
 * that came misspelled from the scanned PDF. The fix lives in the API
 * (`tools/bolivia-datasets/correcciones-arancel.json`) and, for the mock
 * backend, in `data/fee-schedules/`; this suite checks the mock copy as the
 * doctor sees it. Runs against `yarn start:demo` and saves a screenshot.
 */
const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const SALIDA = join(
  process.env['E2E_EVIDENCE_DIR'] ??
    join('artifacts', 'evidencia', '2026-11-07-arancel-nombres-corregidos'),
);
const importar = (q: string): string =>
  `/my-services/import?specialty=${encodeURIComponent('Cardiología')}&q=${encodeURIComponent(q)}`;

test('Cardiología se importa con los nombres corregidos y sin «invasivo»', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrarAlSimulador(page, 'medica', BASE);
  const nombres = page.locator('[data-testid="procedimiento"] .procedimiento__nombre');

  // The search runs server-side over the whole specialty, not only the first page of 60.
  const buscar = async (q: string): Promise<string[]> => {
    await irA(page, importar(q));
    await expect(nombres.first()).toBeVisible({ timeout: 30_000 });
    await esperarAQueSeAsiente(page);
    return nombres.allTextContents();
  };

  expect(await buscar('trombólisis')).toEqual([
    'Tratamiento mediante trombólisis dirigida por catéter, por miembro',
    'Tratamiento mediante trombólisis mecánica del tromboembolismo pulmonar (TEP)',
    'Tratamiento mediante trombólisis dirigida por catéter del tromboembolismo pulmonar (TEP)',
  ]);
  mkdirSync(SALIDA, { recursive: true });
  await page.screenshot({ path: join(SALIDA, 'cardiologia-trombolisis.png'), fullPage: false });

  expect(await buscar('vena cava')).toContain('Implante de filtro de vena cava inferior');
  expect(await buscar('Emboliz')).toContain(
    'Embolizaciones (pulmonar, hepática, renal, malformaciones vasculares)',
  );

  // Nothing in the specialty still says "invasivo" or carries the old OCR spellings.
  for (const viejo of ['invasiv', 'trombétisis', 'fitra', 'Embolzaciones']) {
    await irA(page, importar(viejo));
    // Wait for the explicit empty state: a bare count of 0 would also pass while loading.
    await expect(
      page.getByText('Ningún procedimiento del arancel coincide con lo que buscó.'),
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId('procedimiento')).toHaveCount(0);
  }

  await irA(page, `/my-services/import?specialty=${encodeURIComponent('Cardiología')}`);
  await expect(nombres.first()).toBeVisible({ timeout: 30_000 });
  await esperarAQueSeAsiente(page);
  await page.screenshot({ path: join(SALIDA, 'cardiologia-escritorio.png'), fullPage: false });
});

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { estable } from './support/sesion';

/** Captura la vitrina del sistema de diseño para comparar antes/después de DS-001. */
test('DS-001 · vitrina de botones', async ({ page }) => {
  test.setTimeout(120_000);
  const etiqueta = process.env['FABLE_ETIQUETA'] ?? 'sin-etiqueta';
  const salida = join('docs', 'frontend', 'evidence', 'DS-001');
  mkdirSync(salida, { recursive: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/design-system', { waitUntil: 'domcontentloaded' });
  await estable(page);

  const botones = page.locator('.btn--sm').first();
  const computado = await botones.evaluate((el) => {
    const s = getComputedStyle(el);
    return { fontSize: s.fontSize, padding: s.padding, minHeight: s.minHeight };
  });
  console.log(`[DS-001] ${etiqueta} · .btn--sm computado = ${JSON.stringify(computado)}`);

  await botones.screenshot({ path: join(salida, `${etiqueta}-boton.png`) });
  expect(computado.fontSize).toBe('13px');
});

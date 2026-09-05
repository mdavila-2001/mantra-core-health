// Captura de evidencia forense temporal para el rework de FT-25 (F3).
// NO forma parte de la suite del carril: junta screenshots + consola + red
// en un directorio de evidencia y se borra al cerrar el rework.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { administrador } from './support/actores';
import { entrar, estable } from './support/sesion';

const OUT = process.env.EVIDENCE_OUT ?? './_ft25-evidence-out';
fs.mkdirSync(OUT, { recursive: true });

test('captura de evidencia FT-25', async ({ page }) => {
  const consoleLog: unknown[] = [];
  const networkLog: unknown[] = [];
  const pageErrors: unknown[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleLog.push({ text: msg.text(), location: msg.location() });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      networkLog.push({ status: res.status(), url: res.url(), method: res.request().method() });
    }
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await entrar(page, administrador());

  await page.goto('/glossary');
  await estable(page);
  await page.screenshot({ path: path.join(OUT, 'glossary-grid-desktop-1440.png'), fullPage: true });

  const respuesta = page.waitForResponse(
    (r) => r.url().includes('/terminology/concepts') && r.url().includes('q=paracetamol'),
  );
  await page.goto('/glossary?q=paracetamol');
  await respuesta;
  await expect(page.getByTestId('tabla')).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: path.join(OUT, 'glossary-search-paracetamol.png'), fullPage: true });

  await page.locator('.glosario__termino-enlace').first().click();
  await expect(page.locator('.termino__definicion').first()).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: path.join(OUT, 'glossary-term-paracetamol.png'), fullPage: true });

  for (const [name, viewport] of [
    ['mobile-390', { width: 390, height: 844 }],
    ['tablet-768', { width: 768, height: 1024 }],
  ] as const) {
    await page.setViewportSize(viewport);
    await page.goto('/glossary');
    await estable(page);
    await page.screenshot({ path: path.join(OUT, `glossary-grid-${name}.png`), fullPage: true });
  }

  // F1: confirmación visual de que el ícono de cada permiso del navegador
  // renderiza (antes rompía el build entero por `permiso.icono`).
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/settings');
  await estable(page);
  const tabPermisos = page.getByRole('tab', { name: 'Permisos' });
  await tabPermisos.click();
  await expect(page.locator('.ajustes__icono').first()).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: path.join(OUT, 'settings-permisos-f1.png'), fullPage: true });

  fs.writeFileSync(path.join(OUT, 'console.json'), JSON.stringify(consoleLog, null, 2));
  fs.writeFileSync(path.join(OUT, 'network.json'), JSON.stringify(networkLog, null, 2));
  fs.writeFileSync(path.join(OUT, 'page-errors.json'), JSON.stringify(pageErrors, null, 2));
});

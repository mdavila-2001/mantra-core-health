import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * C1 · La nota médica es una tabla de filas campo/valor.
 *
 * Recorrido: médica → agenda → «Iniciar la consulta» → casilla «Nota médica»
 * → tres filas → guardar → la nota aparece con sus tres pares → F5 → sigue
 * → firmar → sello «Firmada». Todo contra el simulador: sin API externa.
 *
 * Y de paso, lo que el propietario pidió el 25/09/2026: la rejilla no ofrece
 * «Medición» ni «Internación», y el menú lateral no tiene «Notas médicas».
 */
const OUTPUT = join('docs', 'trabajo', '2026-09-25-encuentro-clinico', 'c1', 'evidencia', 'visual');
const DOCTOR: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};
const FILAS = [
  ['Presión arterial', '128/84 mmHg'],
  ['Dolor', 'Región lumbar, 6/10'],
  ['Duración', '3 días'],
] as const;

test.beforeEach(() => {
  test.setTimeout(120_000);
  mkdirSync(OUTPUT, { recursive: true });
});

async function abrirLaConsulta(page: Page): Promise<void> {
  await entrar(page, DOCTOR);
  await irA(page, '/schedule');
  const tarjetas = page.locator('.dia__bloque[data-tipo="cita"]');
  await expect(tarjetas.first()).toBeVisible();
  const enCurso = tarjetas.filter({
    has: page.locator('.dia__estado').filter({ hasText: /en (curso|consulta)/i }),
  });
  const confirmadas = tarjetas.filter({
    has: page.locator('.dia__estado').filter({ hasText: /confirmad/i }),
  });
  const tarjeta = (await enCurso.count()) > 0 ? enCurso.first() : confirmadas.first();
  // El mismo camino que C0: la tarjeta del día tiene su acceso «atender».
  const atender = tarjeta.getByTestId('dia-ir-a-atender');
  await atender.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/medical-records\/[^/]+\/consultation\?/, { timeout: 30_000 });
  await expect(page.getByTestId('consulta-rejilla')).toBeVisible();
  const abrir = page.getByTestId('consulta-abrir-encuentro');
  if (await abrir.isVisible()) await abrir.click();
  await expect(page.getByTestId('encuentros-en-curso')).toBeVisible();
}

test('la rejilla no ofrece Medición ni Internación y el menú no tiene Notas médicas', async ({
  page,
}) => {
  await abrirLaConsulta(page);
  await expect(page.locator('[data-testid^="consulta-casilla-"]')).toHaveCount(10);
  await expect(page.getByTestId('consulta-casilla-observaciones')).toHaveCount(0);
  await expect(page.getByTestId('consulta-casilla-internacion')).toHaveCount(0);
  await expect(
    page.locator('app-side-nav').getByText('Notas médicas', { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: join(OUTPUT, 'rejilla-sin-medicion-ni-internacion.png'),
    fullPage: true,
  });
});

test('escribe tres filas, sobrevive a F5 y firma', async ({ page }) => {
  await abrirLaConsulta(page);
  await page.getByTestId('consulta-casilla-notas').click();
  // El host `consulta-modal` no tiene caja; lo visible es el dialog nativo.
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Escribir una nota médica')).toBeVisible();

  const antes = await modal.getByTestId('nota-medica-item').count();

  for (const [indice, [campo, valor]] of FILAS.entries()) {
    const fila = modal.getByTestId('nota-medica-fila').nth(indice);
    await fila.getByTestId('nota-medica-rotulo').fill(campo);
    // `data-testid` cae en el host `app-textarea`; lo que se escribe es el nativo.
    const valorNativo = fila.getByTestId('nota-medica-valor').locator('textarea');
    await valorNativo.fill(valor);
    if (indice < FILAS.length - 1) {
      // Enter en el valor agrega la fila siguiente y la enfoca.
      await valorNativo.press('Enter');
      await expect(modal.getByTestId('nota-medica-fila')).toHaveCount(indice + 2);
    }
  }
  await expect(modal.getByTestId('nota-medica-contador')).toHaveText(/3 de 40/);
  await page.screenshot({ path: join(OUTPUT, 'nota-tres-filas.png'), fullPage: true });

  await modal.getByRole('button', { name: 'Guardar la nota' }).click();
  await expect(modal.getByTestId('nota-medica-item')).toHaveCount(antes + 1);
  const nota = modal.getByTestId('nota-medica-item').first();
  for (const [campo, valor] of FILAS) {
    await expect(nota).toContainText(campo);
    await expect(nota).toContainText(valor);
  }
  await expect(nota.getByTestId('nota-medica-sello')).toHaveText(/Borrador/);
  // El formulario volvió a una fila vacía.
  await expect(modal.getByTestId('nota-medica-fila')).toHaveCount(1);
  await page.screenshot({ path: join(OUTPUT, 'nota-guardada.png'), fullPage: true });

  // F5: la nota sigue —el simulador persiste dentro de la pestaña—.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('encuentros-en-curso')).toBeVisible();
  await page.getByTestId('consulta-casilla-notas').click();
  const reabierto = page.getByRole('dialog');
  const otraVez = reabierto.getByTestId('nota-medica-item').first();
  for (const [campo, valor] of FILAS) {
    await expect(otraVez).toContainText(campo);
    await expect(otraVez).toContainText(valor);
  }

  await otraVez.getByTestId('nota-medica-firmar').click();
  await expect(otraVez.getByTestId('nota-medica-sello')).toHaveText(/Firmada/);
  await expect(otraVez.getByTestId('nota-medica-firmar')).toHaveCount(0);
  await page.screenshot({ path: join(OUTPUT, 'nota-firmada.png'), fullPage: true });

  // Y abajo, en «Lo registrado en este encuentro», las mismas filas.
  await reabierto.getByTestId('content-dialog-close').click();
  const linea = page.getByTestId('consulta-lo-registrado');
  await expect(linea).toContainText('Presión arterial');
  await expect(linea).toContainText('128/84 mmHg');
});

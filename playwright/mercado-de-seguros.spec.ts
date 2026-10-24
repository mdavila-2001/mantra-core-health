import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * El mercado de seguros del paciente (28/09/2026).
 *
 * 1. «Directorios» ofrece el nodo «Directorio de aseguradoras», con la misma
 *    tarjeta que los otros.
 * 2. El directorio lista las aseguradoras con la misma página que clínicas y
 *    farmacias; la tarjeta abre la ficha dentro del panel.
 * 3. La ficha muestra cada plan en su pestaña, con la tabla de cláusulas y
 *    coberturas, y los brokers.
 * 4. «Hablar con el broker» abre el chat con él.
 */
const SALIDA = join('docs', 'trabajo', '2026-09-28-mercado-de-seguros', 'evidencia');
const PACIENTE: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'mock',
  nombre: 'Paciente',
};

test.beforeEach(() => {
  test.setTimeout(240_000);
  mkdirSync(SALIDA, { recursive: true });
});

test('el paciente ve productos, planes y cláusulas de una aseguradora y habla con su broker', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (error) => errores.push(error.message));

  await entrar(page, PACIENTE);
  await irA(page, '/directories');

  /* ---- 1 · el nodo en Directorios --------------------------------------- */
  const nodo = page.getByRole('link', { name: /Directorio de aseguradoras/ });
  await expect(nodo).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: join(SALIDA, '1-directorios-con-aseguradoras.png') });
  await nodo.click();

  /* ---- 2 · el directorio ------------------------------------------------ */
  await page.waitForURL(/\/insurers-directory/);
  await expect(page.getByRole('heading', { name: 'Directorio de aseguradoras' })).toBeVisible();
  const andina = page.getByRole('link', { name: /Seguros Andina/ }).first();
  await expect(andina).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: /La Vitalicia/ }).first()).toBeVisible();
  await page.screenshot({ path: join(SALIDA, '2-directorio-de-aseguradoras.png') });
  await andina.click();

  /* ---- 3 · la ficha: planes, cláusulas y brokers ------------------------ */
  await page.waitForURL(/\/insurers-directory\/seguros-andina/);
  await expect(page.getByRole('heading', { name: 'Seguros Andina', level: 1 })).toBeVisible();
  const planes = page.getByTestId('aseguradora-planes');
  await expect(planes).toBeVisible({ timeout: 30_000 });
  for (const plan of ['Plan Integral', 'Plan Familiar', 'Plan Oro']) {
    await expect(planes.getByRole('tab', { name: plan })).toBeVisible();
  }
  const clausulas = planes.getByTestId('aseguradora-clausulas');
  await expect(clausulas).toContainText('Consulta médica');
  await expect(clausulas).toContainText('Internación');
  await expect(clausulas).toContainText('Pide: Orden médica');
  await expect(planes.getByTestId('aseguradora-prima')).toContainText('450,00');
  await planes.scrollIntoViewIfNeeded();
  // A la altura de la ventana: con el armazón fijo, la foto de página completa
  // superpone el menú lateral sobre el contenido.
  await page.screenshot({ path: join(SALIDA, '3-ficha-plan-integral.png') });

  // Otra pestaña, otro plan con sus propias cláusulas.
  await planes.getByRole('tab', { name: 'Plan Familiar' }).click();
  await expect(planes.getByTestId('aseguradora-prima')).toContainText('680,00');
  await expect(planes.getByTestId('aseguradora-clausulas')).toContainText('80\u00a0%');

  const brokers = page.getByTestId('aseguradora-broker');
  await expect(brokers).toHaveCount(2);
  await expect(page.getByTestId('aseguradora-brokers')).toContainText(
    'Consultores en Seguros Oriente',
  );
  await expect(page.getByTestId('aseguradora-brokers')).toContainText(
    'Matrícula CS-2210 · Trabaja con varias aseguradoras',
  );
  await page.getByTestId('aseguradora-brokers').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SALIDA, '4-ficha-brokers.png') });
  await page.getByTestId('aseguradora-hablar-con-broker').scrollIntoViewIfNeeded();

  /* ---- 4 · hablar con el broker ----------------------------------------- */
  await page.getByTestId('aseguradora-hablar-con-broker').click();
  await page.waitForURL(/\/messaging\/[^/?]+/, { timeout: 30_000 });
  await expect(page.locator('.hilo__nombre')).toContainText('Consultores en Seguros Oriente', {
    timeout: 30_000,
  });
  await page.screenshot({ path: join(SALIDA, '5-chat-con-el-broker.png') });

  expect(errores).toEqual([]);
});

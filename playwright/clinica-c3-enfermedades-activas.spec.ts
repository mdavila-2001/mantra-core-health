import { expect, test } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * C3 (reducido tras la colisión con el PR #708, ya mergeado): la tarjeta
 * «Enfermedades activas» y la agrupación por estado en el expediente. El
 * flujo de crear/confirmar/rechazar un diagnóstico ya lo prueba la suite de
 * Pablo (`diagnosis-block`/`diagnosis-verify-dialog`); esto sólo verifica lo
 * que agrega este PR encima de eso.
 *
 * El seed confirma el primer diagnóstico de cada paciente (`i === 0`,
 * `fixtures/clinica.ts:314-332`), así que alcanza con abrir cualquier
 * expediente — sin recrear el alta ni la verificación.
 */

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

test('el expediente muestra Enfermedades activas y el sello coloreado por estado', async ({ page }) => {
  const erroresDeConsola: string[] = [];
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') erroresDeConsola.push(mensaje.text());
  });
  page.on('pageerror', (error) => erroresDeConsola.push(String(error)));

  await entrar(page, MEDICA);
  await irA(page, '/medical-records');
  await estable(page);
  await page.getByLabel('Nombre o código').fill('Ana');
  await page.getByTestId('paciente-ver-expediente').first().click();
  await page.waitForURL(/\/medical-records\/[^/]+$/, { timeout: 60_000 });
  await estable(page);

  // El aviso de alergias/encuentros aparece una vez por apertura, cubriendo
  // el resto (ver `content-dialog` de "Antes de leer el expediente").
  const entendido = page.getByRole('button', { name: 'Entendido' });
  if (await entendido.isVisible().catch(() => false)) {
    await entendido.click();
    await estable(page);
  }

  const tarjeta = page.getByTestId('expediente-enfermedades-activas');
  await expect(tarjeta).toBeVisible();

  // El sello de la pestaña Diagnósticos ya no es un único tono `info` fijo.
  // `app-badge` pinta sus clases en el propio host (`badge.ts:31-32`), no en
  // un `<span>` interno.
  await page.getByRole('tab', { name: /Diagnósticos/ }).click();
  const sellos = page.locator('.data-table__row app-badge');
  await expect(sellos.first()).toBeVisible();
  // No depende de que esta paciente tenga varios diagnósticos con estados
  // distintos: alcanza con que NINGUNO se quedó en el `info` fijo de antes,
  // porque `estadoTono` ahora se fija siempre en `diagnosticos()`.
  const tonos = await sellos.evaluateAll((elementos) =>
    elementos.map((el) => [...el.classList].find((clase) => clase.startsWith('tone--'))),
  );
  expect(tonos.length, 'Al menos un diagnóstico en la tabla').toBeGreaterThan(0);
  expect(tonos.every((tono) => tono !== 'tone--info'), `Tonos encontrados: ${tonos.join(', ')}`).toBe(true);

  await page.screenshot({
    path: 'docs/trabajo/2026-09-25-encuentro-clinico/c3/evidencia/visual/enfermedades-activas-runtime.png',
    fullPage: true,
  });

  const propios = erroresDeConsola.filter(
    (error) => !(error.includes('Content Security Policy') && error.includes('inline script')),
  );
  expect(propios, 'Consola atribuible a este cambio').toEqual([]);
});

import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

import type { Actor } from './support/actores';
import { entrar, esperarAplicacionLista } from './support/sesion';

/**
 * Capturas de C-01 (MD-06 / PA-04) contra la API REAL con los datos que
 * siembra `scripts/e2e-sembrar-api-real.mjs --etiqueta carril2`.
 *
 * Tres anchos (1440 · 768 · 390) × dos temas (claro · oscuro) de:
 *   1. «Contabilidad» → «Pagos por sesión», y en 768/390 una fila desplegada
 *      (fecha, seguro y comprobante viven en el detalle).
 *   2. La consulta del paciente A → casilla «Pagos»: comprobantes, la captura
 *      en grande, y los diálogos de aceptar y de rechazar con motivo — se
 *      capturan ANTES de confirmar, para no consumir el comprobante sembrado
 *      (la mutación real está en `c01-aceptar-comprobante.spec.ts`).
 *   3. Los estados vacío y error de la tabla, con la red interceptada: son
 *      evidencia de UI, no de integración, y el nombre del archivo lo dice.
 *
 * Movimiento reducido y espera a que el diálogo esté opaco: una captura a mitad
 * de la animación no es evidencia (segunda pasada, 2026-10-23).
 *
 * Variables: E2E_MODE=real, E2E_DOCTOR_EMAIL/PASSWORD, E2E_PATIENT_PROFILE_ID,
 * CAPTURAS_DIR (carpeta de salida).
 */
const ANCHOS = [
  { nombre: '1440', width: 1440, height: 900 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '390', width: 390, height: 844 },
] as const;
const TEMAS = ['light', 'dark'] as const;
const DIR = process.env['CAPTURAS_DIR'] ?? 'artifacts/capturas-c01';
const TABLA = '**/billing/me/provider-payment-table**';

test.skip(process.env['E2E_MODE'] !== 'real', 'Sólo contra la API real con datos sembrados');
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const medica = (): Actor => ({
  rol: 'medica' as unknown as Actor['rol'],
  identificador: process.env['E2E_DOCTOR_EMAIL'] ?? '',
  clave: process.env['E2E_DOCTOR_PASSWORD'] ?? '',
  nombre: 'medica',
});

/**
 * El tema se fija ANTES de que cargue la página (script de inicio), no después:
 * cambiarlo con la página pintada dispara la transición de colores y la
 * captura sale a mitad de camino (segunda pasada, ronda 2).
 */
let temaActual: (typeof TEMAS)[number] = 'light';
async function tema(_page: Page, modo: (typeof TEMAS)[number]): Promise<void> {
  temaActual = modo;
}

/**
 * Espera a que terminen las animaciones FINITAS del documento (la entrada del
 * panel del diálogo, la transición de tema). Las infinitas —el pulso
 * decorativo— no terminan nunca y no afectan lo que se mide.
 */
async function quieto(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(Number(a.effect?.getComputedTiming().endTime ?? 0)))
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

/** El diálogo por su nombre accesible, ya opaco: nada de capturas a mitad de la entrada. */
async function dialogoQuieto(page: Page, nombre: RegExp): Promise<Locator> {
  const dialogo = page.getByRole('dialog', { name: nombre });
  await expect(dialogo).toBeVisible();
  // La animación de entrada corre en el panel interno (`.panel-muelle`), no en
  // el `<dialog>`: se espera a que terminen todas.
  await quieto(page);
  return dialogo;
}

async function fijarTema(page: Page): Promise<void> {
  await page.evaluate((m) => localStorage.setItem('mantra-core-health.theme', m), temaActual);
}

async function abrirPestana(page: Page): Promise<Locator> {
  await fijarTema(page);
  await page.goto('/administration/accounting', { waitUntil: 'domcontentloaded' });
  await esperarAplicacionLista(page);
  await page.getByRole('tab', { name: /pagos por sesión/i }).click();
  const sesiones = page.getByTestId('pagos-por-sesion');
  await expect(sesiones).toBeVisible();
  await quieto(page);
  return sesiones;
}

async function abrirCaja(page: Page, paciente: string): Promise<Locator> {
  await fijarTema(page);
  await page.goto(`/medical-records/${paciente}/consultation`, { waitUntil: 'domcontentloaded' });
  await esperarAplicacionLista(page);
  await page.getByRole('button', { name: /^pagos/i }).first().click();
  await dialogoQuieto(page, /pagos de la persona/i);
  const caja = page.getByTestId('comprobantes-de-pago');
  await expect(caja.getByTestId('comprobante-aceptar').first()).toBeVisible();
  await quieto(page);
  return caja;
}

test('C-01 · capturas de «Pagos por sesión» y de la caja «Pagos»', async ({ page }) => {
  test.setTimeout(420_000);
  mkdirSync(DIR, { recursive: true });
  const paciente = process.env['E2E_PATIENT_PROFILE_ID'] ?? '';
  expect(paciente, 'Falta E2E_PATIENT_PROFILE_ID').toBeTruthy();
  await entrar(page, medica());

  for (const t of TEMAS) {
    for (const a of ANCHOS) {
      await page.setViewportSize({ width: a.width, height: a.height });
      const sufijo = `${a.nombre}-${t}`;

      await tema(page, t);
      // 1 · La tabla, y en angosto una fila desplegada.
      const sesiones = await abrirPestana(page);
      const tabla = sesiones.getByRole('table');
      for (const columna of [/paciente/i, /monto/i, /estado/i]) {
        await expect(tabla.getByRole('columnheader', { name: columna })).toBeVisible();
      }
      if (a.width >= 1024) {
        await expect(tabla.getByRole('columnheader', { name: /comprobante/i })).toBeVisible();
      }
      await page.screenshot({ path: `${DIR}/pagos-por-sesion-${sufijo}.png`, fullPage: true });
      if (a.width < 1024) {
        await sesiones.getByRole('button', { name: /ver el detalle/i }).last().click();
        // El detalle (un `dl`) muestra lo que la fila angosta esconde.
        await expect(sesiones.locator('dl').getByText(/transferencia por qr/i)).toBeVisible();
        await quieto(page);
        await page.screenshot({ path: `${DIR}/pagos-por-sesion-detalle-${sufijo}.png`, fullPage: true });
      }

      // 2 · La caja «Pagos», la captura en grande y los dos diálogos.
      const caja = await abrirCaja(page, paciente);
      await page.screenshot({ path: `${DIR}/caja-pagos-${sufijo}.png` });

      await caja.getByTestId('comprobante-ampliar').first().click();
      const grande = await dialogoQuieto(page, /^comprobante de pago$/i);
      await expect(grande.getByRole('img', { name: /en grande/i })).toBeVisible();
      await page.screenshot({ path: `${DIR}/caja-pagos-ampliado-${sufijo}.png` });
      await page.keyboard.press('Escape');
      await expect(grande).toBeHidden();

      await caja.getByTestId('comprobante-rechazar').first().click();
      const rechazo = await dialogoQuieto(page, /rechazar el comprobante/i);
      await rechazo.getByTestId('dialogo-motivo').locator('textarea').fill('La captura no muestra el número de operación');
      await page.screenshot({ path: `${DIR}/caja-pagos-rechazar-con-motivo-${sufijo}.png` });
      await rechazo.getByRole('button', { name: /cancelar/i }).click();
      await expect(rechazo).toBeHidden();

      await caja.getByTestId('comprobante-aceptar').first().click();
      const aceptar = await dialogoQuieto(page, /aceptar el comprobante/i);
      await expect(aceptar.getByText(/se confirma el pago/i)).toBeVisible();
      await page.screenshot({ path: `${DIR}/caja-pagos-aceptar-${sufijo}.png` });
      await aceptar.getByRole('button', { name: /cancelar/i }).click();
      await expect(aceptar).toBeHidden();
    }
  }

  // 3 · Estados vacío y error (red interceptada, sólo UI), en los tres anchos.
  for (const t of TEMAS) {
   for (const a of ANCHOS) {
    await page.setViewportSize({ width: a.width, height: a.height });
    await tema(page, t);
    await page.route(TABLA, (ruta) =>
      ruta.fulfill({
        json: { items: [], nextCursor: null, totals: { sessions: 0, amountMinor: 0, paidMinor: 0, pendingMinor: 0 } },
      }),
    );
    const vacia = await abrirPestana(page);
    await expect(vacia.getByText(/cuando atienda una consulta/i)).toBeVisible();
    await quieto(page);
    await page.screenshot({ path: `${DIR}/estado-vacio-interceptado-${a.nombre}-${t}.png`, fullPage: true });
    await page.unroute(TABLA);

    await page.route(TABLA, (ruta) =>
      ruta.fulfill({
        status: 500,
        json: { code: 'INTERNAL', message: 'Falla simulada', correlationId: 'req-captura-500', timestamp: '', path: '' },
      }),
    );
    const rota = await abrirPestana(page);
    await expect(rota.getByRole('button', { name: /reintentar/i })).toBeVisible();
    await quieto(page);
    await page.screenshot({ path: `${DIR}/estado-error-interceptado-${a.nombre}-${t}.png`, fullPage: true });

    // El error de la caja de comprobantes (S9: qué pasó + ID de petición).
    await fijarTema(page);
    await page.goto(`/medical-records/${paciente}/consultation`, { waitUntil: 'domcontentloaded' });
    await esperarAplicacionLista(page);
    await page.getByRole('button', { name: /^pagos/i }).first().click();
    await dialogoQuieto(page, /pagos de la persona/i);
    const errorCaja = page.getByTestId('comprobantes-error');
    await expect(errorCaja).toContainText('req-captura-500');
    await quieto(page);
    await page.screenshot({ path: `${DIR}/caja-pagos-estado-error-interceptado-${a.nombre}-${t}.png` });
    await page.unroute(TABLA);
   }
  }
});

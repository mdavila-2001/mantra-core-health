import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Tarea 3 · H8/H5 — transparencia de exclusiones y liquidación conciliada en
 * la maqueta interna (`insurance.handlers.ts`), del mismo régimen que
 * `carril-adjudicacion-clausulas.spec.ts`.
 *
 * Dos vistas de la misma liquidación:
 * - **Prestador/operador**: `CLM-2026-0177` en el detalle de solicitud
 *   (300 = 150 cubierto + 30 copago + 120 rechazado, cláusula 12.3 del ECG).
 * - **Paciente**: la orden diagnóstica con liquidación `PARTIALLY_APPROVED`
 *   de la maqueta (`patientSettlementFixture`, 100 = 50 + 20 + 30, cláusula
 *   14.2 con justificación).
 *
 * Se comprueba la ecuación de la liquidación leyendo el DOM y sumando con
 * `BigInt` sobre centavos — nunca `Number` — para no enmascarar un
 * redondeo con el margen de la comparación de punto flotante.
 */

const OPERADOR_MOCK: Actor = {
  rol: 'administrador',
  identificador: 'admin@alovida.mock',
  clave: 'cualquiera',
  nombre: 'Operador (maqueta)',
};

const PACIENTE_MOCK: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'mock',
  nombre: 'Paciente (maqueta)',
};

const VIEWPORTS = [
  { nombre: 'escritorio', width: 1440, height: 900 },
  { nombre: 'movil', width: 390, height: 844 },
] as const;

/** Centavos exactos de un importe leído del DOM, sin pasar por `Number`. */
function centavosDe(texto: string): bigint {
  const coincidencia = texto.match(/-?\d+(?:\.\d+)?/);
  if (coincidencia === null) {
    throw new Error(`No se encontró un importe en «${texto}»`);
  }
  const [entero, fraccion = ''] = coincidencia[0].split('.');
  const negativo = entero.startsWith('-');
  const magnitud = BigInt(`${entero.replace('-', '')}${fraccion.padEnd(2, '0').slice(0, 2)}`);
  return negativo ? -magnitud : magnitud;
}

async function sinDesborde(page: Page): Promise<void> {
  const desborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(desborde, 'la sección de liquidación desborda a lo ancho').toBe(false);
}

test.describe('liquidación conciliada · vista del prestador (CLM-2026-0177)', () => {
  for (const viewport of VIEWPORTS) {
    test(`concilia 300 = 150 + 30 + 120 y muestra la cláusula 12.3 en ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      const errores: string[] = [];
      page.on('console', (mensaje) => {
        if (mensaje.type() === 'error') errores.push(mensaje.text());
      });

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await entrar(page, OPERADOR_MOCK);
      await irA(page, '/administration/insurance-claims');
      await expect(page.getByTestId('tabla')).toBeVisible({ timeout: 30_000 });
      await estable(page);

      await page
        .getByTestId('tabla-fila')
        .filter({ hasText: 'CLM-2026-0177' })
        .getByTestId('claim-link')
        .click();
      const seccion = page.getByTestId('claim-settlement');
      await expect(seccion).toBeVisible({ timeout: 30_000 });
      await estable(page);

      const facturado = centavosDe(await seccion.getByTestId('claim-settlement-billed').innerText());
      const cubierto = centavosDe(await seccion.getByTestId('claim-settlement-approved').innerText());
      const copago = centavosDe(await seccion.getByTestId('claim-settlement-patient').innerText());
      const rechazado = centavosDe(await seccion.getByTestId('claim-settlement-denied').innerText());

      expect(facturado).toBe(30000n);
      expect(cubierto).toBe(15000n);
      expect(copago).toBe(3000n);
      expect(rechazado).toBe(12000n);
      expect(cubierto + copago + rechazado).toBe(facturado);

      await expect(seccion.getByTestId('claim-settlement-mismatch')).toHaveCount(0);

      const clausula = seccion.getByTestId('claim-exclusion-clause');
      await expect(clausula).toContainText('Cláusula 12.3');
      await expect(seccion.getByTestId('claim-exclusion-rationale')).toContainText(
        'requiere autorización previa del área médica',
      );

      await sinDesborde(page);
      await page.screenshot({
        path: `docs/trabajo/2026-09-24-insurance-exclusions-settlement-contracts/evidencia/prestador-${viewport.nombre}.png`,
        fullPage: true,
      });

      const ruido = errores.filter((texto) => !/Content Security Policy/i.test(texto));
      expect(ruido, `errores de consola: ${ruido.join(' | ')}`).toEqual([]);
    });
  }
});

test.describe('liquidación conciliada · vista del paciente (orden parcialmente aprobada)', () => {
  for (const viewport of VIEWPORTS) {
    test(`concilia 100 = 50 + 20 + 30 y muestra la cláusula 14.2 en ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      const errores: string[] = [];
      page.on('console', (mensaje) => {
        if (mensaje.type() === 'error') errores.push(mensaje.text());
      });

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await entrar(page, PACIENTE_MOCK);
      await irA(page, '/my-account/diagnostic-orders');

      // Sólo la orden con resultado PARTIALLY_APPROVED trae una exclusión
      // con justificación real: la DENIED muestra «No informada» y la
      // APPROVED no tiene exclusión (nada quedó fuera de lo cubierto).
      const orden = page
        .getByTestId('diagnostic-order')
        .filter({ hasText: 'excede el beneficio específico' });
      await expect(orden.first()).toBeVisible({ timeout: 30_000 });
      await estable(page);
      const tarjeta = orden.first();

      const cubierto = centavosDe(await tarjeta.getByTestId('settlement-total-approved').innerText());
      const copago = centavosDe(await tarjeta.getByTestId('settlement-total-patient').innerText());
      const rechazado = centavosDe(await tarjeta.getByTestId('settlement-total-denied').innerText());
      const facturado = centavosDe(await tarjeta.getByTestId('settlement-total-billed').innerText());

      expect(facturado).toBe(10000n);
      expect(cubierto).toBe(5000n);
      expect(copago).toBe(2000n);
      expect(rechazado).toBe(3000n);
      expect(cubierto + copago + rechazado).toBe(facturado);

      await expect(tarjeta.getByTestId('settlement-exclusion-clause')).toContainText('Cláusula 14.2');
      await expect(tarjeta.getByTestId('settlement-exclusion-rationale')).toContainText(
        'excede el beneficio específico',
      );

      await sinDesborde(page);
      await page.screenshot({
        path: `docs/trabajo/2026-09-24-insurance-exclusions-settlement-contracts/evidencia/paciente-${viewport.nombre}.png`,
        fullPage: true,
      });

      const ruido = errores.filter((texto) => !/Content Security Policy/i.test(texto));
      expect(ruido, `errores de consola: ${ruido.join(' | ')}`).toEqual([]);
    });
  }
});

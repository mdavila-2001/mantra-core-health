import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * La contabilidad simple del doctor (28/09/2026).
 *
 * 1. En la pestaña «Resumen», tres números: pacientes atendidos, cuánto cobró
 *    y cuánto espera de las aseguradoras. Los registros están aparte, en la
 *    pestaña «Registros» (30/09/2026): tableros y tablas ya no se mezclan.
 * 2. Gasto con su tipo: el tipo que falta se crea «ahí mismo» con «Nueva
 *    cuenta», el gasto se edita y se borra.
 * 3. Activo y deuda con su tipo.
 * 4. Transacción debe/haber.
 * 5. Cuentas: tabla y modal; las generales no se borran, las propias sí.
 * 6. Lo guardado sigue ahí después de recargar.
 */
const SALIDA = process.env['E2E_EVIDENCE_DIR']
  ? join(process.env['E2E_EVIDENCE_DIR'], 'accounting')
  : join('docs', 'trabajo', '2026-09-28-contabilidad-simple', 'evidencia');
const DOCTORA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

test.beforeEach(() => {
  test.setTimeout(240_000);
  mkdirSync(SALIDA, { recursive: true });
});

async function abrirPestana(registros: Locator, nombre: RegExp): Promise<void> {
  await registros.getByRole('tab', { name: nombre }).click();
}

function modal(page: Page, testId: string): Locator {
  return page.getByTestId(testId).locator('dialog[open]');
}

test('el doctor ve sus tres números y lleva gastos, activos, deudas, transacciones y cuentas', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (error) => errores.push(error.message));

  await entrar(page, DOCTORA);
  await irA(page, '/administration/accounting');

  /* ---- 1 · los tres números -------------------------------------------- */
  const numeros = page.getByTestId('contabilidad-numeros');
  await expect(numeros).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('numero-pacientes')).toContainText('Pacientes atendidos');
  await expect(page.getByTestId('numero-cobrado')).toContainText('Bs');
  await expect(page.getByTestId('numero-aseguradoras')).toContainText(
    'Esperás de las aseguradoras',
  );
  await page.screenshot({ path: join(SALIDA, '1-tres-numeros.png') });

  // Tableros y registros son dos pestañas: en «Resumen» no hay tablas…
  await expect(page.getByTestId('contabilidad-registros')).toHaveCount(0);
  // …y en «Registros» no hay tableros.
  await page.getByRole('tab', { name: 'Registros', exact: true }).click();
  await expect(page.getByTestId('contabilidad-numeros')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '¿Cuánto hiciste?' })).toHaveCount(0);
  const registros = page.getByTestId('contabilidad-registros');
  await registros.scrollIntoViewIfNeeded();
  await expect(registros.getByTestId('tabla-EXPENSE')).toContainText('Alquiler de septiembre');
  await page.screenshot({ path: join(SALIDA, '2-gastos.png') });

  /* ---- 2 · gasto con un tipo nuevo, creado ahí mismo -------------------- */
  await registros.getByTestId('nuevo-EXPENSE').click();
  let dialogo = modal(page, 'registro-dialog');
  await expect(dialogo).toBeVisible();
  await dialogo.getByTestId('registro-nueva-cuenta').click();
  const cuenta = modal(page, 'cuenta-dialog');
  await expect(cuenta).toBeVisible();
  await expect(cuenta).toContainText('Nueva cuenta de gasto');
  await cuenta.getByTestId('cuenta-nombre').fill('Laboratorio de referencia');
  await cuenta.getByTestId('cuenta-guardar').click();
  await expect(page.getByTestId('cuenta-dialog')).toHaveCount(0);
  // La cuenta nueva quedó elegida como tipo.
  await expect(dialogo.locator('[data-testid="registro-tipo"] select')).toHaveValue(/.+/);
  await expect(
    dialogo.locator('[data-testid="registro-tipo"] select option:checked'),
  ).toContainText('Laboratorio de referencia');
  await dialogo.getByTestId('registro-descripcion').fill('Perfil lipídico derivado');
  await dialogo.getByTestId('registro-monto').fill('1.250,50');
  await page.screenshot({ path: join(SALIDA, '3-gasto-nuevo.png') });
  await dialogo.getByTestId('registro-guardar').click();
  await expect(page.getByTestId('registro-dialog')).toHaveCount(0);
  const tablaGastos = registros.getByTestId('tabla-EXPENSE');
  await expect(tablaGastos).toContainText('Perfil lipídico derivado');
  await expect(tablaGastos).toContainText('Bs\u00a01\u00a0250,50');
  await expect(tablaGastos).toContainText('Laboratorio de referencia');

  // Editar el gasto.
  const fila = tablaGastos.getByRole('row', { name: /Perfil lipídico derivado/ });
  await fila.getByRole('button', { name: /Editar/ }).click();
  dialogo = modal(page, 'registro-dialog');
  await expect(dialogo.getByTestId('registro-monto')).toHaveValue('1250,50');
  await dialogo.getByTestId('registro-monto').fill('1300');
  await dialogo.getByTestId('registro-guardar').click();
  await expect(page.getByTestId('registro-dialog')).toHaveCount(0);
  await expect(tablaGastos).toContainText('Bs\u00a01\u00a0300,00');

  /* ---- 3 · activo y deuda ---------------------------------------------- */
  await abrirPestana(registros, /^Activos/);
  await registros.getByTestId('nuevo-ASSET').click();
  dialogo = modal(page, 'registro-dialog');
  await dialogo
    .locator('[data-testid="registro-tipo"] select')
    .selectOption({ label: '1.6 · Equipo de computación' });
  await dialogo.getByTestId('registro-descripcion').fill('Computadora del consultorio');
  await dialogo.getByTestId('registro-monto').fill('6400');
  await dialogo.getByTestId('registro-guardar').click();
  await expect(registros.getByTestId('tabla-ASSET')).toContainText('Computadora del consultorio');

  await abrirPestana(registros, /^Deudas/);
  await registros.getByTestId('nuevo-DEBT').click();
  dialogo = modal(page, 'registro-dialog');
  await dialogo
    .locator('[data-testid="registro-tipo"] select')
    .selectOption({ label: '2.3 · Tarjeta de crédito' });
  await dialogo.getByTestId('registro-descripcion').fill('Cuotas de la computadora');
  await dialogo.getByTestId('registro-monto').fill('3200');
  await dialogo.getByTestId('registro-guardar').click();
  await expect(registros.getByTestId('tabla-DEBT')).toContainText('Cuotas de la computadora');
  await page.screenshot({ path: join(SALIDA, '4-deudas.png') });

  /* ---- 4 · transacción debe/haber -------------------------------------- */
  await abrirPestana(registros, /^Transacciones/);
  await registros.getByTestId('nueva-transaccion').click();
  dialogo = modal(page, 'transaccion-dialog');
  await dialogo.getByTestId('transaccion-descripcion').fill('Pago de la tarjeta');
  await dialogo
    .locator('[data-testid="transaccion-debe"] select')
    .selectOption({ label: '2.3 · Tarjeta de crédito' });
  await dialogo
    .locator('[data-testid="transaccion-haber"] select')
    .selectOption({ label: '1.2 · Banco' });
  await dialogo.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await dialogo.getByTestId('transaccion-monto').fill('800');
  await page.screenshot({ path: join(SALIDA, '5-transaccion-nueva.png') });
  await dialogo.getByTestId('transaccion-guardar').click();
  await expect(page.getByTestId('transaccion-dialog')).toHaveCount(0);
  const tablaTransacciones = registros.getByTestId('tabla-transacciones');
  await expect(tablaTransacciones).toContainText('Pago de la tarjeta');
  await expect(tablaTransacciones).toContainText('2.3 · Tarjeta de crédito');
  await expect(tablaTransacciones).toContainText('1.2 · Banco');

  /* ---- 5 · cuentas ------------------------------------------------------ */
  await abrirPestana(registros, /^Cuentas/);
  const tablaCuentas = registros.getByTestId('tabla-cuentas');
  await expect(tablaCuentas).toContainText('Honorarios por consultas');
  await expect(tablaCuentas).toContainText('Laboratorio de referencia');
  // Una general no ofrece borrar.
  const general = tablaCuentas.getByRole('row', { name: /Alquiler del consultorio/ });
  await expect(general.getByRole('button', { name: /Borrar/ })).toHaveCount(0);
  await page.screenshot({ path: join(SALIDA, '6-cuentas.png') });

  await registros.getByTestId('nueva-cuenta').click();
  const nueva = modal(page, 'cuenta-dialog');
  await nueva.getByTestId('cuenta-nombre').fill('Donaciones');
  await nueva.locator('[data-testid="cuenta-clase"] select').selectOption({ label: 'Ingreso' });
  await nueva.getByTestId('cuenta-guardar').click();
  await expect(tablaCuentas).toContainText('Donaciones');
  const filaNueva = tablaCuentas.getByRole('row', { name: /Donaciones/ });
  await filaNueva.getByRole('button', { name: /Borrar/ }).click();
  await page
    .getByRole('alertdialog')
    .or(page.getByRole('dialog'))
    .getByRole('button', { name: 'Borrar' })
    .last()
    .click();
  await expect(tablaCuentas).not.toContainText('Donaciones');

  /* ---- 6 · recarga: lo guardado sigue ahí ------------------------------ */
  await page.reload();
  await page.getByRole('tab', { name: 'Registros', exact: true }).click();
  const tras = page.getByTestId('contabilidad-registros');
  await expect(tras.getByTestId('tabla-EXPENSE')).toContainText('Perfil lipídico derivado', {
    timeout: 30_000,
  });
  await expect(tras.getByTestId('tabla-EXPENSE')).toContainText('Bs\u00a01\u00a0300,00');
  await abrirPestana(tras, /^Transacciones/);
  await expect(tras.getByTestId('tabla-transacciones')).toContainText('Pago de la tarjeta');
  await tras.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SALIDA, '7-tras-recargar.png') });

  // Y el gasto se borra.
  await abrirPestana(tras, /^Gastos/);
  const aBorrar = tras
    .getByTestId('tabla-EXPENSE')
    .getByRole('row', { name: /Perfil lipídico derivado/ });
  await aBorrar.getByRole('button', { name: /Borrar/ }).click();
  await page
    .getByRole('alertdialog')
    .or(page.getByRole('dialog'))
    .getByRole('button', { name: 'Borrar' })
    .last()
    .click();
  await expect(tras.getByTestId('tabla-EXPENSE')).not.toContainText('Perfil lipídico derivado');

  expect(errores).toEqual([]);
});

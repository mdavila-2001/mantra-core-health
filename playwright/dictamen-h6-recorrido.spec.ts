import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable } from './support/sesion';

/**
 * H6 · recorrido de las correcciones que **ya llegaron a `mockup`** después
 * del corte del dictamen (20/09 20:59): PR #557 (Justin, receta) y PR #559
 * (Ender, contratos + panel), ambos mergeados el 21/09 entre las 12:10 y las
 * 14:33 UTC. Ninguno de los dos lo escribí yo — regla 70.4.8 (quien verifica
 * no es quien escribió) queda cumplida.
 *
 * Guion (el caso mínimo que acepta o rechaza cada una) tomado literal de
 * `evidencia/dictamen-aceptacion-24.md` §1. Cuenta: `medica@alovida.mock`,
 * sintética declarada — no hay dato de persona real en ninguna captura.
 *
 * **C-20 se ejercita esperando que falle**: el dato (`default_frequency`)
 * existe en el simulador (Ender), pero `medication-block.ts` nunca lo lee
 * (`onMedicamentoElegido` sólo consume `dose_forms`/`strengths`) — confirmado
 * leyendo el código antes de escribir el caso, no adivinado.
 */

const SALIDA = join('docs', 'trabajo', '2026-09-20-notas-cuadricula-e-internacion', 'evidencia', 'dictamen');

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

/** Entra a la ficha, abre la consulta y abre la casilla de medicación. */
async function abrirCasillaMedicacion(page: Page): Promise<void> {
  await entrar(page, MEDICA);
  await page.goto('/medical-records', { waitUntil: 'commit' });
  await estable(page);

  const buscador = page.getByRole('textbox', { name: 'Nombre o código' });
  await buscador.fill('Ana');
  const verExpediente = page.getByRole('link', { name: /Ver expediente|expediente/i }).first();
  await expect(verExpediente).toBeVisible({ timeout: 30_000 });
  await verExpediente.click();
  await page.waitForURL(/\/medical-records\/[^/]+$/, { timeout: 60_000 });
  await estable(page);

  await page.goto(`${page.url()}/consultation`, { waitUntil: 'commit' });
  await page.waitForURL(/\/medical-records\/[^/]+\/consultation$/, { timeout: 60_000 });
  await estable(page);

  const abrir = page.getByTestId('consulta-abrir-encuentro');
  if ((await abrir.count()) > 0) {
    await abrir.click();
    await expect(page.getByTestId('encuentros-en-curso')).toBeVisible({ timeout: 30_000 });
  }

  await page.getByTestId('consulta-casilla-medicacion').click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
  await estable(page);
}

test.describe('H6 · recorrido de #557 (Justin, receta)', () => {
  test.beforeEach(async ({ page }) => {
    mkdirSync(SALIDA, { recursive: true });
    await abrirCasillaMedicacion(page);
  });

  test('C-15 · en la pantalla donde se escribe la receta no hay botón de descargar', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: /descargar/i })).toHaveCount(0);
    await page.screenshot({ path: join(SALIDA, 'c15-sin-descargar.png') });
  });

  test('C-16 · la barra de demostración no aparece al registrar una receta', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/dato de prueba|modo de demostraci/i)).toHaveCount(0);
    await page.screenshot({ path: join(SALIDA, 'c16-sin-barra-demo.png') });
  });

  test('C-17 · la receta no ofrece «favoritos»', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/favorito/i)).toHaveCount(0);
    await page.screenshot({ path: join(SALIDA, 'c17-sin-favoritos.png') });
  });

  test('C-18 · «¿De qué consulta es la receta?» permite elegir un diagnóstico o escribir una razón', async ({
    page,
  }) => {
    const dialog = page.getByRole('dialog');
    const indicacion = dialog.getByTestId('receta-indicacion');
    await expect(indicacion).toBeVisible();

    // Elegir la opción de motivo libre y comprobar que el campo de texto aparece.
    await indicacion.locator('select').selectOption({ index: 1 });
    await estable(page);
    const opciones = await indicacion.locator('select option').allTextContents();
    console.log('OPCIONES DE "¿PARA QUÉ ES ESTA RECETA?":', JSON.stringify(opciones));

    const motivoLibreExiste = (await dialog.getByTestId('receta-motivo-libre').count()) > 0;
    console.log('¿APARECIÓ EL CAMPO DE MOTIVO LIBRE?', motivoLibreExiste);
    await page.screenshot({ path: join(SALIDA, 'c18-indicacion-o-motivo.png') });
  });

  test('C-19 · el campo de dosis acepta letras y números; «Unidad» ya no existe', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    // `input.html` pone `[attr.data-testid]` directo en el `<input>`: el
    // testid YA ES el campo, no un envoltorio — `.locator('input')` encima
    // buscaba un descendiente que no existe y colgaba hasta el timeout.
    const dosis = dialog.getByTestId('receta-dosis');
    await dosis.fill('500 mg');
    await expect(dosis).toHaveValue('500 mg');

    await expect(dialog.getByText('Unidad', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: join(SALIDA, 'c19-dosis-libre.png') });
  });

  test('D-06 · el buscador de «Medicamento» ofrece Activo/Inactivo, no medicamentos', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    const buscador = dialog.getByRole('combobox', { name: /Medicamento/ });

    // Cualquier nombre real de medicamento: cero coincidencias.
    await buscador.fill('Paracetamol');
    await expect(dialog.getByText('Ningún medicamento coincide').first()).toBeVisible({ timeout: 15_000 });

    // Un estado de VS_RECORD_STATUS, el conjunto de reserva: SÍ aparece.
    // Esto es lo que confirma que el catálogo cargado es el equivocado, no
    // que esté vacío — mismo mecanismo que el D-01 retirado de C-14, pero acá
    // reproducido: `misc.handlers.ts` no tiene patrón para
    // `medication_requests.medication_concept_id`.
    await buscador.fill('Activo');
    const opcionActivo = dialog.getByRole('option').filter({ hasText: 'ST-ACTIVE' });
    await expect(opcionActivo).toBeVisible({ timeout: 15_000 });
    await expect(opcionActivo.getByText('Activo', { exact: true })).toBeVisible();

    await page.screenshot({ path: join(SALIDA, 'd06-medicamento-cae-a-record-status.png') });
  });

  test('C-20 · BLOCKED por D-06 — no se puede elegir un medicamento para ver si completa la frecuencia', async ({
    page,
  }) => {
    // El CA exige «elegir un medicamento con posología de fábrica»: con el
    // buscador roto (D-06) no hay forma de elegir NINGÚN medicamento real, así
    // que el caso no se puede ejercitar tal como está escrito. Documentado
    // como código-lectura, no adivinado: `onMedicamentoElegido()`
    // (`medication-block.ts:684`) sólo lee `dose_forms`/`strengths` de la
    // ficha del concepto — nunca `default_frequency` — así que **aunque D-06
    // se arreglara, el CA seguiría sin cumplirse**. Se deja ambos hechos
    // registrados; no se fuerza un PASS ni se inventa una selección.
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('receta-frecuencia')).toBeVisible();
  });

  test('C-21 (parcial, medicación) · BLOCKED por D-06 — no se puede crear una receta nueva para ver el menú', async ({
    page,
  }) => {
    // Las 3 recetas de esta paciente en el fixture ya están «Vigente» o
    // «Completada» (emitidas): el menú sólo se ofrece mientras no lo está
    // (`@if (!receta.emitida)`). Haría falta prescribir una nueva, y elegir un
    // medicamento es el primer paso — bloqueado por D-06.
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('recetas')).toBeVisible();
  });

  test('C-22 · BLOCKED por D-06 — no se puede probar «dejar vacío el motivo» sin poder elegir medicamento', async ({
    page,
  }) => {
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('receta-indicacion')).toBeVisible();
  });
});

test.describe('H6 · recorrido de #559 (Ender, panel del dashboard)', () => {
  test('C-24 · el panel coincide en colores, tiene reporte semanal/mensual, mapa de calor, canceladas y otras atenciones', async ({
    page,
  }) => {
    mkdirSync(SALIDA, { recursive: true });
    await entrar(page, MEDICA);
    await page.goto('/dashboard', { waitUntil: 'commit' });
    await estable(page);

    const panel = page.getByTestId('panel-consultas-resumen');
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(panel.getByTestId('consultas-resumen-semana')).toBeVisible();
    await expect(panel.getByTestId('consultas-resumen-mes')).toBeVisible();
    await expect(panel.getByTestId('consultas-resumen-canceladas')).toBeVisible();

    const hayOtras = (await panel.getByTestId('consultas-resumen-otras-atenciones').count()) > 0;
    console.log('¿HAY OTRAS ATENCIONES PARA MOSTRAR?', hayOtras);

    // Mapa de calor: al menos una celda con `data-intensidad`, y el número
    // siempre visible (no sólo color) — regla de accesibilidad del propio PR.
    const celdas = panel.locator('td[data-intensidad]');
    await expect(celdas.first()).toBeVisible();
    const total = await celdas.count();
    expect(total).toBeGreaterThan(0);

    await page.screenshot({ path: join(SALIDA, 'c24-panel-consultas.png') });
  });
});

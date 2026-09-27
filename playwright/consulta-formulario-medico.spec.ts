import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * El formulario médico absorbe la nota médica y los documentos (26/09/2026).
 *
 * Recorrido, todo contra el simulador:
 *
 * 1. La rejilla tiene ocho casillas: sin «Nota médica» ni «Documento».
 * 2. Antes de responder el formulario, la receta avisa que falta y no emite.
 * 3. El formulario médico termina en «Campos adicionales del doctor»: una fila
 *    con texto y otra sólo con una imagen adjunta. Al completar se registran la
 *    nota y el documento con su archivo, y el modo lectura los relee.
 * 4. Receta, orden de análisis, plan de cuidados y reconsulta traen la
 *    respuesta cargada, y con una sola el selector queda deshabilitado.
 * 5. Un plan de cuidados se emite desde la respuesta y la línea del encuentro
 *    lee la nota. Que el alta viaje con `formInstanceId` lo fija la prueba
 *    unitaria del bloque: el simulador vive en el navegador y no hay red que
 *    mirar desde acá.
 */
const SALIDA = join('docs', 'trabajo', '2026-09-26-formulario-medico', 'evidencia');
const DOCTORA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};
// Un PNG de un píxel: lo que importa es que viaje, no lo que muestra.
const IMAGEN = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test.beforeEach(() => {
  test.setTimeout(240_000);
  mkdirSync(SALIDA, { recursive: true });
});

async function abrirLaConsulta(page: Page): Promise<void> {
  await entrar(page, DOCTORA);
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
  const atender = tarjeta.getByTestId('dia-ir-a-atender');
  await atender.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/medical-records\/[^/]+\/consultation\?/, { timeout: 30_000 });
  await expect(page.getByTestId('consulta-rejilla')).toBeVisible();
  const abrir = page.getByTestId('consulta-abrir-encuentro');
  await expect(abrir.or(page.getByTestId('encuentros-en-curso')).first()).toBeVisible();
  if (await abrir.isVisible()) await abrir.click();
  await expect(page.getByTestId('encuentros-en-curso')).toBeVisible();
}

async function abrirCasilla(page: Page, clave: string): Promise<Locator> {
  await page.getByTestId(`consulta-casilla-${clave}`).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  return modal;
}

async function cerrar(page: Page, modal: Locator): Promise<void> {
  await modal.getByTestId('content-dialog-close').click();
  await expect(page.getByTestId('consulta-modal')).toHaveCount(0);
}

/** Contesta la ficha elegida: «No» en cada sí/no y un texto en cada campo. */
async function contestarLaFicha(modal: Locator): Promise<void> {
  const campos = modal.getByTestId('campo-especialidad');
  await expect(campos.first()).toBeVisible({ timeout: 30_000 });
  for (const campo of await campos.all()) {
    const no = campo.getByRole('radio', { name: 'No' }).or(campo.getByRole('button', { name: 'No' }));
    if ((await no.count()) > 0) {
      await no.first().click();
      continue;
    }
    const texto = campo.locator('input:not([type="number"]):not([type="hidden"])');
    if ((await texto.count()) > 0 && (await texto.first().isEditable())) {
      await texto.first().fill('Sin particularidades');
      continue;
    }
    const numero = campo.locator('input[type="number"]');
    if ((await numero.count()) > 0) await numero.first().fill('1');
  }
}

test('el formulario médico absorbe nota y documentos, y lo emitido cuelga de su respuesta', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (error) => errores.push(error.message));

  await abrirLaConsulta(page);

  /* ---- 1 · ocho casillas ------------------------------------------------ */
  await expect(page.locator('[data-testid^="consulta-casilla-"]')).toHaveCount(8);
  await expect(page.getByTestId('consulta-casilla-notas')).toHaveCount(0);
  await expect(page.getByTestId('consulta-casilla-documentos')).toHaveCount(0);
  await expect(page.locator('.consulta__casilla-titulo').first()).toHaveText('Formulario médico');
  await page.screenshot({ path: join(SALIDA, '1-rejilla-ocho-casillas.png'), fullPage: true });

  /* ---- 2 · sin respuesta, la receta no emite ---------------------------- */
  let modal = await abrirCasilla(page, 'medicacion');
  await expect(modal.getByTestId('respuesta-falta')).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: join(SALIDA, '2-receta-sin-formulario.png') });
  await cerrar(page, modal);

  /* ---- 3 · formulario con campos adicionales ---------------------------- */
  modal = await abrirCasilla(page, 'formulario');
  await contestarLaFicha(modal);

  const seccion = modal.getByTestId('campos-adicionales');
  await seccion.scrollIntoViewIfNeeded();
  await expect(seccion).toContainText('Campos adicionales del doctor');
  await expect(seccion.getByTestId('adicional-fila')).toHaveCount(0);

  await seccion.getByTestId('adicional-agregar-fila').click();
  let fila = seccion.getByTestId('adicional-fila').nth(0);
  await fila.getByTestId('adicional-rotulo').fill('Presión arterial');
  await fila.getByTestId('adicional-valor').locator('textarea').fill('128/84 mmHg');

  await seccion.getByTestId('adicional-agregar-fila').click();
  fila = seccion.getByTestId('adicional-fila').nth(1);
  await fila.getByTestId('adicional-rotulo').fill('Análisis clínico con el que vino');
  // Sólo el campo y un archivo, sin valor: basta con una de las dos cosas.
  await fila.getByTestId('adicional-archivos').setInputFiles({
    name: 'hemograma.png',
    mimeType: 'image/png',
    buffer: IMAGEN,
  });
  await expect(fila).toContainText('hemograma.png');
  await seccion.getByTestId('adicional-texto').locator('textarea').fill('Refiere mareos al levantarse.');
  await seccion.screenshot({ path: join(SALIDA, '3-campos-adicionales.png') });

  // El simulador vive en el navegador: no hay red que mirar. Lo guardado se
  // comprueba releído en pantalla, que es lo que prueba la persistencia.
  await modal.getByRole('button', { name: 'Completar formulario' }).click();
  await expect(page.getByText('Quedaron como nota médica de esta consulta.')).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText('«Análisis clínico con el que vino» quedó en «Documentos» con 1 archivo.'),
  ).toBeVisible({ timeout: 30_000 });

  await expect(modal.getByTestId('formulario-respondido')).toBeVisible({ timeout: 30_000 });
  const guardados = modal.getByTestId('adicionales-guardados');
  await expect(guardados).toContainText('Presión arterial');
  await expect(guardados).toContainText('128/84 mmHg');
  await expect(guardados).toContainText('Adjunto: hemograma.png');
  await expect(guardados).toContainText('Refiere mareos al levantarse.');
  await expect(modal.getByTestId('formulario-cierre-fallos')).toHaveCount(0);
  await guardados.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SALIDA, '4-formulario-respondido.png') });
  await cerrar(page, modal);

  /* ---- 4 · la respuesta viene cargada y bloqueada ----------------------- */
  for (const clave of ['medicacion', 'ordenes', 'reconsulta', 'planes']) {
    modal = await abrirCasilla(page, clave);
    const selector = modal.getByTestId('respuesta-del-formulario');
    await expect(selector).toBeVisible({ timeout: 30_000 });
    await expect(selector).toContainText('Formulario médico');
    await expect(selector.locator('[disabled], [aria-disabled="true"]').first()).toBeAttached();
    await expect(modal.getByTestId('respuesta-falta')).toHaveCount(0);
    await page.screenshot({ path: join(SALIDA, `5-respuesta-en-${clave}.png`) });
    if (clave !== 'planes') await cerrar(page, modal);
  }

  /* ---- 5 · el plan emitido viaja asociado ------------------------------- */
  // `data-testid` cae en el host de `app-textarea`; `testId` de `app-input`, en el nativo.
  await modal.getByTestId('plan-meta').locator('textarea').fill('Controlar la presión');
  const motivo = modal.getByTestId('plan-motivo');
  if ((await motivo.count()) > 0 && (await motivo.first().isEditable())) {
    await motivo.first().fill('Hipertensión en estudio');
  }
  await modal.locator('app-form-actions button').last().click();
  await expect(page.getByText('Queda en la pestaña «Planes de cuidados» del expediente.')).toBeVisible({
    timeout: 30_000,
  });
  // Registrar cierra el modal por su cuenta: el alta ya quedó.
  await expect(page.getByTestId('consulta-modal')).toHaveCount(0, { timeout: 30_000 });

  // Y la línea del encuentro lee la nota de los campos adicionales.
  const linea = page.getByTestId('consulta-lo-registrado');
  await expect(linea).toContainText('Presión arterial');
  await expect(linea).toContainText('128/84 mmHg');
  await page.screenshot({ path: join(SALIDA, '6-lo-registrado.png'), fullPage: true });

  expect(errores).toEqual([]);
});

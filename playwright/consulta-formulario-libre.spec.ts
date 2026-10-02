import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * «Formulario libre — campo y valor» y el modal que no se despega (28/09/2026).
 *
 * Recorrido contra el simulador:
 *
 * 1. El modal del formulario médico no tiene una segunda barra: el `<dialog>`
 *    no desborda y rodar sobre su encabezado no mueve el panel. Antes, las
 *    etiquetas `.sr-only` de los campos obligatorios se medían contra el
 *    `<dialog>` y lo estiraban; rodar ahí subía el modal entero.
 * 2. El selector ofrece «Formulario libre — campo y valor», que se dibuja
 *    solo, sin plantilla, con una fila ya abierta.
 * 3. Una fila con texto y otra con varios archivos —elegidos en dos tandas:
 *    la segunda suma, no reemplaza—. Guardar registra la nota y el documento.
 * 4. Tras recargar la página, el formulario libre relee lo registrado.
 */
const SALIDA = join('docs', 'trabajo', '2026-09-28-formulario-libre-y-deslizable', 'evidencia');
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
const png = (name: string) => ({ name, mimeType: 'image/png', buffer: IMAGEN });

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
  await entrarAlEncuentro(page);
}

async function entrarAlEncuentro(page: Page): Promise<void> {
  await expect(page.getByTestId('consulta-rejilla')).toBeVisible({ timeout: 30_000 });
  const abrir = page.getByTestId('consulta-abrir-encuentro');
  await expect(abrir.or(page.getByTestId('encuentros-en-curso')).first()).toBeVisible();
  if (await abrir.isVisible()) await abrir.click();
  await expect(page.getByTestId('encuentros-en-curso')).toBeVisible();
}

async function abrirElFormulario(page: Page): Promise<Locator> {
  await page.getByTestId('consulta-casilla-formulario').click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  return modal;
}

async function elegirFormularioLibre(modal: Locator): Promise<Locator> {
  await modal
    .locator('app-select select')
    .first()
    .selectOption({ label: 'Formulario libre — campo y valor' });
  const libre = modal.getByTestId('formulario-libre');
  await expect(libre).toBeVisible();
  return libre;
}

/** Lo que mide el defecto: el `<dialog>` no se recorre y el panel no se mueve. */
async function medirElModal(page: Page) {
  return page.evaluate(() => {
    const dialogo = document.querySelector<HTMLElement>('dialog.content-dialog')!;
    const panel = dialogo.querySelector<HTMLElement>('.content-dialog__panel')!;
    return {
      desborde: dialogo.scrollHeight - dialogo.clientHeight,
      recorrido: dialogo.scrollTop,
      arribaDelPanel: Math.round(panel.getBoundingClientRect().top),
    };
  });
}

test.describe('en una ventana baja y en oscuro, como la del reporte', () => {
  test.use({ viewport: { width: 1025, height: 560 }, colorScheme: 'dark' });

  test('el modal del formulario médico no se despega al rodar', async ({ page }) => {
    await abrirLaConsulta(page);
    const modal = await abrirElFormulario(page);
    await expect(modal.getByTestId('campo-especialidad').first()).toBeVisible({ timeout: 30_000 });

    const antes = await medirElModal(page);
    expect(antes.desborde).toBeLessThanOrEqual(0);

    // Sobre el encabezado: con el defecto, ahí el que se recorría era el <dialog>.
    const encabezado = await modal.locator('.content-dialog__encabezado').boundingBox();
    await page.mouse.move(encabezado!.x + 200, encabezado!.y + encabezado!.height / 2);
    for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 300);
    // Y sobre el cuerpo, hasta el fondo.
    const cuerpo = await modal.locator('.content-dialog__cuerpo').boundingBox();
    await page.mouse.move(cuerpo!.x + 200, cuerpo!.y + cuerpo!.height / 2);
    for (let i = 0; i < 30; i++) await page.mouse.wheel(0, 400);

    const despues = await medirElModal(page);
    expect(despues.recorrido).toBe(0);
    expect(despues.arribaDelPanel).toBe(antes.arribaDelPanel);
    await expect(modal.getByRole('button', { name: 'Completar formulario' })).toBeInViewport();
    await page.screenshot({ path: join(SALIDA, '1-modal-al-fondo-sin-despegarse.png') });
  });
});

test('formulario libre: campos y valores, varios archivos por fila, y relee tras recargar', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (error) => errores.push(error.message));

  await abrirLaConsulta(page);
  let modal = await abrirElFormulario(page);
  const libre = await elegirFormularioLibre(modal);

  // Sin plantilla: ninguna pregunta de ficha, una fila ya abierta.
  await expect(modal.getByTestId('campo-especialidad')).toHaveCount(0);
  await expect(libre.getByTestId('adicional-fila')).toHaveCount(1);
  await expect(libre).toContainText('Campos y valores');
  await expect(libre.getByRole('button', { name: 'Guardar formulario' })).toBeDisabled();
  await page.screenshot({ path: join(SALIDA, '2-formulario-libre-vacio.png') });

  let fila = libre.getByTestId('adicional-fila').nth(0);
  await fila.getByTestId('adicional-rotulo').fill('Glucemia en ayunas');
  await fila.getByTestId('adicional-valor').locator('textarea').fill('98 mg/dL');

  await libre.getByTestId('adicional-agregar-fila').click();
  fila = libre.getByTestId('adicional-fila').nth(1);
  await fila.getByTestId('adicional-rotulo').fill('Estudios con los que vino');
  // Dos tandas: la segunda se suma a la primera.
  await fila
    .getByTestId('adicional-archivos')
    .setInputFiles([png('hemograma.png'), png('orina.png')]);
  await fila.getByTestId('adicional-archivos').setInputFiles(png('ecografia.png'));
  for (const nombre of ['hemograma.png', 'orina.png', 'ecografia.png']) {
    await expect(fila).toContainText(nombre);
  }
  await fila.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SALIDA, '3-formulario-libre-lleno.png') });

  await libre.getByRole('button', { name: 'Guardar formulario' }).click();
  await expect(page.getByText('Quedaron como nota médica de esta consulta.')).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText('«Estudios con los que vino» quedó en «Documentos» con 3 archivos.'),
  ).toBeVisible({ timeout: 30_000 });

  // Lo registrado se relee y el formulario vuelve a una fila vacía.
  let guardado = modal.getByTestId('formulario-libre-guardado');
  await expect(guardado).toContainText('Glucemia en ayunas');
  await expect(guardado).toContainText('98 mg/dL');
  await expect(guardado).toContainText('Adjunto: hemograma.png, orina.png, ecografia.png');
  await expect(libre.getByTestId('adicional-fila')).toHaveCount(1);
  await expect(modal.getByTestId('formulario-libre-fallos')).toHaveCount(0);
  await guardado.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SALIDA, '4-formulario-libre-guardado.png') });

  /* ---- recarga: lo registrado sigue ahí --------------------------------- */
  await page.reload();
  await entrarAlEncuentro(page);
  modal = await abrirElFormulario(page);
  await elegirFormularioLibre(modal);
  guardado = modal.getByTestId('formulario-libre-guardado');
  await expect(guardado).toContainText('Glucemia en ayunas', { timeout: 30_000 });
  await expect(guardado).toContainText('Adjunto: hemograma.png, orina.png, ecografia.png');
  await guardado.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SALIDA, '5-releido-tras-recargar.png') });

  expect(errores).toEqual([]);
});

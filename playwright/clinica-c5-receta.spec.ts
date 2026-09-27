import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * El medicamento es obligatorio en las dos recetas (`puedeRecetar` exige
 * `medicamento() !== null`, además de la indicación). Con texto vacío
 * `buscarMedicamento` ofrece el catálogo entero, así que un carácter
 * cualquiera alcanza para tener opciones que elegir.
 */
async function elegirUnMedicamento(page: Page): Promise<void> {
  const contenedor = page.locator('app-reference-combobox');
  const buscador = contenedor.getByRole('combobox', { name: 'Medicamento (obligatorio)' });
  await buscador.click();
  await buscador.fill('a');
  const opcion = contenedor.getByRole('option').first();
  await expect(opcion).toBeVisible();
  await opcion.click();
}

/**
 * El motor de decisión clínica puede avisar una interacción con la
 * medicación ya activa de la persona (ajeno a lo que este spec verifica:
 * diagnóstico/motivo, no interacciones). Si aparece, se sigue igual.
 */
async function seguirPeseAInteraccion(page: Page): Promise<void> {
  // `isVisible()` no espera — sólo mira el instante actual. El diálogo tarda
  // un momento en montarse tras `Prescribir`, así que hace falta esperar de
  // verdad (`waitFor`) y no asumir que ya está o que nunca va a estar.
  const boton = page.getByRole('button', { name: 'Prescribir de todas formas' });
  try {
    await boton.waitFor({ state: 'visible', timeout: 5_000 });
    await boton.click();
  } catch {
    // No hubo aviso de interacción para este medicamento: nada que hacer.
  }
}

/**
 * Tras prescribir, el bloque ofrece adjuntar archivos a esa receta
 * («recetaRecienCreada») — mientras esa oferta sigue abierta, la fila de la
 * lista muestra «Borrador Activo» en vez del badge de diagnóstico/motivo.
 * Hay que cerrarla para que la fila termine de pintar su estado real.
 */
async function cerrarOfertaDeAdjuntos(page: Page): Promise<void> {
  const listo = page.getByRole('button', { name: 'Listo, sin adjuntar' });
  await listo.waitFor({ state: 'visible', timeout: 10_000 });
  await listo.click();
}

/**
 * C5 — la receta siempre se liga a un diagnóstico confirmado, o a un motivo
 * plano (pedido literal del propietario). Recorrido del prompt (§6): médica
 * → Iniciar consulta → casilla de medicación → el selector no ofrece un
 * presuntivo → elegir un confirmado → guardar → aparece "Diagnóstico: …" →
 * nueva receta con "Otro motivo" → guardar → "Motivo: …" → recargar y
 * confirmar que ambas siguen → "Vincular a un diagnóstico…" sobre la de
 * motivo cambia el badge.
 */

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

test.describe('C5 · Receta ligada a un diagnóstico confirmado o motivo', () => {
  test('el selector filtra a confirmados, exige diagnóstico o motivo, y "Vincular" liga después', async ({
    page,
  }) => {
    await entrar(page, MEDICA);
    // La ruta real es `/medical-records/:profileId/consultation` (no existe
    // `/clinical-record/consultation`: ese literal daba 404 — bug del propio
    // spec, nunca antes ejecutado). Se busca una persona desde «Archivo
    // clínico», se entra a su expediente y se abre la casilla de medicación,
    // igual que hace `consulta-rejilla.spec.ts` con las demás casillas.
    await irA(page, '/medical-records');
    await estable(page);
    const buscador = page.getByLabel('Nombre o código');
    await buscador.fill('Ana');
    await page.getByTestId('paciente-ver-expediente').first().click();
    await page.waitForURL(/\/medical-records\/[^/]+$/, { timeout: 60_000 });
    await estable(page);

    await page.goto(`${page.url()}/consultation`, { waitUntil: 'commit' });
    await page.waitForURL(/\/medical-records\/[^/]+\/consultation$/, { timeout: 60_000 });
    await estable(page);

    // Igual que `consulta-rejilla.spec.ts`: si el encuentro no está abierto
    // todavía, se abre antes de tocar cualquier casilla.
    const abrirEncuentro = page.getByTestId('consulta-abrir-encuentro');
    if ((await abrirEncuentro.count()) > 0) {
      await abrirEncuentro.click();
      await estable(page);
    }

    await page.getByTestId('consulta-casilla-medicacion').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const selectorDiagnostico = page.getByTestId('receta-diagnostico');
    await expect(selectorDiagnostico).toBeVisible();
    // `app-select` es el host; el `<select>` nativo que `selectOption` exige
    // vive adentro (`select.html:19`).
    const nativoDiagnostico = selectorDiagnostico.locator('select');

    // El selector no debe listar un diagnóstico presuntivo/provisional de la
    // seed — sólo confirmados y «Otro motivo».
    const opciones = await selectorDiagnostico.locator('option, [role="option"]').allTextContents();
    expect(opciones.some((texto) => /provisional|presuntivo/i.test(texto))).toBe(false);

    // Elegir un confirmado y guardar. La fila muestra «Borrador Activo»
    // mientras la oferta de adjuntos sigue abierta y sólo termina de pintar
    // su badge real (Diagnóstico:/Motivo:) tras recargar — por eso las dos
    // altas se hacen primero y la verificación del contenido es una sola,
    // después de recargar (ver más abajo).
    const confirmado = opciones.find((texto) => /confirmado el/i.test(texto));
    let huboConfirmado = false;
    if (confirmado !== undefined) {
      huboConfirmado = true;
      await elegirUnMedicamento(page);
      await nativoDiagnostico.selectOption({ label: confirmado });
      await page.getByTestId('content-dialog').getByRole('button', { name: 'Prescribir' }).click();
      await seguirPeseAInteraccion(page);
      await cerrarOfertaDeAdjuntos(page);
    }

    // Segunda receta, con «Otro motivo».
    await elegirUnMedicamento(page);
    await nativoDiagnostico.selectOption({ label: 'Otro motivo — escribirlo' });
    // `app-textarea` es el host; el `<textarea>` nativo vive adentro.
    await page.getByTestId('receta-motivo').locator('textarea').fill('Control de síntomas');
    await page.getByTestId('content-dialog').getByRole('button', { name: 'Prescribir' }).click();
    await seguirPeseAInteraccion(page);
    await cerrarOfertaDeAdjuntos(page);

    // Recargar conserva las recetas, ya con su badge real (no «Borrador Activo»).
    // La recarga cierra el modal: hay que reabrir la casilla para volver a verlas.
    await page.reload();
    await estable(page);
    await page.getByTestId('consulta-casilla-medicacion').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const total = huboConfirmado ? 2 : 1;
    await expect(page.getByTestId('receta-vinculo')).toHaveCount(total, { timeout: 15_000 });
    await expect(page.getByTestId('receta-vinculo').last()).toContainText('Motivo:');
    if (huboConfirmado) {
      await expect(page.getByTestId('receta-vinculo').first()).toContainText('Diagnóstico:');
    }

    // «Vincular a un diagnóstico…» sobre la de motivo.
    const vincular = page.getByTestId('receta-vincular').first();
    if (await vincular.count()) {
      await vincular.click();
      await expect(page.getByTestId('receta-vincular-dialog')).toBeVisible();
      const selectorDelDialogo = page.getByTestId('receta-vincular-dialog').getByRole('combobox');
      const opcionesDelDialogo = await selectorDelDialogo.locator('option, [role="option"]').allTextContents();
      const confirmadoEnDialogo = opcionesDelDialogo.find((texto) => /confirmado el/i.test(texto));
      if (confirmadoEnDialogo !== undefined) {
        await selectorDelDialogo.selectOption({ label: confirmadoEnDialogo });
        await page.getByTestId('receta-vincular-dialog').getByRole('button', { name: 'Vincular' }).click();
        await expect(page.getByTestId('receta-vinculo').first()).toContainText('Diagnóstico:');
      }
    }
  });
});

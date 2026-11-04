import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';
import { elegirOpcion, leerOpciones } from './support/desplegable';
import { abrirExpedienteDelPrimero } from './support/expediente';

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

/** Motivo escrito a mano por este spec; la semilla de la maqueta no lo usa. */
const MOTIVO_LIBRE = 'Control de síntomas C5';

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
    await abrirExpedienteDelPrimero(page);
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
    await estable(page);

    // Línea base: las recetas con vínculo que la maqueta ya trae.
    const vinculosAntes = await page.getByTestId('receta-vinculo').count();
    const diagnosticosAntes = await page
      .getByTestId('receta-vinculo')
      .filter({ hasText: 'Diagnóstico:' })
      .count();

    const selectorDiagnostico = page.getByTestId('receta-diagnostico');
    await expect(selectorDiagnostico).toBeVisible();
    // `app-select` es un botón `combobox`, no un `<select>` nativo: las filas
    // sólo existen con la lista abierta (`support/desplegable.ts`).
    const disparadorDiagnostico = selectorDiagnostico.getByRole('combobox');

    // El selector no debe listar un diagnóstico presuntivo/provisional de la
    // seed — sólo confirmados y «Otro motivo».
    const opciones = await leerOpciones(disparadorDiagnostico);
    expect(opciones.length).toBeGreaterThan(0);
    expect(opciones.some((texto) => /provisional|presuntivo/i.test(texto))).toBe(false);

    // Elegir un confirmado y guardar. La fila muestra «Borrador Activo»
    // mientras la oferta de adjuntos sigue abierta y sólo termina de pintar
    // su badge real (Diagnóstico:/Motivo:) tras recargar — por eso las dos
    // altas se hacen primero y la verificación del contenido es una sola,
    // después de recargar (ver más abajo).
    const confirmado = opciones.find((texto) => /· confirmado\b/i.test(texto));
    // La semilla de la maqueta trae diagnósticos confirmados: que no aparezcan
    // es un fallo, no un motivo para saltarse esa mitad del recorrido.
    expect(confirmado, 'el selector debe ofrecer un diagnóstico confirmado').toBeDefined();
    let huboConfirmado = false;
    if (confirmado !== undefined) {
      huboConfirmado = true;
      await elegirUnMedicamento(page);
      await elegirOpcion(disparadorDiagnostico, confirmado);
      await page.getByTestId('content-dialog').getByRole('button', { name: 'Prescribir' }).click();
      await seguirPeseAInteraccion(page);
      await cerrarOfertaDeAdjuntos(page);
    }

    // Segunda receta, con «Otro motivo».
    await elegirUnMedicamento(page);
    await elegirOpcion(disparadorDiagnostico, 'Otro motivo — escribirlo');
    // `app-textarea` es el host; el `<textarea>` nativo vive adentro.
    await page.getByTestId('receta-motivo').locator('textarea').fill(MOTIVO_LIBRE);
    await page.getByTestId('content-dialog').getByRole('button', { name: 'Prescribir' }).click();
    await seguirPeseAInteraccion(page);
    await cerrarOfertaDeAdjuntos(page);

    // Recargar conserva las recetas, ya con su badge real (no «Borrador Activo»).
    // La recarga cierra el modal: hay que reabrir la casilla para volver a verlas.
    await page.reload();
    await estable(page);
    await page.getByTestId('consulta-casilla-medicacion').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // La maqueta ya siembra recetas con vínculo: se cuenta contra la línea base
    // y lo creado aquí se reconoce por su motivo, que es único de este spec.
    const vinculos = page.getByTestId('receta-vinculo');
    const conDiagnostico = vinculos.filter({ hasText: 'Diagnóstico:' });
    await expect(vinculos).toHaveCount(vinculosAntes + (huboConfirmado ? 2 : 1), { timeout: 15_000 });
    await expect(conDiagnostico).toHaveCount(diagnosticosAntes + (huboConfirmado ? 1 : 0));
    await expect(vinculos.filter({ hasText: `Motivo: ${MOTIVO_LIBRE}` })).toHaveCount(1);

    // «Vincular a un diagnóstico…» sobre la receta de motivo que creó este spec.
    const filaDelMotivo = page.locator('.receta__item').filter({ hasText: `Motivo: ${MOTIVO_LIBRE}` });
    await expect(filaDelMotivo).toHaveCount(1);
    // La opción vive en el menú ⋮ de la receta: se abre el de esta fila.
    await filaDelMotivo.getByRole('button', { name: 'Acciones de la receta' }).click();
    await page.getByTestId('receta-vincular').click();
    // El anfitrión `app-content-dialog` no tiene caja propia: se espera el
    // `<dialog>` por su rol y su título.
    const dialogoVincular = page.getByRole('dialog', { name: 'Vincular a un diagnóstico' });
    await expect(dialogoVincular).toBeVisible();
    const selectorDelDialogo = dialogoVincular.getByRole('combobox');
    const opcionesDelDialogo = await leerOpciones(selectorDelDialogo);
    const confirmadoEnDialogo = opcionesDelDialogo.find((texto) => /· confirmado\b/i.test(texto));
    expect(confirmadoEnDialogo, 'el diálogo debe ofrecer un diagnóstico confirmado').toBeDefined();
    if (confirmadoEnDialogo !== undefined) {
      const diagnosticosAntesDeVincular = await conDiagnostico.count();
      await elegirOpcion(selectorDelDialogo, confirmadoEnDialogo);
      await dialogoVincular.getByRole('button', { name: 'Vincular', exact: true }).click();
      await expect(conDiagnostico).toHaveCount(diagnosticosAntesDeVincular + 1);
      await expect(vinculos.filter({ hasText: `Motivo: ${MOTIVO_LIBRE}` })).toHaveCount(0);
    }
  });
});

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * El generador de formularios, editado como Google Forms.
 *
 * Recorre lo que se pidió y lo que estaba roto: crear una pregunta, pasarla a
 * «Opción múltiple» y escribirle opciones **sin que el editor se resetee**,
 * agregarle «Otro», pasarla a casillas con «exactamente 2», y comprobar que
 * todo eso **sobrevive a salir y volver a entrar** al formulario —la mutación
 * se demuestra `UI → request → store → recarga → UI`, no con un toast— y que
 * la vista previa sirve el «Otro» y valida el tope.
 *
 * Contra la rama `mockup`, con la cuenta de la médica. No espera
 * `networkidle`: contra `ng serve` con HMR no llega nunca.
 */

const SALIDA = join('docs', 'frontend', 'evidence', 'formularios-google-forms');

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(SALIDA, { recursive: true });
  await page.screenshot({ path: join(SALIDA, `${nombre}.png`), fullPage: true });
}

/** La tarjeta del último campo propio: es donde nace la pregunta nueva. */
function ultimaPropia(page: Page) {
  return page.getByTestId('campo-propio').last();
}

/** El desplegable de tipo es un `<select>` nativo dentro de `app-select`. */
async function elegirTipo(page: Page, etiqueta: string): Promise<void> {
  await ultimaPropia(page)
    .getByTestId('editor-campo-tipo')
    .locator('select')
    .selectOption({ label: etiqueta });
}

test.describe('Formularios · edición como Google Forms', () => {
  test('crear una pregunta de opción múltiple con «Otro» y topes, y que sobreviva a releer', async ({
    page,
  }) => {
    test.setTimeout(3 * 60_000);
    await page.setViewportSize({ width: 1440, height: 900 });

    await entrar(page, MEDICA);
    await irA(page, '/form-builder');
    await estable(page);

    // ── La lista y el formulario abierto, centrados y a 76rem ──────────────
    await page.getByTestId('plantilla').first().click();
    await expect(page.getByTestId('aviso-estandar')).toBeVisible();
    await capturar(page, '01-formulario-abierto');

    const antes = await page.getByTestId('campo-propio').count();

    // ── Agregar una pregunta ────────────────────────────────────────────────
    await page.getByTestId('agregar-campo').click();
    await expect(page.getByTestId('campo-propio')).toHaveCount(antes + 1);

    const nombre = ultimaPropia(page).getByTestId('editor-campo-nombre').locator('input');
    await nombre.fill('¿Fuma?');

    // ── Pasarla a «Opción múltiple» y escribir las opciones ────────────────
    // Esto era lo que no se podía: cada tecla guardaba, releía y reseteaba.
    await elegirTipo(page, 'Opción múltiple');
    const opcion0 = ultimaPropia(page).getByTestId('editor-campo-opcion-0').locator('input');
    const opcion1 = ultimaPropia(page).getByTestId('editor-campo-opcion-1').locator('input');
    await expect(opcion0).toBeVisible();

    await opcion0.fill('Nunca');
    await opcion1.fill('Fumador');
    await ultimaPropia(page).getByTestId('editor-campo-agregar-opcion').click();
    const opcion2 = ultimaPropia(page).getByTestId('editor-campo-opcion-2').locator('input');
    await opcion2.fill('Ex fumador');

    // «Otro», con texto libre.
    await ultimaPropia(page).getByTestId('editor-campo-agregar-otro').click();
    await expect(ultimaPropia(page).getByTestId('editor-campo-otro')).toBeVisible();

    // Descripción.
    await ultimaPropia(page).getByTestId('editor-campo-agregar-descripcion').click();
    await ultimaPropia(page)
      .getByTestId('editor-campo-descripcion')
      .locator('textarea')
      .fill('Contá desde el último cigarrillo.');

    // Nada de lo tecleado se perdió mientras se guardaba.
    await expect(nombre).toHaveValue('¿Fuma?');
    await expect(opcion0).toHaveValue('Nunca');
    await expect(opcion1).toHaveValue('Fumador');
    await expect(opcion2).toHaveValue('Ex fumador');
    await capturar(page, '02-opcion-multiple-con-otro');

    // ── Casillas con «exactamente 2» ───────────────────────────────────────
    await elegirTipo(page, 'Casillas de verificación');
    await expect(ultimaPropia(page).getByTestId('editor-campo-validacion')).toBeVisible();
    await ultimaPropia(page)
      .getByTestId('editor-campo-regla')
      .locator('select')
      .selectOption({ label: 'Seleccionar exactamente' });
    const cantidad = ultimaPropia(page).getByTestId('editor-campo-cantidad');
    await cantidad.fill('2');
    await cantidad.blur();
    await expect(ultimaPropia(page).getByText('Hay que marcar exactamente 2 opciones.')).toBeVisible();

    // Obligatorio, con el interruptor.
    await ultimaPropia(page).getByTestId('editor-campo-obligatorio').locator('label').click();
    await capturar(page, '03-casillas-con-tope');

    // Dejar que la pausa de guardado (700 ms) venza y la petición vuelva. El
    // acuse «Guardado» dura dos segundos y no sirve de señal: la captura de
    // arriba puede tardar más que eso.
    await page.waitForTimeout(2_000);
    await expect(ultimaPropia(page).getByText('Guardando…')).toHaveCount(0);

    // ── Salir y volver: lo que se ve tiene que venir del store, no del DOM ──
    await page.getByRole('button', { name: 'Volver a la lista' }).click();
    await page.getByTestId('plantilla').first().click();
    await expect(page.getByTestId('aviso-estandar')).toBeVisible();

    const releida = ultimaPropia(page);
    await expect(releida.getByTestId('editor-campo-nombre').locator('input')).toHaveValue('¿Fuma?');
    await expect(releida.getByTestId('editor-campo-tipo').locator('select')).toHaveValue(
      await releida
        .getByTestId('editor-campo-tipo')
        .locator('option', { hasText: 'Casillas de verificación' })
        .getAttribute('value')
        .then((v) => v ?? ''),
    );
    await expect(releida.getByTestId('editor-campo-opcion-0').locator('input')).toHaveValue('Nunca');
    await expect(releida.getByTestId('editor-campo-opcion-2').locator('input')).toHaveValue('Ex fumador');
    await expect(releida.getByTestId('editor-campo-otro')).toBeVisible();
    await expect(releida.getByTestId('editor-campo-descripcion').locator('textarea')).toHaveValue(
      'Contá desde el último cigarrillo.',
    );
    await expect(releida.getByText('Hay que marcar exactamente 2 opciones.')).toBeVisible();
    await capturar(page, '04-releido-desde-el-store');

    // ── La vista previa: «Otro» y el tope, servidos por el motor ───────────
    await page.getByTestId('ver-previa').click();
    const previa = page.getByTestId('vista-previa');
    await expect(previa).toBeVisible();

    // La pregunta nueva está en la última página: avanzar hasta verla.
    for (let i = 0; i < 6; i += 1) {
      if (await previa.getByTestId('checkbox-group-otro').count()) break;
      // Las páginas anteriores tienen obligatorios del estándar: se completan
      // con lo mínimo para poder pasar.
      for (const numero of await previa.locator('input[type="number"]').all()) {
        await numero.fill('1');
      }
      await previa.getByTestId('paginated-form-continuar').click();
    }
    await expect(previa.getByTestId('checkbox-group-otro')).toBeVisible();
    await expect(previa.getByText('Contá desde el último cigarrillo.')).toBeVisible();

    // Marcar tres donde se pedían dos lo dice acá, no cuando el paciente lo vea.
    // El grupo de la pregunta nueva, no el de «Factores de riesgo» del
    // estándar, que está en la misma página: es el que tiene «Otro».
    const grupo = previa.locator('app-checkbox-group', {
      has: page.getByTestId('checkbox-group-otro'),
    });
    const casillas = grupo.locator('app-checkbox label');
    await casillas.nth(0).click();
    await casillas.nth(1).click();
    await casillas.nth(2).click();
    await expect(previa.getByText('Marcá exactamente 2 opciones.')).toBeVisible();

    // «Otro» con texto libre cuenta como una respuesta más: con «Nunca» sola
    // falta una; con «Nunca» y «Pipa» son las dos que se pedían.
    await casillas.nth(2).click();
    await casillas.nth(1).click();
    await expect(previa.getByText('Marcá exactamente 2 opciones.')).toBeVisible();
    await previa.getByTestId('checkbox-group-otro-texto').fill('Pipa');
    await expect(previa.getByText('Marcá exactamente 2 opciones.')).toHaveCount(0);
    await capturar(page, '05-vista-previa-con-otro-y-tope');

    // ── Limpiar: quitar la pregunta que se creó ────────────────────────────
    await page.getByTestId('ver-previa').click();
    await ultimaPropia(page).getByTestId('editor-campo-borrar').click();
    await expect(page.getByTestId('campo-propio')).toHaveCount(antes);
  });
});

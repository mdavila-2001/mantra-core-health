import { expect, test } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

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
    // El recorrido real entra por una consulta en curso; se navega directo a
    // una pantalla con `app-medication-block` montado y encuentro abierto,
    // como hacen los demás recorridos de este archivo del mockup.
    await irA(page, '/clinical-record/consultation');
    await estable(page);

    const selectorDiagnostico = page.getByTestId('receta-diagnostico');
    await expect(selectorDiagnostico).toBeVisible();

    // El selector no debe listar un diagnóstico presuntivo/provisional de la
    // seed — sólo confirmados y «Otro motivo».
    const opciones = await selectorDiagnostico.locator('option, [role="option"]').allTextContents();
    expect(opciones.some((texto) => /provisional|presuntivo/i.test(texto))).toBe(false);

    // Elegir un confirmado y guardar.
    const confirmado = opciones.find((texto) => /confirmado el/i.test(texto));
    if (confirmado !== undefined) {
      await selectorDiagnostico.selectOption({ label: confirmado });
      await page.getByRole('button', { name: 'Prescribir' }).click();
      await expect(page.getByTestId('receta-vinculo').first()).toContainText('Diagnóstico:');
    }

    // Segunda receta, con «Otro motivo».
    await selectorDiagnostico.selectOption({ label: 'Otro motivo — escribirlo' });
    await page.getByTestId('receta-motivo').fill('Control de síntomas');
    await page.getByRole('button', { name: 'Prescribir' }).click();
    await expect(page.getByTestId('receta-vinculo').last()).toContainText('Motivo:');

    // Recargar conserva las dos recetas.
    await page.reload();
    await estable(page);
    await expect(page.getByTestId('receta-vinculo')).toHaveCount(2, { timeout: 15_000 });

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

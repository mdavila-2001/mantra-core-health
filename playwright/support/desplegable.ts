import { expect, type Locator } from '@playwright/test';

/**
 * `app-select` no dibuja un `<select>` nativo: es un botón `role="combobox"`
 * que abre un `<dialog class="select-dialog">` con las filas (`select.html`).
 * `selectOption` no sirve ahí, y las opciones sólo existen en el DOM mientras
 * la lista está abierta.
 */
function listaAbierta(disparador: Locator): Locator {
  return disparador.page().locator('dialog.select-dialog[open]');
}

/** Elige una fila por su texto: abre la lista, la pulsa y espera a que cierre. */
export async function elegirOpcion(disparador: Locator, nombre: string | RegExp): Promise<void> {
  await disparador.click();
  const lista = listaAbierta(disparador);
  await expect(lista).toBeVisible();
  await lista.getByRole('option', { name: nombre }).first().click();
  await expect(lista).toHaveCount(0);
}

/** Lee los textos de las filas sin elegir ninguna: abre, lee y cierra con Escape. */
export async function leerOpciones(disparador: Locator): Promise<string[]> {
  await disparador.click();
  const lista = listaAbierta(disparador);
  await expect(lista).toBeVisible();
  const textos = (await lista.getByRole('option').allTextContents()).map((t) => t.trim());
  await disparador.page().keyboard.press('Escape');
  await expect(lista).toHaveCount(0);
  return textos;
}

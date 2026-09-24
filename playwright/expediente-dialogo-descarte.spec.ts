import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * La política de descarte del alta del expediente (H3 de la línea D,
 * 2026-09-21): abrir el alta de un bloque, escribir algo, y cerrar por los
 * tres caminos —botón, `Escape`, fondo— tiene que preguntar antes de perder
 * lo escrito, y el foco tiene que volver a quien abrió el modal.
 *
 * Lo que sólo un navegador puede afirmar acá:
 *
 * 1. El diálogo es `role="dialog"` con el título como nombre accesible.
 * 2. El primer `Tab` cae en el botón de cerrar (foco inicial adentro).
 * 3. `Escape` sin nada escrito cierra directo y el foco vuelve al abridor.
 * 4. Con algo escrito, los tres caminos preguntan y «Seguir escribiendo»
 *    conserva el valor.
 * 5. Confirmar el descarte cierra el modal.
 * 6. El detalle de lectura nunca pregunta.
 * 7. Con `prefers-reduced-motion: reduce`, el modal igual abre.
 */

const SALIDA = join('docs', 'frontend', 'evidence', 'expediente-dialogo-descarte');

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

async function abrirExpedienteDeAna(page: Page): Promise<void> {
  await entrar(page, MEDICA);
  await irA(page, '/medical-records');
  await estable(page);

  // Etiqueta verificada en runtime el 2026-09-22: "Nombre o código", no
  // "Buscar por nombre o código" (el texto del campo de búsqueda cambió desde
  // que se escribió playwright/consulta-rejilla.spec.ts, que quedó con el
  // texto viejo — deriva ajena a este carril, no se toca ese archivo).
  const buscador = page.getByRole('textbox', { name: 'Nombre o código' });
  await buscador.fill('Ana');
  await buscador.press('Enter');
  // Etiqueta verificada en runtime el 2026-09-22: "Ver el expediente de
  // <nombre completo>", no "Ver expediente" a secas.
  await page.getByRole('link', { name: /^Ver el expediente de/ }).first().click();
  await page.waitForURL(/\/medical-records\/[^/]+$/, { timeout: 60_000 });
  await estable(page);
}

test.describe('Expediente · política de descarte del alta', () => {
  test('el alta de Documentos pregunta antes de descartar lo escrito, por los tres caminos', async ({
    page,
  }) => {
    test.setTimeout(5 * 60_000);
    mkdirSync(SALIDA, { recursive: true });

    await abrirExpedienteDeAna(page);

    // El expediente abre en la primera pestaña con filas (no necesariamente
    // «Documentos»); la etiqueta lleva el conteo, «Documentos (N)».
    await page.getByRole('tab', { name: /^Documentos/ }).click();
    await estable(page);

    const abrirDocumentos = page.getByTestId('expediente-nuevo-documento');
    await expect(abrirDocumentos).toBeVisible();

    /* ---- 1 y 2. rol, nombre accesible y foco inicial ---------------------- */

    await abrirDocumentos.focus();
    await abrirDocumentos.press('Enter');

    // `app-content-dialog` es el host del `<dialog>` real: el host puede no
    // tener caja propia (Playwright lo marca "hidden" aunque su hijo esté
    // visible en pantalla), así que la aserción de visibilidad va sobre el
    // `<dialog>` con rol accesible; `expediente-alta` sirve para localizarlo
    // y para gestos que necesitan el elemento (clic en el fondo).
    const modal = page.getByTestId('expediente-alta');
    await expect(modal).toHaveAttribute('data-testid', 'expediente-alta');
    await expect(page.getByRole('dialog', { name: 'Registrar un documento' })).toBeVisible();

    const botonCerrar = page.getByTestId('content-dialog-close');
    await expect(botonCerrar).toBeFocused();

    await page.screenshot({ path: join(SALIDA, 'alta-documentos-1440-light.png') });

    /* ---- 3. Escape sin nada escrito cierra directo y devuelve el foco ----- */

    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    await expect(abrirDocumentos).toBeFocused();

    /* ---- 4. con algo escrito, Escape pregunta ------------------------------ */

    await abrirDocumentos.click();
    await expect(page.getByRole('dialog', { name: 'Registrar un documento' })).toBeVisible();

    const titulo = page.getByTestId('documento-titulo');
    await titulo.fill('Laboratorio completo');

    await page.keyboard.press('Escape');
    const pregunta = page.getByRole('dialog', { name: '¿Descartar lo escrito?' });
    await expect(pregunta).toBeVisible();
    await page.screenshot({ path: join(SALIDA, 'descarte-pregunta-1440-light.png') });

    const dialogoDelAlta = page.getByRole('dialog', { name: 'Registrar un documento' });

    // Cancelar conserva el valor y el alta sigue abierta.
    await page.getByTestId('dialogo-cancelar').click();
    await expect(pregunta).toHaveCount(0);
    await expect(dialogoDelAlta).toBeVisible();
    await expect(titulo).toHaveValue('Laboratorio completo');

    /* ---- el fondo pregunta igual ------------------------------------------- */

    await page.getByTestId('content-dialog').click({ position: { x: 5, y: 5 } });
    await expect(pregunta).toBeVisible();
    await page.getByTestId('dialogo-cancelar').click();
    await expect(dialogoDelAlta).toBeVisible();

    /* ---- el botón de cerrar pregunta igual --------------------------------- */

    await botonCerrar.click();
    await expect(pregunta).toBeVisible();

    /* ---- 5. confirmar el descarte cierra y devuelve el foco ---------------- */

    await page.getByTestId('dialogo-confirmar').click();
    await expect(pregunta).toHaveCount(0);
    await expect(modal).toHaveCount(0);
    await expect(abrirDocumentos).toBeFocused();
  });

  test('el detalle de lectura nunca pregunta', async ({ page }) => {
    test.setTimeout(5 * 60_000);
    await abrirExpedienteDeAna(page);

    const verDetalle = page.getByTestId('expediente-ver-detalle').first();
    if ((await verDetalle.count()) === 0) {
      test.skip(true, 'No hay filas con detalle disponibles en el paciente de prueba');
      return;
    }
    await verDetalle.click();

    const detalle = page.getByTestId('expediente-detalle');
    await expect(detalle).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(detalle).toHaveCount(0);
    // Sin pregunta de descarte: no hubo cambios pendientes que perder.
    await expect(page.getByRole('dialog', { name: '¿Descartar lo escrito?' })).toHaveCount(0);
  });

  test('con movimiento reducido, el alta igual abre', async ({ page }) => {
    test.setTimeout(5 * 60_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await abrirExpedienteDeAna(page);

    await page.getByRole('tab', { name: /^Documentos/ }).click();
    await estable(page);
    await page.getByTestId('expediente-nuevo-documento').click();
    await expect(page.getByRole('dialog', { name: 'Registrar un documento' })).toBeVisible();
  });

  test('el alta se ve correctamente en móvil, claro y oscuro', async ({ page }) => {
    test.setTimeout(5 * 60_000);
    mkdirSync(SALIDA, { recursive: true });

    await abrirExpedienteDeAna(page);
    await page.getByRole('tab', { name: /^Documentos/ }).click();
    await estable(page);
    await page.getByTestId('expediente-nuevo-documento').click();
    await expect(page.getByRole('dialog', { name: 'Registrar un documento' })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await estable(page);
    await page.screenshot({ path: join(SALIDA, 'alta-documentos-390-light.png') });

    await page.emulateMedia({ colorScheme: 'dark' });
    await estable(page);
    await page.screenshot({ path: join(SALIDA, 'alta-documentos-390-dark.png') });
  });
});

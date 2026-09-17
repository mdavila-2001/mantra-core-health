import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * B.3 — el botón «Descargar receta oficial (PDF)» del portal paciente, contra
 * el backend simulado (rama `mockup`, `mockBackend: true`).
 *
 * ## Qué prueba esto y qué prueba el int-spec de la API
 *
 * Acá se comprueba lo que sólo existe en el navegador: que el botón aparece,
 * que no desborda en móvil ni en escritorio, y que al tocarlo el navegador
 * recibe un archivo de verdad (`page.waitForEvent('download')`). El
 * contenido oficial —matrícula, sello, marca de agua según estado— lo
 * verifica `clinical-prescriptions-pdf.int-spec.ts` contra la API real.
 *
 * `networkidle` no se usa: con HMR el bundler deja conexiones abiertas.
 */

const PACIENTE: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'mock',
  nombre: 'Paciente',
};

const EVIDENCIA = join('docs', 'frontend', 'evidence', 'b3-receta-pdf');

const VIEWPORTS = [
  { nombre: '390x844-movil', width: 390, height: 844 },
  { nombre: '1440x900-escritorio', width: 1440, height: 900 },
] as const;

/** El ruido de CSP que `ng serve` inyecta en cualquier ruta (recarga en vivo). */
const esRuidoDelServidorDeDesarrollo = (error: string): boolean =>
  error.includes('Content Security Policy') && error.includes('inline script');

test('el botón de la receta oficial descarga un PDF real, en dos anchos, sin errores propios', async ({
  browser,
}) => {
  mkdirSync(EVIDENCIA, { recursive: true });

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    const erroresDeConsola: string[] = [];
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error') erroresDeConsola.push(mensaje.text());
    });
    page.on('pageerror', (error) => erroresDeConsola.push(String(error)));

    await entrar(page, PACIENTE);
    await irA(page, '/my-account/medical-record?seccion=recetas');
    await estable(page);

    const boton = page.getByTestId('historia-descargar-receta').first();
    await expect(boton).toBeVisible({ timeout: 30_000 });

    // Sin desborde horizontal en el ancho que sea.
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(desborde, `desborde horizontal en ${viewport.nombre}`).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: join(EVIDENCIA, `recetas-${viewport.nombre}.png`),
      fullPage: true,
    });

    const descarga = await Promise.all([page.waitForEvent('download'), boton.click()]).then(
      ([evento]) => evento,
    );
    await descarga.saveAs(join(EVIDENCIA, `receta-descargada-${viewport.nombre}.pdf`));
    expect(descarga.suggestedFilename()).toMatch(/^receta-.+\.pdf$/);

    await expect(page.getByText('Descarga iniciada exitosamente')).toBeVisible();

    const propios = erroresDeConsola.filter((error) => !esRuidoDelServidorDeDesarrollo(error));
    expect(propios, `errores de consola en ${viewport.nombre}`).toEqual([]);

    await context.close();
  }
});

test('sin conexión, el botón avisa el error y vuelve a estar disponible', async ({ page }) => {
  await entrar(page, PACIENTE);
  await irA(page, '/my-account/medical-record?seccion=recetas');
  await estable(page);

  const boton = page.getByTestId('historia-descargar-receta').first();
  await expect(boton).toBeVisible({ timeout: 30_000 });

  // Se corta la ruta del PDF puntualmente: el resto del backend simulado
  // sigue respondiendo, así que la pantalla no se cae entera por esto.
  await page.route('**/clinical/prescriptions/**/pdf', (route) => route.abort('failed'));

  await boton.click();
  await expect(page.getByText('No pudimos descargar la receta oficial')).toBeVisible({
    timeout: 15_000,
  });
  // El botón no queda trabado en «cargando».
  await expect(boton).toBeEnabled();
});

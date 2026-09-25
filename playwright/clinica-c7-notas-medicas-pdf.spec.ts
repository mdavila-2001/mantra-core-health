import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Evidencia de navegador del botón «Exportar a PDF» de Notas médicas.
 *
 * ## Por qué hace falta esta prueba y no alcanza con las unitarias
 *
 * Las unitarias fijan **qué dice** el documento y **cómo** lo maqueta el motor,
 * pero las dos corren sin navegador. Que el botón aparezca en la cabecera, que
 * sólo aparezca cuando hay algo que imprimir, que no rompa la fila de acciones
 * en un móvil de 390 px y que al pulsarlo salga un archivo de verdad son cuatro
 * hechos que sólo se comprueban acá.
 *
 * ## Contra qué corre
 *
 * Contra la rama `mockup` servida por `ng serve`, sin API: las cuentas
 * `*@alovida.mock` las resuelve el interceptor del propio front.
 *
 * `networkidle` no se usa nunca: con HMR el bundler deja conexiones abiertas y
 * ese estado no llega jamás — produce esperas agotadas que se leen como fallos
 * del producto. Se espera un selector concreto.
 */

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

const EVIDENCIA = join('docs', 'frontend', 'evidence', 'pdf-premium');

/** Los cinco tamaños que exige el gate visual del repo. */
const VIEWPORTS = [
  { nombre: '390x844-movil', width: 390, height: 844 },
  { nombre: '768x1024-tablet-vertical', width: 768, height: 1024 },
  { nombre: '1024x768-tablet-horizontal', width: 1024, height: 768 },
  { nombre: '1440x900-escritorio', width: 1440, height: 900 },
  { nombre: '1920x1080-escritorio-grande', width: 1920, height: 1080 },
] as const;

test('Notas médicas: el botón de PDF se ve, no desborda y descarga un archivo', async ({ page }) => {
  mkdirSync(EVIDENCIA, { recursive: true });

  const erroresDeConsola: string[] = [];
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') {
      erroresDeConsola.push(mensaje.text());
    }
  });
  page.on('pageerror', (error) => erroresDeConsola.push(String(error)));

  await entrar(page, MEDICA);
  await irA(page, '/progress-notes');
  await estable(page);

  // La cabecera de la pantalla es la señal de que la ruta pintó; el botón llega
  // después, cuando la lectura termina.
  await expect(page.getByRole('heading', { name: 'Notas médicas' })).toBeVisible();

  const boton = page.getByRole('button', { name: 'Exportar a PDF' });
  await expect(boton).toBeVisible({ timeout: 30_000 });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expect(boton).toBeVisible();

    // Sin desborde horizontal: el documento no puede ser más ancho que la
    // ventana. Es el defecto que un botón nuevo en una fila de acciones
    // introduce más seguido.
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(desborde, `desborde horizontal en ${viewport.nombre}`).toBeLessThanOrEqual(1);

    // El botón entero dentro de la ventana, no recortado por el borde.
    const caja = await boton.boundingBox();
    expect(caja, `sin caja en ${viewport.nombre}`).not.toBeNull();
    expect(caja!.x, `botón recortado por la izquierda en ${viewport.nombre}`).toBeGreaterThanOrEqual(
      0,
    );
    expect(
      caja!.x + caja!.width,
      `botón recortado por la derecha en ${viewport.nombre}`,
    ).toBeLessThanOrEqual(viewport.width + 1);

    await page.screenshot({
      path: join(EVIDENCIA, `notas-medicas-${viewport.nombre}.png`),
      fullPage: true,
    });

    // La captura de página entera prueba que no hay desborde, pero a 390 px de
    // ancho y once mil de alto no deja **ver** si el botón aprieta el título.
    // El recorte de la cabecera es donde se juzga el acabado.
    await page.screenshot({
      path: join(EVIDENCIA, `cabecera-${viewport.nombre}.png`),
      clip: { x: 0, y: 0, width: viewport.width, height: Math.min(340, viewport.height) },
    });
  }

  // La descarga de verdad: el PDF sale del navegador y se guarda. Un botón que
  // no dispara nada se lee como «la aplicación está rota».
  await page.setViewportSize({ width: 1440, height: 900 });
  const descarga = await Promise.all([page.waitForEvent('download'), boton.click()]).then(
    ([evento]) => evento,
  );
  const destino = join(EVIDENCIA, 'notas-medicas-descargado.pdf');
  await descarga.saveAs(destino);
  // El nombre de archivo lo arma `progress-notes-pdf.ts` (`evoluciones-<fecha>.pdf`),
  // un archivo ajeno a este carril (no está en `ARCHIVOS RESERVADOS`) — se deja tal
  // cual, no se inventa un rename que el propio descargador no hace. Ver
  // `PLAN.md` §"Ajenos, anotados" y `evidencia/inventario.md`.
  expect(descarga.suggestedFilename()).toMatch(/^evoluciones-\d{4}-\d{2}-\d{2}\.pdf$/);

  // El servidor de desarrollo inyecta sus propios scripts en línea (recarga en
  // vivo) y la política de seguridad de la aplicación —`src/server/
  // security-headers.ts`, que lista hashes— los rechaza. Es ruido de `ng serve`,
  // aparece en cualquier ruta y no lo produce esta pantalla. Se anota entero en
  // la evidencia y se descarta sólo para la aserción, con el motivo escrito: un
  // filtro que se tragara cualquier error dejaría pasar el que sí importa.
  const esRuidoDelServidorDeDesarrollo = (error: string): boolean =>
    error.includes('Content Security Policy') && error.includes('inline script');
  const propios = erroresDeConsola.filter((error) => !esRuidoDelServidorDeDesarrollo(error));

  writeFileSync(
    join(EVIDENCIA, 'consola.txt'),
    [
      `errores totales: ${erroresDeConsola.length}`,
      `ruido de CSP del servidor de desarrollo: ${erroresDeConsola.length - propios.length}`,
      `atribuibles a la pantalla: ${propios.length}`,
      '',
      ...erroresDeConsola,
      '',
    ].join('\n'),
    'utf8',
  );
  expect(propios, 'errores de consola atribuibles a Notas médicas').toEqual([]);
});

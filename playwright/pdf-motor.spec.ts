import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * El motor de PDF, de punta a punta contra la maqueta (`mockup`): tres papeles
 * descargados por el navegador, guardados como evidencia y comprobados por
 * lo que un PDF deja comprobar sin abrirlo.
 *
 * 1. **Balance de sumas y saldos** (export de pantalla, médica): antes salía
 *    con un solo renglón —«Exportar a PDF»— porque el botón apuntaba al
 *    encabezado y no a la tabla.
 * 2. **Receta oficial** (paciente): antes era una hoja en blanco con el id.
 * 3. **Historia completa** (paciente): un documento largo con tablas y pie.
 *
 * Deja los tres PDF en `docs/trabajo/2026-10-02-motor-pdf/evidencia/`; la
 * revisión visual (regla 35, dos pasadas) se hace sobre esos archivos.
 */

const EVIDENCIA = join('docs', 'trabajo', '2026-10-02-motor-pdf', 'evidencia');

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Dra. Valeria Rojas Mendoza',
};

const PACIENTE: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'mock',
  nombre: 'Paciente',
};

/** El ruido de CSP que `ng serve` inyecta en cualquier ruta (recarga en vivo). */
const esRuidoDelServidorDeDesarrollo = (error: string): boolean =>
  error.includes('Content Security Policy') && error.includes('inline script');

test.beforeAll(() => {
  mkdirSync(EVIDENCIA, { recursive: true });
});

function vigilarConsola(page: Page): string[] {
  const errores: string[] = [];
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error' && !esRuidoDelServidorDeDesarrollo(mensaje.text())) {
      errores.push(mensaje.text());
    }
  });
  page.on('pageerror', (error) => errores.push(String(error)));
  return errores;
}

/** Baja el archivo que dispara `accion` y lo guarda en la evidencia. */
async function descargar(page: Page, accion: () => Promise<void>, nombre: string): Promise<string> {
  const destino = join(EVIDENCIA, nombre);
  const [descarga] = await Promise.all([page.waitForEvent('download'), accion()]);
  await descarga.saveAs(destino);
  return destino;
}

/**
 * Lo que un PDF deja comprobar sin renderizarlo: que es un PDF, que pesa lo
 * que pesa un papel con fuentes embebidas, y que embebe las dos de marca
 * (`/Poppins` y `/Inter` aparecen en el diccionario de fuentes).
 *
 * El peso es un piso, no una medida: `jsPDF` recorta cada fuente a los glifos
 * usados, así que una receta de una hoja pesa ~150 KB y un balance ~500 KB.
 * Lo que importa es que ninguno se parezca al stub de antes (< 1 KB) ni a un
 * papel en Helvetica sin fuentes (~10 KB).
 */
const PESO_MINIMO_CON_FUENTES = 50_000;

function comprobarPapel(ruta: string, minimoDeBytes = PESO_MINIMO_CON_FUENTES): void {
  const bytes = readFileSync(ruta);
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(bytes.byteLength).toBeGreaterThan(minimoDeBytes);
  const texto = bytes.toString('latin1');
  expect(texto).toContain('/Poppins');
  expect(texto).toContain('/Inter');
}

test('el balance contable exportado trae la tabla y no el rótulo del botón', async ({ page }) => {
  const errores = vigilarConsola(page);

  await entrar(page, MEDICA);
  // Los libros viven en la pestaña «Registros»; «Resumen» no tiene el botón.
  await irA(page, '/administration/accounting/libros');
  await estable(page);
  await page.getByRole('button', { name: 'Ver los libros contables de la práctica' }).click();

  const raiz = page.locator('[data-pdf-root]').first();
  await expect(raiz.getByRole('heading', { name: 'Balance de sumas y saldos' })).toBeVisible();
  // La tabla está **dentro** de la raíz exportable: es lo que faltaba.
  await expect(raiz.getByRole('table')).toBeVisible({ timeout: 30_000 });
  await expect(raiz.getByRole('row')).not.toHaveCount(1);

  const ruta = await descargar(
    page,
    () => raiz.getByRole('button', { name: 'Exportar a PDF' }).click(),
    'balance-de-sumas-y-saldos.pdf',
  );
  comprobarPapel(ruta);
  await page.screenshot({ path: join(EVIDENCIA, 'contabilidad-libros-1440.png'), fullPage: false });

  expect(errores).toEqual([]);
});

test('la receta oficial de la maqueta es un documento de receta, no una hoja con un id', async ({ page }) => {
  const errores = vigilarConsola(page);

  await entrar(page, PACIENTE);
  await irA(page, '/my-account/medical-record?seccion=recetas');
  await estable(page);

  const boton = page.getByTestId('historia-descargar-receta').first();
  await expect(boton).toBeVisible({ timeout: 30_000 });

  const ruta = await descargar(page, () => boton.click(), 'receta-oficial-mock.pdf');
  comprobarPapel(ruta);

  expect(errores).toEqual([]);
});

test('la historia completa del paciente sale con las fuentes de marca', async ({ page }) => {
  const errores = vigilarConsola(page);

  await entrar(page, PACIENTE);
  await irA(page, '/my-account/medical-record');
  await estable(page);

  const boton = page.getByTestId('historia-descargar-todo');
  await expect(boton).toBeVisible({ timeout: 30_000 });

  const ruta = await descargar(page, () => boton.click(), 'historia-completa.pdf');
  comprobarPapel(ruta);

  expect(errores).toEqual([]);
});

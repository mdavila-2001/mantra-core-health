import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { logging, type WebDriver } from 'selenium-webdriver';

import { configuracion } from '../config/environment';

/**
 * Evidencias de un fallo.
 *
 * Un fallo de E2E que solo dice «no apareció el elemento» obliga a reproducirlo
 * a mano, y en CI eso a veces no se puede. Lo que se guarda acá es lo que hace
 * falta para entenderlo **sin volver a correrlo**: qué se veía, en qué
 * dirección, qué decía la consola del navegador y cómo estaba el DOM.
 *
 * Todo va bajo `artifacts/selenium/<corrida>/`, que está en `.gitignore`.
 */

export interface Evidencia {
  readonly captura: string | null;
  readonly html: string | null;
  readonly consola: string | null;
  readonly detalle: string;
  readonly url: string;
}

/** Nombre de archivo seguro y legible a partir del nombre de la prueba. */
export function nombreSeguro(texto: string): string {
  const limpio = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return limpio.slice(0, 120) || 'prueba';
}

function carpeta(sub: string): string {
  const config = configuracion();
  const ruta = resolve(process.cwd(), config.artefactos, config.runId, sub);
  mkdirSync(ruta, { recursive: true });
  return ruta;
}

/** Ruta relativa al repositorio: es la que se escribe en el reporte. */
function relativa(absoluta: string): string {
  return absoluta.startsWith(process.cwd())
    ? absoluta.slice(process.cwd().length + 1)
    : absoluta;
}

async function capturarPantalla(driver: WebDriver, base: string): Promise<string | null> {
  try {
    const png = await driver.takeScreenshot();
    const destino = join(carpeta('capturas'), `${base}.png`);
    writeFileSync(destino, png, 'base64');
    return relativa(destino);
  } catch {
    return null;
  }
}

async function capturarHtml(driver: WebDriver, base: string): Promise<string | null> {
  try {
    const html = await driver.getPageSource();
    const destino = join(carpeta('html'), `${base}.html`);
    writeFileSync(destino, html, 'utf8');
    return relativa(destino);
  } catch {
    return null;
  }
}

async function capturarConsola(driver: WebDriver, base: string): Promise<string | null> {
  try {
    const entradas = await driver.manage().logs().get(logging.Type.BROWSER);
    if (entradas.length === 0) {
      return null;
    }
    const texto = entradas
      .map((e) => `[${new Date(e.timestamp).toISOString()}] ${e.level.name}: ${e.message}`)
      .join('\n');
    const destino = join(carpeta('consola'), `${base}.log`);
    writeFileSync(destino, texto, 'utf8');
    return relativa(destino);
  } catch {
    // Los registros del navegador no están disponibles en todos los drivers.
    // No tenerlos no puede impedir guardar la captura, que es lo importante.
    return null;
  }
}

/**
 * Reúne toda la evidencia de una prueba que falló.
 *
 * Nada de lo de acá puede lanzar: se ejecuta **después** de que la prueba ya
 * falló, y un error recolectando evidencia taparía el error de verdad con uno
 * que no le importa a nadie.
 */
export async function recolectarEvidencia(
  driver: WebDriver,
  nombrePrueba: string,
  error: unknown,
): Promise<Evidencia> {
  const base = `${nombreSeguro(nombrePrueba)}-${Date.now()}`;
  const url = await driver.getCurrentUrl().catch(() => '(sin URL)');

  const [captura, html, consola] = await Promise.all([
    configuracion().capturarEnFallo ? capturarPantalla(driver, base) : Promise.resolve(null),
    capturarHtml(driver, base),
    capturarConsola(driver, base),
  ]);

  const detalle = [
    `Prueba:  ${nombrePrueba}`,
    `Fecha:   ${new Date().toISOString()}`,
    `URL:     ${url}`,
    `Error:   ${error instanceof Error ? error.message : String(error)}`,
    error instanceof Error && error.stack !== undefined ? `\n${error.stack}` : '',
    captura === null ? '' : `Captura: ${captura}`,
    html === null ? '' : `HTML:    ${html}`,
    consola === null ? '' : `Consola: ${consola}`,
  ]
    .filter((linea) => linea !== '')
    .join('\n');

  const destino = join(carpeta('fallos'), `${base}.txt`);
  writeFileSync(destino, detalle, 'utf8');

  return { captura, html, consola, detalle, url };
}

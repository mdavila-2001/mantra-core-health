import { appendFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import type { Page } from '@playwright/test';

/**
 * Recolección de evidencia visual del recorrido.
 *
 * A diferencia de `e2e/selenium/core/evidence.ts` —que junta evidencia **de un
 * fallo**, y por eso solo corre cuando algo se rompió— esto captura el camino
 * feliz: la prueba pasa y aun así deja una imagen de cada pantalla y de cada
 * estado al que se llegó apretando algo.
 *
 * Lo que se busca no es detectar regresiones (para eso está `toHaveScreenshot`,
 * que compara contra una base) sino **poder mirar la aplicación entera sin
 * levantarla**: para una revisión de diseño, para un acta de avance, o para
 * responder «¿cómo se ve la pantalla X después de tocar Y?» sin pedirle a nadie
 * que lo reproduzca.
 *
 * Todo cae en `artifacts/recorrido/`, que está en `.gitignore`: son cientos de
 * PNG y no tienen por qué vivir en la historia del repositorio.
 */

/**
 * Raíz de las evidencias. Relativa al repositorio, no al archivo de prueba.
 *
 * La carpeta se puede mover con `EVIDENCIAS_DIR` porque hay **dos** corridas que
 * usan este mismo mecanismo y no deben pisarse: el recorrido visual —con la red
 * simulada, para mirar cómo se ve cada pantalla— y el recorrido con usuarios
 * reales contra la API viva. Escribir los dos en el mismo directorio dejaría un
 * reporte donde no se sabe cuál captura salió de datos inventados.
 */
export const RAIZ = resolve(
  process.cwd(),
  'artifacts',
  process.env['EVIDENCIAS_DIR'] ?? 'recorrido',
);

/** El manifiesto que después lee el generador del reporte. */
const MANIFIESTO = join(RAIZ, 'manifiesto.jsonl');

/** Una captura, tal como se anota en el manifiesto. */
export interface Anotacion {
  /** Pantalla a la que pertenece, ya en forma de carpeta. */
  readonly pantalla: string;
  /** Rótulo legible de la pantalla, para el reporte. */
  readonly titulo: string;
  /** Ruta de la aplicación en el momento de la captura. */
  readonly url: string;
  /** Qué se hizo para llegar a este estado. */
  readonly accion: string;
  /** Ruta del PNG, relativa al repositorio. */
  readonly archivo: string;
  /** Orden dentro de la pantalla. */
  readonly orden: number;
}

/**
 * Vacía las evidencias de la corrida anterior.
 *
 * Sin esto, una pantalla que dejó de existir seguiría apareciendo en el reporte
 * con la captura de la corrida pasada, y nadie lo notaría: el reporte se arma
 * leyendo el directorio, no comparando contra nada.
 */
export function limpiarEvidencias(): void {
  rmSync(RAIZ, { recursive: true, force: true });
  mkdirSync(RAIZ, { recursive: true });
}

/** Nombre de archivo seguro y legible: sin acentos, sin espacios, en minúscula. */
export function nombreSeguro(texto: string): string {
  const limpio = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return limpio.slice(0, 80) || 'estado';
}

/** Ruta relativa al repositorio: es la que se escribe en el manifiesto. */
function relativa(absoluta: string): string {
  return absoluta.startsWith(process.cwd()) ? absoluta.slice(process.cwd().length + 1) : absoluta;
}

/**
 * Apaga animaciones, transiciones y el cursor que parpadea.
 *
 * Dos capturas del mismo estado tomadas con medio segundo de diferencia salen
 * distintas si algo se está moviendo, y un reporte donde la misma pantalla se
 * ve diferente en cada corrida no sirve para comparar nada.
 *
 * `caret-color: transparent` es el detalle que se olvida: el cursor de texto
 * parpadeante aparece en aproximadamente la mitad de las capturas de un campo
 * enfocado, y nunca en la otra mitad.
 */
export async function congelar(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
      * { caret-color: transparent !important; }
    `,
  });
}

/**
 * Lleva la cuenta del orden de captura dentro de cada pantalla.
 *
 * Es estado de módulo a propósito: el recorrido corre con un solo worker
 * —lo fija `playwright.recorrido.config.ts`— así que no hay dos pantallas
 * capturando a la vez, y pasar el contador por parámetro obligaría a que cada
 * prueba lo hilvane por todos lados sin ganar nada.
 */
const contadores = new Map<string, number>();

/**
 * Captura la pantalla completa y la anota en el manifiesto.
 *
 * Devuelve la ruta del archivo para que quien llame pueda mencionarla en un
 * mensaje de fallo, aunque lo habitual es ignorarla.
 */
export async function capturar(
  page: Page,
  pantalla: { readonly carpeta: string; readonly titulo: string },
  accion: string,
  opciones: {
    /**
     * Página entera (por defecto) o sólo lo que se ve.
     *
     * Para una pantalla del producto la página entera es lo correcto: entra
     * completa y se lee de un vistazo. Para la vitrina de diseño no: mide más de
     * veinte mil píxeles de alto, cada captura pesa dos megabytes y medio, y
     * doscientas de ellas son medio giga de imágenes **casi idénticas** —cambia
     * un recuadro y el resto es el mismo—. Recortar a lo visible no pierde nada
     * ahí, porque el clic ya dejó el control accionado a la vista, y da una
     * evidencia más nítida de lo que efectivamente cambió.
     */
    readonly paginaCompleta?: boolean;
  } = {},
): Promise<string> {
  const { paginaCompleta = true } = opciones;

  const orden = contadores.get(pantalla.carpeta) ?? 0;
  contadores.set(pantalla.carpeta, orden + 1);

  const base = `${String(orden).padStart(2, '0')}-${nombreSeguro(accion)}.png`;
  const destino = join(RAIZ, pantalla.carpeta, base);
  mkdirSync(dirname(destino), { recursive: true });

  await congelar(page);
  await page.screenshot({ path: destino, fullPage: paginaCompleta });

  const anotacion: Anotacion = {
    pantalla: pantalla.carpeta,
    titulo: pantalla.titulo,
    url: new URL(page.url()).pathname + new URL(page.url()).search,
    accion,
    archivo: relativa(destino),
    orden,
  };

  mkdirSync(RAIZ, { recursive: true });
  appendFileSync(MANIFIESTO, `${JSON.stringify(anotacion)}\n`, 'utf8');

  return relativa(destino);
}

/**
 * Deja constancia de lo que el recorrido **no** capturó.
 *
 * Un recorrido que recorta —por tope de acciones, por un control que no se pudo
 * accionar— y no lo dice se lee como cobertura completa, que es justo la
 * conclusión equivocada. El reporte muestra estas notas junto a las capturas.
 */
export function anotarOmision(pantalla: string, motivo: string): void {
  mkdirSync(RAIZ, { recursive: true });
  appendFileSync(
    join(RAIZ, 'omisiones.jsonl'),
    `${JSON.stringify({ pantalla, motivo })}\n`,
    'utf8',
  );
}

/** Escribe un resumen legible al final de la corrida. */
export function escribirResumen(datos: Record<string, unknown>): void {
  mkdirSync(RAIZ, { recursive: true });
  writeFileSync(join(RAIZ, 'resumen.json'), JSON.stringify(datos, null, 2), 'utf8');
}

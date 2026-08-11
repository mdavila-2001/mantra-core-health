import { appendFileSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Recolección de evidencia visual del recorrido. **Lado de Node.**
 *
 * A diferencia de las capturas de fallo —que Cypress toma solo, y solo cuando
 * algo se rompió— esto registra el camino feliz: la prueba pasa y aun así deja
 * una imagen de cada pantalla y de cada estado al que se llegó apretando algo.
 *
 * Lo que se busca no es detectar regresiones sino **poder mirar la aplicación
 * entera sin levantarla**: para una revisión de diseño, para un acta de avance,
 * o para responder «¿cómo se ve la pantalla X después de tocar Y?» sin pedirle
 * a nadie que lo reproduzca.
 *
 * Todo cae en `artifacts/recorrido/`, que está en `.gitignore`: son cientos de
 * PNG y no tienen por qué vivir en la historia del repositorio.
 *
 * ## Por qué acá y no en la prueba
 *
 * Escribir archivos es cosa de Node, y las pruebas de Cypress corren en el
 * navegador. Todo lo de este archivo se invoca desde una prueba con `cy.task`.
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
export function raiz(): string {
  return resolve(process.cwd(), 'artifacts', process.env['EVIDENCIAS_DIR'] ?? 'recorrido');
}

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
export function limpiarEvidencias(): null {
  rmSync(raiz(), { recursive: true, force: true });
  mkdirSync(raiz(), { recursive: true });
  return null;
}

// Compartido con el navegador: si cada lado tratara los acentos distinto, la
// anotacion del manifiesto apuntaria a un archivo que no existe.
export { nombreSeguro } from '../support/nombres';

/** Ruta relativa al repositorio: es la que se escribe en el manifiesto. */
export function relativa(absoluta: string): string {
  return absoluta.startsWith(process.cwd()) ? absoluta.slice(process.cwd().length + 1) : absoluta;
}

/**
 * Reubica la captura que acabó de tomar Cypress.
 *
 * Cypress las escribe en `<screenshotsFolder>/<archivo de spec>/<nombre>.png`.
 * El recorrido necesita `artifacts/recorrido/<pantalla>/NN-accion.png`, sin la
 * carpeta del spec en el medio: el reporte agrupa por pantalla, y una pantalla
 * puede recorrerse desde más de un archivo de prueba.
 *
 * Se invoca desde el evento `after:screenshot`, que es el único punto donde se
 * conoce la ruta final; devolver `{ path }` es lo que hace que Cypress registre
 * la nueva y no la vieja.
 */
export function reubicarCaptura(detalles: { path: string; name?: string }): { path: string } {
  const nombre = detalles.name;
  if (nombre === undefined || nombre === '') {
    // Una captura sin nombre es la automática de un fallo: esa se queda donde
    // Cypress la puso, que es donde el reporte de fallos la busca.
    return { path: detalles.path };
  }

  const destino = join(raiz(), `${nombre}.png`);
  mkdirSync(dirname(destino), { recursive: true });
  renameSync(detalles.path, destino);
  return { path: destino };
}

/** Anota una captura en el manifiesto que después lee el generador del reporte. */
export function anotar(anotacion: Anotacion): null {
  mkdirSync(raiz(), { recursive: true });
  appendFileSync(join(raiz(), 'manifiesto.jsonl'), `${JSON.stringify(anotacion)}\n`, 'utf8');
  return null;
}

/**
 * Deja constancia de lo que el recorrido **no** capturó.
 *
 * Un recorrido que recorta —por tope de acciones, por un control que no se pudo
 * accionar— y no lo dice se lee como cobertura completa, que es justo la
 * conclusión equivocada. El reporte muestra estas notas junto a las capturas.
 */
export function anotarOmision(datos: { pantalla: string; motivo: string }): null {
  mkdirSync(raiz(), { recursive: true });
  appendFileSync(join(raiz(), 'omisiones.jsonl'), `${JSON.stringify(datos)}\n`, 'utf8');
  return null;
}

/** Un problema visto durante el recorrido con usuarios reales. */
export interface Problema {
  readonly actor: string;
  readonly pantalla: string;
  readonly tipo: 'consola' | 'excepcion' | 'http';
  readonly detalle: string;
}

export function anotarProblema(problema: Problema): null {
  mkdirSync(raiz(), { recursive: true });
  appendFileSync(join(raiz(), 'problemas.jsonl'), `${JSON.stringify(problema)}\n`, 'utf8');
  return null;
}

/** Escribe un resumen legible al final de la corrida. */
export function escribirResumen(datos: Record<string, unknown>): null {
  mkdirSync(raiz(), { recursive: true });
  writeFileSync(join(raiz(), 'resumen.json'), JSON.stringify(datos, null, 2), 'utf8');
  return null;
}

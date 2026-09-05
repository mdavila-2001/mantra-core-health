import { Injectable } from '@angular/core';

/**
 * Exporta filas a un CSV descargable.
 *
 * ## Por qué existe
 *
 * `pdf-export` cubre "un documento para leer o imprimir"; el pedido de FT-20
 * para el libro diario es otra cosa — "adicionalmente una opción adicional de
 * descargar csv" — un archivo para abrir en una planilla. Un PDF exportado con
 * `exportElementToPdf` no sirve para eso: recorre el DOM para armar párrafos,
 * no columnas.
 *
 * ## Por qué no arrastra ninguna librería
 *
 * El formato es lo bastante simple —columnas separadas por comas, comillas
 * dobles escapadas— como para no justificar una dependencia nueva por un caso
 * de uso.
 *
 * ## Separador de columnas
 *
 * `,` y no `;`: es el separador que reconoce por omisión tanto Excel en
 * configuración regional `en-US` como Google Sheets al importar. Los importes
 * de este archivo ya usan `.` como separador decimal (ver la cabecera de
 * `accounting.types.ts`), así que no hay conflicto con comas decimales.
 */

/** Una columna del CSV: qué campo lee de la fila y con qué encabezado. */
export interface CsvColumn<T> {
  readonly header: string;
  readonly value: (row: T) => string;
}

/** Arma el texto CSV, con salto de línea CRLF por fila (RFC 4180). */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const encabezado = columns.map((c) => escaparCelda(c.header));
  const filas = rows.map((row) => columns.map((c) => escaparCelda(c.value(row))));
  return [encabezado, ...filas].map((fila) => fila.join(',')).join('\r\n');
}

/**
 * Descarga filas como un archivo `.csv`.
 *
 * ## Por qué es un servicio inyectable, y no una función suelta
 *
 * El primer intento fue una función de módulo — sin `jspdf` de por medio no
 * hay nada pesado que diferir. Pero el runner de tests de este repo
 * (`@angular/build:unit-test`) prohíbe `vi.mock` sobre imports relativos
 * ("Please use Angular TestBed for mocking dependencies") y además no deja
 * espiar con `vi.spyOn` una función exportada de un módulo así compilado
 * ("Cannot redefine property") — verificado al escribir el spec de esta
 * misma clase. La costura que hace falta para poder sustituirla en un test
 * es la inyección de dependencias, no un `import *`.
 */
@Injectable({ providedIn: 'root' })
export class CsvExportService {
  download<T>(rows: readonly T[], columns: readonly CsvColumn<T>[], filename: string): void {
    // El BOM (U+FEFF) es lo que hace que Excel abra el archivo como UTF-8 en
    // vez de adivinar la codificación local y desfigurar cualquier tilde.
    const contenido = String.fromCharCode(0xfeff) + toCsv(rows, columns);
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    try {
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
      enlace.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function escaparCelda(valor: string): string {
  // Comillas si el valor trae el separador, comillas o un salto de línea: la
  // regla de escape de RFC 4180. El resto se manda tal cual.
  if (/[",\r\n]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

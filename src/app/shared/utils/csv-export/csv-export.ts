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
 * ## Qué se escapa
 *
 * Dos cosas distintas, en este orden: la neutralización de fórmulas (ver
 * `neutralizarFormula`, es seguridad) y el entrecomillado de RFC 4180 (ver
 * `escaparCelda`, es formato).
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

/**
 * Primer carácter que hace que una planilla lea la celda como fórmula y no como
 * texto: `=` y `+` la abren en Excel, LibreOffice y Google Sheets; `-` la abre
 * igual (`-1+1` es una fórmula, no un número); `@` la abre en Excel, que lo
 * acepta como inicio heredado de Lotus; el tabulador (U+0009) y el retorno de
 * carro (U+000D) los descarta el importador antes de mirar el resto, así que
 * `\t=cmd` termina evaluándose igual.
 */
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

/**
 * Desactiva la inyección de fórmulas (CSV injection) anteponiendo un apóstrofo.
 *
 * ## Por qué hace falta
 *
 * Los textos que entran acá no son nuestros: son respuestas de pacientes y
 * títulos que escribe quien usa el sistema. Una celda que empieza con uno de
 * los caracteres de arriba no se muestra como texto al abrir el archivo — la
 * planilla la **evalúa**. Con eso se llega desde una respuesta de formulario a
 * `=HYPERLINK("http://…&"&A1)` (fuga del contenido de la planilla a un tercero
 * con un solo clic), a `=IMPORTXML(...)` en Sheets, o a `=cmd|'/c calc'!A1` en
 * un Excel con DDE habilitado. El escape de RFC 4180 no protege de nada de
 * esto: entrecomillar es una regla de *parseo* de columnas, y la planilla
 * decide si algo es fórmula después de haber quitado esas comillas.
 *
 * ## Por qué un apóstrofo y no otra cosa
 *
 * Es la mitigación que recomienda OWASP: el apóstrofo inicial es el prefijo de
 * «esto es texto» que entienden Excel, LibreOffice y Google Sheets, no se ve en
 * la celda al abrir el archivo y no cambia el valor que se copia de ella.
 * Filtrar o borrar el carácter peligroso, en cambio, mutilaría el dato.
 *
 * Contrapartida aceptada: un importe negativo (`-120.50`) también queda
 * neutralizado y la planilla lo lee como texto. Se prefiere eso a dejar abierto
 * el vector, porque no hay forma de distinguir por la sola forma del valor un
 * número de una fórmula que empieza igual.
 */
function neutralizarFormula(valor: string): string {
  return INICIO_DE_FORMULA.test(valor) ? `'${valor}` : valor;
}

function escaparCelda(valor: string): string {
  // Primero se neutraliza la fórmula y recién después se aplica RFC 4180: el
  // apóstrofo tiene que quedar dentro de las comillas para que la planilla lo
  // vea como primer carácter del contenido de la celda.
  const seguro = neutralizarFormula(valor);

  // Comillas si el valor trae el separador, comillas o un salto de línea: la
  // regla de escape de RFC 4180. El resto se manda tal cual.
  if (/[",\r\n]/.test(seguro)) {
    return `"${seguro.replace(/"/g, '""')}"`;
  }
  return seguro;
}

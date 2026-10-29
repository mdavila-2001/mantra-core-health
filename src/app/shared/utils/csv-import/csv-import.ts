/* ============================================================================
    Lectura genérica de un CSV subido por una persona: bytes → texto →
    renglones de celdas.

    Nació dentro de las reglas del catálogo de farmacia
    (`features/pharmacy/catalog-rules/catalog.rules.ts`) y se mudó acá cuando
    la carga masiva de sucursales necesitó exactamente lo mismo: separador
    detectado (Excel en castellano exporta con `;`), comillas RFC 4180,
    Windows-1252 de reserva y el apóstrofo anti-fórmula de `CsvExportService`
    deshecho. Farmacia la re-exporta con los mismos nombres.
    ========================================================================== */

/** Tope de filas por archivo si quien lee no fija otro. */
export const FILAS_MAXIMAS_POR_DEFECTO = 500;

/** Cómo venía codificado el archivo. */
export type CodificacionDelCsv = 'utf-8' | 'windows-1252';

/** El texto del archivo y con qué codificación se leyó. */
export interface TextoDelCsv {
  readonly texto: string;
  readonly codificacion: CodificacionDelCsv;
}

/**
 * Decodifica los bytes del archivo: UTF-8 si lo es de verdad, y si no,
 * Windows-1252.
 *
 * Excel en castellano guarda «CSV (delimitado por comas)» en Windows-1252, no
 * en UTF-8. Leído como UTF-8, cada tilde y cada eñe se vuelven «�» y el
 * producto se publica así — sin arreglo posible, porque el backend no edita y
 * el código retirado no se puede volver a usar. UTF-8 se decodifica en modo
 * estricto: un byte que no le corresponde no se reemplaza, lanza, y entonces
 * se relee como Windows-1252, que acepta cualquier byte.
 */
export function decodificarCsv(bytes: ArrayBuffer | Uint8Array): TextoDelCsv {
  try {
    return { texto: new TextDecoder('utf-8', { fatal: true }).decode(bytes), codificacion: 'utf-8' };
  } catch {
    return { texto: new TextDecoder('windows-1252').decode(bytes), codificacion: 'windows-1252' };
  }
}

/** Un fallo que invalida el archivo entero, antes de mirar fila por fila. */
export class ArchivoInvalido extends Error {
  override readonly name = 'ArchivoInvalido';
}

/** Una tabla leída de un CSV: encabezados normalizados y los renglones de datos. */
export interface TablaCsv {
  /** `Código de barras` → `codigo_de_barras`, uno por columna. */
  readonly encabezados: readonly string[];
  readonly renglones: readonly Renglon[];
}

/**
 * Lee cualquier CSV como tabla —separador detectado, comillas respetadas— sin
 * saber de qué es. Lo usan las cargas que no son de productos (el inventario de farmacia, las
 * sucursales); `leerCsv` del catálogo de farmacia arma encima la suya.
 *
 * Lanza {@link ArchivoInvalido} si está vacío, si una columna no tiene
 * encabezado, si hay dos con el mismo nombre o si pasa del tope de filas.
 */
export function leerTablaCsv(
  contenido: string,
  filasMaximas: number = FILAS_MAXIMAS_POR_DEFECTO,
): TablaCsv {
  const texto = contenido.replace(/^\uFEFF/, '');
  if (texto.trim() === '') {
    throw new ArchivoInvalido('El archivo está vacío.');
  }
  const [primero, ...datos] = partirEnRenglones(texto, detectarSeparador(texto));
  const encabezado = [...primero!.celdas];
  while (encabezado.length > 1 && encabezado[encabezado.length - 1]!.trim() === '') {
    encabezado.pop();
  }
  const encabezados = encabezado.map(normalizarEncabezado);
  if (encabezados.some((nombre) => nombre === '')) {
    throw new ArchivoInvalido('Todas las columnas necesitan un encabezado.');
  }
  if (new Set(encabezados).size !== encabezados.length) {
    throw new ArchivoInvalido('Hay dos columnas con el mismo encabezado.');
  }
  if (datos.length === 0) {
    throw new ArchivoInvalido('El archivo tiene encabezado pero ninguna fila.');
  }
  if (datos.length > filasMaximas) {
    throw new ArchivoInvalido(
      `El archivo tiene ${datos.length} filas y el tope es ${filasMaximas}. Divídalo en varios.`,
    );
  }
  return {
    encabezados,
    renglones: datos.map((renglon) => ({
      linea: renglon.linea,
      celdas: renglon.celdas.map((celda) => sinApostrofoDeFormula(celda.trim())),
    })),
  };
}

/** El separador del archivo: el que más aparece en el encabezado, fuera de comillas. */
export function detectarSeparador(texto: string): string {
  const cuentas: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let entreComillas = false;
  for (const caracter of texto) {
    if (caracter === '"') {
      entreComillas = !entreComillas;
    } else if (!entreComillas && (caracter === '\n' || caracter === '\r')) {
      break;
    } else if (!entreComillas && caracter in cuentas) {
      cuentas[caracter]!++;
    }
  }
  return Object.keys(cuentas).sort((a, b) => cuentas[b]! - cuentas[a]!)[0]!;
}

/** Un renglón del archivo: sus celdas y la línea donde empieza. */
export interface Renglon {
  readonly linea: number;
  readonly celdas: string[];
}

/**
 * Parte el texto en renglones de celdas, respetando las comillas, y anota en
 * qué línea del archivo empieza cada uno (un salto dentro de comillas cuenta
 * como línea, igual que en la planilla).
 */
export function partirEnRenglones(texto: string, separador: string): Renglon[] {
  const renglones: Renglon[] = [];
  let renglon: string[] = [];
  let celda = '';
  let entreComillas = false;
  let recienCerrada = false;
  let linea = 1;
  let inicio = 1;

  const cerrarCelda = (): void => {
    renglon.push(celda);
    celda = '';
    recienCerrada = false;
  };
  const cerrarRenglon = (): void => {
    cerrarCelda();
    if (renglon.some((valor) => valor.trim() !== '')) {
      renglones.push({ linea: inicio, celdas: renglon });
    }
    renglon = [];
  };

  for (let i = 0; i < texto.length; i++) {
    const caracter = texto[i]!;
    if (entreComillas) {
      if (caracter === '"') {
        if (texto[i + 1] === '"') {
          celda += '"';
          i++;
        } else {
          entreComillas = false;
          recienCerrada = true;
        }
      } else {
        if (caracter === '\n' || (caracter === '\r' && texto[i + 1] !== '\n')) {
          linea++;
        }
        celda += caracter;
      }
      continue;
    }
    if (caracter === '"') {
      if (celda.trim() !== '' || recienCerrada) {
        throw new ArchivoInvalido(
          `Hay una comilla en medio de un valor (línea ${linea}).`,
        );
      }
      celda = '';
      entreComillas = true;
    } else if (caracter === separador) {
      cerrarCelda();
    } else if (caracter === '\n' || caracter === '\r') {
      if (caracter === '\r' && texto[i + 1] === '\n') {
        i++;
      }
      cerrarRenglon();
      linea++;
      inicio = linea;
    } else if (recienCerrada) {
      if (caracter.trim() !== '') {
        throw new ArchivoInvalido(
          `Hay texto después de cerrar las comillas (línea ${linea}).`,
        );
      }
    } else {
      celda += caracter;
    }
  }
  if (entreComillas) {
    throw new ArchivoInvalido('Hay comillas sin cerrar en el archivo.');
  }
  if (celda !== '' || renglon.length > 0) {
    cerrarRenglon();
  }
  return renglones;
}

/** `Código de barras` → `codigo_de_barras`. */
export function normalizarEncabezado(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s-]+/g, '_');
}

/**
 * Deshace el apóstrofo que `CsvExportService` antepone a lo que parece una
 * fórmula: así el informe de errores que se descarga de acá se puede corregir
 * y volver a subir tal cual.
 */
export function sinApostrofoDeFormula(valor: string): string {
  return /^'[=+\-@\t\r]/.test(valor) ? valor.slice(1) : valor;
}

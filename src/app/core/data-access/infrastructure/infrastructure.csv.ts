import type { ImportRow } from './infrastructure.types';

/* ============================================================================
    Lectura del CSV de la importación (proceso 01, flujo C).

    El cliente parsea el archivo a `ImportRow[]` y la API valida con
    `?dryRun=true`. Esto sólo resuelve lo que el cliente no puede mandar sin
    perder información: un número que no es número, una columna que no existe,
    una línea sin código. Todo lo demás —formas, funciones, padres, códigos
    repetidos— lo juzga la API y vuelve en la tabla de errores por línea.

    Los errores llevan el número de línea **del archivo** (la cabecera es la 1),
    que es el que la persona ve en su hoja de cálculo.
    ========================================================================== */

/** Columnas que el archivo puede traer, en el orden de la plantilla. */
export const COLUMNAS_CSV = [
  'code',
  'name',
  'formCode',
  'functionCode',
  'parentCode',
  'description',
  'capacity',
  'floorNumber',
  'areaM2',
  'asepsisCode',
  'pressureCode',
  'airChangesPerHour',
  'hvacValidatedOn',
  'sexRestrictionCode',
  'ageGroupCode',
  'bedCategoryCode',
  'censable',
  'prepMinutes',
  'cleanupMinutes',
  'gln',
] as const;

type Columna = (typeof COLUMNAS_CSV)[number];

const OBLIGATORIAS: readonly Columna[] = ['code', 'name', 'formCode', 'functionCode'];
const NUMERICAS: readonly Columna[] = [
  'capacity',
  'floorNumber',
  'areaM2',
  'airChangesPerHour',
  'prepMinutes',
  'cleanupMinutes',
];
const ENTERAS: readonly Columna[] = ['capacity', 'floorNumber', 'prepMinutes', 'cleanupMinutes'];

export interface CsvLineError {
  readonly line: number;
  readonly field: string;
  readonly reason: string;
}

export interface ParsedCsvRow {
  /** Línea del archivo de la que salió (la cabecera es la 1). */
  readonly line: number;
  readonly row: ImportRow;
}

export interface ParsedCsv {
  readonly rows: readonly ParsedCsvRow[];
  /** Problemas que se detectaron al leer; si hay alguno no se manda nada a la API. */
  readonly errors: readonly CsvLineError[];
}

/** Plantilla descargable: cabecera y un ejemplo por forma. */
export const PLANTILLA_CSV = [
  COLUMNAS_CSV.join(','),
  'ED-A,Edificio A,LOC_FORM_BUILDING,SPACE_FN_BUILDING_GENERIC',
  'ED-A-P3,Piso 3,LOC_FORM_LEVEL,SPACE_FN_LEVEL_GENERIC,ED-A',
  'HAB-301,Habitación 301,LOC_FORM_ROOM,SPACE_FN_INPATIENT_ROOM,ED-A-P3',
  '301-A,Cama 301-A,LOC_FORM_BED,SPACE_FN_BED_STANDARD,HAB-301,,1,,,,,,,,,BED_CAT_PRIVATE,true',
].join('\n');

/**
 * Divide el texto en registros y celdas, con comillas (`"a,b"`, `""` escapa).
 * Acepta `,` o `;` según lo que traiga la cabecera (las hojas de cálculo en
 * español exportan con `;`). Devuelve la línea física de cada registro.
 */
function dividir(texto: string): { line: number; cells: string[] }[] {
  const limpio = texto.replace(/^\uFEFF/, '');
  const primera = limpio.split(/\r?\n/, 1)[0] ?? '';
  const delimitador = (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ';' : ',';

  const registros: { line: number; cells: string[] }[] = [];
  let celdas: string[] = [];
  let celda = '';
  let entrecomillado = false;
  let linea = 1;
  let inicio = 1;
  const cerrarCelda = (): void => {
    celdas.push(celda);
    celda = '';
  };
  const cerrarRegistro = (): void => {
    cerrarCelda();
    registros.push({ line: inicio, cells: celdas });
    celdas = [];
  };

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (entrecomillado) {
      if (c === '"' && limpio[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') {
        entrecomillado = false;
      } else {
        if (c === '\n') linea++;
        celda += c;
      }
    } else if (c === '"') {
      entrecomillado = true;
    } else if (c === delimitador) {
      cerrarCelda();
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i++;
      cerrarRegistro();
      linea++;
      inicio = linea;
    } else {
      celda += c;
    }
  }
  if (celda !== '' || celdas.length > 0) cerrarRegistro();
  return registros;
}

/** Lee el CSV. Las líneas en blanco se saltan pero siguen contando para el número de línea. */
export function parseSpacesCsv(texto: string): ParsedCsv {
  const registros = dividir(texto).filter((r) => r.cells.some((c) => c.trim() !== ''));
  const errors: CsvLineError[] = [];
  if (registros.length === 0) {
    return { rows: [], errors: [{ line: 1, field: 'archivo', reason: 'El archivo está vacío.' }] };
  }

  const cabecera = registros[0].cells.map((c) => c.trim());
  const conocidas = new Set<string>(COLUMNAS_CSV);
  for (const nombre of cabecera) {
    if (!conocidas.has(nombre)) {
      errors.push({ line: registros[0].line, field: nombre || '(sin nombre)', reason: 'Columna desconocida.' });
    }
  }
  for (const obligatoria of OBLIGATORIAS) {
    if (!cabecera.includes(obligatoria)) {
      errors.push({ line: registros[0].line, field: obligatoria, reason: 'Falta la columna obligatoria.' });
    }
  }
  if (errors.length > 0) return { rows: [], errors };

  const rows: ParsedCsvRow[] = [];
  for (const registro of registros.slice(1)) {
    const valores: Partial<Record<Columna, string>> = {};
    cabecera.forEach((nombre, i) => {
      const valor = (registro.cells[i] ?? '').trim();
      if (valor !== '') valores[nombre as Columna] = valor;
    });
    const antes = errors.length;
    const fila: Record<string, string | number | boolean> = {};
    for (const [nombre, valor] of Object.entries(valores) as [Columna, string][]) {
      if (NUMERICAS.includes(nombre)) {
        const n = Number(valor.replace(',', '.'));
        if (!Number.isFinite(n)) {
          errors.push({ line: registro.line, field: nombre, reason: `«${valor}» no es un número.` });
        } else if (ENTERAS.includes(nombre) && !Number.isInteger(n)) {
          errors.push({ line: registro.line, field: nombre, reason: `«${valor}» debe ser un número entero.` });
        } else {
          fila[nombre] = n;
        }
      } else if (nombre === 'censable') {
        const v = valor.toLowerCase();
        if (['true', 'si', 'sí', '1'].includes(v)) fila[nombre] = true;
        else if (['false', 'no', '0'].includes(v)) fila[nombre] = false;
        else errors.push({ line: registro.line, field: nombre, reason: `«${valor}» debe ser sí o no.` });
      } else {
        fila[nombre] = valor;
      }
    }
    for (const obligatoria of OBLIGATORIAS) {
      if (valores[obligatoria] === undefined) {
        errors.push({ line: registro.line, field: obligatoria, reason: 'Falta este dato.' });
      }
    }
    if (errors.length === antes) rows.push({ line: registro.line, row: fila as unknown as ImportRow });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ line: 1, field: 'archivo', reason: 'El archivo no trae ninguna fila de datos.' });
  }
  return { rows, errors };
}

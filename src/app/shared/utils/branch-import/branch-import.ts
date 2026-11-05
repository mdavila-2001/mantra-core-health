import {
  ArchivoInvalido,
  leerTablaCsv,
  normalizarEncabezado,
} from '../csv-import/csv-import';
import { BRANCH_IMPORT_COLUMNS, type BranchCells, type BranchField, type BranchImportColumn } from './branch-columns';
import {
  coordinatesFromColumns,
  coordinatesFromMapUrl,
  type BranchCoordinates,
} from './branch-coordinates';

// Re-exported so the rest of the app keeps importing everything from here.
export { BRANCH_IMPORT_COLUMNS, BRANCH_IMPORT_SAMPLE_ROWS } from './branch-columns';
export type { BranchImportColumn } from './branch-columns';
export { coordinatesFromMapUrl, type BranchCoordinates } from './branch-coordinates';

/* ============================================================================
    Carga masiva de sucursales: reglas puras, sin Angular.

    La usan las cuatro puertas por donde entra una sucursal —las altas de
    laboratorio, farmacia e imagenología y la ficha de la organización en
    administración—, así que una organización de cualquier tipo sube el mismo
    archivo y recibe los mismos avisos.

    Columnas (pedido del propietario, 2026-09-30): **nombre**, **descripcion**
    y **url_ubicacion**; desde 2026-11-05 el punto va en **latitud** y
    **longitud** y el enlace queda como alternativa; más dos opcionales que los contratos existentes ya
    usan: **direccion** (las altas la guardan como `addressLines`) y **codigo**
    (`POST /tenants/{id}/branches` lo exige; si no viene, se deriva del nombre).
    ========================================================================== */

/** Tope de sucursales por archivo: una red grande cabe, un volcado equivocado no. */
export const BRANCH_IMPORT_MAX_ROWS = 300;
/** Tope del archivo: 300 filas de texto no llegan ni cerca. */
export const BRANCH_IMPORT_MAX_BYTES = 512 * 1024;

/** Mismos topes que `CreateBranchDto` (nombre 1-300, código 1-100). */
export const BRANCH_NAME_MAX_LENGTH = 300;
export const BRANCH_CODE_MAX_LENGTH = 100;
export const BRANCH_ADDRESS_MAX_LENGTH = 300;
export const BRANCH_DESCRIPTION_MAX_LENGTH = 1000;
/** El largo práctico de una URL que todos los navegadores aceptan. */
export const BRANCH_LOCATION_URL_MAX_LENGTH = 2000;

/** Una sucursal leída del archivo, ya limpia y lista para sumarse. */
export interface BranchDraft {
  readonly name: string;
  readonly description: string;
  readonly locationUrl: string;
  readonly address: string;
  /** Vacío cuando el archivo no lo trae: quien persiste decide cómo derivarlo. */
  readonly code: string;
  /** Sacadas de `locationUrl` cuando el enlace las lleva escritas; si no, `null`. */
  readonly coordinates: BranchCoordinates | null;
}

/** Una fila del archivo, revisada. */
export type BranchImportRow =
  | { readonly line: number; readonly ok: true; readonly draft: BranchDraft; readonly notes: readonly string[] }
  | { readonly line: number; readonly ok: false; readonly errors: readonly string[]; readonly name: string };

/** Lo que salió de revisar el archivo entero. */
export interface BranchImportReview {
  readonly rows: readonly BranchImportRow[];
  /** Encabezados que no son de ninguna columna: se avisan y se ignoran. */
  readonly ignoredColumns: readonly string[];
}

/** Las válidas, en el orden del archivo. */
export function validDrafts(review: BranchImportReview): readonly BranchDraft[] {
  return review.rows.flatMap((row) => (row.ok ? [row.draft] : []));
}

/**
 * Revisa un CSV de sucursales **sin mandar nada**.
 *
 * `existingNames` son las sucursales que ya están cargadas (en el formulario o
 * en la organización): repetir una se marca como error de la fila, igual que
 * repetirla dentro del mismo archivo. La comparación ignora mayúsculas, tildes
 * y espacios de más, porque «Sucursal  Norte» y «sucursal norte» son la misma
 * para quien las busca.
 *
 * Lanza {@link ArchivoInvalido} si el archivo entero no sirve (vacío, sin la
 * columna `nombre`, encabezados repetidos, más de {@link BRANCH_IMPORT_MAX_ROWS}
 * filas). Los problemas de una fila puntual no lanzan: quedan en su fila.
 */
export function reviewBranchCsv(
  content: string,
  existingNames: readonly string[] = [],
): BranchImportReview {
  const table = leerTablaCsv(content, BRANCH_IMPORT_MAX_ROWS);
  const targets = table.encabezados.map((header) => columnFor(header)?.field ?? null);

  if (!targets.includes('name')) {
    throw new ArchivoInvalido(
      'Falta la columna «nombre». Descargue la plantilla para ver los encabezados.',
    );
  }
  const mapped = targets.filter((field) => field !== null);
  if (new Set(mapped).size !== mapped.length) {
    throw new ArchivoInvalido(
      'Dos encabezados apuntan al mismo dato (por ejemplo «lat» y «latitud»).',
    );
  }

  const seen = new Set(existingNames.map(nameKey));
  const rows = table.renglones.map((renglon): BranchImportRow => {
    const cell = (field: BranchField): string => {
      const index = targets.indexOf(field);
      return index === -1 ? '' : (renglon.celdas[index] ?? '').trim();
    };
    const row = reviewRow(renglon.linea, {
      name: collapseSpaces(cell('name')),
      description: cell('description'),
      locationUrl: cell('locationUrl'),
      latitude: cell('latitude'),
      longitude: cell('longitude'),
      address: collapseSpaces(cell('address')),
      code: cell('code'),
    });
    if (row.ok) {
      const key = nameKey(row.draft.name);
      if (seen.has(key)) {
        return {
          line: row.line,
          ok: false,
          name: row.draft.name,
          errors: ['Ya está cargada o se repite en el archivo.'],
        };
      }
      seen.add(key);
    }
    return row;
  });

  return {
    rows,
    ignoredColumns: table.encabezados.filter((_, index) => targets[index] === null),
  };
}

function reviewRow(line: number, fields: BranchCells): BranchImportRow {
  const errors: string[] = [];
  const notes: string[] = [];

  if (fields.name === '') {
    errors.push('Le falta el nombre.');
  } else if (fields.name.length > BRANCH_NAME_MAX_LENGTH) {
    errors.push(`El nombre pasa de ${BRANCH_NAME_MAX_LENGTH} caracteres.`);
  }
  if (fields.description.length > BRANCH_DESCRIPTION_MAX_LENGTH) {
    errors.push(`La descripción pasa de ${BRANCH_DESCRIPTION_MAX_LENGTH} caracteres.`);
  }
  if (fields.address.length > BRANCH_ADDRESS_MAX_LENGTH) {
    errors.push(`La dirección pasa de ${BRANCH_ADDRESS_MAX_LENGTH} caracteres.`);
  }
  if (fields.code.length > BRANCH_CODE_MAX_LENGTH) {
    errors.push(`El código pasa de ${BRANCH_CODE_MAX_LENGTH} caracteres.`);
  }

  // Latitude and longitude win over the link: they are the exact point.
  let coordinates = coordinatesFromColumns(fields.latitude, fields.longitude, errors);
  if (fields.locationUrl !== '') {
    if (fields.locationUrl.length > BRANCH_LOCATION_URL_MAX_LENGTH) {
      errors.push('El enlace de ubicación es demasiado largo.');
    } else if (!isWebUrl(fields.locationUrl)) {
      errors.push('El enlace de ubicación tiene que empezar con https:// (cópielo desde el mapa).');
    } else {
      const fromUrl = coordinatesFromMapUrl(fields.locationUrl);
      coordinates ??= fromUrl;
      if (coordinates === null) {
        notes.push('El enlace no trae el punto escrito: se guarda tal cual, y el pin lo marca usted.');
      }
    }
  }

  return errors.length > 0
    ? { line, ok: false, name: fields.name, errors }
    : {
        line,
        ok: true,
        draft: {
          name: fields.name,
          description: fields.description,
          locationUrl: fields.locationUrl,
          address: fields.address,
          code: fields.code,
          coordinates,
        },
        notes,
      };
}

/** Sólo `http(s)`: un `javascript:` en una celda no puede terminar en un enlace. */
export function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname !== '';
  } catch {
    return false;
  }
}

/**
 * Un código de sucursal a partir del nombre, único frente a `taken`:
 * «Sucursal Equipetrol» → `SUCURSAL-EQUIPETROL`; si ya existe, `-2`, `-3`…
 */
export function branchCodeFromName(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, BRANCH_CODE_MAX_LENGTH - 4) || 'SUCURSAL';
  const takenUpper = new Set([...taken].map((code) => code.toUpperCase()));
  if (!takenUpper.has(base)) {
    return base;
  }
  let suffix = 2;
  while (takenUpper.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

function columnFor(header: string): BranchImportColumn | undefined {
  const normalized = normalizarEncabezado(header);
  return BRANCH_IMPORT_COLUMNS.find(
    (column) => column.header === normalized || column.aliases.includes(normalized),
  );
}

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** La clave con la que dos nombres se consideran la misma sucursal. */
export function nameKey(name: string): string {
  return collapseSpaces(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

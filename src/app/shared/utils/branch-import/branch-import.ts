import {
  ArchivoInvalido,
  leerTablaCsv,
  normalizarEncabezado,
} from '../csv-import/csv-import';

/* ============================================================================
    Carga masiva de sucursales: reglas puras, sin Angular.

    La usan las cuatro puertas por donde entra una sucursal —las altas de
    laboratorio, farmacia e imagenología y la ficha de la organización en
    administración—, así que una organización de cualquier tipo sube el mismo
    archivo y recibe los mismos avisos.

    Columnas (pedido del propietario, 2026-09-30): **nombre**, **descripcion**
    y **url_ubicacion**; más dos opcionales que los contratos existentes ya
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

/** Un punto del mapa, en grados decimales. */
export interface BranchCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}

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

type BranchField = 'name' | 'description' | 'locationUrl' | 'address' | 'code';

/** Una columna de la plantilla: su encabezado, sus alias y qué se espera. */
export interface BranchImportColumn {
  readonly header: string;
  readonly field: BranchField;
  readonly aliases: readonly string[];
  readonly required: boolean;
  readonly hint: string;
}

/**
 * Las columnas, en el orden de la plantilla. Los encabezados van en castellano
 * porque los lee la persona que llena la planilla; se aceptan también en
 * inglés y con las variantes obvias (`url`, `link`, `google_maps`…).
 */
export const BRANCH_IMPORT_COLUMNS: readonly BranchImportColumn[] = [
  {
    header: 'nombre',
    field: 'name',
    aliases: ['name', 'sucursal', 'nombre_de_la_sucursal', 'nombre_sucursal', 'sede'],
    required: true,
    hint: 'Cómo la reconocen tus pacientes. Obligatorio.',
  },
  {
    header: 'descripcion',
    field: 'description',
    aliases: ['description', 'detalle', 'referencia', 'nota'],
    required: false,
    hint: 'Una línea: horario, piso, qué se atiende ahí.',
  },
  {
    header: 'url_ubicacion',
    field: 'locationUrl',
    aliases: [
      'url_de_ubicacion',
      'url_de_la_ubicacion',
      'ubicacion',
      'url',
      'link',
      'enlace',
      'mapa',
      'google_maps',
      'location_url',
      'location',
      'maps_url',
    ],
    required: false,
    hint: 'El enlace de Google Maps u OpenStreetMap. Si trae el punto, lo ubicamos en el mapa.',
  },
  {
    header: 'direccion',
    field: 'address',
    aliases: ['address', 'calle', 'domicilio'],
    required: false,
    hint: 'Calle y número. Opcional.',
  },
  {
    header: 'codigo',
    field: 'code',
    aliases: ['code', 'cod', 'codigo_de_la_sucursal', 'codigo_sucursal'],
    required: false,
    hint: 'Tu código interno. Si lo dejás vacío, lo armamos con el nombre.',
  },
];

/** Filas de ejemplo de la plantilla: dos locales de Santa Cruz inventados como ejemplo. */
export const BRANCH_IMPORT_SAMPLE_ROWS: readonly Omit<BranchDraft, 'coordinates'>[] = [
  {
    name: 'Sucursal Equipetrol',
    description: 'Planta baja. Lunes a sábado de 7:00 a 20:00.',
    locationUrl: 'https://www.google.com/maps?q=-17.7690,-63.1960',
    address: 'Av. San Martín 456',
    code: 'EQP',
  },
  {
    name: 'Sucursal Plan 3000',
    description: 'Toma de muestras desde las 6:30.',
    locationUrl: 'https://www.openstreetmap.org/?mlat=-17.8220&mlon=-63.1210#map=17/-17.8220/-63.1210',
    address: '',
    code: '',
  },
];

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
      'Falta la columna «nombre». Descargá la plantilla para ver los encabezados.',
    );
  }
  const mapped = targets.filter((field) => field !== null);
  if (new Set(mapped).size !== mapped.length) {
    throw new ArchivoInvalido(
      'Dos encabezados apuntan al mismo dato (por ejemplo «url» y «url_ubicacion»).',
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

function reviewRow(line: number, fields: Omit<BranchDraft, 'coordinates'>): BranchImportRow {
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

  let coordinates: BranchCoordinates | null = null;
  if (fields.locationUrl !== '') {
    if (fields.locationUrl.length > BRANCH_LOCATION_URL_MAX_LENGTH) {
      errors.push('El enlace de ubicación es demasiado largo.');
    } else if (!isWebUrl(fields.locationUrl)) {
      errors.push('El enlace de ubicación tiene que empezar con https:// (copialo desde el mapa).');
    } else {
      coordinates = coordinatesFromMapUrl(fields.locationUrl);
      if (coordinates === null) {
        notes.push('El enlace no trae el punto escrito: se guarda tal cual, y el pin lo marcás vos.');
      }
    }
  }

  return errors.length > 0
    ? { line, ok: false, name: fields.name, errors }
    : { line, ok: true, draft: { ...fields, coordinates }, notes };
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

/** Número decimal con signo, como lo escriben los mapas: `-17.7833`. */
const DECIMAL = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

/**
 * Los lugares donde un enlace de mapa deja escrito el punto, del más preciso
 * al más aproximado. En Google Maps, `!3d…!4d…` es el lugar marcado y `@…,…` el
 * centro de la vista: si están los dos, manda el lugar.
 */
const COORDINATE_PATTERNS: readonly RegExp[] = [
  new RegExp(String.raw`!3d${DECIMAL}!4d${DECIMAL}`),
  new RegExp(String.raw`[?&](?:q|query|ll|destination|daddr|center|sll)=(?:loc:)?${DECIMAL}(?:,|%2C)\s*${DECIMAL}`, 'i'),
  new RegExp(String.raw`@${DECIMAL},${DECIMAL}`),
  new RegExp(String.raw`[?&]mlat=${DECIMAL}&mlon=${DECIMAL}`, 'i'),
  new RegExp(String.raw`#map=\d{1,2}(?:\.\d+)?/${DECIMAL}/${DECIMAL}`),
  new RegExp(String.raw`^geo:${DECIMAL},${DECIMAL}`, 'i'),
];

/**
 * Las coordenadas que un enlace de mapa trae escritas, o `null`.
 *
 * No se sigue ningún enlace: un acortado (`maps.app.goo.gl/…`) no lleva el
 * punto, y abrirlo desde el navegador pegaría contra la CSP (`connect-src
 * 'self'`) y le avisaría a Google de cada carga. Se guarda el enlace tal cual y
 * el pin se marca a mano.
 */
export function coordinatesFromMapUrl(value: string): BranchCoordinates | null {
  let text = value.trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    // Un `%` suelto no invalida el enlace: se busca sobre el texto crudo.
  }
  for (const pattern of COORDINATE_PATTERNS) {
    const match = pattern.exec(text);
    if (match === null) {
      continue;
    }
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (isLatitude(latitude) && isLongitude(longitude) && !(latitude === 0 && longitude === 0)) {
      return { latitude, longitude };
    }
  }
  return null;
}

function isLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
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

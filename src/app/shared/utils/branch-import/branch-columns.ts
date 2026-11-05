/** Columns of the branch CSV template (pure data, no Angular). */

export type BranchField =
  | 'name'
  | 'description'
  | 'locationUrl'
  | 'address'
  | 'code'
  | 'latitude'
  | 'longitude';

/** The raw text of one row, one cell per column, before any check. */
export type BranchCells = Record<BranchField, string>;

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
    hint: 'Cómo la reconocen sus pacientes. Obligatorio.',
  },
  {
    header: 'descripcion',
    field: 'description',
    aliases: ['description', 'detalle', 'referencia', 'nota'],
    required: false,
    hint: 'Una línea: horario, piso, qué se atiende ahí.',
  },
  {
    header: 'direccion',
    field: 'address',
    aliases: ['address', 'calle', 'domicilio'],
    required: false,
    hint: 'Calle y número. Opcional.',
  },
  {
    header: 'latitud',
    field: 'latitude',
    aliases: ['latitude', 'lat'],
    required: false,
    hint: 'Del punto en el mapa, en grados decimales (-17.7690). Va junto con la longitud.',
  },
  {
    header: 'longitud',
    field: 'longitude',
    aliases: ['longitude', 'lng', 'lon', 'long'],
    required: false,
    hint: 'Del punto en el mapa, en grados decimales (-63.1960). Va junto con la latitud.',
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
    hint: 'Opcional: un enlace de Google Maps u OpenStreetMap, si no tiene la latitud y la longitud.',
  },
  {
    header: 'codigo',
    field: 'code',
    aliases: ['code', 'cod', 'codigo_de_la_sucursal', 'codigo_sucursal'],
    required: false,
    hint: 'Su código interno. Si lo deja vacío, lo armamos con el nombre.',
  },
];

/** Filas de ejemplo de la plantilla: dos locales de Santa Cruz inventados como ejemplo. */
export const BRANCH_IMPORT_SAMPLE_ROWS: readonly BranchCells[] = [
  {
    name: 'Sucursal Equipetrol',
    description: 'Planta baja. Lunes a sábado de 7:00 a 20:00.',
    locationUrl: '',
    latitude: '-17.7690',
    longitude: '-63.1960',
    address: 'Av. San Martín 456',
    code: 'EQP',
  },
  {
    name: 'Sucursal Plan 3000',
    description: 'Toma de muestras desde las 6:30.',
    locationUrl: '',
    latitude: '-17.8220',
    longitude: '-63.1210',
    address: '',
    code: '',
  },
];


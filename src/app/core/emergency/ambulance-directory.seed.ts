/**
 * Directorio semilla de líneas públicas de ambulancia y emergencias médicas.
 *
 * No pretende enumerar ambulancias privadas ni garantizar cobertura en cada
 * localidad. Cada opción conserva departamento, alcance y fuente pública para
 * que el alta pueda filtrar con honestidad. Revisado el 12/10/2026.
 */
export interface AmbulanceDirectoryEntry {
  readonly id: string;
  readonly name: string;
  /** Línea para marcar; los códigos cortos oficiales también son válidos. */
  readonly phone: string;
  readonly departmentCode: string;
  readonly scope: string;
  readonly source: string;
  readonly sourceUrl: string;
}

export const DEPARTAMENTOS_BOLIVIA = [
  { code: 'chuquisaca', name: 'Chuquisaca' },
  { code: 'la-paz', name: 'La Paz' },
  { code: 'cochabamba', name: 'Cochabamba' },
  { code: 'oruro', name: 'Oruro' },
  { code: 'potosi', name: 'Potosí' },
  { code: 'tarija', name: 'Tarija' },
  { code: 'santa-cruz', name: 'Santa Cruz' },
  { code: 'beni', name: 'Beni' },
  { code: 'pando', name: 'Pando' },
] as const;

const MINISTRY_168 =
  'https://www.minsalud.gob.bo/3026-bolivia-presenta-numero-unico-de-emergencias-168-para-todo-el-pais';
const SAR_CONTACT = 'https://sarbolivia.com/contactanos/';

/**
 * Fuente compartida conceptualmente con `lib/features/auth/data/ambulance_directory_seed.dart`.
 * El 168 nacional se replica por departamento en la consulta, no como nueve
 * filas, y así el filtro sigue mostrando una opción en los nueve.
 */
export const AMBULANCE_DIRECTORY_SEED: readonly AmbulanceDirectoryEntry[] = [
  {
    id: 'emergencias-168',
    name: 'Emergencias médicas · Línea 168',
    phone: '168',
    departmentCode: '*',
    scope: 'Nacional',
    source: 'Ministerio de Salud y Deportes de Bolivia',
    sourceUrl: MINISTRY_168,
  },
  ...[
    'chuquisaca',
    'la-paz',
    'cochabamba',
    'oruro',
    'potosi',
    'tarija',
    'santa-cruz',
    'beni',
  ].map((departmentCode) => ({
    id: `sar-bolivia-${departmentCode}`,
    name: 'SAR Bolivia · emergencias y ambulancias (123)',
    phone: '123',
    departmentCode,
    scope: 'Filial departamental; atención sujeta a disponibilidad',
    source: 'Grupo Voluntario de Salvamento Bolivia – SAR',
    sourceUrl: SAR_CONTACT,
  })),
  {
    id: 'sema-la-paz',
    name: 'SEMA · Servicio Municipal de Ambulancias',
    phone: '167',
    departmentCode: 'la-paz',
    scope: 'Municipio de La Paz',
    source: 'Gobierno Autónomo Municipal de La Paz',
    sourceUrl: 'https://lapaz.bo/turismo/emergencia/',
  },
  {
    id: 'suma-el-alto',
    name: 'SUMA · Servicio de Emergencia de El Alto',
    phone: '161',
    departmentCode: 'la-paz',
    scope: 'Municipio de El Alto',
    source: 'Gobierno Autónomo Municipal de El Alto',
    sourceUrl: 'https://elalto.gob.bo/contactos/',
  },
  {
    id: 'sisme-santa-cruz',
    name: 'SISME · Servicios Médicos Municipales',
    phone: '160',
    departmentCode: 'santa-cruz',
    scope: 'Municipio de Santa Cruz de la Sierra',
    source: 'Gobierno Autónomo Municipal de Santa Cruz de la Sierra',
    sourceUrl: 'https://www.gmsantacruz.gob.bo/agenda-telefonica/',
  },
  {
    id: 'cces-santa-cruz',
    name: 'CCES-D · Emergencias de salud SEDES',
    phone: '168',
    departmentCode: 'santa-cruz',
    scope: 'Departamento de Santa Cruz',
    source: 'Centro Coordinador de Emergencias en Salud Departamental · SEDES',
    sourceUrl: 'https://ccesd.sedescz.gob.bo/',
  },
  {
    id: 'cces-cochabamba',
    name: 'Centro Coordinador de Emergencias · SEDES',
    phone: '168',
    departmentCode: 'cochabamba',
    scope: 'Departamento de Cochabamba',
    source: 'Servicio Departamental de Salud de Cochabamba',
    sourceUrl: 'https://sedescochabamba.gob.bo/noticias.php?idp=287',
  },
  {
    id: 'cruem-potosi',
    name: 'CRUEM · Urgencias y Emergencias Médicas',
    phone: '168',
    departmentCode: 'potosi',
    scope: 'Departamento de Potosí',
    source: 'CRUEM (Ministerio de Salud) · línea reportada por El Potosí',
    sourceUrl: 'https://elpotosi.net/local/20211224_el-cruem-tiene-listo-el-personal-de-urgencias-para-feriado-navideno.html',
  },
  {
    id: 'semat-tarija',
    name: 'SEMAT · Emergencias Médicas de Tarija',
    phone: '168',
    departmentCode: 'tarija',
    scope: 'Departamento de Tarija',
    source: 'Defensoría del Pueblo; número según red nacional de emergencias',
    sourceUrl: 'https://www.defensoria.gob.bo/oficinas/prensa/defensoria-del-pueblo-investiga-de-oficio-fallecimiento-de-una-bebe-en-tarija',
  },
];

export function ambulancesForDepartment(
  departmentCode: string | null,
): readonly AmbulanceDirectoryEntry[] {
  if (!departmentCode) return [];
  const local = AMBULANCE_DIRECTORY_SEED.filter(
    (entry) => entry.departmentCode === departmentCode,
  );
  const national = AMBULANCE_DIRECTORY_SEED.filter(
    (entry) => entry.departmentCode === '*',
  );
  // Si hay un centro departamental documentado con la misma línea, mostrarlo
  // bajo su nombre local y evitar una segunda opción duplicada «168».
  return local.some((entry) => entry.phone === '168') ? local : [...national, ...local];
}

export function isSeededAmbulancePhone(phone: string): boolean {
  const normalized = phone.replace(/\s+/g, '');
  return AMBULANCE_DIRECTORY_SEED.some((entry) => entry.phone === normalized);
}

/** Opción nacional 168 disponible dentro de cada departamento. */
export function ambulanceDepartments() {
  return DEPARTAMENTOS_BOLIVIA.map(({ code, name }) => ({ code, name }));
}

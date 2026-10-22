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
  {
    id: 'bomberos-119',
    name: 'Bomberos de la Policía Boliviana · Emergencias (119)',
    phone: '119',
    departmentCode: '*',
    scope: 'Nacional',
    source: 'Policía Boliviana · Dirección Nacional de Bomberos',
    sourceUrl: 'https://policia.bo/',
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
    'pando',
  ].map((departmentCode) => ({
    id: `sar-bolivia-${departmentCode}`,
    name: 'SAR Bolivia · emergencias y ambulancias (123)',
    phone: '123',
    departmentCode,
    scope: 'Filial departamental; atención sujeta a disponibilidad',
    source: 'Grupo Voluntario de Salvamento Bolivia – SAR',
    sourceUrl: SAR_CONTACT,
  })),
  // Santa Cruz (Públicos y Privados)
  {
    id: 'cardiocruz-santa-cruz',
    name: 'CARDIOCRUZ · Ambulancias y Emergencias Médicas',
    phone: '+591 3 3482886',
    departmentCode: 'santa-cruz',
    scope: 'Santa Cruz · Servicio privado de ambulancias y emergencias 24h',
    source: 'Directorio de servicios médicos privados Santa Cruz',
    sourceUrl: 'https://soysantacruz.com.bo/',
  },
  {
    id: 'udem-santa-cruz',
    name: 'UDEM · Unidad de Emergencias Médicas Prehospitalarias',
    phone: '+591 3 3492500',
    departmentCode: 'santa-cruz',
    scope: 'Santa Cruz · Terapia intensiva móvil y traslados privados',
    source: 'UDEM Bolivia emergencias prehospitalarias',
    sourceUrl: 'https://soysantacruz.com.bo/',
  },
  {
    id: 'emercom-santa-cruz',
    name: 'EMERCOM · Emergencias Médicas y Ambulancias',
    phone: '+591 3 3643440',
    departmentCode: 'santa-cruz',
    scope: 'Santa Cruz · Ambulancias privadas de alta y mediana complejidad',
    source: 'Directorio empresarial de emergencias médicas Santa Cruz',
    sourceUrl: 'https://soysantacruz.com.bo/',
  },
  {
    id: 'mia-santa-cruz',
    name: 'MIA · Servicio de Ambulancia y Medicina Ambulatoria',
    phone: '+591 3 3550000',
    departmentCode: 'santa-cruz',
    scope: 'Santa Cruz · Atención médica y traslados en ambulancia',
    source: 'MIA Medicina Ambulatoria Bolivia',
    sourceUrl: 'https://mia.bo/',
  },
  {
    id: 'alerta-medica-santa-cruz',
    name: 'Alerta Médica · Ambulancias Santa Cruz',
    phone: '+591 3 3360000',
    departmentCode: 'santa-cruz',
    scope: 'Santa Cruz · Red privada de emergencias prehospitalarias',
    source: 'Directorio de salud y emergencias Santa Cruz',
    sourceUrl: 'https://soysantacruz.com.bo/',
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
    id: 'cruz-roja-santa-cruz',
    name: 'Cruz Roja Boliviana · Filial Santa Cruz',
    phone: '+591 3 3341334',
    departmentCode: 'santa-cruz',
    scope: 'Santa Cruz · Ambulancia y primeros auxilios',
    source: 'Cruz Roja Boliviana',
    sourceUrl: 'https://cruzrojaboliviana.org/',
  },
  // La Paz y El Alto (Públicos y Privados)
  {
    id: 'oximed-la-paz',
    name: 'OXIMED · Ambulancias y Oxígeno Medicinal',
    phone: '+591 2 2491279',
    departmentCode: 'la-paz',
    scope: 'La Paz y El Alto · Ambulancias de terapia intensiva y auxilio',
    source: 'Oximed Bolivia emergencias',
    sourceUrl: 'https://oximedbolivia.com/',
  },
  {
    id: 'cdi-hai-la-paz',
    name: 'CDI + HAI · Servicios de Ambulancia y Traslados',
    phone: '+591 71563335',
    departmentCode: 'la-paz',
    scope: 'La Paz · Zona Sur, Miraflores y El Alto',
    source: 'CDI HAI Centro de Diagnóstico e Imágenes',
    sourceUrl: 'https://cdihai.com/',
  },
  {
    id: 'alerta-medica-la-paz',
    name: 'Alerta Médica · Emergencias La Paz',
    phone: '+591 2 2444444',
    departmentCode: 'la-paz',
    scope: 'La Paz · Emergencias médicas y ambulancias privadas',
    source: 'Directorio de emergencias médicas La Paz',
    sourceUrl: 'https://lapaz.bo/',
  },
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
    id: 'cruz-roja-la-paz',
    name: 'Cruz Roja Boliviana · Filial La Paz',
    phone: '+591 2 2202930',
    departmentCode: 'la-paz',
    scope: 'La Paz · Emergencias y traslados prehospitalarios',
    source: 'Cruz Roja Boliviana',
    sourceUrl: 'https://cruzrojaboliviana.org/',
  },
  // Cochabamba (Públicos y Privados)
  {
    id: 'ambulancias-sum-cochabamba',
    name: 'Ambulancias SUM · Emergencias Cochabamba',
    phone: '+591 72766123',
    departmentCode: 'cochabamba',
    scope: 'Cochabamba · Ambulancias privadas y atención prehospitalaria 24h',
    source: 'Directorio médico Cochabamba',
    sourceUrl: 'https://boliviaentusmanos.com/',
  },
  {
    id: 'delta-med-cochabamba',
    name: 'DELTA MED · Ambulancias y Emergencias',
    phone: '+591 4 4066911',
    departmentCode: 'cochabamba',
    scope: 'Cochabamba · Traslados asistidos y terapia móvil',
    source: 'Directorio de salud Cochabamba',
    sourceUrl: 'https://boliviaentusmanos.com/',
  },
  {
    id: 'medicar-cochabamba',
    name: 'MEDICAR Bolivia · Atención Prehospitalaria',
    phone: '+591 4 4413231',
    departmentCode: 'cochabamba',
    scope: 'Cochabamba · Servicio de ambulancias y urgencias médicas',
    source: 'Medicar Bolivia',
    sourceUrl: 'https://boliviaentusmanos.com/',
  },
  {
    id: 'enlace-vida-cochabamba',
    name: 'ENLACE VIDA · Ambulancias y Rescate',
    phone: '+591 76471107',
    departmentCode: 'cochabamba',
    scope: 'Cochabamba · Traslado crítico y atención médica domiciliaria',
    source: 'Enlace Vida emergencias',
    sourceUrl: 'https://boliviaentusmanos.com/',
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
    id: 'cruz-roja-cochabamba',
    name: 'Cruz Roja Boliviana · Filial Cochabamba',
    phone: '+591 4 4252525',
    departmentCode: 'cochabamba',
    scope: 'Cochabamba · Emergencias y soporte vital',
    source: 'Cruz Roja Boliviana',
    sourceUrl: 'https://cruzrojaboliviana.org/',
  },
  // Tarija
  {
    id: 'semat-tarija',
    name: 'SEMAT · Emergencias Médicas de Tarija',
    phone: '168',
    departmentCode: 'tarija',
    scope: 'Departamento de Tarija',
    source: 'Defensoría del Pueblo; número según red nacional de emergencias',
    sourceUrl: 'https://www.defensoria.gob.bo/',
  },
  {
    id: 'cruz-roja-tarija',
    name: 'Cruz Roja Boliviana · Filial Tarija',
    phone: '+591 4 6642424',
    departmentCode: 'tarija',
    scope: 'Tarija · Ambulancias y auxilio de emergencias',
    source: 'Cruz Roja Boliviana',
    sourceUrl: 'https://cruzrojaboliviana.org/',
  },
  // Chuquisaca
  {
    id: 'samu-chuquisaca',
    name: 'SAMU · Emergencias Médicas Chuquisaca',
    phone: '168',
    departmentCode: 'chuquisaca',
    scope: 'Sucre y departamento de Chuquisaca',
    source: 'SEDES Chuquisaca · Red de ambulancias',
    sourceUrl: 'https://minsalud.gob.bo/',
  },
  {
    id: 'cruz-roja-chuquisaca',
    name: 'Cruz Roja Boliviana · Filial Chuquisaca',
    phone: '+591 4 6451515',
    departmentCode: 'chuquisaca',
    scope: 'Sucre · Ambulancias y primeros auxilios',
    source: 'Cruz Roja Boliviana',
    sourceUrl: 'https://cruzrojaboliviana.org/',
  },
  // Oruro
  {
    id: 'cruem-oruro',
    name: 'CRUEM · Centro Regulador de Emergencias Oruro',
    phone: '168',
    departmentCode: 'oruro',
    scope: 'Departamento de Oruro',
    source: 'SEDES Oruro · Red de Emergencias Médicas',
    sourceUrl: 'https://minsalud.gob.bo/',
  },
  {
    id: 'cruz-roja-oruro',
    name: 'Cruz Roja Boliviana · Filial Oruro',
    phone: '+591 2 5252222',
    departmentCode: 'oruro',
    scope: 'Oruro · Servicio de emergencias',
    source: 'Cruz Roja Boliviana',
    sourceUrl: 'https://cruzrojaboliviana.org/',
  },
  // Potosí
  {
    id: 'cruem-potosi',
    name: 'CRUEM · Urgencias y Emergencias Médicas',
    phone: '168',
    departmentCode: 'potosi',
    scope: 'Departamento de Potosí',
    source: 'CRUEM (Ministerio de Salud) · red departamental',
    sourceUrl: 'https://minsalud.gob.bo/',
  },
  {
    id: 'cruz-roja-potosi',
    name: 'Cruz Roja Boliviana · Filial Potosí',
    phone: '+591 2 6222222',
    departmentCode: 'potosi',
    scope: 'Potosí · Asistencia de emergencias y ambulancia',
    source: 'Cruz Roja Boliviana',
    sourceUrl: 'https://cruzrojaboliviana.org/',
  },
  // Beni
  {
    id: 'cruem-beni',
    name: 'CRUEM · Emergencias Médicas del Beni',
    phone: '168',
    departmentCode: 'beni',
    scope: 'Trinidad y departamento del Beni',
    source: 'SEDES Beni · Red de ambulancias y emergencias',
    sourceUrl: 'https://minsalud.gob.bo/',
  },
  {
    id: 'cruz-roja-beni',
    name: 'Cruz Roja Boliviana · Filial Beni',
    phone: '+591 3 4621111',
    departmentCode: 'beni',
    scope: 'Beni · Primeros auxilios y ambulancia',
    source: 'Cruz Roja Boliviana',
    sourceUrl: 'https://cruzrojaboliviana.org/',
  },
  // Pando
  {
    id: 'cruem-pando',
    name: 'CRUEM · Emergencias Médicas de Pando',
    phone: '168',
    departmentCode: 'pando',
    scope: 'Cobija y departamento de Pando',
    source: 'SEDES Pando · Red de ambulancias',
    sourceUrl: 'https://minsalud.gob.bo/',
  },
  {
    id: 'cruz-roja-pando',
    name: 'Cruz Roja Boliviana · Filial Pando',
    phone: '+591 3 8422222',
    departmentCode: 'pando',
    scope: 'Cobija · Emergencias médicas',
    source: 'Cruz Roja Boliviana',
    sourceUrl: 'https://cruzrojaboliviana.org/',
  },
];

const MAPA_SIGLA_A_CODIGO: Record<string, string> = {
  SC: 'santa-cruz',
  LP: 'la-paz',
  CB: 'cochabamba',
  CH: 'chuquisaca',
  OR: 'oruro',
  PO: 'potosi',
  PT: 'potosi',
  TJ: 'tarija',
  BE: 'beni',
  BN: 'beni',
  PA: 'pando',
  PD: 'pando',
};

export function ambulancesForDepartment(
  departmentCode: string | null,
): readonly AmbulanceDirectoryEntry[] {
  if (!departmentCode) {
    return AMBULANCE_DIRECTORY_SEED;
  }
  const code = (MAPA_SIGLA_A_CODIGO[departmentCode.toUpperCase()] ?? departmentCode).toLowerCase();
  const local = AMBULANCE_DIRECTORY_SEED.filter(
    (entry) => entry.departmentCode === code,
  );
  const national = AMBULANCE_DIRECTORY_SEED.filter(
    (entry) => entry.departmentCode === '*',
  );
  // Mostrar los servicios locales del departamento y las líneas nacionales
  return [...local, ...national];
}

export function isSeededAmbulancePhone(phone: string): boolean {
  const normalized = phone.replace(/[\s+-]/g, '');
  return AMBULANCE_DIRECTORY_SEED.some((entry) => {
    const entryNorm = entry.phone.replace(/[\s+-]/g, '');
    return entryNorm === normalized || normalized.endsWith(entryNorm) || entryNorm.endsWith(normalized);
  });
}

/** Opción nacional 168 disponible dentro de cada departamento. */
export function ambulanceDepartments() {
  return DEPARTAMENTOS_BOLIVIA.map(({ code, name }) => ({ code, name }));
}

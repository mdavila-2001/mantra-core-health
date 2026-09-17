import { uuid } from '../mock-store';
import {
  ASEGURADORAS_REALES,
  CLINICAS_REALES,
  HOSPITALES_REALES,
  type AseguradoraReal,
  type HospitalReal,
  type PrecisionDeInstitucion,
} from './instituciones.generated';

/* ============================================================================
    Las instituciones de salud reales, con la forma de una vitrina pública.

    Indexa `instituciones.generated.ts` —22 clínicas privadas, 17 hospitales
    públicos y cajas, 19 aseguradoras— y las publica en el directorio, donde
    antes había tres nombres inventados.

    ## Sin opiniones, sin puntuación, sin servicios

    Es el mismo criterio que ya aplica el corpus boliviano a sus laboratorios:
    son instituciones reales con nombre y apellido. Fabricarles una nota media,
    una lista de servicios o un número de habilitación sería una afirmación
    sobre alguien que existe y puede leerla.

    Lo que la planilla no declara queda vacío, y las pantallas ya saben dibujar
    «todavía sin opiniones».

    ## El punto del mapa dice con qué precisión se sacó

    `ubicacionAproximada()` responde si el punto es el centro de la ciudad — o
    sea, que Nominatim no reconoció la dirección—. La ficha tiene que decirlo:
    mandar a alguien a una dirección que no es, en un directorio de salud, es
    peor que no mostrar el mapa.
    ========================================================================== */

/** Una institución lista para el directorio público. */
export interface SemillaDeInstitucion {
  readonly clave: string;
  readonly kind: 'ORGANIZATION' | 'INSURER';
  readonly tenantId: string;
  readonly targetId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly headline: string;
  readonly biography: string;
  readonly city: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  readonly verified: boolean;
  readonly color: string;
  readonly precision: PrecisionDeInstitucion;
}

/** Si el punto es el centro de la ciudad y no la dirección publicada. */
export function ubicacionAproximada(precision: PrecisionDeInstitucion): boolean {
  return precision === 'ciudad';
}

function slugDe(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

/** El titular de un hospital: qué es y, si lo declara, en qué red está. */
function titularDeHospital(hospital: HospitalReal): string {
  const que = {
    hospital_tercer_nivel: 'Hospital de tercer nivel',
    hospital_segundo_nivel: 'Hospital de segundo nivel',
    caja_de_salud: 'Caja de salud',
  }[hospital.kind] ?? 'Establecimiento de salud';
  return hospital.healthNetwork === null ? `${que} · ${hospital.city}` : `${que} · ${hospital.healthNetwork}`;
}

/** El titular de una aseguradora: el ramo que declara su propia planilla. */
function titularDeAseguradora(aseguradora: AseguradoraReal): string {
  return aseguradora.coversHealth
    ? 'Aseguradora de personas · cubre salud'
    : 'Seguros generales y fianzas · no cubre salud';
}

/** La biografía de una clínica: sólo lo que la planilla declara. */
function biografiaDeClinica(legalName: string | null, taxId: string | null): string {
  const partes: string[] = [];
  if (legalName !== null) partes.push(legalName);
  if (taxId !== null) partes.push(`NIT ${taxId}`);
  return partes.length === 0
    ? 'Clínica privada de Santa Cruz de la Sierra.'
    : `${partes.join(' · ')}.`;
}

export const SEMILLAS_DE_INSTITUCIONES: readonly SemillaDeInstitucion[] = [
  ...CLINICAS_REALES.map((clinica) => ({
    clave: `institucion-${clinica.id}`,
    kind: 'ORGANIZATION' as const,
    tenantId: uuid(`tenant-${clinica.id}`),
    targetId: uuid(`organization-${clinica.id}`),
    slug: slugDe(clinica.name),
    displayName: clinica.name,
    headline: `Clínica privada · ${clinica.city}`,
    biography: biografiaDeClinica(clinica.legalName, clinica.taxId),
    city: clinica.city,
    address: clinica.address ?? '',
    lat: clinica.lat,
    lng: clinica.lng,
    // `verified` es «lo verificó la plataforma», y nadie lo hizo: estas salen
    // de una planilla, no de un trámite de habilitación.
    verified: false,
    color: '#0f766e',
    precision: clinica.precision,
  })),
  ...HOSPITALES_REALES.map((hospital) => ({
    clave: `institucion-${hospital.id}`,
    kind: 'ORGANIZATION' as const,
    tenantId: uuid(`tenant-${hospital.id}`),
    targetId: uuid(`organization-${hospital.id}`),
    slug: slugDe(hospital.name),
    displayName: hospital.name,
    headline: titularDeHospital(hospital),
    biography:
      hospital.sector === 'seguridad_social'
        ? 'Caja de salud de la seguridad social de corto plazo.'
        : 'Establecimiento público del sistema de salud.',
    city: hospital.city,
    address: hospital.address ?? '',
    lat: hospital.lat,
    lng: hospital.lng,
    verified: false,
    color: '#1d4ed8',
    precision: hospital.precision,
  })),
  ...ASEGURADORAS_REALES.map((aseguradora) => ({
    clave: `institucion-${aseguradora.id}`,
    kind: 'INSURER' as const,
    tenantId: uuid(`tenant-${aseguradora.id}`),
    targetId: uuid(`insurer-${aseguradora.id}`),
    slug: slugDe(aseguradora.name),
    displayName: aseguradora.shortName ?? aseguradora.name,
    headline: titularDeAseguradora(aseguradora),
    biography:
      aseguradora.taxId === null
        ? aseguradora.name
        : `${aseguradora.name} · NIT ${aseguradora.taxId}.`,
    city: 'Bolivia',
    address: aseguradora.address ?? '',
    lat: aseguradora.lat,
    lng: aseguradora.lng,
    verified: false,
    color: '#b45309',
    precision: aseguradora.precision,
  })),
];

const porSlug = new Map(SEMILLAS_DE_INSTITUCIONES.map((s) => [s.slug, s]));

/** Una institución por su slug, o `undefined`. */
export function institucionPorSlug(slug: string): SemillaDeInstitucion | undefined {
  return porSlug.get(slug);
}

/** Las aseguradoras que **sí** cubren salud, que son las que importan acá. */
export const ASEGURADORAS_DE_SALUD = ASEGURADORAS_REALES.filter((a) => a.coversHealth);

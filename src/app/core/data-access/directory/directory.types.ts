/**
 * Tipos de la vista para `directory`: organizaciones (tenants). **No son los
 * DTOs de la API**: se mapean en el cliente, y las fechas ya son `Date`.
 */

/**
 * Una fila del listado de organizaciones (`GET /admin/tenants`).
 *
 * Más angosta que la entidad a propósito — es el contrato del backend: «lo
 * justo para pintar la tabla y decidir a cuál entrar». La ficha completa
 * (forma jurídica, país, moneda, zona horaria) vive en `GET /tenants/{id}`.
 */
export interface TenantListItem {
  readonly id: string;
  /** Código único global. Es sobre lo que ordena el cursor. */
  readonly code: string;
  readonly legalName: string;
  readonly tradeName?: string;
  readonly tenantTypeConceptId: string;
  readonly statusConceptId: string;
  readonly verificationStatusConceptId: string;
  /** Presente sólo si es una sub-organización. */
  readonly parentTenantId?: string;
  readonly createdAt: Date;
}

/** Página del listado. Sin total: la paginación es por cursor, a propósito. */
export interface TenantPage {
  readonly items: readonly TenantListItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/** Parámetros de `GET /admin/tenants`. Todos opcionales. */
export interface TenantSearchQuery {
  /** Texto sobre código, razón social y nombre comercial. */
  readonly query?: string;
  /** Concepto de estado al que acotar. */
  readonly statusConceptId?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

/**
 * Códigos de tipo de organización que declara `CreateTenantDto`.
 *
 * TODO(IT3): cuando el servicio de `dynamic-enums` exista en el front
 * (`GET /system-context/dynamic-enums?target=…`), este set literal se
 * reemplaza por el catálogo real. Hoy es la única fuente que el frontend
 * puede leer: el DTO los enumera (`@IsIn(TENANT_TYPE_CODES)`) y el backend
 * resuelve cada código a su concept id.
 */
export const TENANT_TYPE_CODES = [
  'PROVIDER',
  'PAYER',
  'BROKER',
  'UNIVERSITY',
  'PHARMACY',
  'HOSPITAL',
  'MEDICAL_OFFICE',
  'NURSING',
  'HEALTH_OTHER',
  'HEALTH_BUSINESS',
] as const;

export type TenantTypeCode = (typeof TENANT_TYPE_CODES)[number];

/**
 * Etiquetas visibles de cada tipo. Texto de la interfaz, no del catálogo: el
 * backend traduce el código al concept id; la pantalla sólo necesita nombrarlo
 * en el idioma de quien lo elige.
 */
export const TENANT_TYPE_LABELS: Readonly<Record<TenantTypeCode, string>> = {
  PROVIDER: 'Prestador de salud',
  PAYER: 'Aseguradora',
  BROKER: 'Corredor de seguros',
  UNIVERSITY: 'Universidad',
  PHARMACY: 'Farmacia',
  HOSPITAL: 'Hospital',
  MEDICAL_OFFICE: 'Consultorio médico',
  NURSING: 'Centro de enfermería',
  HEALTH_OTHER: 'Otro servicio de salud',
  HEALTH_BUSINESS: 'Comercio de salud',
};

/**
 * Datos de aseguradora. El backend los **exige** cuando el tipo es `PAYER` y
 * los **rechaza** en cualquier otro: el formulario muestra el bloque sólo en
 * ese caso.
 */
export interface PayerProfile {
  readonly carrierCode: string;
  readonly regulatorIdentifier: string;
  readonly jurisdictionConceptId?: string;
}

/** Datos de corredor. Mismo trato que {@link PayerProfile}, para `BROKER`. */
export interface BrokerProfile {
  readonly brokerCode: string;
  readonly licenseNumber: string;
  readonly jurisdictionConceptId?: string;
}

/**
 * Alta de una organización raíz (`POST /admin/tenants`, UC-04-01).
 *
 * Los `*ConceptId` opcionales (entidad legal, país, jurisdicción, región de
 * datos) **no figuran acá todavía**: un campo de catálogo sólo puede ser un
 * selector poblado desde `terminology`, y el vínculo columna → value set no
 * está publicado en ningún contrato que el frontend pueda leer. Es la misma
 * decisión —y por la misma razón— que en el alta de paciente.
 * TODO(IT3): ofrecerlos cuando el servicio de `dynamic-enums` exista.
 */
export interface NewTenant {
  readonly code: string;
  readonly legalName: string;
  /** Usuario que queda como owner inicial. Se elige, nunca se tipea. */
  readonly ownerUserId: string;
  readonly tradeName?: string;
  readonly tenantType: TenantTypeCode;
  readonly timeZone?: string;
  readonly payer?: PayerProfile;
  readonly broker?: BrokerProfile;
}

/** Lo que devuelve el alta. La organización nace `pending`, sin verificar. */
export interface TenantCreated {
  readonly id: string;
  readonly code: string;
  readonly legalName: string;
  readonly statusConceptId: string;
  readonly verificationStatusConceptId: string;
  readonly parentTenantId?: string;
  readonly createdAt: Date;
}

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

/**
 * Una organización del actor, con qué puede hacer en ella (TP-1).
 *
 * `canAdminister` viene del servidor y no se deduce acá: el criterio de quién
 * administra una organización vive en la API, y calcularlo otra vez en el front
 * daría dos definiciones que se separan en cuanto una de las dos cambie.
 *
 * Sirve para dibujar, nunca para autorizar: la API vuelve a comprobarlo en cada
 * escritura. Lo que evita es una pantalla que ofrece botones que fallan.
 */
export interface MyOrganization extends TenantListItem {
  /** Concepto del rol de la membresía activa (owner/admin/staff). */
  readonly myRoleConceptId: string;
  /** Si puede editar los datos y gestionar la gente. */
  readonly canAdminister: boolean;
  /**
   * Si la plataforma ya la aprobó.
   *
   * Resuelto por la API a propósito: el estado viaja como concepto —un uuid— y
   * saber cuál significa «verificada» ataría la pantalla a un identificador
   * sembrado. Importa porque sin aprobar no aparece en el directorio público.
   */
  readonly isVerified: boolean;
  /** Zona horaria IANA declarada, si la hay. */
  readonly timeZone?: string;
}

/**
 * Un profesional que pidió atender en una sede de la organización (TP-2).
 *
 * Trae lo justo para decidir: quién pide, para qué sede, con qué cargo y desde
 * cuándo. Ningún dato clínico y nada del profesional más allá de su perfil
 * profesional, que ya es público.
 */
export interface PractitionerRequest {
  /** Con este id se aprueba o se rechaza. */
  readonly id: string;
  readonly practitionerProfileId: string;
  /** Institución tal como la declaró el profesional. */
  readonly organizationName: string;
  readonly roleTitle: string;
  readonly practiceSiteId: string | null;
  readonly startDate: Date;
  readonly statusConceptId: string;
  readonly createdAt: Date;
}

/**
 * Una cita de la agenda de la organización (TP-5).
 *
 * ## Lo que no está, y es lo importante
 *
 * **El motivo de consulta.** Ni acá ni en el DTO del servidor: es del paciente
 * y de su médico. Una recepción necesita saber quién viene, cuándo y con quién
 * —eso es recibir a alguien— y no por qué viene, que es un dato clínico.
 *
 * El nombre del paciente sí: la organización lo recibe en la puerta.
 */
export interface TenantAgendaItem {
  readonly bookingId: string;
  readonly startAt: Date;
  readonly endAt: Date;
  readonly resourceId: string | null;
  /** Nombre de la sede, ya resuelto por el servidor. */
  readonly resourceName: string | null;
  readonly practitionerProfileId: string | null;
  readonly patientProfileId: string;
  readonly patientName: string | null;
  readonly statusConceptId: string;
}

/**
 * La agenda de la organización en una ventana.
 *
 * `truncated` no es cosmético: una agenda a la que le faltan citas sin avisar
 * se lee como una agenda más vacía de lo que está, que es la lectura contraria
 * a la que una recepción necesita.
 */
export interface TenantAgenda {
  readonly items: readonly TenantAgendaItem[];
  readonly truncated: boolean;
}

/** Filtros de la agenda de la organización. */
export interface TenantAgendaQuery {
  readonly from: Date;
  readonly to: Date;
  /** Acotar a un profesional; se traduce a sus recursos EN esta organización. */
  readonly practitionerProfileId?: string;
  readonly limit?: number;
}

/** Campos que la organización edita de sí misma. Lo que no viene no se toca. */
export interface OrganizationEdit {
  readonly legalName?: string;
  readonly tradeName?: string;
  readonly timeZone?: string;
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
 * Comparado con `dynamic-enums` el 2026-08-11: los diez códigos coinciden con
 * `directory.tenants.tenant_type_concept_id`. Se mantiene literal a propósito
 * —ver la nota de `organization-new.ts`—, porque este set literal se
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
 * Tipos que operan atendiendo o formando en un territorio. Para ellos el
 * backend **exige** país y jurisdicción (`422 PRECONDITION_FAILED` con
 * `missing` si faltan — verificado contra la API viva): es lo que determina
 * bajo qué regulador operan. `PAYER` y `BROKER` quedan fuera porque su
 * regulador viaja dentro de su propio bloque.
 */
export const TERRITORIAL_TENANT_TYPES: readonly TenantTypeCode[] = [
  'PROVIDER',
  'UNIVERSITY',
  'PHARMACY',
  'HOSPITAL',
  'MEDICAL_OFFICE',
  'NURSING',
  'HEALTH_OTHER',
  'HEALTH_BUSINESS',
];

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
 * País y jurisdicción figuran porque los tipos territoriales **no pueden**
 * crearse sin ellos; se resuelven contra la búsqueda de conceptos de
 * `terminology`. Los demás `*ConceptId` (entidad legal, región de datos)
 * siguen fuera: son opcionales y su value set no está publicado en ningún
 * contrato que el frontend pueda leer — misma decisión que en el alta de
 * paciente. País y jurisdicción **no tienen binding** en `dynamic-enums`
 * (404, comprobado el 2026-08-11): hasta que lo tengan no se pueden acotar.
 */
export interface NewTenant {
  readonly code: string;
  readonly legalName: string;
  /** Usuario que queda como owner inicial. Se elige, nunca se tipea. */
  readonly ownerUserId: string;
  readonly tradeName?: string;
  readonly tenantType: TenantTypeCode;
  readonly timeZone?: string;
  /** Obligatorio para los tipos territoriales; el backend lo hace cumplir. */
  readonly countryConceptId?: string;
  /** Obligatoria para los tipos territoriales. */
  readonly jurisdictionConceptId?: string;
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

/* ---- lecturas dentro de una organización ----------------------------------
   Cuelgan de `/tenants/{id}`, no de `/admin/tenants`, y **no piden rol
   global**: basta pertenecer a la organización. Quien no pertenece recibe
   `403`, y una organización inexistente responde `404` —no `403`— para que el
   código de error no sirva para sondear qué identificadores existen. */

/**
 * Una sucursal (`GET /tenants/{id}/branches`).
 *
 * El endpoint **no pagina**: devuelve las sucursales de la organización en una
 * sola respuesta, con su `count`. La pantalla no promete «Siguientes».
 */
export interface BranchListItem {
  readonly id: string;
  /** Código dentro de la organización. Es sobre lo que ordena el backend. */
  readonly code: string;
  readonly name: string;
  readonly branchTypeConceptId?: string;
  readonly statusConceptId: string;
  readonly timeZone?: string;
  readonly createdAt: Date;
}

/** Respuesta plana de sucursales: sin cursor, con recuento. */
export interface BranchList {
  readonly items: readonly BranchListItem[];
  readonly count: number;
}

/**
 * Una membresía (`GET /tenants/{id}/memberships`).
 *
 * `primaryBranchId`, `startDate` y `endDate` llegan como `null` explícito
 * cuando no hay dato: son nulos del contrato, no ausencias, y se normalizan a
 * `undefined` en la frontera como manda `wire.ts`.
 */
export interface MembershipListItem {
  readonly id: string;
  readonly userId: string;
  readonly tenantRoleConceptId: string;
  readonly statusConceptId: string;
  readonly accessScopeConceptId?: string;
  readonly primaryBranchId?: string;
  readonly startDate?: Date;
  readonly endDate?: Date;
  readonly createdAt: Date;
}

/** Página de membresías. Por cursor, como el listado de organizaciones. */
export interface MembershipPage {
  readonly items: readonly MembershipListItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/** Filtros de `GET /tenants/{id}/memberships`. */
export interface MembershipQuery {
  /** Concepto de estado al que acotar. Es un uuid, no un código. */
  readonly statusConceptId?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

/**
 * Una sucursal asignada a una membresía
 * (`GET /tenants/{id}/memberships/{mid}/branch-assignments`).
 *
 * Devuelve `branchId` crudo: resolver el nombre legible de la sucursal es
 * trabajo del frontend, que ya tiene el listado de sucursales cargado.
 */
export interface BranchAssignmentListItem {
  readonly id: string;
  readonly branchId: string;
  readonly localRoleConceptId?: string;
  readonly statusConceptId: string;
  readonly createdAt: Date;
}

/** Respuesta plana de asignaciones: tampoco pagina. */
export interface BranchAssignmentList {
  readonly items: readonly BranchAssignmentListItem[];
  readonly count: number;
}

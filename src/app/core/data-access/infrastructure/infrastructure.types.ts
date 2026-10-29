/* ============================================================================
    Contratos de la infraestructura hospitalaria — franja F1.

    Espejo de `CONTRATO-F0-F1.md` §2 (conceptos) y §3 (API) del vault de
    documentación (`SALUD/Arquitectura/infraestructura-hospitalaria/`). Todo
    `readonly`: la pantalla proyecta y filtra, nunca muta la respuesta. Las
    fechas viajan como texto ISO y se quedan así — no hay conversión a `Date`
    para que lo que se muestra sea lo que el servidor dijo.

    ## Qué está fijado por el contrato y qué es un supuesto

    El contrato fija las **rutas**, los **cuerpos de petición** y los **errores**.
    De las **respuestas** sólo fija la forma de `CareSpaceNode` y los nombres de
    las partes de `CareSpaceDetail`, `SiteStructure` y del catálogo. Donde la
    forma interna de una respuesta no está escrita, el tipo dice
    «SUPUESTO F1» en su comentario: es lo que este cliente espera y lo que hay
    que confrontar con la API cuando exista (ver `REPORTE.md` de la franja).

    ## Códigos

    Los `code` de los conceptos son los nombres de §2 tal cual:
    `LOC_FORM_ROOM`, `SPACE_FN_OPERATING_ROOM`, `SPACE_ACTIVE`,
    `TYPOLOGY_HEALTH_POST`… Lo que se compara es el código, nunca el rótulo.
    ========================================================================== */

/** Concepto de terminología ya resuelto: código estable y rótulo. */
export interface InfraConcept {
  readonly code: string;
  readonly display: string;
}

/* ---- catálogo — GET /practice/infrastructure-catalog -------------------------- */

/**
 * Perfil de una función de espacio (§2 «Perfil de función»).
 *
 * SUPUESTO F1: el contrato dice «por función → `forms` permitidas y banderas»;
 * se espera el concepto aplanado (`code`, `display`) junto a `forms` (códigos
 * `LOC_FORM_*`) y las diez banderas con los nombres de §2.
 */
export interface FunctionProfile {
  readonly code: string;
  readonly display: string;
  /** Códigos `LOC_FORM_*` bajo los que esta función puede existir. */
  readonly forms: readonly string[];
  readonly schedulable: boolean;
  readonly inpatient: boolean;
  readonly billable: boolean;
  readonly allowOverlap: boolean;
  readonly isolationCapable: boolean;
  readonly stockPoint: boolean;
  readonly hostsEquipment: boolean;
  readonly requiresTerminalCleaning: boolean;
  readonly requiresArea: boolean;
  readonly requiresHvac: boolean;
}

/**
 * Regla padre → hijo entre formas. `parent: null` es la regla de la **raíz**
 * (qué forma puede existir sin padre).
 *
 * SUPUESTO F1: el modelo no puede guardar la raíz en `space_form_parent_rules`
 * (Desvíos del contrato, modelo) y la deja como constante de la API; se espera
 * que el catálogo la exponga con `parent: null`. Si no viniera, el cliente usa
 * `FORMAS_DE_RAIZ` de `infrastructure.logic.ts` como ayuda — la API valida igual.
 */
export interface ParentRule {
  readonly parent: string | null;
  readonly child: string;
}

export type TypologyRuleKind = 'TYPO_ALLOWED' | 'TYPO_REQUIRED';

export interface TypologyRule {
  readonly typology: string;
  readonly function: string;
  readonly rule: TypologyRuleKind;
}

export interface InfrastructureAttributes {
  readonly asepsis: readonly InfraConcept[];
  readonly pressure: readonly InfraConcept[];
  readonly sex: readonly InfraConcept[];
  readonly ageGroup: readonly InfraConcept[];
  readonly bedCategory: readonly InfraConcept[];
  readonly unitRole: readonly InfraConcept[];
}

export interface InfrastructureRegulatoryCatalog {
  readonly subsector: readonly InfraConcept[];
  readonly careLevel: readonly InfraConcept[];
  readonly typology: readonly InfraConcept[];
  readonly sedes: readonly InfraConcept[];
  readonly licenseStatus: readonly InfraConcept[];
  readonly capacityKind: readonly InfraConcept[];
}

export interface InfrastructureCatalog {
  readonly forms: readonly InfraConcept[];
  readonly functions: readonly FunctionProfile[];
  readonly parentRules: readonly ParentRule[];
  readonly typologyRules: readonly TypologyRule[];
  readonly lifecycle: readonly InfraConcept[];
  readonly attributes: InfrastructureAttributes;
  readonly regulatory: InfrastructureRegulatoryCatalog;
}

/* ---- estructura — GET /sites/:siteId/structure ------------------------------- */

/** Datos regulatorios del establecimiento (Bolivia). Cada concepto puede faltar. */
export interface SiteRegulatory {
  readonly snisCode: string | null;
  /** Lo verifica la plataforma, nunca el tenant (Desvíos del modelo, v4.2.67b). */
  readonly snisVerified: boolean;
  readonly subsector: InfraConcept | null;
  readonly careLevel: InfraConcept | null;
  readonly typology: InfraConcept | null;
  readonly managingEntityName: string | null;
  readonly healthNetworkName: string | null;
  readonly sedes: InfraConcept | null;
  readonly municipalityName: string | null;
}

/**
 * Qué puede hacer quien mira, según el servidor.
 *
 * SUPUESTO F1 — **no está en el contrato**. Admin de organización y de
 * sucursal salen de membresías, que el token no trae, así que la interfaz no
 * puede deducirlos. Se pide a la API que lo declare en `SiteSummary.viewer`;
 * mientras no venga, `InfrastructurePermissions` cae al criterio por rol de
 * plataforma. En ambos casos **solo refleja**: la API decide.
 */
export interface SiteViewer {
  readonly canWriteStructure: boolean;
  readonly canEditRegulatory: boolean;
  readonly canSeeHistory: boolean;
}

/** SUPUESTO F1: `SiteSummary` no está definido en el contrato. */
export interface SiteSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly branchId: string | null;
  readonly status: InfraConcept;
  readonly regulatory: SiteRegulatory;
  /** `If-Match` de `PATCH /sites/:siteId/regulatory`. */
  readonly rowVersion: number;
  readonly viewer?: SiteViewer;
}

/** Nodo del árbol físico (§3 `CareSpaceNode`, forma literal del contrato). */
export interface CareSpaceNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly code: string;
  readonly name: string;
  readonly form: InfraConcept;
  readonly function: InfraConcept;
  readonly status: InfraConcept;
  readonly operationalStatus: InfraConcept | null;
  readonly clinicalUnitId: string | null;
  readonly capacity: number | null;
  readonly rowVersion: number;
  readonly childCount: number;
}

/** Nodo del árbol organizativo. SUPUESTO F1: el contrato no lo detalla. */
export interface ClinicalUnitNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly code: string;
  readonly name: string;
  readonly status: InfraConcept;
  readonly rowVersion: number;
}

/** Vínculo espacio ↔ unidad, con vigencia y rol (OWNER · SHARED · LOAN). */
export interface SpaceUnitAssignment {
  readonly id: string;
  readonly careSpaceId: string;
  readonly clinicalUnitId: string;
  readonly role: InfraConcept;
  readonly validFrom: string;
  readonly validTo: string | null;
}

export interface SiteStructure {
  readonly site: SiteSummary;
  readonly spaces: readonly CareSpaceNode[];
  readonly units: readonly ClinicalUnitNode[];
  readonly assignments: readonly SpaceUnitAssignment[];
  /** Momento al que corresponde la lectura: base del estado S7. */
  readonly asOf: string;
}

/* ---- ficha — GET /care-spaces/:id --------------------------------------------- */

export interface SpacePathStep {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly form: InfraConcept;
}

/** Recuentos derivados: se cuentan, nunca se escriben (INV-20). */
export interface SpaceDerived {
  readonly beds: number;
  readonly censableBeds: number;
  readonly activeChildren: number;
}

/**
 * Detalle de un espacio: el nodo, más `path`, `children`, `assignments` y
 * `derived` (§3). SUPUESTO F1: los atributos técnicos viajan como conceptos
 * resueltos (`asepsis`, `pressure`…) y no como `*Code`, igual que `form` y
 * `function` en el nodo; las fechas de vigencia, como texto ISO.
 */
export interface CareSpaceDetail extends CareSpaceNode {
  readonly siteId: string;
  readonly description: string | null;
  readonly floorNumber: number | null;
  readonly areaM2: number | null;
  readonly asepsis: InfraConcept | null;
  readonly pressure: InfraConcept | null;
  readonly airChangesPerHour: number | null;
  readonly hvacValidatedOn: string | null;
  readonly sexRestriction: InfraConcept | null;
  readonly ageGroup: InfraConcept | null;
  readonly bedCategory: InfraConcept | null;
  readonly censable: boolean | null;
  readonly prepMinutes: number | null;
  readonly cleanupMinutes: number | null;
  readonly gln: string | null;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly path: readonly SpacePathStep[];
  readonly children: readonly CareSpaceNode[];
  readonly assignments: readonly SpaceUnitAssignment[];
  readonly derived: SpaceDerived;
}

/**
 * Historial de un espacio (pestaña «Historial»).
 *
 * SUPUESTO F1 — **ruta propuesta, no contratada**: el §3 no define lectura de
 * `audit.care_spaces_history`. `GET /care-spaces/:id/history` es lo que la
 * ficha necesita; si la API no la ofrece, la pestaña muestra su error (S9/S8)
 * en vez de inventar datos. Pendiente de confirmar en «Desvíos».
 */
export interface SpaceHistoryChange {
  readonly field: string;
  readonly from: string | null;
  readonly to: string | null;
}

export type SpaceHistoryAction = 'created' | 'updated' | 'moved' | 'lifecycle_changed';

export interface SpaceHistoryEntry {
  readonly revision: number;
  readonly action: SpaceHistoryAction;
  readonly changedAt: string;
  readonly changedBy: string | null;
  readonly reason: string | null;
  readonly requestId: string | null;
  readonly changes: readonly SpaceHistoryChange[];
}

export interface SpaceHistory {
  readonly entries: readonly SpaceHistoryEntry[];
  readonly asOf: string;
}

/* ---- escritura — cuerpos de petición del §3 ----------------------------------- */

/** Atributos que comparten el alta, la masiva y la edición. */
export interface SpaceAttributesInput {
  readonly description?: string;
  readonly capacity?: number;
  readonly floorNumber?: number;
  readonly areaM2?: number;
  readonly asepsisCode?: string;
  readonly pressureCode?: string;
  readonly airChangesPerHour?: number;
  readonly hvacValidatedOn?: string;
  readonly sexRestrictionCode?: string;
  readonly ageGroupCode?: string;
  readonly bedCategoryCode?: string;
  readonly censable?: boolean;
  readonly prepMinutes?: number;
  readonly cleanupMinutes?: number;
  readonly gln?: string;
}

/**
 * Las claves del alta de un espacio que el `openapi.json` de `dev` todavía no
 * declara: la API de la franja F1 las agrega (§3 del contrato) y el contrato
 * generado es anterior. Como pasa con `REFERRAL_CONTRACT_PENDING_KEYS`, el
 * cliente SÍ las manda a la API real; el simulador las acepta hasta que se
 * regenere el contrato (`yarn contract:refresh`), momento en que este registro
 * se borra.
 */
export const INFRASTRUCTURE_CONTRACT_PENDING_KEYS: readonly string[] = [
  'formCode',
  'functionCode',
  'parentSpaceId',
  'clinicalUnitId',
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
  'activate',
];

/** `POST /sites/:siteId/care-spaces` */
export interface CreateCareSpaceRequest extends SpaceAttributesInput {
  readonly code: string;
  readonly name: string;
  readonly formCode: string;
  readonly functionCode: string;
  readonly parentSpaceId?: string;
  readonly clinicalUnitId?: string;
  /** Nace `SPACE_PLANNED` salvo `activate: true`. */
  readonly activate?: boolean;
}

/** `POST /sites/:siteId/care-spaces/bulk` — máx. 200, todo o nada. */
export interface BulkCreateRequest extends SpaceAttributesInput {
  readonly parentSpaceId: string;
  readonly formCode: string;
  readonly functionCode: string;
  /** `301-{A..H}` o `CAMA-{1..12}`. */
  readonly codePattern: string;
  readonly namePattern: string;
}

export interface BulkCreateResult {
  readonly created: readonly CareSpaceDetail[];
}

/** Una fila ya parseada del CSV; el padre se referencia por **código**. */
export interface ImportRow extends SpaceAttributesInput {
  readonly code: string;
  readonly name: string;
  readonly formCode: string;
  readonly functionCode: string;
  readonly parentCode?: string;
}

export interface ImportRowError {
  readonly field: string;
  readonly reason: string;
}

export interface ImportRowResult {
  /** Número de línea **del archivo** (la cabecera es la 1). */
  readonly line: number;
  readonly status: 'ok' | 'error';
  readonly errors: readonly ImportRowError[];
}

export interface ImportResult {
  readonly ok: boolean;
  readonly rows: readonly ImportRowResult[];
  readonly created?: number;
}

/** `PATCH /care-spaces/:id` — `code` y `formCode` son inmutables si está ACTIVO. */
export interface UpdateCareSpaceRequest extends SpaceAttributesInput {
  readonly name?: string;
  readonly code?: string;
  readonly formCode?: string;
  readonly functionCode?: string;
}

export interface MoveCareSpaceRequest {
  readonly parentSpaceId: string | null;
}

export type LifecycleAction = 'activate' | 'suspend' | 'reactivate' | 'retire';

export interface LifecycleRequest {
  readonly action: LifecycleAction;
  readonly reason?: string;
}

export type RetireBlockerKind =
  | 'ACTIVE_CHILDREN'
  | 'ACTIVE_ENCOUNTER'
  | 'FUTURE_PROCEDURE'
  | 'FUTURE_BOOKING'
  | 'SCHEDULABLE_RESOURCE'
  | 'INVENTORY_LOCATION'
  | 'EQUIPMENT';

export interface RetireBlocker {
  readonly kind: RetireBlockerKind;
  readonly count: number;
  readonly sampleIds: readonly string[];
  /** Qué hacer para resolverlo. Es el texto de S3: nunca se omite. */
  readonly nextAction: string;
}

/** `GET /care-spaces/:id/retire-check`. SUPUESTO F1: `asOf` opcional para S7. */
export interface RetireCheck {
  readonly blockers: readonly RetireBlocker[];
  readonly asOf?: string;
}

export interface AddUnitAssignmentRequest {
  readonly clinicalUnitId: string;
  /** `SPACE_UNIT_ROLE_OWNER` · `SPACE_UNIT_ROLE_SHARED` · `SPACE_UNIT_ROLE_LOAN`. */
  readonly roleCode: string;
}

/* ---- regulatorio, habilitaciones y capacidad ---------------------------------- */

/** `PATCH /sites/:siteId/regulatory`. */
export interface RegulatoryUpdateRequest {
  readonly snisCode?: string;
  readonly subsectorCode?: string;
  readonly careLevelCode?: string;
  readonly typologyCode?: string;
  readonly managingEntityName?: string;
  readonly healthNetworkName?: string;
  readonly sedesCode?: string;
  readonly municipalityName?: string;
}

/** Un espacio que incumple la tipología nueva (`TYPOLOGY_CONFLICT`). */
export interface TypologyConflict {
  readonly spaceId: string;
  readonly code: string;
  readonly name: string;
  readonly functionCode: string;
  readonly rule: string;
}

/**
 * Habilitación del establecimiento. El estado «vencida» lo calcula el servidor
 * al leer (`expiresOn < hoy`, INV-21): la pantalla no lo recalcula con su reloj.
 *
 * SUPUESTO F1: nombres de §1.2 en `camelCase`; el desvío v4.2.67b mueve el
 * almacenamiento a `facility_licenses` pero no cambia la forma de la ruta.
 */
export interface SiteLicense {
  readonly id: string;
  readonly authorityName: string;
  readonly resolutionNumber: string | null;
  readonly issuedOn: string | null;
  readonly expiresOn: string | null;
  readonly status: InfraConcept;
  readonly clinicalUnitId: string | null;
  readonly healthcareServiceId: string | null;
  readonly documentFileId: string | null;
  readonly notes: string | null;
  readonly rowVersion: number;
}

/** `POST /sites/:siteId/licenses` y `PATCH /site-licenses/:id`. */
export interface LicenseInput {
  readonly authorityName: string;
  readonly resolutionNumber?: string;
  readonly issuedOn?: string;
  readonly expiresOn?: string;
  readonly statusCode: string;
  readonly clinicalUnitId?: string;
  readonly healthcareServiceId?: string;
  readonly notes?: string;
}

export interface DeclaredCapacity {
  readonly kindCode: string;
  readonly quantity: number;
  readonly asOf: string;
  readonly resolutionNumber: string | null;
}

export interface DerivedCapacity {
  readonly kindCode: string;
  readonly quantity: number;
}

export interface CapacityGap {
  readonly kindCode: string;
  readonly declared: number;
  readonly derived: number;
}

/** `GET /sites/:siteId/capacity`. SUPUESTO F1: `asOf` opcional para S7. */
export interface SiteCapacity {
  readonly declared: readonly DeclaredCapacity[];
  readonly derived: readonly DerivedCapacity[];
  readonly gaps: readonly CapacityGap[];
  readonly asOf?: string;
}

/** `POST /sites/:siteId/declared-capacities`. */
export interface DeclaredCapacityInput {
  readonly capacityKindCode: string;
  readonly quantity: number;
  readonly asOf: string;
  readonly resolutionNumber?: string;
  readonly validTo?: string;
}

/* ---- errores ------------------------------------------------------------------ */

/**
 * Los `reason` del §3 que la interfaz sabe leer. Viajan en
 * `details.reason` del cuerpo de error (`DomainException`); el `code` del
 * contrato de errores sigue siendo `CONFLICT` / `PRECONDITION_FAILED` /
 * `CONCURRENCY_CONFLICT`, que es lo que ramifica `errorToViewState`.
 */
export const INFRASTRUCTURE_REASONS = [
  'SPACE_CODE_TAKEN',
  'SPACE_RETIRE_BLOCKED',
  'SPACE_IMMUTABLE_FIELD',
  'SPACE_CYCLE',
  'PARENT_NOT_ACTIVE',
  'TYPOLOGY_CONFLICT',
  'SNIS_CODE_UNAVAILABLE',
] as const;

export type InfrastructureReason = (typeof INFRASTRUCTURE_REASONS)[number];

/** Lo que la interfaz extrae de un error de la API de infraestructura. */
export interface InfrastructureErrorDetail {
  readonly status: number;
  readonly reason: InfrastructureReason | null;
  readonly message: string;
  readonly requestId: string | undefined;
  readonly blockers: readonly RetireBlocker[];
  readonly conflicts: readonly TypologyConflict[];
}

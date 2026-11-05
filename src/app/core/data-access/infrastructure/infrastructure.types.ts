/* ============================================================================
    Contratos de la infraestructura hospitalaria — franja F1.

    Espejo de §3 de `CONTRATO-F0-F1.md` (docs de arquitectura,
    `SALUD/Arquitectura/infraestructura-hospitalaria/`). Ese documento manda:
    si un nombre de acá no coincide con el contrato, el defecto es de acá.

    Dos árboles ligados (decisión D2 del plan):

    - el **físico** (`CareSpaceNode`, FHIR `Location`): edificio > pabellón >
      piso > sala > local > cama;
    - el **organizativo** (`ClinicalUnitNode`): servicio, departamento, subárea.

    El vínculo entre los dos es `SpaceUnitAssignment`, con vigencia y rol.

    Los conceptos llegan resueltos (`code` + `display`). **Se compara siempre el
    `code`**, nunca la etiqueta: la etiqueta es texto traducible.
    ========================================================================== */

/** Concepto de terminología ya legible. */
export interface InfraConcept {
  readonly code: string;
  readonly display: string;
}

/**
 * Perfil de una función de espacio (§2 «Perfil de función»).
 *
 * No es una tabla: es una constante de la API expuesta por el catálogo. La
 * pantalla la usa para decidir **qué campos pedir** —área y climatización sólo
 * si la función los exige, categoría de cama sólo si es cama— y qué formas
 * ofrecer. La API vuelve a validar todo: esto sólo evita ofrecer lo imposible.
 */
export interface FunctionProfile extends InfraConcept {
  /** Formas (`LOC_FORM_*`) en las que esta función puede existir. */
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
 * Regla padre → hijo entre formas.
 *
 * `parent: null` es la raíz del establecimiento: sin padre se permiten
 * edificio, área, local y virtual (§2).
 */
export interface ParentRule {
  readonly parent: string | null;
  readonly child: string;
}

/** Regla de tipología: `TYPO_ALLOWED` o `TYPO_REQUIRED`. */
export interface TypologyRule {
  readonly typology: string;
  readonly function: string;
  readonly rule: 'TYPO_ALLOWED' | 'TYPO_REQUIRED' | string;
}

export interface InfrastructureAttributes {
  readonly asepsis: readonly InfraConcept[];
  readonly pressure: readonly InfraConcept[];
  readonly sex: readonly InfraConcept[];
  readonly ageGroup: readonly InfraConcept[];
  readonly bedCategory: readonly InfraConcept[];
  readonly unitRole: readonly InfraConcept[];
}

export interface RegulatoryCatalog {
  readonly subsector: readonly InfraConcept[];
  readonly careLevel: readonly InfraConcept[];
  readonly typology: readonly InfraConcept[];
  readonly sedes: readonly InfraConcept[];
  readonly licenseStatus: readonly InfraConcept[];
  readonly capacityKind: readonly InfraConcept[];
}

/** `GET /practice/infrastructure-catalog`. */
export interface InfrastructureCatalog {
  readonly forms: readonly InfraConcept[];
  readonly functions: readonly FunctionProfile[];
  readonly parentRules: readonly ParentRule[];
  readonly typologyRules: readonly TypologyRule[];
  readonly lifecycle: readonly InfraConcept[];
  readonly attributes: InfrastructureAttributes;
  readonly regulatory: RegulatoryCatalog;
}

/** Datos regulatorios del establecimiento (Bolivia, §2.3 del plan). */
export interface SiteRegulatory {
  readonly snisCode: string | null;
  readonly subsector: InfraConcept | null;
  readonly careLevel: InfraConcept | null;
  readonly typology: InfraConcept | null;
  readonly managingEntityName: string | null;
  readonly healthNetworkName: string | null;
  readonly sedes: InfraConcept | null;
  readonly municipalityName: string | null;
}

/** El establecimiento regulado (`practice_sites`). */
export interface SiteSummary {
  readonly id: string;
  readonly practiceId: string;
  readonly branchId: string | null;
  readonly code: string;
  readonly name: string;
  readonly status: InfraConcept;
  readonly timeZone: string | null;
  readonly regulatory: SiteRegulatory;
  readonly rowVersion: number;
}

/** Un nodo del árbol físico (§3 `CareSpaceNode`). Plano, con `parentId`. */
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

/** Un nodo del árbol organizativo (`clinical_units`). */
export interface ClinicalUnitNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly code: string;
  readonly name: string;
  readonly type: InfraConcept;
  readonly status: InfraConcept;
  readonly description: string | null;
  readonly responsibleUserId: string | null;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly rowVersion: number;
}

/** Vínculo espacio ↔ unidad, con vigencia y rol (OWNER/SHARED/LOAN). */
export interface SpaceUnitAssignment {
  readonly id: string;
  readonly careSpaceId: string;
  readonly clinicalUnitId: string;
  readonly role: InfraConcept;
  readonly validFrom: string;
  readonly validTo: string | null;
}

/** `GET /sites/:siteId/structure` — el árbol plano; el cliente lo arma. */
export interface SiteStructure {
  readonly site: SiteSummary;
  readonly spaces: readonly CareSpaceNode[];
  readonly units: readonly ClinicalUnitNode[];
  readonly assignments: readonly SpaceUnitAssignment[];
  /** ISO-8601: cuándo se armó la respuesta. Lo que alimenta S7. */
  readonly asOf: string;
}

/** Un escalón del camino de un espacio hasta la raíz. */
export interface CareSpacePathStep {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly form: InfraConcept;
}

/** Atributos técnicos y de uso de un espacio. Todos opcionales en el modelo. */
export interface CareSpaceAttributes {
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
}

/** `GET /care-spaces/:id` — nodo + camino + hijos + vínculos + derivados. */
export interface CareSpaceDetail extends CareSpaceNode, CareSpaceAttributes {
  readonly siteId: string;
  readonly path: readonly CareSpacePathStep[];
  readonly children: readonly CareSpaceNode[];
  readonly assignments: readonly SpaceUnitAssignment[];
  readonly derived: {
    readonly beds: number;
    readonly censableBeds: number;
    readonly activeChildren: number;
  };
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
}

/** Campos descriptivos y atributos que viajan en alta, edición y alta masiva. */
export interface CareSpaceAttributesInput {
  readonly description?: string | null;
  readonly capacity?: number | null;
  readonly floorNumber?: number | null;
  readonly areaM2?: number | null;
  readonly asepsisCode?: string | null;
  readonly pressureCode?: string | null;
  readonly airChangesPerHour?: number | null;
  readonly hvacValidatedOn?: string | null;
  readonly sexRestrictionCode?: string | null;
  readonly ageGroupCode?: string | null;
  readonly bedCategoryCode?: string | null;
  readonly censable?: boolean | null;
  readonly prepMinutes?: number | null;
  readonly cleanupMinutes?: number | null;
  readonly gln?: string | null;
  readonly clinicalUnitId?: string | null;
}

/** `POST /sites/:siteId/care-spaces`. */
export interface CreateCareSpaceRequest extends CareSpaceAttributesInput {
  readonly code: string;
  readonly name: string;
  readonly formCode: string;
  readonly functionCode: string;
  readonly parentSpaceId?: string | null;
  /** Sin esto nace `SPACE_PLANNED`. */
  readonly activate?: boolean;
}

/**
 * `PATCH /care-spaces/:id`.
 *
 * `code` y `formCode` sólo se aceptan mientras el espacio no está activo: una
 * vez activo la API responde 422 `SPACE_IMMUTABLE_FIELD`.
 */
export interface UpdateCareSpaceRequest extends CareSpaceAttributesInput {
  readonly name?: string;
  readonly code?: string;
  readonly formCode?: string;
  readonly functionCode?: string;
}

/** `POST /sites/:siteId/care-spaces/bulk` — todo o nada, máx. 200. */
export interface BulkCreateCareSpacesRequest extends CareSpaceAttributesInput {
  readonly parentSpaceId: string;
  readonly formCode: string;
  readonly functionCode: string;
  /** `"301-{A..H}"` o `"CAMA-{1..12}"`. */
  readonly codePattern: string;
  /** El mismo rango en el nombre: `"Cama {A..H}"`. Sin rango, se numera. */
  readonly namePattern: string;
}

export interface BulkCreateCareSpacesResult {
  readonly created: readonly CareSpaceDetail[];
}

/**
 * Una fila del CSV, ya parseada **en el cliente**.
 *
 * `parentCode` referencia al padre por código —existente o de una fila
 * anterior del mismo archivo—, porque quien arma la planilla no conoce ids.
 */
export interface ImportRow extends CareSpaceAttributesInput {
  readonly line: number;
  readonly code: string;
  readonly name: string;
  readonly formCode: string;
  readonly functionCode: string;
  readonly parentCode: string | null;
}

export interface ImportRowError {
  readonly field: string;
  readonly reason: string;
}

export interface ImportRowResult {
  readonly line: number;
  readonly status: 'ok' | 'error';
  readonly errors: readonly ImportRowError[];
}

/** `POST /sites/:siteId/care-spaces/import?dryRun=…`. */
export interface ImportResult {
  readonly ok: boolean;
  readonly rows: readonly ImportRowResult[];
  readonly created?: number;
}

export type LifecycleAction = 'activate' | 'suspend' | 'reactivate' | 'retire';

/** `POST /care-spaces/:id/lifecycle`. `suspend` y `retire` exigen `reason`. */
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

/** La próxima acción de un bloqueo (S3): qué hacer para destrabarlo. */
export interface BlockerNextAction {
  readonly label: string;
  readonly route?: string;
}

/** Un motivo por el que un espacio no se puede retirar. */
export interface RetireBlocker {
  readonly kind: RetireBlockerKind;
  readonly count: number;
  readonly sampleIds: readonly string[];
  readonly nextAction: BlockerNextAction;
}

/** `GET /care-spaces/:id/retire-check` y cuerpo del 409 `SPACE_RETIRE_BLOCKED`. */
export interface RetireCheck {
  readonly blockers: readonly RetireBlocker[];
}

/** `POST /care-spaces/:id/unit-assignments`. Un solo OWNER vigente. */
export interface UnitAssignmentRequest {
  readonly clinicalUnitId: string;
  readonly roleCode: string;
}

/** `PATCH /sites/:siteId/regulatory`. */
export interface UpdateRegulatoryRequest {
  readonly snisCode: string | null;
  readonly subsectorCode: string | null;
  readonly careLevelCode: string | null;
  readonly typologyCode: string | null;
  readonly managingEntityName: string | null;
  readonly healthNetworkName: string | null;
  readonly sedesCode: string | null;
  readonly municipalityName: string | null;
}

/** Una habilitación del establecimiento. */
export interface SiteLicense {
  readonly id: string;
  readonly siteId: string;
  readonly authorityName: string;
  readonly resolutionNumber: string;
  readonly issuedOn: string;
  readonly expiresOn: string | null;
  /** Vencida se calcula **al leer**, si `expiresOn` < hoy. */
  readonly status: InfraConcept;
  readonly clinicalUnitId: string | null;
  readonly healthcareServiceId: string | null;
  readonly documentFileId: string | null;
  readonly notes: string | null;
  readonly rowVersion: number;
}

export interface CreateSiteLicenseRequest {
  readonly authorityName: string;
  readonly resolutionNumber: string;
  readonly issuedOn: string;
  readonly expiresOn?: string | null;
  readonly statusCode: string;
  readonly clinicalUnitId?: string | null;
  readonly notes?: string | null;
}

export type UpdateSiteLicenseRequest = Partial<CreateSiteLicenseRequest>;

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

/** `GET /sites/:siteId/capacity`: declarada (habilitación) vs. real (contada). */
export interface SiteCapacity {
  readonly declared: readonly DeclaredCapacity[];
  readonly derived: readonly DerivedCapacity[];
  readonly gaps: readonly CapacityGap[];
}

export interface DeclareCapacityRequest {
  readonly kindCode: string;
  readonly quantity: number;
  readonly asOf: string;
  readonly resolutionNumber?: string | null;
}

/**
 * Un evento del historial de un espacio.
 *
 * **Desvío anotado en el contrato**: §3 no declara una lectura del historial,
 * aunque §1 exige escribir `audit.care_spaces_history`. La ficha la pide en
 * `GET /care-spaces/:id/history`; si la API no la publica, la pestaña lo dice.
 */
export interface CareSpaceHistoryEntry {
  readonly id: string;
  readonly at: string;
  readonly action: string;
  readonly actorName: string | null;
  readonly reason: string | null;
  readonly summary: string;
  readonly rowVersion: number;
}

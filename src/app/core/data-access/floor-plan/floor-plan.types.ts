/* ============================================================================
    Tipos del plano de planta — CONTRATO-PLANO §3 (franja F1c).

    Copiados del contrato, no reinterpretados. Donde el contrato no fija la
    forma interna de una respuesta, el supuesto está marcado con «SUPUESTO» y
    figura en el REPORTE de la franja.

    **Ausente ≠ nulo.** Una clave que la API no devuelve (`patient`, `card`)
    significa «no autorizado» o «no pedido»; `null` significa «sin valor». La
    interfaz no decide cuál: lo dicen `ViewerCaps` y `inScope`.
    ========================================================================== */

/** Un concepto de catálogo con su código estable. */
export interface PlanConceptRef {
  readonly code: string;
}

/** `ViewerCaps` — lo que la interfaz refleja (CONTRATO-PLANO §3.9). Reflejo, no autoridad. */
export interface ViewerCaps {
  readonly canEditPlan: boolean;
  readonly canSeeState: boolean;
  readonly canSeePatient: boolean;
  readonly canOpenSpaceFile: boolean;
  readonly scope: 'ALL' | 'UNITS' | 'NONE';
  readonly unitIds?: readonly string[];
}

export interface FloorPlanAnchor {
  readonly spaceId: string;
  readonly code: string;
  readonly name: string;
  readonly form: string;
}

/** `FloorPlanSummary` (§3.2). */
export interface FloorPlanSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly anchor: FloorPlanAnchor | null;
  readonly widthM: number;
  readonly heightM: number;
  readonly elevationM: number | null;
  readonly layoutVersion: number;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly counts: { readonly placed: number; readonly unplaced: number; readonly elements: number };
}

/** `FloorPlanMeta` (§3.2). SUPUESTO: suma a `FloorPlanSummary` los campos de la tabla de §1.1. */
export interface FloorPlanMeta extends FloorPlanSummary {
  readonly siteId: string;
  readonly northBearingDeg: number;
  readonly gridSizeM: number;
  readonly snapToGrid: boolean;
  readonly contactToleranceM: number;
  readonly rowVersion: number;
  /** Otros lienzos del mismo edificio, para `PageUp`/`PageDown` y las pestañas por piso. SUPUESTO. */
  readonly siblings?: readonly { readonly id: string; readonly code: string; readonly name: string; readonly elevationM: number | null }[];
}

export type PlacementGeometry =
  | {
      readonly kind: 'RECT';
      readonly centerXM: number;
      readonly centerYM: number;
      readonly widthM: number;
      readonly depthM: number;
      readonly rotationDeg: number;
    }
  | { readonly kind: 'POLYGON'; readonly vertices: readonly (readonly [number, number])[] };

export interface PlanCardTechnical {
  readonly asepsis?: string;
  readonly pressure?: string;
  readonly airChangesPerHour?: number;
  readonly hvacValidatedOn?: string;
  readonly sexRestriction?: string;
  readonly ageGroup?: string;
  readonly bedCategory?: string;
}

/** Datos estáticos de la tarjeta de detalle (`detail=full`, §3.3). */
export interface PlacementCard {
  readonly formDisplay: string;
  readonly functionDisplay: string;
  readonly lifecycle: { readonly code: string; readonly display: string };
  readonly ownerUnit: { readonly id: string; readonly code: string; readonly name: string } | null;
  readonly capacity: number | null;
  readonly bedCount: number | null;
  readonly censableBeds: number | null;
  readonly areaDeclaredM2: number | null;
  readonly technical?: PlanCardTechnical;
  readonly path: readonly { readonly id: string; readonly code: string; readonly name: string; readonly form: string }[];
}

/** `SpacePlacementDTO` (§3.3). Fuera de alcance (`inScope:false`) solo viaja la silueta. */
export interface SpacePlacementDTO {
  readonly placementId: string;
  readonly spaceId: string;
  readonly rowVersion: number;
  readonly zOrder: number;
  readonly locked: boolean;
  readonly geometry: PlacementGeometry;
  readonly bbox: readonly [number, number, number, number];
  readonly areaCalcM2: number;
  readonly inScope: boolean;
  readonly inFocus?: boolean;
  readonly code?: string;
  readonly name?: string;
  readonly parentId?: string | null;
  readonly form?: PlanConceptRef;
  readonly function?: PlanConceptRef;
  readonly card?: PlacementCard;
}

export const PLAN_ELEMENT_KINDS = [
  'WALL',
  'DOOR',
  'WINDOW',
  'OPENING',
  'STAIRS',
  'ELEVATOR',
  'CIRCULATION',
  'COLUMN',
  'ANNOTATION',
] as const;
export type PlanElementKind = (typeof PLAN_ELEMENT_KINDS)[number];

export type DoorSwing = 'LEFT' | 'RIGHT' | 'DOUBLE' | 'SLIDING' | 'NONE';

/** `PlanElementDTO` (§1.3 y §3.3). SUPUESTO: una sola forma con campos opcionales por `kind`. */
export interface PlanElementDTO {
  readonly id: string;
  readonly kind: PlanElementKind;
  readonly rowVersion: number;
  readonly zOrder: number;
  readonly vertices?: readonly (readonly [number, number])[];
  readonly thicknessM?: number;
  readonly hostElementId?: string;
  readonly offsetM?: number;
  readonly widthM?: number;
  readonly swing?: DoorSwing;
  readonly swingSide?: 'A' | 'B';
  readonly connectsSpaceAId?: string | null;
  readonly connectsSpaceBId?: string | null;
  readonly verticalLinkCode?: string;
  readonly label?: string;
}

/** `LayoutResponse` (§3.3). */
export interface LayoutResponse {
  readonly floorPlan: FloorPlanMeta;
  readonly layoutVersion: number;
  readonly asOf: string;
  readonly spaces: readonly SpacePlacementDTO[];
  readonly elements: readonly PlanElementDTO[];
  readonly page: { readonly nextCursor: string | null; readonly total: number };
  readonly focus?: { readonly spaceIds: readonly string[]; readonly bbox: readonly [number, number, number, number] };
  readonly viewer: ViewerCaps;
}

export interface LayoutQuery {
  readonly bbox?: readonly [number, number, number, number];
  readonly detail?: 'lite' | 'full';
  readonly limit?: number;
  readonly cursor?: string | null;
  readonly focusSpaceId?: string;
  readonly unitId?: string;
  readonly unitMode?: 'filter' | 'flag';
  readonly includeRetired?: boolean;
}

/** `SpaceState` (§3.6): `BedBoardCell` de F2 sin identidad. */
export interface SpaceState {
  readonly lifecycle: PlanConceptRef;
  readonly availability: {
    readonly code: string;
    readonly reasonCode?: string;
    readonly reasonText?: string;
    readonly expectedUntil?: string;
    readonly since: string;
  };
  readonly occupancy: {
    readonly code: 'OCC_FREE' | 'OCC_RESERVED' | 'OCC_OCCUPIED';
    readonly since: string;
    /** Ausente = «no autorizado». Nunca se infiere de un `null`. */
    readonly patient?: { readonly initials: string; readonly sexCode: string; readonly ageYears: number };
  };
  readonly hygiene: { readonly code: string; readonly since: string; readonly terminalRequired: boolean };
  readonly isolation: { readonly code: string; readonly organism?: string; readonly since: string };
  readonly v2Code: 'C' | 'H' | 'I' | 'K' | 'O' | 'U' | 'R';
  readonly assignable: boolean;
  readonly openCleaningOrderId?: string;
  readonly lastEventAt: string;
  readonly opsVersion: number;
}

export interface PlanRollup {
  readonly beds: number;
  readonly censable: number;
  readonly occupied: number;
  readonly reserved: number;
  readonly assignable: number;
  readonly blocked: number;
  readonly maintenance: number;
  readonly dirty: number;
  readonly cleaning: number;
  readonly isolation: number;
  readonly contaminated: number;
}

/** `PlanStateResponse` (§3.6). */
export interface PlanStateResponse {
  readonly asOf: string;
  readonly lastEventAt: string | null;
  readonly layoutVersion: number;
  readonly spaces: Readonly<Record<string, SpaceState>>;
  readonly rollups: Readonly<Record<string, PlanRollup>>;
  readonly counts: {
    readonly total: number;
    readonly assignable: number;
    readonly occupied: number;
    readonly reserved?: number;
    readonly blocked?: number;
    readonly maintenance?: number;
    readonly dirty?: number;
    readonly cleaning?: number;
    readonly isolation?: number;
    readonly contaminated?: number;
  };
  readonly viewer: ViewerCaps;
}

export interface PlanStateQuery {
  readonly bbox?: readonly [number, number, number, number];
  readonly focusSpaceId?: string;
  readonly unitId?: string;
}

/** `GET /care-spaces/:id/plan-card` (§3.7). `patient` ausente = no autorizado. */
export interface PlanCardResponse {
  readonly asOf: string;
  readonly patient?: {
    readonly displayName: string;
    readonly initials: string;
    readonly sexCode: string;
    readonly ageYears: number;
    readonly encounterId: string;
    readonly admittedAt: string;
    readonly losDays: number;
    readonly expectedDischargeAt?: string;
  };
  readonly openBlocks: readonly {
    readonly kind: string;
    readonly reasonText?: string;
    readonly startsAt: string;
    readonly expectedEndAt?: string;
  }[];
  readonly openCleaningOrder?: { readonly id: string; readonly type: string; readonly status: string; readonly requestedAt: string };
}

/** `GET /sites/:siteId/plan-search` (§3.5). */
export interface PlanSearchHit {
  readonly spaceId: string;
  readonly code: string;
  readonly name: string;
  readonly path: string;
  readonly floorPlanId: string | null;
  readonly floorPlanName: string | null;
  readonly centerXM: number | null;
  readonly centerYM: number | null;
  readonly bbox: readonly [number, number, number, number] | null;
  readonly placed: boolean;
}

/** `GET /sites/:siteId/plan-focus` (§3.5): una entrada por lienzo. */
export interface PlanFocusEntry {
  readonly floorPlanId: string;
  readonly floorPlanName: string;
  readonly bbox: readonly [number, number, number, number];
  readonly spaceIds: readonly string[];
}

/** `GET /care-spaces/:id/plan-location` (§3.5). */
export interface PlanLocation {
  readonly placed: boolean;
  readonly floorPlanId?: string;
  readonly floorPlanName?: string;
  readonly bbox?: readonly [number, number, number, number];
  readonly centerXM?: number;
  readonly centerYM?: number;
}

export interface PlanUnit {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** Ítem de un `PATCH /layout` (§3.4). */
export interface PlacementUpsert {
  readonly spaceId: string;
  readonly geometry: PlacementGeometry;
  readonly zOrder?: number;
  readonly locked?: boolean;
  readonly expectedRowVersion?: number;
}

export interface ElementUpsert extends Omit<PlanElementDTO, 'id' | 'rowVersion' | 'zOrder'> {
  /** El cliente genera el id de los nuevos (UUID v4): reintentar es idempotente. */
  readonly id?: string;
  readonly zOrder?: number;
  readonly expectedRowVersion?: number;
}

export interface LayoutPatch {
  readonly upsert?: {
    readonly placements?: readonly PlacementUpsert[];
    readonly elements?: readonly ElementUpsert[];
  };
  readonly remove?: {
    readonly spaceIds?: readonly string[];
    readonly elementIds?: readonly string[];
    readonly cascade?: boolean;
  };
}

export interface LayoutWarning {
  readonly code: 'AREA_MISMATCH';
  readonly spaceId: string;
  readonly declaredM2: number;
  readonly calculatedM2: number;
  readonly deviationPct: number;
  readonly tolerancePct: number;
}

/** Respuesta 200 de `PATCH /layout` (§3.4). */
export interface LayoutApplyResponse {
  readonly layoutVersion: number;
  readonly applied: {
    readonly placed: number;
    readonly moved: number;
    readonly removed: number;
    readonly elementsUpserted: number;
    readonly elementsRemoved: number;
  };
  readonly warnings: readonly LayoutWarning[];
  readonly requestId: string;
}

/** Un error por elemento de `PLAN_LAYOUT_INVALID` (§3.4): es el S3/S4 del editor. */
export interface LayoutItemError {
  readonly kind: 'SPACE' | 'ELEMENT' | 'CANVAS';
  readonly id: string;
  readonly code: string;
  readonly field?: 'geometry' | 'parent' | 'host' | 'size';
  readonly message: string;
  readonly conflictsWith?: readonly {
    readonly kind: 'SPACE' | 'ELEMENT';
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly overlapAreaM2?: number;
  }[];
  readonly nextAction?: { readonly label: string; readonly hint: string };
}

export interface PlanValidationIssue {
  readonly severity: 'ERROR' | 'WARNING';
  readonly code: string;
  readonly subjectId: string;
  readonly otherId?: string;
  readonly detail: string;
}

/** Una fila de la paleta de espacios sin ubicar (§3.5). */
export interface UnplacedSpace {
  readonly spaceId: string;
  readonly code: string;
  readonly name: string;
  readonly depth: number;
  readonly form: string;
  readonly function: string;
  readonly parentId: string | null;
  readonly placeable: boolean;
  readonly reason?: string;
}

export interface PlanCatalog {
  readonly limits: {
    readonly maxVertices: number;
    readonly maxCoordinateM: number;
    readonly minRectSideM: number;
    readonly maxItemsPerPatch: number;
    readonly maxItemsPerReplace: number;
    readonly maxPageSize: number;
  };
  readonly defaults: { readonly gridSizeM: number; readonly snapToGrid: boolean; readonly contactToleranceM: number };
  readonly stateLayers: readonly string[];
  readonly elementKinds: readonly PlanElementKind[];
}

/** Lo que el cliente expone de un fallo del plano (§3.4, §2). */
export interface PlanFailure {
  readonly status: number;
  readonly reason: string | null;
  readonly requestId: string | null;
  readonly message: string | null;
  readonly errors: readonly LayoutItemError[];
  /** `PLAN_VERSION_MISMATCH` / 412. */
  readonly currentVersion: number | null;
  readonly changedSummary: string | null;
  readonly requiredRoles: readonly string[];
}

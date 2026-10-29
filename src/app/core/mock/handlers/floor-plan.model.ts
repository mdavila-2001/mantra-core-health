import { rectVertices, bboxOf, polygonArea, type Point } from '../../floor-plan/geometry';
import { AVAILABILITY, HYGIENE, LIFECYCLE, OCCUPANCY } from '../../data-access/floor-plan/floor-plan.codes';
import type {
  PlacementCard,
  PlacementGeometry,
  PlanCardResponse,
  PlanElementDTO,
  PlanElementKind,
  SpacePlacementDTO,
  SpaceState,
  ViewerCaps,
} from '../../data-access/floor-plan/floor-plan.types';
import {
  ESTAC_VERTICES,
  SEED_ELEMENTS,
  SEED_SPACES,
  SEED_SPACE_BY_KEY,
  UNIT_ROWS,
  placementId,
  planId,
  spaceId,
  unitId,
  type SeedSpace,
} from '../fixtures/floor-plan.seed';
import { MockOpsState } from '../fixtures/floor-plan.state';

/* ============================================================================
    El «servidor» del plano de ejemplo: lienzos, ubicaciones y elementos en
    memoria, con la proyección de roles de CONTRATO-PLANO §4.

    Nada de acá corre en producción: es el backend simulado (`mockBackend`).
    La validación de un guardado reutiliza la librería de geometría del cliente,
    de modo que **no es una segunda opinión independiente**: sirve para ejercitar
    los caminos de error de la pantalla, no para probar la geometría (eso lo
    prueba `shared/floor-plan/geometry.spec.ts`). La autoridad real es la base
    de datos y la API.
    ========================================================================== */

export type PlanCode = 'PB' | 'P1' | 'CP';
export type PlanRole = 'SA' | 'AO' | 'AS' | 'ENF' | 'ADM' | 'LIM' | 'MAN' | 'JQ' | 'FAC' | 'PRO';
export const PLAN_ROLES: readonly PlanRole[] = ['SA', 'AO', 'AS', 'ENF', 'ADM', 'LIM', 'MAN', 'JQ', 'FAC', 'PRO'];

export interface Actor {
  readonly role: PlanRole;
  readonly userId: string;
  readonly caps: ViewerCaps;
  /** Códigos de unidad del alcance cuando `scope === 'UNITS'`. */
  readonly unitCodes: readonly string[];
  /** Rol sin atributos administrativos (Limpieza). */
  readonly hideAdministrative: boolean;
  readonly showTechnical: boolean;
}

/** Matriz de §4, traducida a capacidades del visor. */
export function actorFor(role: PlanRole, userId: string): Actor {
  const edit = role === 'SA' || role === 'AO' || role === 'AS';
  const patient = role === 'ENF' || role === 'ADM';
  const units: Partial<Record<PlanRole, string[]>> = { ENF: ['MED'], JQ: ['QX'] };
  const scopedUnits = units[role];
  const caps: ViewerCaps = {
    canEditPlan: edit,
    canSeeState: role !== 'FAC',
    canSeePatient: patient,
    canOpenSpaceFile: true,
    scope: scopedUnits ? 'UNITS' : 'ALL',
    ...(scopedUnits ? { unitIds: scopedUnits.map(unitId) } : {}),
  };
  return {
    role,
    userId,
    caps,
    unitCodes: scopedUnits ?? [],
    hideAdministrative: role === 'LIM',
    showTechnical: role !== 'LIM',
  };
}

export function inScope(actor: Actor, space: SeedSpace): boolean {
  if (actor.caps.scope === 'ALL') return true;
  if (actor.caps.scope === 'NONE') return false;
  return space.unit !== null && actor.unitCodes.includes(space.unit);
}

export interface PlacementRec {
  key: string;
  plan: PlanCode;
  geometry: PlacementGeometry;
  zOrder: number;
  locked: boolean;
  rowVersion: number;
}

export interface ElementRec {
  id: string;
  plan: PlanCode;
  kind: PlanElementKind;
  zOrder: number;
  rowVersion: number;
  vertices?: readonly (readonly [number, number])[];
  thicknessM?: number;
  hostElementId?: string;
  offsetM?: number;
  widthM?: number;
  swing?: PlanElementDTO['swing'];
  swingSide?: 'A' | 'B';
  connectsSpaceAId?: string | null;
  verticalLinkCode?: string;
  label?: string;
}

export interface PlanRec {
  code: PlanCode;
  layoutVersion: number;
  rowVersion: number;
}

export const FUNCTION_DISPLAY: Readonly<Record<string, string>> = {
  BUILDING_GENERIC: 'Edificio', LEVEL_GENERIC: 'Piso', AREA_GENERIC: 'Área', WARD_GENERIC: 'Sala de internación',
  CONSULTING_ROOM: 'Consultorio', EMERGENCY_BOX: 'Box de emergencia', IMAGING_ROOM: 'Sala de imagenología',
  OBSERVATION: 'Observación', PROCEDURE_ROOM: 'Sala de procedimientos', SAMPLE_COLLECTION: 'Toma de muestras',
  LAB_AREA: 'Área de laboratorio', PHARMACY: 'Dispensación de farmacia', STORAGE: 'Depósito',
  OFFICE_ADMIN: 'Oficina administrativa', WAITING: 'Sala de espera', INPATIENT_ROOM: 'Habitación de internación',
  ISOLATION_AIIR: 'Aislamiento de presión negativa', NURSE_STATION: 'Control de enfermería',
  DELIVERY_ROOM: 'Sala de partos', OPERATING_ROOM: 'Quirófano', STERILIZATION: 'Esterilización',
  RECOVERY_PACU: 'Recuperación posanestésica', ICU_BAY: 'Terapia intermedia', BED_STANDARD: 'Cama estándar',
  BED_ICU: 'Cama de terapia intermedia',
};
export const FORM_DISPLAY: Readonly<Record<string, string>> = {
  BUILDING: 'Edificio', LEVEL: 'Nivel', AREA: 'Área', WARD: 'Sala', ROOM: 'Local', BED: 'Cama',
};
const LIFECYCLE_DISPLAY: Readonly<Record<string, string>> = {
  [LIFECYCLE.PLANNED]: 'Planificado', [LIFECYCLE.ACTIVE]: 'Activo', [LIFECYCLE.SUSPENDED]: 'Suspendido', [LIFECYCLE.RETIRED]: 'Clausurado',
};

/** Atributos técnicos de DEMOSTRACIÓN (no salen de ninguna norma). */
const TECHNICAL: Readonly<Record<string, NonNullable<PlacementCard['technical']>>> = {
  'P1-AIS': { asepsis: 'Aislamiento respiratorio', pressure: 'Negativa', airChangesPerHour: 12, hvacValidatedOn: '2026-09-14', bedCategory: 'Estándar' },
  'P1-QX1': { asepsis: 'Quirúrgica', pressure: 'Positiva', airChangesPerHour: 20, hvacValidatedOn: '2026-08-02' },
  'P1-QX2': { asepsis: 'Quirúrgica', pressure: 'Positiva', airChangesPerHour: 20, hvacValidatedOn: '2026-08-02' },
  'P1-UTI': { asepsis: 'Crítica', pressure: 'Neutra', airChangesPerHour: 8, bedCategory: 'Terapia intermedia' },
  'P1-PA1': { sexRestriction: 'Femenino', asepsis: 'Quirúrgica' },
  'P1-PA2': { sexRestriction: 'Femenino', asepsis: 'Quirúrgica' },
  'P1-401': { sexRestriction: 'Femenino', bedCategory: 'Estándar' },
  'P1-301': { ageGroup: 'Pediátrico', bedCategory: 'Estándar' },
  'P1-302': { ageGroup: 'Pediátrico', bedCategory: 'Estándar' },
  'P1-303': { ageGroup: 'Pediátrico', bedCategory: 'Estándar' },
  'P1-101': { bedCategory: 'Estándar' },
  'P1-102': { bedCategory: 'Estándar' },
  'PB-OBS': { bedCategory: 'Observación' },
  'PB-RX': { asepsis: 'Radiológica', pressure: 'Neutra' },
};

function rectOf(space: SeedSpace): PlacementGeometry {
  return { kind: 'RECT', centerXM: space.x + space.w / 2, centerYM: space.y + space.d / 2, widthM: space.w, depthM: space.d, rotationDeg: 0 };
}

export function verticesOf(geometry: PlacementGeometry): Point[] {
  return geometry.kind === 'RECT'
    ? rectVertices(geometry.centerXM, geometry.centerYM, geometry.widthM, geometry.depthM, geometry.rotationDeg)
    : geometry.vertices.map(([x, y]) => [x, y] as Point);
}

const round = (value: number, digits = 3): number => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

export class FloorPlanModel {
  readonly plans = new Map<PlanCode, PlanRec>();
  readonly placements = new Map<string, PlacementRec>();
  readonly elements = new Map<string, ElementRec>();
  readonly ops: MockOpsState;
  /** Auditoría de lecturas de paciente: `PLAN_OCCUPANT_VIEWED`, deduplicada 60 s por usuario y espacio. */
  readonly occupantViews: { userId: string; spaceId: string; at: number }[] = [];

  constructor(bootMs: number = Date.now()) {
    this.ops = new MockOpsState(bootMs);
    for (const code of ['PB', 'P1', 'CP'] as const) this.plans.set(code, { code, layoutVersion: 1, rowVersion: 1 });
    for (const s of SEED_SPACES) {
      if (s.canvas === null) continue;
      this.placements.set(s.key, {
        key: s.key,
        plan: s.canvas,
        geometry: s.key === 'ESTAC' ? { kind: 'POLYGON', vertices: ESTAC_VERTICES } : rectOf(s),
        zOrder: s.form === 'AREA' || s.form === 'WARD' || s.form === 'BUILDING' ? 0 : s.form === 'BED' ? 20 : 10,
        locked: false,
        rowVersion: 1,
      });
    }
    for (const e of SEED_ELEMENTS) {
      this.elements.set(e.id, {
        id: e.id, plan: e.canvas, kind: e.kind, zOrder: e.zOrder, rowVersion: 1,
        ...(e.vertices ? { vertices: e.vertices } : {}),
        ...(e.thicknessM !== undefined ? { thicknessM: e.thicknessM } : {}),
        ...(e.hostId ? { hostElementId: e.hostId } : {}),
        ...(e.offsetM !== undefined ? { offsetM: e.offsetM } : {}),
        ...(e.widthM !== undefined ? { widthM: e.widthM } : {}),
        ...(e.swing ? { swing: e.swing, swingSide: 'A' as const } : {}),
        ...(e.connectsKey ? { connectsSpaceAId: spaceId(e.connectsKey) } : {}),
        ...(e.verticalLinkCode ? { verticalLinkCode: e.verticalLinkCode } : {}),
        ...(e.label ? { label: e.label } : {}),
      });
    }
  }

  /* ---- identidad ----------------------------------------------------------- */

  keyOfSpaceId(id: string): string | null {
    for (const s of SEED_SPACES) if (spaceId(s.key) === id) return s.key;
    return null;
  }

  planCodeOfId(id: string): PlanCode | null {
    for (const code of ['PB', 'P1', 'CP'] as const) if (planId(code) === id) return code;
    return null;
  }

  descendantsOf(key: string): SeedSpace[] {
    const out: SeedSpace[] = [];
    const walk = (k: string): void => {
      for (const s of SEED_SPACES) {
        if (s.parent === k) {
          out.push(s);
          walk(s.key);
        }
      }
    };
    walk(key);
    return out;
  }

  ancestorsOf(key: string): SeedSpace[] {
    const out: SeedSpace[] = [];
    let parent = SEED_SPACE_BY_KEY.get(key)?.parent ?? null;
    while (parent !== null) {
      const p = SEED_SPACE_BY_KEY.get(parent)!;
      out.unshift(p);
      parent = p.parent;
    }
    return out;
  }

  /* ---- DTO ------------------------------------------------------------------ */

  lifecycleOf(key: string): string {
    return this.ops.states.get(key)?.lifecycle ?? LIFECYCLE.ACTIVE;
  }

  cardOf(key: string, actor: Actor): PlacementCard {
    const space = SEED_SPACE_BY_KEY.get(key)!;
    const beds = this.descendantsOf(key).filter((d) => d.form === 'BED');
    const isBed = space.form === 'BED';
    const lifecycle = this.lifecycleOf(key);
    const technical = TECHNICAL[key];
    return {
      formDisplay: FORM_DISPLAY[space.form] ?? space.form,
      functionDisplay: FUNCTION_DISPLAY[space.fn] ?? space.fn,
      lifecycle: { code: lifecycle, display: LIFECYCLE_DISPLAY[lifecycle] ?? lifecycle },
      ownerUnit: !actor.hideAdministrative && space.unit ? { id: unitId(space.unit), code: space.unit, name: UNIT_ROWS.find((u) => u[0] === space.unit)![1] } : null,
      capacity: isBed ? 1 : beds.length > 0 ? beds.length : null,
      bedCount: isBed ? null : beds.length > 0 ? beds.length : null,
      censableBeds: isBed ? null : beds.length > 0 ? beds.length : null,
      areaDeclaredM2: actor.hideAdministrative ? null : (space.declared ?? (space.canvas ? round(space.w * space.d, 2) : null)),
      ...(actor.showTechnical && technical ? { technical } : {}),
      path: this.ancestorsOf(key).map((a) => ({ id: spaceId(a.key), code: `PLANO-${a.key}`, name: a.name, form: a.form })),
    };
  }

  placementDto(rec: PlacementRec, actor: Actor, detail: 'lite' | 'full', inFocus?: boolean): SpacePlacementDTO {
    const space = SEED_SPACE_BY_KEY.get(rec.key)!;
    const vertices = verticesOf(rec.geometry);
    const box = bboxOf(vertices);
    const base = {
      placementId: placementId(rec.key),
      spaceId: spaceId(rec.key),
      rowVersion: rec.rowVersion,
      zOrder: rec.zOrder,
      locked: rec.locked,
      geometry: rec.geometry,
      bbox: [round(box[0]), round(box[1]), round(box[2]), round(box[3])] as const,
      areaCalcM2: round(polygonArea(vertices), 2),
      ...(inFocus === undefined ? {} : { inFocus }),
    };
    if (!inScope(actor, space)) return { ...base, inScope: false };
    return {
      ...base,
      inScope: true,
      code: `PLANO-${space.key}`,
      name: space.name,
      parentId: space.parent === null ? null : spaceId(space.parent),
      form: { code: space.form },
      function: { code: space.fn },
      ...(detail === 'full' ? { card: this.cardOf(rec.key, actor) } : {}),
    };
  }

  elementDto(rec: ElementRec): PlanElementDTO {
    return {
      id: rec.id, kind: rec.kind, rowVersion: rec.rowVersion, zOrder: rec.zOrder,
      ...(rec.vertices ? { vertices: rec.vertices } : {}),
      ...(rec.thicknessM !== undefined ? { thicknessM: rec.thicknessM } : {}),
      ...(rec.hostElementId ? { hostElementId: rec.hostElementId } : {}),
      ...(rec.offsetM !== undefined ? { offsetM: rec.offsetM } : {}),
      ...(rec.widthM !== undefined ? { widthM: rec.widthM } : {}),
      ...(rec.swing ? { swing: rec.swing, swingSide: rec.swingSide ?? 'A' } : {}),
      ...(rec.connectsSpaceAId !== undefined ? { connectsSpaceAId: rec.connectsSpaceAId } : {}),
      ...(rec.verticalLinkCode ? { verticalLinkCode: rec.verticalLinkCode } : {}),
      ...(rec.label ? { label: rec.label } : {}),
    };
  }

  placementsOf(plan: PlanCode): PlacementRec[] {
    return [...this.placements.values()].filter((p) => p.plan === plan);
  }

  elementsOf(plan: PlanCode): ElementRec[] {
    return [...this.elements.values()].filter((e) => e.plan === plan);
  }

  /* ---- estado --------------------------------------------------------------- */

  /** Estado visible para el actor: nunca serializa `patient` si el rol no lo tiene (ausente ≠ nulo). */
  stateFor(key: string, actor: Actor, nowMs: number): SpaceState | null {
    const state = this.ops.stateOf(key, nowMs);
    if (state === null) return null;
    if (actor.caps.canSeePatient || state.occupancy.patient === undefined) return state;
    const { patient: _omit, ...occupancy } = state.occupancy;
    void _omit;
    return { ...state, occupancy };
  }

  cardResponse(key: string, actor: Actor, nowMs: number): PlanCardResponse {
    const state = this.ops.stateOf(key, nowMs);
    const source = this.ops.states.get(key);
    const seed = source?.occupancy.patient;
    const space = SEED_SPACE_BY_KEY.get(key)!;
    const canSee = actor.caps.canSeePatient && inScope(actor, space) && seed !== undefined;
    const blocks: PlanCardResponse['openBlocks'] =
      state && state.availability.code !== AVAILABILITY.AVAILABLE
        ? [{
            kind: state.availability.code,
            ...(state.availability.reasonText ? { reasonText: state.availability.reasonText } : {}),
            startsAt: state.availability.since,
            ...(state.availability.expectedUntil ? { expectedEndAt: state.availability.expectedUntil } : {}),
          }]
        : [];
    return {
      asOf: new Date(nowMs).toISOString(),
      ...(canSee && seed
        ? {
            patient: {
              displayName: seed.displayName,
              initials: seed.initials,
              sexCode: seed.sexCode,
              ageYears: seed.ageYears,
              encounterId: seed.encounterId,
              admittedAt: new Date(nowMs - seed.admittedDaysAgo * 86_400_000).toISOString(),
              losDays: seed.admittedDaysAgo,
              ...(seed.expectedDischargeInDays ? { expectedDischargeAt: new Date(nowMs + seed.expectedDischargeInDays * 86_400_000).toISOString() } : {}),
            },
          }
        : {}),
      openBlocks: blocks,
      ...(state?.openCleaningOrderId
        ? { openCleaningOrder: { id: state.openCleaningOrderId, type: state.hygiene.terminalRequired ? 'TERMINAL' : 'DISCHARGE', status: state.hygiene.code === HYGIENE.CLEANING ? 'IN_PROGRESS' : 'PENDING', requestedAt: state.hygiene.since } }
        : {}),
    };
  }

  /** ¿Algún descendiente (o el propio espacio) tiene ocupación activa? (INV-PL-12) */
  hasActiveOccupancy(key: string): boolean {
    return [key, ...this.descendantsOf(key).map((d) => d.key)].some(
      (k) => SEED_SPACE_BY_KEY.get(k)?.form === 'BED' && this.ops.states.get(k)?.occupancy.code === OCCUPANCY.OCCUPIED,
    );
  }
}

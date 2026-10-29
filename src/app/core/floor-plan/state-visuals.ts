/* ============================================================================
    Cómo se ve cada estado del plano — CONTRATO-PLANO §5.4.

    **Nunca solo color.** Cada valor de cada eje trae color (un rol semántico del
    sistema, no un hex) + patrón de relleno + glifo + texto. Verde y rojo jamás
    son la única señal: cada eje cambia además de patrón o de glifo.

    Este módulo es datos puros: la pantalla los pinta con clases CSS que usan los
    tokens `--st-*`, y las pruebas fijan que ningún valor se distinga únicamente
    por color.
    ========================================================================== */

import { AVAILABILITY, HYGIENE, ISOLATION, LIFECYCLE, OCCUPANCY } from '../data-access/floor-plan/floor-plan.codes';
import type { PlanRollup, SpaceState } from '../data-access/floor-plan/floor-plan.types';

/** Roles semánticos del sistema que se usan como relleno. */
export type PlanTone = 'success' | 'info' | 'warning' | 'error' | 'neutral' | 'accent' | 'primary' | 'secondary';

export type PlanPattern = 'solid' | 'solid-strong' | 'dotted-outline' | 'diagonal' | 'cross' | 'dots' | 'hstripes' | 'grid' | 'none';

export type PlanGlyph =
  | 'person'
  | 'clock'
  | 'lock'
  | 'wrench'
  | 'slash'
  | 'broom'
  | 'drop'
  | 'biohazard'
  | 'isolation'
  | 'check'
  | 'pause'
  | 'bed'
  | 'unit';

export type PlanBorder = 'solid' | 'dashed-thick' | 'dotted';

export interface StateVisual {
  /** Clave estable (`occupancy:OCC_OCCUPIED`): sirve de filtro de leyenda y de atributo del nodo. */
  readonly key: string;
  readonly label: string;
  readonly tone: PlanTone;
  readonly pattern: PlanPattern;
  readonly glyph: PlanGlyph | null;
  readonly border: PlanBorder;
  /** Letra que acompaña al glifo de aislamiento (C, G, A, P). */
  readonly mark?: string;
  /** Un tono más intenso (mantenimiento frente a bloqueo). */
  readonly strong?: boolean;
  /** Atenuado: el valor «normal» no debe competir con las excepciones. */
  readonly quiet?: boolean;
}

export const COLOR_MODES = ['lifecycle', 'availability', 'occupancy', 'hygiene', 'isolation', 'v2', 'unit', 'function', 'none'] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

export const COLOR_MODE_LABEL: Readonly<Record<ColorMode, string>> = {
  lifecycle: 'Ciclo de vida',
  availability: 'Disponibilidad',
  occupancy: 'Ocupación',
  hygiene: 'Higiene',
  isolation: 'Aislamiento',
  v2: 'Estado operativo',
  unit: 'Unidad clínica',
  function: 'Función',
  none: 'Ninguno',
};

/** Modos que dependen del estado operativo (la API puede negarlo al rol). */
export const STATE_MODES: readonly ColorMode[] = ['availability', 'occupancy', 'hygiene', 'isolation', 'v2'];

const v = (
  axis: string,
  code: string,
  label: string,
  tone: PlanTone,
  pattern: PlanPattern,
  glyph: PlanGlyph | null,
  extra: Partial<Pick<StateVisual, 'border' | 'mark' | 'strong' | 'quiet'>> = {},
): StateVisual => ({ key: `${axis}:${code}`, label, tone, pattern, glyph, border: extra.border ?? 'solid', ...extra });

export const LIFECYCLE_VISUALS: readonly StateVisual[] = [
  v('lifecycle', LIFECYCLE.PLANNED, 'Planificado', 'neutral', 'dots', 'clock'),
  v('lifecycle', LIFECYCLE.ACTIVE, 'Activo', 'success', 'solid', 'check', { quiet: true }),
  v('lifecycle', LIFECYCLE.SUSPENDED, 'Suspendido', 'warning', 'diagonal', 'pause'),
  v('lifecycle', LIFECYCLE.RETIRED, 'Clausurado', 'neutral', 'dots', 'slash'),
];

export const AVAILABILITY_VISUALS: readonly StateVisual[] = [
  v('availability', AVAILABILITY.AVAILABLE, 'Disponible', 'success', 'solid', null),
  v('availability', AVAILABILITY.BLOCKED_CLINICAL, 'Bloqueada · clínica', 'warning', 'diagonal', 'lock'),
  v('availability', AVAILABILITY.BLOCKED_ADMIN, 'Bloqueada · administrativa', 'warning', 'diagonal', 'lock'),
  v('availability', AVAILABILITY.MAINTENANCE, 'Mantenimiento', 'warning', 'cross', 'wrench', { strong: true }),
  v('availability', AVAILABILITY.CLOSED, 'Cerrada', 'neutral', 'dots', 'slash', { border: 'dotted' }),
];

export const OCCUPANCY_VISUALS: readonly StateVisual[] = [
  v('occupancy', OCCUPANCY.FREE, 'Libre', 'success', 'solid', null),
  v('occupancy', OCCUPANCY.RESERVED, 'Reservada', 'info', 'dotted-outline', 'clock', { border: 'dotted' }),
  v('occupancy', OCCUPANCY.OCCUPIED, 'Ocupada', 'info', 'solid-strong', 'person'),
];

export const HYGIENE_VISUALS: readonly StateVisual[] = [
  v('hygiene', HYGIENE.INSPECTED, 'Inspeccionada', 'success', 'solid', 'check'),
  v('hygiene', HYGIENE.CLEAN, 'Limpia', 'success', 'solid', 'check'),
  v('hygiene', HYGIENE.DIRTY, 'Sucia', 'accent', 'hstripes', 'broom'),
  v('hygiene', HYGIENE.CLEANING, 'En limpieza', 'accent', 'hstripes', 'drop'),
  v('hygiene', HYGIENE.CONTAMINATED, 'Contaminada', 'error', 'grid', 'biohazard', { strong: true }),
];

export const ISOLATION_VISUALS: readonly StateVisual[] = [
  v('isolation', ISOLATION.NONE, 'Sin aislamiento', 'neutral', 'none', null, { quiet: true }),
  v('isolation', ISOLATION.CONTACT, 'Aislamiento por contacto', 'error', 'none', 'isolation', { border: 'dashed-thick', mark: 'C' }),
  v('isolation', ISOLATION.DROPLET, 'Aislamiento por gotas', 'error', 'none', 'isolation', { border: 'dashed-thick', mark: 'G' }),
  v('isolation', ISOLATION.AIRBORNE, 'Aislamiento aéreo', 'error', 'none', 'isolation', { border: 'dashed-thick', mark: 'A' }),
  v('isolation', ISOLATION.PROTECTIVE, 'Aislamiento protector', 'error', 'none', 'isolation', { border: 'dashed-thick', mark: 'P' }),
];

/** HL7 v2-0116 con la extensión local R (CONTRATO-F2-F5 §F2.2). */
export const V2_VISUALS: readonly StateVisual[] = [
  v('v2', 'U', 'Libre y lista (U)', 'success', 'solid', null),
  v('v2', 'O', 'Ocupada (O)', 'info', 'solid-strong', 'person'),
  v('v2', 'R', 'Reservada (R)', 'info', 'dotted-outline', 'clock', { border: 'dotted' }),
  v('v2', 'H', 'Por limpiar (H)', 'accent', 'hstripes', 'broom'),
  v('v2', 'I', 'Aislamiento (I)', 'error', 'none', 'isolation', { border: 'dashed-thick' }),
  v('v2', 'K', 'Contaminada (K)', 'error', 'grid', 'biohazard', { strong: true }),
  v('v2', 'C', 'No disponible (C)', 'neutral', 'dots', 'slash', { border: 'dotted' }),
];

export const NO_STATE_VISUAL: StateVisual = {
  key: 'none:none', label: 'Sin estado', tone: 'neutral', pattern: 'none', glyph: null, border: 'solid', quiet: true,
};

const BY_MODE: Readonly<Partial<Record<ColorMode, readonly StateVisual[]>>> = {
  lifecycle: LIFECYCLE_VISUALS,
  availability: AVAILABILITY_VISUALS,
  occupancy: OCCUPANCY_VISUALS,
  hygiene: HYGIENE_VISUALS,
  isolation: ISOLATION_VISUALS,
  v2: V2_VISUALS,
};

/** Los valores de un eje, en el orden de la leyenda. */
export function legendValues(mode: ColorMode): readonly StateVisual[] {
  return BY_MODE[mode] ?? [];
}

const INDEX: ReadonlyMap<string, StateVisual> = new Map(
  Object.values(BY_MODE).flatMap((list) => (list ?? []).map((visual) => [visual.key, visual] as const)),
);

export function visualByKey(key: string): StateVisual | undefined {
  return INDEX.get(key);
}

/** El código de concepto que corresponde a un eje en un `SpaceState`. */
export function axisCode(mode: ColorMode, state: SpaceState): string | undefined {
  switch (mode) {
    case 'lifecycle':
      return state.lifecycle.code;
    case 'availability':
      return state.availability.code;
    case 'occupancy':
      return state.occupancy.code;
    case 'hygiene':
      return state.hygiene.code;
    case 'isolation':
      return state.isolation.code;
    case 'v2':
      return state.v2Code;
    default:
      return undefined;
  }
}

/** El visual de un espacio para un eje; `NO_STATE_VISUAL` si no tiene estado o su valor no se conoce. */
export function stateVisual(mode: ColorMode, state: SpaceState | undefined): StateVisual {
  if (state === undefined) return NO_STATE_VISUAL;
  const code = axisCode(mode, state);
  if (code === undefined) return NO_STATE_VISUAL;
  return INDEX.get(`${mode}:${code}`) ?? NO_STATE_VISUAL;
}

/* ---- unidad clínica y función ----------------------------------------------- */

/** Tonos del sistema que se reparten entre unidades; con el patrón alternado dan 14 combinaciones. */
const CATEGORY_TONES: readonly PlanTone[] = ['primary', 'secondary', 'accent', 'info', 'success', 'warning', 'error'];

/** Visual categórico por posición: tono del sistema + patrón alternado, y el código de la unidad como texto. */
export function categoryVisual(axis: 'unit' | 'function', code: string, label: string, index: number): StateVisual {
  const tone = CATEGORY_TONES[index % CATEGORY_TONES.length]!;
  const alternate = Math.floor(index / CATEGORY_TONES.length) % 2 === 1;
  return {
    key: `${axis}:${code}`,
    label,
    tone,
    pattern: alternate ? 'dots' : 'solid',
    glyph: null,
    border: 'solid',
    mark: code,
  };
}

/** Familias de función para colorear «por función». */
export const FUNCTION_GROUPS: readonly { readonly code: string; readonly label: string; readonly members: readonly string[] }[] = [
  { code: 'INPATIENT', label: 'Internación', members: ['INPATIENT_ROOM', 'ISOLATION_AIIR', 'WARD_GENERIC', 'NURSE_STATION', 'ICU_BAY', 'OBSERVATION', 'RECOVERY_PACU', 'BED_STANDARD', 'BED_ICU'] },
  { code: 'SURGICAL', label: 'Quirúrgico y partos', members: ['OPERATING_ROOM', 'STERILIZATION', 'DELIVERY_ROOM', 'PROCEDURE_ROOM'] },
  { code: 'EMERGENCY', label: 'Emergencias', members: ['EMERGENCY_BOX'] },
  { code: 'OUTPATIENT', label: 'Consulta', members: ['CONSULTING_ROOM'] },
  { code: 'DIAGNOSTIC', label: 'Diagnóstico', members: ['IMAGING_ROOM', 'SAMPLE_COLLECTION', 'LAB_AREA'] },
  { code: 'SUPPORT', label: 'Apoyo y administración', members: ['PHARMACY', 'STORAGE', 'OFFICE_ADMIN', 'WAITING', 'AREA_GENERIC', 'BUILDING_GENERIC', 'LEVEL_GENERIC'] },
];

export function functionGroupOf(functionCode: string | undefined): (typeof FUNCTION_GROUPS)[number] | undefined {
  return FUNCTION_GROUPS.find((group) => functionCode !== undefined && group.members.includes(functionCode));
}

/* ---- antigüedad del dato (S7) ------------------------------------------------ */

/** Pasado este tiempo sin dato fresco, el estado se marca «Desactualizado» (CONTRATO-PLANO §3.6, igual que F2). */
export const PLAN_STALE_AFTER_MS = 120_000;
export const PLAN_POLL_MS = 30_000;

/** «Dato de hace 2 min». */
export function ageLabel(asOf: string | Date, now: number | Date = Date.now()): string {
  const seconds = Math.max(0, Math.round((+now - +new Date(asOf)) / 1000));
  if (seconds < 10) return 'Dato actualizado ahora';
  if (seconds < 60) return `Dato de hace ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Dato de hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Dato de hace ${hours} h`;
  return `Dato de hace ${Math.round(hours / 24)} días`;
}

export function isStale(asOf: string | Date, now: number | Date = Date.now()): boolean {
  return +now - +new Date(asOf) > PLAN_STALE_AFTER_MS;
}

/** «hace 35 min» para el «desde» de un eje. */
export function sinceLabel(since: string, now: number | Date = Date.now()): string {
  const minutes = Math.max(0, Math.round((+now - +new Date(since)) / 60_000));
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} días`;
}

/* ---- leyenda: recuentos ------------------------------------------------------- */

/** Cuántos espacios hay de cada valor del eje, para la leyenda (que además es un filtro). */
export function legendCounts(mode: ColorMode, states: Readonly<Record<string, SpaceState>>, include?: (spaceId: string) => boolean): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const [id, state] of Object.entries(states)) {
    if (include && !include(id)) continue;
    const visual = stateVisual(mode, state);
    counts.set(visual.key, (counts.get(visual.key) ?? 0) + 1);
  }
  return counts;
}

/** Resumen de un contenedor en una frase: «12 camas · 9 ocupadas · 2 asignables». */
export function rollupSentence(rollup: PlanRollup | undefined): string | null {
  if (!rollup || rollup.beds === 0) return null;
  const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
  const parts = [plural(rollup.beds, 'cama', 'camas'), plural(rollup.occupied, 'ocupada', 'ocupadas'), plural(rollup.assignable, 'asignable', 'asignables')];
  return parts.join(' · ');
}

/* ---- aria-label -------------------------------------------------------------- */

export interface AriaSpace {
  readonly name: string;
  readonly functionDisplay?: string;
  readonly inScope: boolean;
}

/**
 * La frase completa que lee un lector de pantalla al enfocar un espacio
 * (CONTRATO-PLANO §5.6): «Habitación 101, internación, ocupada, higiene limpia,
 * sin aislamiento, dato de hace 2 minutos». Un espacio fuera del alcance es solo
 * «Espacio fuera de su alcance»: ni nombre ni estado.
 */
export function ariaLabelFor(space: AriaSpace, state: SpaceState | undefined, asOf: string | undefined, now: number): string {
  if (!space.inScope) return 'Espacio fuera de su alcance';
  const parts = [space.name];
  if (space.functionDisplay) parts.push(space.functionDisplay.toLowerCase());
  if (state) {
    parts.push(stateVisual('occupancy', state).label.toLowerCase());
    const availability = stateVisual('availability', state);
    if (state.availability.code !== AVAILABILITY.AVAILABLE) parts.push(availability.label.toLowerCase());
    parts.push(`higiene ${stateVisual('hygiene', state).label.toLowerCase()}`);
    parts.push(state.isolation.code === ISOLATION.NONE ? 'sin aislamiento' : stateVisual('isolation', state).label.toLowerCase());
    if (asOf) parts.push(ageLabel(asOf, now).replace(/^Dato/, 'dato').replace('actualizado ahora', 'actualizado ahora'));
  }
  return parts.join(', ');
}

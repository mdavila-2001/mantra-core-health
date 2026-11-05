import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import type {
  AccessMatrix,
  MatrixCell,
  MatrixCellStatus,
  MatrixDimension,
  PersonMatrix,
  PersonMatrixRow,
  TargetMatrixRow,
} from '../../../core/data-access/access-governance';
import {
  ATOM_CATEGORY_CODES,
  ATOM_CATEGORY_LABELS,
  atomMeta,
  atomsOfCategory,
  type AtomCategoryCode,
} from '../../../core/data-access/support-access/support-atoms';
import {
  SUPPORT_ROLE_TEMPLATE_LABELS,
  type SupportRoleTemplateCode,
} from '../../../core/data-access/support-access/support-access.types';

/* ============================================================================
    Lo puro de la matriz de accesos (CONTRATO-GOBIERNO §6.5, §9.3 fila 3): rótulos en lenguaje simple, filtros,
    orden y página. Sin red ni DOM, para probarlo aparte. La autoridad sobre quién puede qué es la API.
   ========================================================================== */

export type MatrixView = 'person' | 'target';
export type TargetKind = Exclude<MatrixDimension, 'person'>;
export type PersonGroup = 'category' | 'atom';
export type StateFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'PENDING';
export type SensitivityFilter = 'ALL' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/* ---- opciones de los controles ---- */

export const VIEW_OPTIONS: readonly SegmentedOption<MatrixView>[] = [
  { value: 'person', label: 'Quién tiene qué' },
  { value: 'target', label: 'Quién puede actuar sobre…' },
];
export const GROUP_OPTIONS: readonly SegmentedOption<PersonGroup>[] = [
  { value: 'category', label: 'Categoría' },
  { value: 'atom', label: 'Permiso individual' },
];
export const KIND_OPTIONS: readonly SegmentedOption<TargetKind>[] = [
  { value: 'doctor', label: 'Doctor' },
  { value: 'service', label: 'Servicio' },
  { value: 'location', label: 'Espacio' },
];
export const FORMAT_OPTIONS: readonly SegmentedOption<'csv' | 'json'>[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
];
export const STATE_OPTIONS: readonly SelectOption<StateFilter>[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'ACTIVE', label: 'Vigentes' },
  { value: 'SUSPENDED', label: 'Suspendidos' },
  { value: 'PENDING', label: 'Pendientes' },
];
export const SENSITIVITY_OPTIONS: readonly SelectOption<SensitivityFilter>[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'MEDIUM', label: 'Media o más' },
  { value: 'HIGH', label: 'Alta o más' },
  { value: 'CRITICAL', label: 'Solo crítica' },
];
export const TARGET_PROMPT =
  'Elija un doctor, un servicio o un espacio para ver quién puede actuar sobre él.';

export const PAGE_SIZE = 10;

export interface MatrixFilters {
  /** Código de plantilla o `ALL`. */
  readonly template: string;
  readonly state: StateFilter;
  readonly sensitivity: SensitivityFilter;
}

export const NO_FILTERS: MatrixFilters = { template: 'ALL', state: 'ALL', sensitivity: 'ALL' };

export const hasFilters = (filters: MatrixFilters): boolean =>
  filters.template !== 'ALL' || filters.state !== 'ALL' || filters.sensitivity !== 'ALL';

/* ---- celdas ------------------------------------------------------------------------------------------------------ */

/** El estado de una celda en palabras y con un símbolo: nunca depende solo del color. */
export const CELL_TEXT: Readonly<Record<MatrixCellStatus, string>> = {
  FULL: 'Completo',
  CONDITIONAL: 'Con condiciones',
  PARTIAL: 'Parcial',
  NONE: 'Sin acceso',
};
export const CELL_GLYPH: Readonly<Record<MatrixCellStatus, string>> = {
  FULL: '●',
  CONDITIONAL: '◆',
  PARTIAL: '◐',
  NONE: '○',
};
export const CELL_MEANING: Readonly<Record<MatrixCellStatus, string>> = {
  FULL: 'tiene todos los permisos del grupo, sin condiciones',
  CONDITIONAL: 'los tiene con horario, tope u otra condición',
  PARTIAL: 'tiene solo algunos permisos del grupo',
  NONE: 'no tiene ninguno',
};
export const CELL_ORDER: readonly MatrixCellStatus[] = ['FULL', 'CONDITIONAL', 'PARTIAL', 'NONE'];

const NONE_CELL: MatrixCell = { status: 'NONE', grantIds: [], conditions: [] };
export const cellOf = (row: PersonMatrixRow, column: string): MatrixCell =>
  row.cells[column] ?? NONE_CELL;

/* ---- columnas y sensibilidad -------------------------------------------------------------------------------------- */

const RANK: Readonly<Record<string, number>> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const MIN_RANK: Readonly<Record<SensitivityFilter, number>> = {
  ALL: 0,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

const isCategory = (code: string): code is AtomCategoryCode =>
  (ATOM_CATEGORY_CODES as readonly string[]).includes(code);

export function columnLabel(column: string): string {
  if (isCategory(column)) return ATOM_CATEGORY_LABELS[column];
  return atomMeta(column)?.name ?? column;
}

/** Qué tan sensible es el permiso (o, en una categoría, el más sensible que contiene). 0 si no se conoce. */
export function columnRank(column: string): number {
  if (isCategory(column))
    return Math.max(0, ...atomsOfCategory(column).map((a) => RANK[a.sensitivity] ?? 0));
  return RANK[atomMeta(column)?.sensitivity ?? ''] ?? 0;
}

export const atomRank = (code: string): number => RANK[atomMeta(code)?.sensitivity ?? ''] ?? 0;

export const sensitivityParam = (filter: SensitivityFilter): string | null =>
  filter === 'ALL' ? null : filter;

/** Los permisos que se pueden elegir para pedir «¿por qué?» desde una celda de personas. */
export function explainableAtoms(
  column: string,
): readonly { readonly value: string; readonly label: string }[] {
  if (isCategory(column))
    return atomsOfCategory(column).map((a) => ({ value: a.code, label: a.name }));
  return [{ value: column, label: columnLabel(column) }];
}

/* ---- filtros y orden de personas ------------------------------------------------------------------------------- */

export function templateLabel(code: string | undefined): string {
  if (code === undefined) return 'Sin plantilla';
  return (
    (SUPPORT_ROLE_TEMPLATE_LABELS as Readonly<Record<string, string>>)[
      code as SupportRoleTemplateCode
    ] ?? code
  );
}

export function templateChoices(
  rows: readonly { readonly templateCode?: string }[],
): readonly { readonly value: string; readonly label: string }[] {
  const codes = [
    ...new Set(rows.flatMap((row) => (row.templateCode === undefined ? [] : [row.templateCode]))),
  ];
  return codes
    .map((code) => ({ value: code, label: templateLabel(code) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

export const STATE_TEXT: Readonly<Record<string, string>> = {
  ACTIVE: 'Vigente',
  SUSPENDED: 'Suspendido',
  PENDING: 'Pendiente',
  ENDED: 'Terminado',
};
export const stateText = (state: string): string => STATE_TEXT[state] ?? state;

const passesRowFilters = (
  row: { readonly templateCode?: string; readonly state: string },
  filters: MatrixFilters,
): boolean =>
  (filters.template === 'ALL' || row.templateCode === filters.template) &&
  (filters.state === 'ALL' || row.state === filters.state);

/** Las columnas que quedan con el filtro de sensibilidad. */
export function visibleColumns(matrix: PersonMatrix, filters: MatrixFilters): readonly string[] {
  const min = MIN_RANK[filters.sensitivity];
  return matrix.columns.filter((column) => columnRank(column) >= min);
}

/** Las filas que quedan: por plantilla, vigencia y, si se filtra por sensibilidad, que tengan algo en las columnas visibles. */
export function visibleRows(
  matrix: PersonMatrix,
  columns: readonly string[],
  filters: MatrixFilters,
): readonly PersonMatrixRow[] {
  return matrix.rows.filter(
    (row) =>
      passesRowFilters(row, filters) &&
      (filters.sensitivity === 'ALL' ||
        columns.some((column) => cellOf(row, column).status !== 'NONE')),
  );
}

export function sortByName<T extends { readonly name?: string }>(
  rows: readonly T[],
  direction: 'asc' | 'desc' | null,
): readonly T[] {
  if (direction === null) return rows;
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => sign * (a.name ?? '').localeCompare(b.name ?? '', 'es'));
}

export function pageOf<T>(
  rows: readonly T[],
  page: number,
): { readonly items: readonly T[]; readonly page: number; readonly pages: number } {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safe = Math.min(Math.max(page, 0), pages - 1);
  return { items: rows.slice(safe * PAGE_SIZE, (safe + 1) * PAGE_SIZE), page: safe, pages };
}

/* ---- «quién puede actuar sobre…» ---------------------------------------------------------------------------------- */

/** Las filas de un destino que quedan con los filtros (los permisos se recortan al nivel de sensibilidad pedido). */
export function visibleTargetRows(
  rows: readonly TargetMatrixRow[],
  filters: MatrixFilters,
): readonly TargetMatrixRow[] {
  const min = MIN_RANK[filters.sensitivity];
  return rows
    .filter((row) => passesRowFilters(row, filters))
    .map((row) => ({ ...row, atoms: row.atoms.filter((atom) => atomRank(atom) >= min) }))
    .filter((row) => min === 0 || row.atoms.length > 0);
}

/** Por qué alguien que tiene el permiso hoy no puede usarlo, en lenguaje simple (Anexo C del contrato). */
const BLOCK_TEXT: Readonly<Record<string, string>> = {
  DOCTOR_NOT_ACCEPTED: 'El doctor todavía no aceptó a esta persona.',
  ENGAGEMENT_INACTIVE: 'Su vínculo no está activo: está suspendido, vencido o terminado.',
  ONBOARDING_INCOMPLETE: 'Falta completar su ingreso.',
  TIME_WINDOW: 'Hoy está fuera del horario permitido.',
  NETWORK_NOT_ALLOWED: 'Debe conectarse desde la red de la organización.',
  DEVICE_NOT_TRUSTED: 'Debe usar un equipo de confianza.',
  SESSION_TOO_LONG: 'Su sesión pasó del máximo permitido.',
  DOCTOR_OFFLINE: 'El doctor debe estar conectado.',
  LIMIT_EXCEEDED: 'Llegó al límite de uso de hoy.',
};

export function blockText(reason: string | undefined): string {
  return (
    (reason === undefined ? undefined : BLOCK_TEXT[reason]) ??
    'Hoy una condición se lo impide. Use «¿Por qué?» para ver cuál.'
  );
}

/** Cómo se llaman las condiciones de un permiso (las claves de §3.4), para decirlas sin mostrar el JSON. */
const CONDITION_TEXT: Readonly<Record<string, string>> = {
  time: 'Horario',
  limits: 'Topes de uso',
  patients: 'Qué pacientes',
  appointment: 'Qué citas',
  channels: 'Canales',
  fields: 'Datos que ve',
  amount: 'Montos',
  session: 'Duración de la sesión',
  network: 'Red de la organización',
  device: 'Equipo de confianza',
  presence: 'Doctor conectado',
  obligations: 'Motivo, segundo paso o aprobación',
  delegationCeiling: 'Techo de delegación',
};

export const conditionTexts = (keys: readonly string[]): readonly string[] =>
  keys.map((key) => CONDITION_TEXT[key] ?? key);

/** Lo que se exporta: lo que se está viendo, sin valores vacíos. */
export function exportFilters(
  view: MatrixView,
  group: PersonGroup,
  target: { readonly kind: TargetKind; readonly id: string } | null,
  filters: MatrixFilters,
): Readonly<Record<string, unknown>> {
  const sensitivity = sensitivityParam(filters.sensitivity);
  return {
    by: view === 'person' || target === null ? 'person' : target.kind,
    ...(view === 'person' ? { group } : target === null ? {} : { id: target.id }),
    ...(filters.template === 'ALL' ? {} : { template: filters.template }),
    ...(filters.state === 'ALL' ? {} : { state: filters.state }),
    ...(sensitivity === null ? {} : { sensitivity }),
  };
}

/** ¿La respuesta es la matriz de personas? */
export const isPersonMatrix = (matrix: AccessMatrix): matrix is PersonMatrix =>
  matrix.by === 'person';

/* ---- decisión de «¿por qué?» ------------------------------------------------------------------------------------ */

export interface DecisionView {
  readonly text: string;
  readonly glyph: string;
  readonly tone: 'success' | 'error' | 'warning';
}

/** La decisión en palabras y con símbolo: ✓ permitido, ✕ no permitido, ! hace falta un paso más. */
export function decisionView(effect: string): DecisionView {
  if (effect === 'PERMIT') return { text: 'Está permitido', glyph: '✓', tone: 'success' };
  if (effect === 'CHALLENGE')
    return { text: 'Hace falta un paso más', glyph: '!', tone: 'warning' };
  return { text: 'No está permitido', glyph: '✕', tone: 'error' };
}

const LOCATION_KIND_TEXT: Readonly<Record<string, string>> = {
  SITE: 'Sede',
  BUILDING: 'Edificio',
  LEVEL: 'Piso',
  WING: 'Ala',
  CONSULTING_ROOM: 'Consultorio',
  OPERATING_ROOM: 'Quirófano',
  PROCEDURE_ROOM: 'Sala de procedimientos',
  BED: 'Cama',
};
export const locationKindText = (kind: string): string => LOCATION_KIND_TEXT[kind] ?? 'Espacio';

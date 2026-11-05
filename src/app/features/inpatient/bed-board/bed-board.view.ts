import type { BedBoardCell, BedBoardUnit, V2Code } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { opsLabel, V2_LABEL, V2_LEGEND } from '../../../core/data-access/infrastructure-ops/ops-labels';
import type { CareSpaceNode } from '../../../core/data-access/infrastructure/infrastructure.types';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import type { FilterDef } from '../../../shared/components/organisms/filter-bar/filter-bar';
import { cellToTile } from '../inpatient-presentation';

/* ============================================================================
    Lo que el tablero arma para mostrar, sin estado: filas de la lista,
    recuentos, leyenda y filtros. Separado del componente para que éste quede
    en la carga, el sondeo y la selección (y bajo 300 líneas).
    ========================================================================== */

export type BoardView = 'grid' | 'list';

export const VIEWS: readonly SegmentedOption<BoardView>[] = [
  { value: 'grid', label: 'Grilla' },
  { value: 'list', label: 'Lista' },
];

/** Las claves de la URL que **filtran** (M8): cambiar otra no vuelve a pedir el tablero. */
export const FILTER_KEYS = ['location', 'fn', 'v2'] as const;

export const LEGEND = V2_LEGEND.map((r) => ({ code: r.code, label: V2_LABEL[r.code], rule: r.rule }));

/** Una fila de la vista de lista. */
export interface BoardRow {
  readonly id: string;
  readonly code: string;
  readonly v2Code: V2Code;
  readonly statusLabel: string;
  readonly availability: string;
  readonly hygiene: string;
  readonly isolation: string;
  readonly patient: string;
  readonly age: string;
  readonly cell: BedBoardCell;
}

export function toRow(c: BedBoardCell, now: number, timeZone: string): BoardRow {
  const t = cellToTile(c, now, timeZone);
  return {
    id: c.id,
    code: c.code,
    v2Code: c.v2Code,
    statusLabel: t.statusLabel,
    availability: t.reason ?? opsLabel(c.availability.code),
    hygiene: opsLabel(c.hygiene.code) + (c.hygiene.terminalRequired ? ' · terminal' : ''),
    isolation: t.isolation ?? 'Sin aislamiento',
    patient: t.patient ?? '—',
    age: t.age ?? '—',
    cell: c,
  };
}

const COUNT_LABELS: readonly [keyof BedBoardUnit['counts'], string][] = [
  ['assignable', 'Asignables'],
  ['occupied', 'Ocupadas'],
  ['reserved', 'Reservadas'],
  ['blocked', 'Bloqueadas'],
  ['maintenance', 'Mantenimiento'],
  ['dirty', 'Sucias'],
  ['cleaning', 'Limpiando'],
  ['isolation', 'Aislamiento'],
  ['contaminated', 'Contaminadas'],
];

export function countsOf(u: BedBoardUnit): { label: string; value: number }[] {
  return COUNT_LABELS.map(([k, label]) => ({ label, value: u.counts[k] }));
}

/** La clave de una unidad para `track` y para la URL (`unitId` puede ser `null`: «Sin unidad»). */
export const unitKey = (u: BedBoardUnit): string => u.unitId ?? 'sin-unidad';

const BADGE: Readonly<Record<V2Code, string>> = { U: 'success', O: 'primary', K: 'error', H: 'warning', R: 'info', I: 'secondary', C: 'secondary' };
export const badgeOf = (v: V2Code): string => BADGE[v];

/** Filtros: sede (si hay varias), piso o sala (estructura de F1), función y estado v2. */
export function boardFilters(
  sites: readonly { readonly siteId: string; readonly name: string }[],
  spaces: readonly CareSpaceNode[],
  cells: readonly BedBoardCell[],
): readonly FilterDef[] {
  const byId = new Map(spaces.map((e) => [e.id, e]));
  const camino = (e: CareSpaceNode): string => {
    const partes: string[] = [];
    let x: CareSpaceNode | undefined = e;
    while (x !== undefined && partes.length < 6) {
      partes.unshift(x.name);
      x = x.parentId === null ? undefined : byId.get(x.parentId);
    }
    return partes.join(' › ');
  };
  const ubicaciones = spaces
    .filter((e) => ['LOC_FORM_LEVEL', 'LOC_FORM_WARD', 'LOC_FORM_AREA', 'LOC_FORM_WING'].includes(e.form.code))
    .map((e) => ({ value: e.id, label: camino(e) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  const funciones = [...new Set(cells.map((c) => c.function).filter((f): f is string => f !== null))].map((value) => ({ value, label: opsLabel(value) }));
  return [
    ...(sites.length > 1 ? [{ key: 'site', label: 'Establecimiento', options: sites.map((s) => ({ value: s.siteId, label: s.name })) }] : []),
    { key: 'location', label: 'Piso o sala', placeholder: 'Todo el establecimiento', options: ubicaciones },
    { key: 'fn', label: 'Función', placeholder: 'Todas', options: funciones },
    { key: 'v2', label: 'Estado', placeholder: 'Todos', options: V2_LEGEND.map((r) => ({ value: r.code, label: `${r.code} · ${V2_LABEL[r.code]}` })) },
  ];
}

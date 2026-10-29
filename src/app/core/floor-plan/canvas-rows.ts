/* ============================================================================
    Filas de dibujo del lienzo: qué se pinta, con qué clases y con qué rótulo.

    Funciones puras de los datos que ya están en el cliente. El componente las
    envuelve en `computed`, así que solo se recalculan cuando cambian los datos
    (estado, capas, leyenda), no en cada fotograma del zoom.
    ========================================================================== */

import type { SpaceState } from '../data-access/floor-plan/floor-plan.types';
import type { PlanLayerId } from './canvas.types';
import { PLAN_MIN_TOUCH_TARGET_PX } from './canvas.types';
import { shortName } from './labels';
import type { SpaceView } from './plan-view';
import { NO_STATE_VISUAL, ariaLabelFor, type ColorMode, type StateVisual } from './state-visuals';

/** Una fila de la capa de rellenos: el espacio con todo lo que se decide una vez por cambio de datos. */
export interface FillRow {
  readonly s: SpaceView;
  readonly visual: StateVisual;
  readonly cls: string;
  readonly interactive: boolean;
  readonly aria: string | null;
  readonly dim: boolean;
  readonly hiddenByLegend: boolean;
  readonly patternUrl: string | null;
  readonly showBorder: boolean;
}

export interface LabelRow {
  readonly s: SpaceView;
  readonly visual: StateVisual;
  readonly x: number;
  readonly y: number;
  readonly text: string | null;
  readonly glyph: StateVisual['glyph'];
  readonly mark: string | undefined;
  readonly zone: boolean;
}

export interface Lod {
  readonly labels: boolean;
  readonly glyphs: boolean;
  readonly beds: boolean;
  readonly scale: number;
}

export interface RowContext {
  readonly ordered: readonly SpaceView[];
  readonly layers: ReadonlySet<PlanLayerId>;
  readonly lod: Lod;
  readonly mounted: ReadonlySet<string> | null;
  readonly visual: (space: SpaceView) => StateVisual;
}

export interface FillContext extends RowContext {
  readonly hidden: ReadonlySet<string>;
  readonly focus: ReadonlySet<string> | null;
  readonly selectable: (id: string) => boolean;
  readonly asOf: string | undefined;
  readonly now: number;
  readonly states: Readonly<Record<string, SpaceState>>;
  readonly canSeeState: boolean;
  readonly colorBy: ColorMode;
}

const FILL_PATTERN: Readonly<Record<string, string>> = {
  diagonal: 'url(#plan-pat-diagonal)',
  cross: 'url(#plan-pat-cross)',
  dots: 'url(#plan-pat-dots)',
  hstripes: 'url(#plan-pat-hstripes)',
  grid: 'url(#plan-pat-grid)',
};

/** ¿El espacio se monta con las capas, el nivel de detalle y la virtualización actuales? */
function isMounted(s: SpaceView, ctx: RowContext): boolean {
  if (ctx.mounted && !ctx.mounted.has(s.id)) return false;
  if (s.band === 'zone') return ctx.layers.has('zones');
  if (s.band === 'room') return ctx.layers.has('rooms');
  return ctx.layers.has('beds') && ctx.lod.beds;
}

export function buildFillRows(ctx: FillContext): FillRow[] {
  const rows: FillRow[] = [];
  const categorical = ctx.colorBy === 'none' || ctx.colorBy === 'unit' || ctx.colorBy === 'function';
  for (const s of ctx.ordered) {
    if (!isMounted(s, ctx)) continue;
    const visual = ctx.visual(s);
    const interactive = s.inScope && s.band !== 'zone';
    const classes = ['sp', `sp--${s.band}`, `tone-${s.inScope ? visual.tone : 'silhouette'}`];
    if (visual.strong) classes.push('is-strong');
    if (visual.quiet) classes.push('is-quiet');
    if (visual.border === 'dashed-thick') classes.push('b-dashed');
    if (visual.border === 'dotted') classes.push('b-dotted');
    if (visual.pattern === 'solid-strong') classes.push('p-strong');
    if (!s.inScope) classes.push('is-silhouette');
    if (s.locked) classes.push('is-locked');
    if (!ctx.canSeeState && !categorical) classes.push('is-stateless');
    rows.push({
      s,
      visual,
      cls: classes.join(' '),
      interactive,
      aria: interactive
        ? ariaLabelFor({ name: s.name, functionDisplay: s.card?.functionDisplay, inScope: s.inScope }, ctx.canSeeState ? ctx.states[s.id] : undefined, ctx.asOf, ctx.now)
        : null,
      dim: (ctx.focus !== null && !ctx.focus.has(s.id)) || !ctx.selectable(s.id),
      hiddenByLegend: visual.key !== NO_STATE_VISUAL.key && ctx.hidden.has(visual.key),
      patternUrl: s.inScope ? (FILL_PATTERN[visual.pattern] ?? null) : null,
      showBorder: visual.border === 'dashed-thick',
    });
  }
  return rows;
}

export function buildLabelRows(ctx: RowContext): LabelRow[] {
  const { lod, layers } = ctx;
  if (!lod.glyphs && !lod.labels) return [];
  const showLabels = layers.has('labels') && lod.labels;
  const showGlyphs = layers.has('state') && lod.glyphs;
  const rows: LabelRow[] = [];
  for (const s of ctx.ordered) {
    if (!s.inScope || !isMounted(s, ctx)) continue;
    const widthPx = (s.bbox[2] - s.bbox[0]) * lod.scale;
    const heightPx = (s.bbox[3] - s.bbox[1]) * lod.scale;
    const visual = ctx.visual(s);
    const zone = s.band === 'zone';
    const fitsGlyph = widthPx >= 18 && heightPx >= 18;
    const glyph = showGlyphs && fitsGlyph && !zone ? visual.glyph : null;
    const mark = showGlyphs && fitsGlyph && !zone ? visual.mark : undefined;
    let text: string | null = null;
    if (showLabels && zone) text = widthPx >= 70 ? shortName(s.name, Math.floor((widthPx - 12) / 7.6)) || null : null;
    else if (showLabels && s.band === 'room' && widthPx >= 54 && heightPx >= 30) text = shortName(s.name, Math.floor(widthPx / 6.5));
    if (text === null && glyph === null && mark === undefined) continue;
    rows.push({ s, visual, x: zone ? s.bbox[0] : s.center[0], y: zone ? s.bbox[1] : s.center[1], text, glyph, mark, zone });
  }
  return rows;
}

/** Halos transparentes del área de toque (44 px) para los espacios que se ven más chicos que eso. */
export function buildHaloRows(rows: readonly FillRow[], scale: number): { id: string; x: number; y: number }[] {
  return rows
    .filter((r) => r.interactive && Math.min(r.s.bbox[2] - r.s.bbox[0], r.s.bbox[3] - r.s.bbox[1]) * scale < PLAN_MIN_TOUCH_TARGET_PX)
    .map((r) => ({ id: r.s.id, x: r.s.center[0], y: r.s.center[1] }));
}

import type { PlanGlyph } from '../../../../core/floor-plan/state-visuals';

/**
 * Forma de un glifo en una caja de 16 × 16, con trazo `currentColor`. Una sola
 * fuente de datos para el `<symbol>` del lienzo y para el ícono en línea de la
 * tarjeta, la leyenda y la lista.
 */
export type GlyphShape =
  | { readonly t: 'path'; readonly d: string }
  | { readonly t: 'circle'; readonly cx: number; readonly cy: number; readonly r: number }
  | { readonly t: 'rect'; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly rx: number };

const p = (d: string): GlyphShape => ({ t: 'path', d });
const c = (cx: number, cy: number, r: number): GlyphShape => ({ t: 'circle', cx, cy, r });

export type ExtraGlyph = PlanGlyph | 'alert';

export const PLAN_GLYPH_SHAPES: Readonly<Record<ExtraGlyph, readonly GlyphShape[]>> = {
  person: [c(8, 5, 2.6), p('M3 14c0-3 2.2-5 5-5s5 2 5 5')],
  clock: [c(8, 8, 6), p('M8 4.6V8l2.4 1.6')],
  lock: [{ t: 'rect', x: 3.5, y: 7, w: 9, h: 6.5, rx: 1.5 }, p('M5.5 7V5a2.5 2.5 0 0 1 5 0v2')],
  wrench: [p('M10.6 2.4a3.4 3.4 0 0 0-3.2 4.7l-4.9 4.9a1.4 1.4 0 0 0 2 2l4.9-4.9a3.4 3.4 0 0 0 4.7-3.2l-2.2 2.2-2-.5-.5-2z')],
  slash: [c(8, 8, 6), p('M3.8 12.2l8.4-8.4')],
  broom: [p('M12.8 2.4L8.4 7'), p('M7.2 6.4l2.4 2.4-2.6 4.6H2.6c1.6-.9 2-2.6 2-4.2z')],
  drop: [p('M8 2.4s4 4.3 4 7.3a4 4 0 0 1-8 0c0-3 4-7.3 4-7.3z')],
  biohazard: [c(8, 4.6, 2.9), c(11.2, 10.2, 2.9), c(4.8, 10.2, 2.9), c(8, 8.4, 0.9)],
  isolation: [c(8, 8, 6), p('M8 5v6M6.4 5h3.2M6.4 11h3.2')],
  check: [p('M3 8.6l3.2 3.2L13 4.8')],
  pause: [p('M5.5 3.5v9M10.5 3.5v9')],
  bed: [p('M2 12.5V4M2 9h12v3.5M2 12.5h12M4.5 9V7.4a1.7 1.7 0 0 1 1.7-1.7H9.5A2.5 2.5 0 0 1 12 8.2V9')],
  unit: [c(8, 8, 5)],
  alert: [p('M8 2.5l6 10.5H2z'), p('M8 6.8v3M8 11.4v.1')],
};

export const PLAN_GLYPH_NAMES = Object.keys(PLAN_GLYPH_SHAPES) as ExtraGlyph[];

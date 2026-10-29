/* ============================================================================
    Matemática de la vista del plano: zoom, desplazamiento y encuadre.

    La vista es `(cx, cy, scale)`: el centro en metros y los píxeles por metro.
    No hay ningún `transform` acumulado; el `viewBox` del SVG se deriva de acá,
    así que nada se desfasa tras mil zooms. CONTRATO-PLANO §5.2: de 5 % a 1 600 %.
    ========================================================================== */

import { bboxSize, type BBox, type Point } from './geometry';

export interface Viewport {
  /** Centro de la vista, en metros. */
  readonly cx: number;
  readonly cy: number;
  /** Píxeles por metro. */
  readonly scale: number;
}

export interface PixelSize {
  readonly width: number;
  readonly height: number;
}

/** 100 % = 10 px por metro: un piso de 64 m mide 640 px a 100 %. */
export const PX_PER_M_AT_100 = 10;
export const MIN_ZOOM_PERCENT = 5;
export const MAX_ZOOM_PERCENT = 1600;
export const MIN_SCALE = (MIN_ZOOM_PERCENT / 100) * PX_PER_M_AT_100;
export const MAX_SCALE = (MAX_ZOOM_PERCENT / 100) * PX_PER_M_AT_100;

export function zoomPercent(scale: number): number {
  return Math.round((scale / PX_PER_M_AT_100) * 100);
}

export function clampScale(scale: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

/** La caja del mundo que se ve en un lienzo de `size` píxeles. */
export function visibleBBox(view: Viewport, size: PixelSize): BBox {
  const halfWidth = size.width / (2 * view.scale);
  const halfHeight = size.height / (2 * view.scale);
  return [view.cx - halfWidth, view.cy - halfHeight, view.cx + halfWidth, view.cy + halfHeight];
}

/** El `viewBox` del SVG que corresponde a la vista. */
export function viewBoxOf(view: Viewport, size: PixelSize): string {
  const [x0, y0, x1, y1] = visibleBBox(view, size);
  return `${round(x0)} ${round(y0)} ${round(x1 - x0)} ${round(y1 - y0)}`;
}

const round = (value: number): number => Math.round(value * 1000) / 1000;

/** Vista que encuadra una caja del mundo con un margen en píxeles. */
export function frameBBox(box: BBox, size: PixelSize, paddingPx = 24, maxScale = MAX_SCALE): Viewport {
  const { width, height } = bboxSize(box);
  const usableWidth = Math.max(1, size.width - 2 * paddingPx);
  const usableHeight = Math.max(1, size.height - 2 * paddingPx);
  const fit = Math.min(usableWidth / Math.max(width, 1e-6), usableHeight / Math.max(height, 1e-6));
  return {
    cx: (box[0] + box[2]) / 2,
    cy: (box[1] + box[3]) / 2,
    scale: clampScale(Math.min(fit, maxScale)),
  };
}

/** Pasa de píxeles del lienzo (origen arriba a la izquierda) a metros. */
export function screenToWorld(view: Viewport, size: PixelSize, px: Point): Point {
  return [view.cx + (px[0] - size.width / 2) / view.scale, view.cy + (px[1] - size.height / 2) / view.scale];
}

export function worldToScreen(view: Viewport, size: PixelSize, world: Point): Point {
  return [(world[0] - view.cx) * view.scale + size.width / 2, (world[1] - view.cy) * view.scale + size.height / 2];
}

/** Zoom multiplicativo que deja fijo el punto del mundo que está bajo `focusPx`. */
export function zoomAt(view: Viewport, size: PixelSize, factor: number, focusPx: Point): Viewport {
  const scale = clampScale(view.scale * factor);
  if (scale === view.scale) return view;
  const anchor = screenToWorld(view, size, focusPx);
  return {
    scale,
    cx: anchor[0] - (focusPx[0] - size.width / 2) / scale,
    cy: anchor[1] - (focusPx[1] - size.height / 2) / scale,
  };
}

export function panBy(view: Viewport, dxPx: number, dyPx: number): Viewport {
  return { ...view, cx: view.cx - dxPx / view.scale, cy: view.cy - dyPx / view.scale };
}

/**
 * Evita perder el plano: el centro no sale de la caja del mundo ensanchada
 * (dos veces el ancho/alto visible de margen), para que siempre quede algo a la vista.
 */
export function clampViewport(view: Viewport, size: PixelSize, world: BBox): Viewport {
  const halfWidth = size.width / (2 * view.scale);
  const halfHeight = size.height / (2 * view.scale);
  const minX = world[0] - halfWidth * 0.5;
  const maxX = world[2] + halfWidth * 0.5;
  const minY = world[1] - halfHeight * 0.5;
  const maxY = world[3] + halfHeight * 0.5;
  const cx = Math.max(minX, Math.min(maxX, view.cx));
  const cy = Math.max(minY, Math.min(maxY, view.cy));
  return cx === view.cx && cy === view.cy ? view : { ...view, cx, cy };
}

/**
 * Desplazamiento mínimo para que una caja quede visible (con margen en px). Si
 * ya lo está, devuelve la misma vista: no hay saltos al recorrer con flechas.
 */
export function ensureVisible(view: Viewport, size: PixelSize, box: BBox, marginPx = 32): Viewport {
  const margin = marginPx / view.scale;
  const [vx0, vy0, vx1, vy1] = visibleBBox(view, size);
  let dx = 0;
  let dy = 0;
  if (box[0] - margin < vx0) dx = box[0] - margin - vx0;
  else if (box[2] + margin > vx1) dx = box[2] + margin - vx1;
  if (box[1] - margin < vy0) dy = box[1] - margin - vy0;
  else if (box[3] + margin > vy1) dy = box[3] + margin - vy1;
  // Si la caja es más grande que la ventana, se alinea su comienzo en vez de oscilar.
  if (box[2] - box[0] + 2 * margin > vx1 - vx0) dx = box[0] - margin - vx0;
  if (box[3] - box[1] + 2 * margin > vy1 - vy0) dy = box[1] - margin - vy0;
  return dx === 0 && dy === 0 ? view : { ...view, cx: view.cx + dx, cy: view.cy + dy };
}

/** Pasos de zoom de teclado y botones: ×1,25 por pulsación. */
export const ZOOM_STEP = 1.25;

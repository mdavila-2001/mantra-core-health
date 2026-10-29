import type { Point } from './geometry';
import type { BBox } from './geometry';
import type { Viewport } from './plan-viewport';
import type { HoverSource } from './hover-intent';

/** Capas conmutables del visor (CONTRATO-PLANO §5.2). */
export const PLAN_LAYERS = [
  { id: 'background', label: 'Fondo' },
  { id: 'grid', label: 'Grilla' },
  { id: 'zones', label: 'Zonas' },
  { id: 'rooms', label: 'Locales' },
  { id: 'beds', label: 'Camas' },
  { id: 'walls', label: 'Muros' },
  { id: 'openings', label: 'Aberturas' },
  { id: 'circulation', label: 'Circulación y verticales' },
  { id: 'labels', label: 'Etiquetas' },
  { id: 'state', label: 'Estado' },
  { id: 'dimensions', label: 'Cotas' },
] as const;
export type PlanLayerId = (typeof PLAN_LAYERS)[number]['id'];

/** Capas visibles por omisión: la grilla, el fondo y las cotas se piden a mano. */
export const DEFAULT_LAYERS: ReadonlySet<PlanLayerId> = new Set<PlanLayerId>([
  'zones', 'rooms', 'beds', 'walls', 'openings', 'circulation', 'labels', 'state',
]);

/* Constantes de rendimiento nombradas (CONTRATO-PLANO §5.9), ajustables tras medir. */
/** Por debajo de este zoom no se pintan rótulos ni camas. */
export const PLAN_LOD_LABELS_MIN_ZOOM = 80;
/** Por debajo de este zoom no se pintan glifos. */
export const PLAN_LOD_GLYPHS_MIN_ZOOM = 50;
export const PLAN_LOD_BEDS_MIN_ZOOM = 60;
/** A partir de esta cantidad de nodos se monta solo lo visible. */
export const PLAN_VIRTUALIZE_MIN_NODES = 400;
/** Radio mínimo del área de toque (px): los locales chicos se agrandan con un halo, no en el dibujo. */
export const PLAN_MIN_TOUCH_TARGET_PX = 44;

/** Lo que el lienzo avisa cuando hay (o deja de haber) un espacio bajo el puntero, el foco o un toque. */
export interface CanvasHover {
  readonly spaceId: string;
  readonly source: HoverSource | 'touch';
  /** Rectángulo del espacio en el viewport, para anclar la tarjeta. */
  readonly anchor: { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
  /** Último punto del puntero, en el viewport (para anclar a un espacio más grande que la tarjeta). */
  readonly pointer: { readonly x: number; readonly y: number } | null;
  /** El rectángulo visible del lienzo: la tarjeta no debe salirse de él. */
  readonly bounds: { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
}

export interface ViewInfo {
  readonly viewport: Viewport;
  readonly sizePx: { readonly width: number; readonly height: number };
  readonly visible: BBox;
  readonly zoomPercent: number;
}

/** Pedido de encuadre: una caja a enmarcar (con `nonce` para repetir el mismo pedido). */
export interface FrameRequest {
  readonly bbox: BBox;
  readonly nonce: number;
  readonly maxScale?: number;
  /** Margen inferior reservado (hoja anclada en móvil): el espacio no queda tapado. */
  readonly bottomInsetPx?: number;
}

export interface RevealRequest {
  readonly spaceId: string;
  readonly nonce: number;
}

/** Evento de puntero en coordenadas del mundo, para el editor. */
export interface WorldPointerEvent {
  readonly phase: 'down' | 'move' | 'up' | 'cancel';
  readonly world: Point;
  readonly targetId: string | null;
  readonly handleId: string | null;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly pointerType: string;
  readonly detail: number;
  /** El lienzo ya usó este gesto (pan/zoom): el editor debe ignorarlo. */
  readonly scale: number;
}

/** Lo que el editor dibuja encima del plano. */
export interface OverlayShape {
  readonly id: string;
  readonly path: string;
  readonly kind: 'draft' | 'ghost' | 'error' | 'selection' | 'selection-line' | 'error-line' | 'guide' | 'measure';
}
export interface OverlayHandle {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly kind: 'resize' | 'rotate' | 'vertex' | 'midpoint';
  readonly cursor: string;
}
export interface OverlayLabel {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly kind: 'measure' | 'error';
}
export interface CanvasOverlay {
  readonly shapes: readonly OverlayShape[];
  readonly handles: readonly OverlayHandle[];
  readonly labels: readonly OverlayLabel[];
  /** Espacios con error: se pintan con borde de error, glifo y mensaje. */
  readonly errorIds: ReadonlySet<string>;
  readonly errorMessages: ReadonlyMap<string, string>;
  /** Imán activo: marca el punto al que se pegó. */
  readonly snapMark: Point | null;
}

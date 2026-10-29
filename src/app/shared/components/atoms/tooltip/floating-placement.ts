/* ============================================================================
    Posicionamiento de una capa flotante junto a un ancla: *flip* + *shift*.

    Es el motor único del sistema para globos y tarjetas flotantes
    (CONTRATO-PLANO §5.6, «Posicionamiento anti-recorte»). La directiva
    `Tooltip` lo usa para ubicarse y la tarjeta del plano lo reutiliza: no hay
    un tercer posicionador.

    Todo está en coordenadas de viewport (la capa es `position: fixed`).
    ========================================================================== */

export type Side = 'top' | 'bottom' | 'left' | 'right';

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export const OPPOSITE_SIDE: Readonly<Record<Side, Side>> = Object.freeze({
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
});

export interface PlacementOptions {
  /** Lado preferido. */
  readonly preferred: Side;
  /** Separación entre el ancla y la capa, en px. */
  readonly gap: number;
  /**
   * Orden de lados a probar. Por omisión `[preferido, opuesto, perpendiculares…]`
   * (arriba, abajo, derecha, izquierda para `top`).
   */
  readonly order?: readonly Side[];
  /** Rectángulo visible que no se debe exceder. Sin él, no hay recorte que evitar. */
  readonly bounds?: Rect;
  /** Margen interior respecto de `bounds`, en px (`--sp-2` = 8). */
  readonly margin?: number;
  /** Desplazar la capa a lo largo del eje para que quede dentro de `bounds`. */
  readonly shift?: boolean;
  /**
   * Comportamiento histórico de `Tooltip`: probar solo el lado pedido y su
   * opuesto, y si el pedido no entra quedarse con el opuesto sin más.
   */
  readonly legacy?: boolean;
}

export interface Placement {
  readonly side: Side;
  readonly left: number;
  readonly top: number;
  /** Posición de la flecha a lo largo del borde de la capa que mira al ancla, en px desde su esquina. */
  readonly arrowOffset: number;
  /** ¿La capa quedó fuera de `bounds` aun después de voltear y desplazar? (capa más grande que el lienzo). */
  readonly clipped: boolean;
  /** ¿La capa tapa al ancla? Con el puntero sobre el ancla, taparla la cierra por rebote. */
  readonly overlapsAnchor: boolean;
}

const DEFAULT_ORDER: Readonly<Record<Side, readonly Side[]>> = {
  top: ['top', 'bottom', 'right', 'left'],
  bottom: ['bottom', 'top', 'right', 'left'],
  left: ['left', 'right', 'top', 'bottom'],
  right: ['right', 'left', 'top', 'bottom'],
};

/** Esquina de la capa para un lado, sin desplazar (centrada sobre el ancla). */
function rawPosition(side: Side, anchor: Rect, card: Size, gap: number): { left: number; top: number } {
  const centerX = anchor.left + anchor.width / 2 - card.width / 2;
  const centerY = anchor.top + anchor.height / 2 - card.height / 2;
  switch (side) {
    case 'top':
      return { left: centerX, top: anchor.top - card.height - gap };
    case 'bottom':
      return { left: centerX, top: anchor.top + anchor.height + gap };
    case 'left':
      return { left: anchor.left - card.width - gap, top: centerY };
    case 'right':
      return { left: anchor.left + anchor.width + gap, top: centerY };
  }
}

function mainAxisFits(side: Side, anchor: Rect, card: Size, gap: number, area: Rect): boolean {
  switch (side) {
    case 'top':
      return anchor.top - card.height - gap >= area.top;
    case 'bottom':
      return anchor.top + anchor.height + card.height + gap <= area.top + area.height;
    case 'left':
      return anchor.left - card.width - gap >= area.left;
    case 'right':
      return anchor.left + anchor.width + card.width + gap <= area.left + area.width;
  }
}

/** Espacio libre sobre el eje principal de un lado (para elegir el menos malo). */
function availableSpace(side: Side, anchor: Rect, gap: number, area: Rect): number {
  switch (side) {
    case 'top':
      return anchor.top - gap - area.top;
    case 'bottom':
      return area.top + area.height - (anchor.top + anchor.height) - gap;
    case 'left':
      return anchor.left - gap - area.left;
    case 'right':
      return area.left + area.width - (anchor.left + anchor.width) - gap;
  }
}

function clamp(value: number, min: number, max: number): number {
  return max < min ? min : Math.max(min, Math.min(max, value));
}

/**
 * Calcula dónde poner la capa. Orden: lado preferido; si no entra, el opuesto;
 * luego los perpendiculares. Con `shift`, se desplaza a lo largo del eje para
 * quedar dentro de `bounds`. Si ningún lado entero entra, usa el de más espacio
 * y desplaza en ambos ejes (la flecha sigue apuntando al ancla).
 */
export function placeFloating(anchor: Rect, card: Size, options: PlacementOptions): Placement {
  const { preferred, gap } = options;
  const margin = options.margin ?? 0;
  const bounds = options.bounds;
  const area: Rect | undefined =
    bounds === undefined
      ? undefined
      : {
          left: bounds.left + margin,
          top: bounds.top + margin,
          width: Math.max(0, bounds.width - 2 * margin),
          height: Math.max(0, bounds.height - 2 * margin),
        };

  let side: Side = preferred;
  if (options.legacy === true) {
    if (area !== undefined && !mainAxisFits(preferred, anchor, card, gap, area)) {
      side = OPPOSITE_SIDE[preferred];
    }
  } else if (area !== undefined) {
    const order = options.order ?? DEFAULT_ORDER[preferred];
    const fitting = order.find((candidate) => mainAxisFits(candidate, anchor, card, gap, area));
    if (fitting !== undefined) {
      side = fitting;
    } else {
      side = [...order].sort((a, b) => availableSpace(b, anchor, gap, area) - availableSpace(a, anchor, gap, area))[0]!;
    }
  }

  let { left, top } = rawPosition(side, anchor, card, gap);
  let clipped = false;
  if (area !== undefined && options.shift === true) {
    // Desplazar a lo largo del eje paralelo al borde del ancla, y como último recurso en el principal.
    left = clamp(left, area.left, area.left + area.width - card.width);
    top = clamp(top, area.top, area.top + area.height - card.height);
  }
  if (area !== undefined) {
    clipped =
      left < area.left - 0.5 ||
      top < area.top - 0.5 ||
      left + card.width > area.left + area.width + 0.5 ||
      top + card.height > area.top + area.height + 0.5;
  }

  // La flecha apunta al centro del ancla (acotada al borde útil de la capa).
  const vertical = side === 'top' || side === 'bottom';
  const anchorCenter = vertical ? anchor.left + anchor.width / 2 : anchor.top + anchor.height / 2;
  const origin = vertical ? left : top;
  const span = vertical ? card.width : card.height;
  const arrowOffset = clamp(anchorCenter - origin, Math.min(12, span / 2), Math.max(span - 12, span / 2));

  const overlapsAnchor =
    left < anchor.left + anchor.width - 0.5 &&
    left + card.width > anchor.left + 0.5 &&
    top < anchor.top + anchor.height - 0.5 &&
    top + card.height > anchor.top + 0.5;

  return { side, left, top, arrowOffset, clipped, overlapsAnchor };
}

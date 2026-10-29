/* ============================================================================
    Gestos del lienzo: arrastrar para desplazar, pellizcar para hacer zoom y
    distinguir un toque de un arrastre (CONTRATO-PLANO §5.2 y §5.8).

    Sin DOM: recibe coordenadas de puntero y devuelve qué pasó, de modo que la
    prueba recorre un pellizco entero sin un navegador.
    ========================================================================== */

/** Un toque es un gesto que se movió menos que esto y duró menos que `TAP_MAX_MS`. */
export const TAP_MAX_MOVE_PX = 8;
export const TAP_MAX_MS = 500;

export interface PointerPoint {
  readonly x: number;
  readonly y: number;
}

export type GestureStep =
  | { readonly kind: 'pan'; readonly dx: number; readonly dy: number }
  | { readonly kind: 'pinch'; readonly factor: number; readonly center: PointerPoint; readonly dx: number; readonly dy: number };

interface Tracked {
  x: number;
  y: number;
  startX: number;
  startY: number;
  startedAt: number;
}

export class GestureTracker {
  private readonly pointers = new Map<number, Tracked>();
  /** Cuánto se alejó el puntero principal desde que bajó (para decidir si fue un toque). */
  private maxTravel = 0;
  private lastPinchDistance: number | null = null;
  private lastCenter: PointerPoint | null = null;
  private multi = false;

  get count(): number {
    return this.pointers.size;
  }

  get isPinching(): boolean {
    return this.pointers.size >= 2;
  }

  /** Si en algún momento hubo más de un dedo, el gesto ya no es un toque. */
  get wasMultiTouch(): boolean {
    return this.multi;
  }

  down(id: number, x: number, y: number, at: number): void {
    if (this.pointers.size === 0) {
      this.maxTravel = 0;
      this.multi = false;
    }
    this.pointers.set(id, { x, y, startX: x, startY: y, startedAt: at });
    if (this.pointers.size >= 2) {
      this.multi = true;
      this.lastPinchDistance = this.pinchDistance();
      this.lastCenter = this.centroid();
    }
  }

  move(id: number, x: number, y: number): GestureStep | null {
    const tracked = this.pointers.get(id);
    if (!tracked) return null;
    const dx = x - tracked.x;
    const dy = y - tracked.y;
    tracked.x = x;
    tracked.y = y;
    this.maxTravel = Math.max(this.maxTravel, Math.hypot(x - tracked.startX, y - tracked.startY));
    if (this.pointers.size >= 2) {
      const distance = this.pinchDistance();
      const center = this.centroid();
      const previousDistance = this.lastPinchDistance ?? distance;
      const previousCenter = this.lastCenter ?? center;
      this.lastPinchDistance = distance;
      this.lastCenter = center;
      const factor = previousDistance > 0 ? distance / previousDistance : 1;
      return { kind: 'pinch', factor, center, dx: center.x - previousCenter.x, dy: center.y - previousCenter.y };
    }
    return { kind: 'pan', dx, dy };
  }

  /** Suelta un puntero; devuelve si el gesto completo fue un toque. */
  up(id: number, at: number): { wasTap: boolean } {
    const tracked = this.pointers.get(id);
    this.pointers.delete(id);
    this.lastPinchDistance = null;
    this.lastCenter = this.pointers.size >= 2 ? this.centroid() : null;
    if (!tracked) return { wasTap: false };
    const wasTap = !this.multi && this.maxTravel <= TAP_MAX_MOVE_PX && at - tracked.startedAt <= TAP_MAX_MS;
    if (this.pointers.size === 0) this.multi = false;
    return { wasTap };
  }

  cancel(): void {
    this.pointers.clear();
    this.lastPinchDistance = null;
    this.lastCenter = null;
    this.multi = false;
    this.maxTravel = 0;
  }

  /** ¿El gesto en curso ya se movió lo suficiente como para no ser un toque? */
  get moved(): boolean {
    return this.maxTravel > TAP_MAX_MOVE_PX;
  }

  private centroid(): PointerPoint {
    let x = 0;
    let y = 0;
    for (const p of this.pointers.values()) {
      x += p.x;
      y += p.y;
    }
    return { x: x / this.pointers.size, y: y / this.pointers.size };
  }

  private pinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}

import { computed, signal } from '@angular/core';

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2.5;
/** Al ajustar, no se baja de acá: más chico que esto el texto de los nodos no se lee. */
const FIT_FLOOR = 0.6;
const FIT_MARGIN = 16;
const ZOOM_STEP = 1.25;
/** Cuánto debe moverse el puntero para que un toque pase a ser un arrastre. */
const DRAG_THRESHOLD_PX = 5;

interface Size {
  readonly width: number;
  readonly height: number;
}

interface Drag {
  readonly x: number;
  readonly y: number;
  readonly ox: number;
  readonly oy: number;
  moved: boolean;
}

/**
 * Acercar y arrastrar el lienzo del árbol.
 *
 * El árbol se dibuja en un solo `<g>` con `transform`; esta clase es el dueño de
 * ese `transform` (escala y desplazamiento) y de los gestos que lo cambian.
 *
 * **La rueda sola no se toma:** el lienzo es grande y, si la tomara, la página
 * no se podría desplazar con el puntero encima. Ctrl (⌘) + rueda acerca; para
 * mover el árbol se lo arrastra.
 */
export class GraphViewport {
  readonly scale = signal(1);
  readonly offsetX = signal(0);
  readonly offsetY = signal(0);
  readonly transform = computed(
    () => `translate(${this.offsetX()} ${this.offsetY()}) scale(${this.scale()})`,
  );
  readonly zoomText = computed(() => `${Math.round(this.scale() * 100)} %`);

  /** Desde el último ajuste nadie acercó ni arrastró: el encuadre puede seguir al tamaño del lienzo. */
  private pristine = false;
  private drag: Drag | null = null;
  private justDragged = false;

  /** `size` devuelve lo que mide hoy el lienzo (o `undefined` si todavía no existe). */
  constructor(private readonly size: () => Size | undefined) {}

  /** `true` mientras el encuadre es el del último ajuste automático. */
  get untouched(): boolean {
    return this.pristine;
  }

  /** La persona hizo algo con el árbol (abrir un término, pedir definiciones): el encuadre ya no es automático. */
  markTouched(): void {
    this.pristine = false;
  }

  zoomIn(): void {
    this.zoomBy(ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoomBy(1 / ZOOM_STEP);
  }

  private zoomBy(factor: number, around?: readonly [number, number]): void {
    const previous = this.scale();
    const next = Math.min(Math.max(previous * factor, ZOOM_MIN), ZOOM_MAX);
    if (next === previous) return;
    this.pristine = false;
    const rect = this.size();
    const [px, py] = around ?? [(rect?.width ?? 0) / 2, (rect?.height ?? 0) / 2];
    // El punto bajo el puntero se queda quieto: la escala se aplica alrededor de él.
    this.offsetX.set(px - ((px - this.offsetX()) / previous) * next);
    this.offsetY.set(py - ((py - this.offsetY()) / previous) * next);
    this.scale.set(next);
  }

  /**
   * Ajusta un contenido de `contentWidth × contentHeight` a la ventana, sin
   * pasar de su tamaño real y **sin bajar de {@link FIT_FLOOR}**.
   *
   * Si con ese piso el árbol no entra, no se lo encoge hasta volverlo ilegible:
   * se lo deja legible, pegado a la izquierda y con la raíz (`rootY`, su centro
   * vertical) a media altura. Desde ahí se arrastra para ver el resto.
   *
   * Devuelve `false` si el lienzo todavía no tiene medida.
   */
  fit(contentWidth: number, contentHeight: number, rootY = contentHeight / 2): boolean {
    const rect = this.size();
    // Sin medida todavía (el lienzo recién se creó): no se puede ajustar, y se avisa.
    if (rect === undefined || rect.width === 0 || rect.height === 0) return false;
    const wanted = Math.min(1, rect.width / contentWidth, rect.height / contentHeight);
    const scale = Math.max(wanted, FIT_FLOOR);
    this.scale.set(scale);
    const fits = wanted >= FIT_FLOOR;
    this.offsetX.set(fits ? Math.max(0, (rect.width - contentWidth * scale) / 2) : FIT_MARGIN);
    this.offsetY.set(fits ? Math.max(0, (rect.height - contentHeight * scale) / 2) : rect.height / 2 - rootY * scale);
    this.pristine = true;
    return true;
  }

  reset(): void {
    this.pristine = false;
    this.scale.set(1);
    this.offsetX.set(0);
    this.offsetY.set(0);
  }

  onWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    this.zoomBy(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, [event.clientX - rect.left, event.clientY - rect.top]);
  }

  onPointerDown(event: PointerEvent): void {
    this.justDragged = false;
    if (event.button !== 0) return;
    this.drag = { x: event.clientX, y: event.clientY, ox: this.offsetX(), oy: this.offsetY(), moved: false };
  }

  onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (drag === null) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    drag.moved = true;
    this.pristine = false;
    this.offsetX.set(drag.ox + dx);
    this.offsetY.set(drag.oy + dy);
  }

  onPointerUp(): void {
    this.justDragged = this.drag?.moved ?? false;
    this.drag = null;
  }

  /** `true` una sola vez después de un arrastre: el clic que lo cierra no debe abrir un término. */
  consumeDrag(): boolean {
    const dragged = this.justDragged;
    this.justDragged = false;
    return dragged;
  }
}

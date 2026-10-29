import type { CanvasHover, WorldPointerEvent } from '../../../../core/floor-plan/canvas.types';
import { GestureTracker } from '../../../../core/floor-plan/gestures';
import type { Point } from '../../../../core/floor-plan/geometry';
import { HoverIntent, reduceTouch, type HoverSource, type TouchState } from '../../../../core/floor-plan/hover-intent';
import { panBy, screenToWorld, zoomAt, type PixelSize, type Viewport } from '../../../../core/floor-plan/plan-viewport';

/** Lo que el controlador necesita del lienzo; el componente lo implementa. */
export interface PointerHost {
  readonly interactionMode: () => 'view' | 'edit';
  readonly handTool: () => boolean;
  readonly hostRect: () => { left: number; top: number; width: number; height: number };
  readonly svg: () => SVGSVGElement | null;
  readonly view: () => Viewport;
  readonly size: () => PixelSize;
  readonly setView: (view: Viewport) => void;
  /** ¿Hay un relleno interactivo con ese id? (para el toque y el clic). */
  readonly isInteractive: (id: string) => boolean;
  /** ¿Se puede mostrar la tarjeta de ese espacio? (no está oculto por la leyenda). */
  readonly isHoverable: (id: string) => boolean;
  readonly hoveredId: () => string | null;
  readonly setHovered: (id: string | null) => void;
  readonly setTouchSeen: () => void;
  readonly dragging: () => boolean;
  readonly setDragging: (on: boolean) => void;
  readonly setFocusVisible: (on: boolean) => void;
  readonly focusVisible: () => boolean;
  readonly setActive: (id: string) => void;
  readonly emitPick: (id: string | null) => void;
  readonly emitOpen: (id: string) => void;
  readonly emitHover: (hover: CanvasHover | null) => void;
  readonly emitWorld: (event: WorldPointerEvent) => void;
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&');
}

/**
 * Puntero, gestos y tarjeta del lienzo (CONTRATO-PLANO §5.2, §5.6 y §5.8).
 *
 * **Un solo manejador delegado** sobre el SVG: el blanco se resuelve con
 * `closest('[data-space-id]')`, acotado por `requestAnimationFrame`, así que
 * no hay un listener por espacio. Un toque es un gesto corto y quieto; el
 * primero abre la tarjeta y el segundo sobre el mismo espacio abre la ficha.
 */
export class PlanPointerController {
  private readonly gestures = new GestureTracker();
  private readonly intent: HoverIntent;
  private touchState: TouchState = { openId: null };
  private pendingTarget: string | null = null;
  private hoverFrame = 0;
  private lastPointer: { x: number; y: number } | null = null;
  private editDragging = false;
  /** Lo que había bajo el puntero al bajar: con la captura, el blanco del `pointerup` es el SVG. */
  private downTarget: string | null = null;
  private downHandle: string | null = null;
  private downButton = 0;

  constructor(private readonly host: PointerHost) {
    this.intent = new HoverIntent((id, source) => this.onIntent(id, source));
  }

  /* ---- tarjeta ------------------------------------------------------------------- */

  get activeIntentId(): string | null {
    return this.intent.activeId;
  }

  cardEnter(): void {
    this.intent.cardEnter();
  }

  cardLeave(): void {
    this.intent.cardLeave();
  }

  closeCard(): void {
    this.intent.closeNow();
    this.touchState = { openId: null };
  }

  /** Escape: descarta sin mover el foco (WCAG 1.4.13). */
  dismiss(): void {
    this.intent.dismiss();
    this.touchState = { openId: null };
    this.host.emitHover(null);
  }

  focus(id: string): void {
    this.intent.focus(id);
  }

  blur(): void {
    this.intent.blur();
  }

  destroy(): void {
    if (this.hoverFrame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.hoverFrame);
    this.intent.destroy();
  }

  /** La vista cambió con la tarjeta abierta: se vuelve a anclar al espacio. */
  reanchor(focusVisible: boolean): void {
    const id = this.intent.activeId ?? this.touchState.openId;
    if (!id) return;
    const source: HoverSource | 'touch' = this.touchState.openId === id ? 'touch' : focusVisible ? 'focus' : 'pointer';
    this.emitHover(id, source);
  }

  private onIntent(id: string | null, source: HoverSource | null): void {
    if (id === null || source === null) {
      this.host.emitHover(null);
      return;
    }
    this.emitHover(id, source);
  }

  private emitHover(id: string, source: HoverSource | 'touch'): void {
    const svg = this.host.svg();
    const element = svg?.querySelector<SVGGraphicsElement>(`[data-space-id="${cssEscape(id)}"]`);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    this.host.emitHover({
      spaceId: id,
      source,
      anchor: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      pointer: this.lastPointer,
      bounds: this.host.hostRect(),
    });
  }

  /* ---- puntero --------------------------------------------------------------------- */

  targetOf(event: Event): { spaceId: string | null; handleId: string | null } {
    const element = event.target instanceof Element ? event.target : null;
    const handle = element?.closest('[data-handle-id]');
    if (handle) return { spaceId: null, handleId: handle.getAttribute('data-handle-id') };
    const space = element?.closest('[data-space-id]');
    return { spaceId: space?.getAttribute('data-space-id') ?? null, handleId: null };
  }

  private local(event: { clientX: number; clientY: number }): [number, number] {
    const rect = this.host.hostRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  toWorld(clientX: number, clientY: number): Point {
    return screenToWorld(this.host.view(), this.host.size(), this.local({ clientX, clientY }));
  }

  private worldEvent(phase: WorldPointerEvent['phase'], event: PointerEvent, target: { spaceId: string | null; handleId: string | null }): WorldPointerEvent {
    return {
      phase,
      world: this.toWorld(event.clientX, event.clientY),
      targetId: target.spaceId,
      handleId: target.handleId,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey || event.metaKey,
      pointerType: event.pointerType,
      detail: event.detail,
      scale: this.host.view().scale,
    };
  }

  onDown(event: PointerEvent): void {
    if (event.pointerType === 'touch') this.host.setTouchSeen();
    this.host.setFocusVisible(false);
    const [x, y] = this.local(event);
    this.gestures.down(event.pointerId, x, y, event.timeStamp);
    const target = this.targetOf(event);
    this.downTarget = target.spaceId;
    this.downHandle = target.handleId;
    this.downButton = event.button;
    const capture = (): void => (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    const panGesture = event.button === 1 || this.host.handTool() || this.host.interactionMode() === 'view';
    if (this.host.interactionMode() === 'edit' && !this.gestures.isPinching && !panGesture) {
      this.editDragging = true;
      capture();
      this.host.emitWorld(this.worldEvent('down', event, target));
      return;
    }
    capture();
    if (this.gestures.isPinching) this.host.setDragging(true);
  }

  onMove(event: PointerEvent): void {
    const [x, y] = this.local(event);
    this.lastPointer = { x: event.clientX, y: event.clientY };
    if (this.editDragging) {
      this.host.emitWorld(this.worldEvent('move', event, this.targetOf(event)));
      return;
    }
    const step = this.gestures.move(event.pointerId, x, y);
    if (step === null) {
      // Sin botón apretado: un paso del mouse (o un lápiz flotando) es intención de hover.
      if (this.host.interactionMode() === 'edit') {
        this.host.emitWorld(this.worldEvent('move', event, this.targetOf(event)));
        return;
      }
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') this.scheduleHover(this.targetOf(event).spaceId);
      return;
    }
    if (step.kind === 'pinch') {
      this.host.setDragging(true);
      this.intent.closeNow();
      this.host.setView(panBy(zoomAt(this.host.view(), this.host.size(), step.factor, [step.center.x, step.center.y]), step.dx, step.dy));
      return;
    }
    if (this.gestures.moved) {
      if (!this.host.dragging()) {
        this.host.setDragging(true);
        this.intent.closeNow();
        this.host.emitHover(null);
      }
      this.host.setView(panBy(this.host.view(), step.dx, step.dy));
    }
  }

  onUp(event: PointerEvent): void {
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
    if (this.editDragging) {
      this.editDragging = false;
      this.host.emitWorld(this.worldEvent('up', event, { spaceId: this.downTarget, handleId: this.downHandle }));
      this.gestures.up(event.pointerId, event.timeStamp);
      return;
    }
    const { wasTap } = this.gestures.up(event.pointerId, event.timeStamp);
    if (this.gestures.count === 0) this.host.setDragging(false);
    if (!wasTap) return;
    const target = this.downTarget;
    if (event.pointerType === 'touch') {
      this.onTouchTap(target);
      return;
    }
    if (this.host.interactionMode() === 'edit' || this.downButton !== 0) return;
    this.host.emitPick(target);
    if (target) this.host.setActive(target);
    else this.intent.closeNow();
  }

  onCancel(event: PointerEvent): void {
    if (this.editDragging) {
      this.editDragging = false;
      this.host.emitWorld(this.worldEvent('cancel', event, { spaceId: null, handleId: null }));
    }
    this.gestures.cancel();
    this.host.setDragging(false);
  }

  onLeave(): void {
    this.pendingTarget = null;
    const id = this.host.hoveredId();
    if (id) this.intent.pointerLeave(id);
    this.host.setHovered(null);
  }

  onWheel(event: WheelEvent): void {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0025));
    this.host.setView(zoomAt(this.host.view(), this.host.size(), factor, this.local(event)));
  }

  private onTouchTap(target: string | null): void {
    const interactive = target !== null && this.host.isInteractive(target);
    const { state, outcome } = reduceTouch(this.touchState, interactive ? target : null);
    this.touchState = state;
    switch (outcome.action) {
      case 'open-card':
        this.host.setActive(outcome.id);
        this.host.emitPick(outcome.id);
        this.emitHover(outcome.id, 'touch');
        break;
      case 'open-file':
        this.host.emitOpen(outcome.id);
        break;
      case 'close':
        this.host.emitPick(null);
        this.host.emitHover(null);
        break;
      case 'none':
        this.host.emitPick(null);
        break;
    }
  }

  private scheduleHover(target: string | null): void {
    this.pendingTarget = target;
    if (this.hoverFrame) return;
    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = 0;
      this.applyHover(this.pendingTarget);
    });
  }

  private applyHover(target: string | null): void {
    const next = target !== null && this.host.isHoverable(target) ? target : null;
    const previous = this.host.hoveredId();
    if (next === previous) return;
    if (previous) this.intent.pointerLeave(previous);
    this.host.setHovered(next);
    if (next) this.intent.pointerEnter(next);
  }
}

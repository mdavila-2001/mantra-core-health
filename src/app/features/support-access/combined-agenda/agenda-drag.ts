import { signal, type WritableSignal } from '@angular/core';

import type { DropVerdict } from './agenda-actions';

/**
 * Arrastrar una cita sobre un horario libre para reprogramarla.
 *
 * Se hace con **eventos de puntero** y no con el arrastre nativo de HTML: así
 * sirve igual con mouse y lápiz, se ve un fantasma que sigue al puntero, el
 * horario de destino se pinta **antes de soltar** (verde si sirve, rojo con el
 * motivo si no) y `Escape` cancela. El arrastre no tiene versión de teclado
 * porque no la necesita: «Reprogramar» del panel hace lo mismo con un selector.
 *
 * El controlador no sabe de citas: le pregunta todo al anfitrión (qué hay bajo
 * el puntero, si ese destino sirve), y por eso se prueba sin DOM real.
 */
export interface DragHost {
  /** El id del horario bajo ese punto de la pantalla, o `null`. */
  hit(x: number, y: number): string | null;
  /** Si esa cita se puede arrastrar. */
  canStart(sourceId: string): boolean;
  verdict(sourceId: string, targetId: string): DropVerdict;
  label(sourceId: string): string;
  /** Soltó sobre un destino válido. */
  drop(sourceId: string, targetId: string): void;
  /** Soltó sobre un destino que no sirve o sobre nada. */
  rejected(sourceId: string, reason: string | null): void;
  /** Para desplazar la grilla cuando el puntero llega al borde. */
  autoscroll?(x: number, y: number): void;
}

export interface DragSnapshot {
  readonly sourceId: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly overId: string | null;
  readonly verdict: DropVerdict | null;
}

/** Lo que hay que moverse antes de que un clic se convierta en arrastre. */
export const DRAG_THRESHOLD_PX = 6;

export class AgendaDragController {
  readonly state: WritableSignal<DragSnapshot | null> = signal(null);

  private pending: { readonly id: string; readonly x: number; readonly y: number } | null = null;
  private swallowNextClick = false;

  constructor(
    private readonly host: DragHost,
    private readonly doc: Document,
  ) {}

  /** `pointerdown` sobre una cita arrastrable. Solo el botón principal del mouse o el lápiz. */
  pointerDown(event: PointerEvent, sourceId: string): void {
    if (event.button !== 0 || event.pointerType === 'touch' || !this.host.canStart(sourceId)) return;
    this.pending = { id: sourceId, x: event.clientX, y: event.clientY };
    this.doc.addEventListener('pointermove', this.onMove);
    this.doc.addEventListener('pointerup', this.onUp);
    this.doc.addEventListener('pointercancel', this.onCancel);
    this.doc.addEventListener('keydown', this.onKey);
  }

  /** Si el clic que sigue a soltar es el de cerrar el arrastre, no el de abrir la cita. */
  consumeClick(): boolean {
    const tragar = this.swallowNextClick;
    this.swallowNextClick = false;
    return tragar;
  }

  get dragging(): boolean {
    return this.state() !== null;
  }

  destroy(): void {
    this.stop();
    this.state.set(null);
  }

  private readonly onMove = (event: PointerEvent): void => {
    if (this.pending === null) return;
    const { id, x, y } = this.pending;
    if (this.state() === null && Math.hypot(event.clientX - x, event.clientY - y) < DRAG_THRESHOLD_PX) return;
    const over = this.host.hit(event.clientX, event.clientY);
    const overId = over === id ? null : over;
    this.state.set({
      sourceId: id,
      label: this.host.label(id),
      x: event.clientX,
      y: event.clientY,
      overId,
      verdict: overId === null ? null : this.host.verdict(id, overId),
    });
    this.host.autoscroll?.(event.clientX, event.clientY);
  };

  private readonly onUp = (): void => {
    const snapshot = this.state();
    const origen = this.pending?.id ?? null;
    this.stop();
    this.state.set(null);
    if (snapshot === null || origen === null) return; // fue un clic, no un arrastre
    // El `click` que sigue a soltar llega en la misma vuelta: si no llega, no se arrastra la bandera.
    this.swallowNextClick = true;
    setTimeout(() => (this.swallowNextClick = false), 0);
    if (snapshot.overId !== null && snapshot.verdict?.ok === true) this.host.drop(origen, snapshot.overId);
    else this.host.rejected(origen, snapshot.verdict !== null && !snapshot.verdict.ok ? snapshot.verdict.reason : null);
  };

  private readonly onCancel = (): void => {
    this.stop();
    this.state.set(null);
  };

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    this.stop();
    this.state.set(null);
  };

  private stop(): void {
    this.pending = null;
    this.doc.removeEventListener('pointermove', this.onMove);
    this.doc.removeEventListener('pointerup', this.onUp);
    this.doc.removeEventListener('pointercancel', this.onCancel);
    this.doc.removeEventListener('keydown', this.onKey);
  }
}

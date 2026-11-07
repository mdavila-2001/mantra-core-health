import { computed, signal } from '@angular/core';
import type { MensajeDelHilo } from '../../../core/messaging/chat.store';
import type { LineaDelHilo } from './thread';

/**
 * Which messages of the thread are selected to be forwarded together.
 *
 * Kept by key, so a thread refresh that rebuilds the message objects keeps the
 * selection. Only messages already on the server can be selected: a pending
 * one has nothing to forward yet.
 */
export class MessageSelection {
  private readonly claves = signal<ReadonlySet<string>>(new Set());

  readonly cantidad = computed(() => this.claves().size);
  /** Selection mode is on while something is selected, as in a messaging app. */
  readonly activa = computed(() => this.claves().size > 0);

  has(mensajes: readonly MensajeDelHilo[]): boolean {
    const claves = this.claves();
    return mensajes.length > 0 && mensajes.every((m) => claves.has(m.clave));
  }

  /** Selects them all, or unselects them all if they already were. */
  toggle(mensajes: readonly MensajeDelHilo[]): void {
    const enviados = mensajes.filter((m) => m.estado === 'enviado');
    const quitar = this.has(enviados);
    this.claves.update((actual) => {
      const nuevo = new Set(actual);
      for (const m of enviados) {
        if (quitar) nuevo.delete(m.clave);
        else nuevo.add(m.clave);
      }
      return nuevo;
    });
  }

  clear(): void {
    this.claves.set(new Set());
  }

  /** The selected messages, in thread order (the order they are forwarded in). */
  enOrden(lineas: readonly LineaDelHilo[]): MensajeDelHilo[] {
    const claves = this.claves();
    return lineas
      .flatMap((linea) => (linea.tipo === 'mensaje' ? [linea.mensaje] : linea.tipo === 'galeria' ? linea.mensajes : []))
      .filter((m) => claves.has(m.clave));
  }
}

import { effect, signal, untracked, type Signal } from '@angular/core';

import type { ChatStore } from '../../../core/messaging/chat.store';

/**
 * ALOVIDA Pulse · las burbujas AJENAS que llegaron con el hilo ya abierto.
 *
 * Sólo ésas entran con `pulse-arrive`: el historial que se carga al abrir la
 * conversación aparece quieto —animar cincuenta burbujas es una cortina, no
 * una señal— y lo que llega en vivo por el socket o el sondeo es justo lo que
 * hay que notar. Las propias no animan: su clave cambia de temporal a
 * definitiva al confirmarse y se reanimarían dos veces.
 *
 * Con el hilo sin cargar se reinicia (otra conversación); en la primera carga
 * sólo se anota hasta dónde llega el hilo; después, lo que aparece DESPUÉS de
 * la última clave vista es nuevo. Las páginas de historial se agregan antes,
 * así que no cuentan.
 *
 * Se llama en un contexto de inyección: registra su propio `effect`.
 */
export function trackArrivals(store: ChatStore): Signal<ReadonlySet<string>> {
  const arrivals = signal<ReadonlySet<string>>(new Set());
  let lastSeenKey: string | null = null;

  effect(() => {
    const loaded = store.hiloCargado();
    const messages = store.enOrden();
    untracked(() => {
      if (!loaded) {
        lastSeenKey = null;
        if (arrivals().size > 0) {
          arrivals.set(new Set());
        }
        return;
      }
      const keys = messages.map((m) => m.clave);
      const previous = lastSeenKey;
      lastSeenKey = keys.length > 0 ? keys[keys.length - 1] : null;
      if (previous === null) {
        return;
      }
      const from = keys.indexOf(previous);
      if (from < 0) {
        return;
      }
      const own = store.perfil();
      const fresh = messages
        .slice(from + 1)
        .filter((m) => m.senderProfileId !== own)
        .map((m) => m.clave);
      if (fresh.length > 0) {
        arrivals.update((prev) => new Set([...prev, ...fresh]));
      }
    });
  });

  return arrivals.asReadonly();
}

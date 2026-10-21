import { Injectable, inject, signal } from '@angular/core';

import { CommunityClient } from '../data-access/community/community.client';
import type { ReactionType } from '../data-access/community/community.types';
import { OwnProfileStore } from './own-profile.store';

/** Cuántas lecturas de publicación pueden estar en vuelo a la vez. */
const SIMULTANEAS = 3;

/**
 * Qué reacción dejó **la persona con sesión** en cada publicación que mira.
 *
 * ## El hueco que cubre
 *
 * El feed público (`GET /public/posts`) no conoce a quien lo lee —es público,
 * sin sesión— y por eso no puede decir «ya recomendaste esto». Sin ese dato el
 * botón arrancaba siempre apagado: reaccionar, recargar y verlo apagado de
 * nuevo, aunque el servidor tuviera la reacción guardada. El detalle de una
 * publicación (`GET /community/posts/:id?actorProfileId=`) sí trae la reacción
 * propia, así que se pide **por publicación visible**, con tope de
 * {@link SIMULTANEAS} lecturas a la vez, y se recuerda.
 *
 * Que el servidor la incluya en el feed (o ofrezca una lectura por lote) es la
 * solución de fondo y está registrada como brecha de la API; esto es lo que
 * deja la pantalla honesta mientras tanto.
 *
 * ## Tres estados, no dos
 *
 * `undefined` = todavía no se sabe · `null` = se leyó y no reaccionó · un tipo
 * = su reacción. El botón no afirma «no recomendada» mientras no se sabe.
 */
@Injectable({ providedIn: 'root' })
export class PostActorStateStore {
  private readonly community = inject(CommunityClient);
  private readonly propio = inject(OwnProfileStore);

  private readonly reacciones = signal<Readonly<Record<string, ReactionType | null>>>({});
  private readonly pedidas = new Set<string>();
  private readonly cola: string[] = [];
  private enVuelo = 0;

  /** La reacción propia a una publicación; ver los tres estados arriba. Lee una señal. */
  reaccionDe(postId: string): ReactionType | null | undefined {
    return this.reacciones()[postId];
  }

  /**
   * Pide el estado de estas publicaciones (las que no se hayan pedido ya).
   * Se llama al cargar cada página del feed.
   */
  cargar(postIds: readonly string[]): void {
    if (this.propio.id() === null) return;
    for (const id of postIds) {
      if (this.pedidas.has(id)) continue;
      this.pedidas.add(id);
      this.cola.push(id);
    }
    this.avanzar();
  }

  /** Recuerda la reacción tras reaccionar o quitarla desde la tarjeta. */
  fijar(postId: string, reaccion: ReactionType | null): void {
    this.pedidas.add(postId);
    this.reacciones.update((actuales) => ({ ...actuales, [postId]: reaccion }));
  }

  /** Se olvida todo (al cambiar de sesión). */
  olvidar(): void {
    this.pedidas.clear();
    this.cola.length = 0;
    this.reacciones.set({});
  }

  private avanzar(): void {
    const actor = this.propio.id();
    if (actor === null) return;

    while (this.enVuelo < SIMULTANEAS && this.cola.length > 0) {
      const id = this.cola.shift()!;
      this.enVuelo += 1;
      this.community.readPost(id, { actorProfileId: actor }).subscribe({
        next: (detalle) => {
          // Una reacción que el usuario dejó mientras llegaba la lectura manda
          // sobre la lectura: es más nueva.
          this.reacciones.update((actuales) =>
            id in actuales ? actuales : { ...actuales, [id]: detalle.reactions.actorReactionType ?? null },
          );
          this.terminar();
        },
        // Si no se pudo, no se afirma nada: queda «no se sabe» y se puede reintentar.
        error: () => {
          this.pedidas.delete(id);
          this.terminar();
        },
      });
    }
  }

  private terminar(): void {
    this.enVuelo -= 1;
    this.avanzar();
  }
}

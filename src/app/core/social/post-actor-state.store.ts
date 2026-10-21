import { Injectable, inject, signal } from '@angular/core';
import { catchError, EMPTY, tap } from 'rxjs';

import { CommunityClient } from '../data-access/community/community.client';
import type { ReactionType } from '../data-access/community/community.types';
import { ColaAcotada } from './cola-acotada';

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

  private readonly reacciones = signal<Readonly<Record<string, ReactionType | null>>>({});
  private readonly imagenes = signal<Readonly<Record<string, readonly string[]>>>({});
  private readonly pedidas = new Set<string>();
  private readonly cola = new ColaAcotada(SIMULTANEAS);

  /**
   * Los `fileId` de las imágenes de una publicación, o `undefined` mientras no
   * se leyó su detalle.
   *
   * El feed personal (`GET /community/feed`) trae la publicación **sin sus
   * medios** (`PostListItem`); el detalle, que ya se pide para saber la
   * reacción propia, sí los trae. Se aprovecha esa misma lectura en vez de
   * pedir otra.
   */
  imagenesDe(postId: string): readonly string[] | undefined {
    return this.imagenes()[postId];
  }

  /** La reacción propia a una publicación; ver los tres estados arriba. Lee una señal. */
  reaccionDe(postId: string): ReactionType | null | undefined {
    return this.reacciones()[postId];
  }

  /**
   * Pide el estado de estas publicaciones (las que no se hayan pedido ya).
   *
   * El actor lo pasa **quien llama**, no se consulta en otro store: la tarjeta
   * recibe su `actorProfileId` y pide en ese mismo instante, y el perfil propio
   * puede estar todavía leyéndose. Consultarlo acá descartaba el pedido sin
   * dejar rastro (`null` → no se pide, no se marca como pedido y nadie vuelve a
   * llamar), y el botón quedaba apagado para siempre tras recargar.
   *
   * @param postIds - Las publicaciones visibles.
   * @param actorProfileId - El perfil de quien mira.
   */
  cargar(postIds: readonly string[], actorProfileId: string): void {
    const actor = actorProfileId;

    for (const id of postIds) {
      if (this.pedidas.has(id)) continue;
      this.pedidas.add(id);
      this.cola.encolar(() =>
        this.community.readPost(id, { actorProfileId: actor }).pipe(
          tap((detalle) =>
            // Una reacción que el usuario dejó mientras llegaba la lectura manda
            // sobre la lectura: es más nueva.
            {
              this.reacciones.update((actuales) =>
                id in actuales ? actuales : { ...actuales, [id]: detalle.reactions.actorReactionType ?? null },
              );
              this.imagenes.update((actuales) => ({
                ...actuales,
                [id]: (detalle.media ?? []).map((m) => m.fileId),
              }));
            },
          ),
          // Si no se pudo, no se afirma nada: queda «no se sabe» y se puede reintentar.
          catchError(() => {
            this.pedidas.delete(id);
            return EMPTY;
          }),
        ),
      );
    }
  }

  /** Recuerda la reacción tras reaccionar o quitarla desde la tarjeta. */
  fijar(postId: string, reaccion: ReactionType | null): void {
    this.pedidas.add(postId);
    this.reacciones.update((actuales) => ({ ...actuales, [postId]: reaccion }));
  }

  /**
   * Deshace un {@link fijar} cuando la escritura falló: vuelve a lo que había.
   * Si lo anterior era «no se sabe» (`undefined`) se olvida la publicación y
   * puede volver a pedirse; afirmar `null` sería inventar que no reaccionó.
   */
  restaurar(postId: string, anterior: ReactionType | null | undefined): void {
    if (anterior === undefined) {
      this.pedidas.delete(postId);
      this.reacciones.update((actuales) => {
        const { [postId]: _olvidada, ...resto } = actuales;
        return resto;
      });
      return;
    }
    this.reacciones.update((actuales) => ({ ...actuales, [postId]: anterior }));
  }

  /** Se olvida todo (al cambiar de sesión). */
  olvidar(): void {
    this.pedidas.clear();
    this.cola.vaciar();
    this.reacciones.set({});
    this.imagenes.set({});
  }
}

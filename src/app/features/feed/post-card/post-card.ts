import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { CommunityClient } from '../../../core/data-access/community/community.client';
import type {
  PostListItem,
  ReactionType,
} from '../../../core/data-access/community/community.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Card } from '../../../shared/components/molecules/card/card';

/**
 * Una publicación del muro.
 *
 * ## Está en `features/feed/` y no en el banco, a propósito
 *
 * El carril la pedía reusable por el muro por-perfil. Reusable no es lo mismo
 * que del banco: una pieza del banco no conoce el dominio, y ésta habla de
 * publicaciones, reacciones y `CommunityClient`. Vive acá y se importa desde
 * donde haga falta — el día que exista una segunda superficie que la use se ve
 * si conviene mover algo, pero adelantarlo sería inventar la abstracción antes
 * del segundo caso.
 *
 * ## La reacción es optimista, y por qué eso está bien acá
 *
 * El conteo sube antes de que el servidor conteste, y vuelve atrás si falla.
 * Es aceptable porque **una reacción no es un dato clínico**: si se pierde, no
 * pasa nada grave y el gesto se repite. La misma técnica sobre una receta sería
 * inaceptable.
 *
 * ## Lo que no hace
 *
 * No trae el nombre del autor: la lectura del muro devuelve
 * `authorPublicProfileId` y nada más. Resolverlo serían N peticiones por
 * pantalla; lo correcto es que el backend lo incluya en `FeedListItem`, y hasta
 * entonces se muestra el identificador acortado en vez de inventar un nombre.
 */
@Component({
  selector: 'app-post-card',
  imports: [AppButton, Badge, Card, DatePipe],
  templateUrl: './post-card.html',
  styleUrl: './post-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostCard {
  private readonly community = inject(CommunityClient);

  /** La publicación a pintar. */
  readonly post = input.required<PostListItem>();

  /**
   * Quién mira, si hay sesión con perfil público.
   *
   * Sin actor la tarjeta se lee igual pero **no se puede reaccionar**: el
   * contrato exige el perfil, no lo deduce de la sesión.
   */
  readonly actorProfileId = input<string | null>(null);

  /** Se emite cuando la reacción quedó guardada, por si el muro recarga. */
  readonly reacted = output<void>();

  protected readonly reacciones = signal(0);
  protected readonly reaccionPropia = signal<ReactionType | null>(null);
  protected readonly error = signal('');

  protected readonly puedeReaccionar = computed(
    () => this.actorProfileId() !== null,
  );

  /** El autor, acortado. No es su nombre: la lectura no lo trae. */
  protected readonly autor = computed(
    () => this.post().authorPublicProfileId.slice(0, 8),
  );

  protected reaccionar(tipo: ReactionType): void {
    const actor = this.actorProfileId();
    if (actor === null) {
      return;
    }

    const anterior = this.reaccionPropia();
    const conteoAnterior = this.reacciones();

    // Optimista: el gesto se siente inmediato. Se revierte si el servidor falla.
    this.reaccionPropia.set(tipo);
    this.reacciones.set(anterior === null ? conteoAnterior + 1 : conteoAnterior);
    this.error.set('');

    this.community
      .react({
        actorProfileId: actor,
        reactableType: 'POST',
        reactableRefId: this.post().id,
        reactionType: tipo,
      })
      .subscribe({
        next: () => this.reacted.emit(),
        error: () => {
          this.reaccionPropia.set(anterior);
          this.reacciones.set(conteoAnterior);
          this.error.set('No pudimos guardar tu reacción.');
        },
      });
  }
}

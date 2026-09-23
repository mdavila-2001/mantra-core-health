import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SessionStore } from '@core/auth/session.store';
import type { OwnPublicProfile } from '@core/data-access/community/community.types';
import type { PublicProfileDetail } from '@core/data-access/public-directory/public-directory.types';
import { inicialesDe } from '@shared/text/iniciales';

/**
 * La versión mini del perfil propio, en la columna derecha de la red social.
 *
 * ## Qué muestra y de dónde sale
 *
 * Portada, retrato, nombre y titular vienen de la vitrina propia
 * (`community/profiles/me`) y, cuando quien mira es profesional, de su ficha
 * pública —que es la única que sirve la foto y la portada como URL—. Sin
 * vitrina se ofrece crearla: la tarjeta es una puerta, no un hueco.
 *
 * ## Por qué no pide nada
 *
 * Quien la monta (`FeedPublicaciones`) ya resolvió la vitrina para saber si se
 * puede publicar, y pedirla dos veces por pantalla es el defecto que `app-tab`
 * tuvo en `/my-account`. Esta tarjeta sólo pinta lo que le pasan.
 */
@Component({
  selector: 'app-feed-perfil-mini',
  imports: [RouterLink],
  templateUrl: './feed-perfil-mini.html',
  styleUrl: './feed-perfil-mini.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedPerfilMini {
  private readonly sesion = inject(SessionStore);

  /** La vitrina propia, o `null` si todavía no la creó. */
  readonly perfil = input<OwnPublicProfile | null>(null);
  /** Si ya se sabe si hay vitrina o no. Antes de eso, esqueleto. */
  readonly resuelto = input(false);
  /** La ficha pública, cuando quien mira es profesional y la tiene. */
  readonly detalle = input<PublicProfileDetail | null>(null);

  /** El nombre para saludar cuando no hay vitrina: el del token. */
  protected readonly nombreDeSesion = computed(() => this.sesion.displayName() ?? 'Tu cuenta');

  protected readonly nombre = computed(
    () => this.perfil()?.displayName ?? this.nombreDeSesion(),
  );

  protected readonly iniciales = computed(() => inicialesDe(this.nombre()));

  protected readonly foto = computed(() => this.detalle()?.avatarUrl ?? null);

  protected readonly portada = computed(() => {
    const url = this.detalle()?.coverUrl;
    return url ? `url(${url})` : null;
  });

  /**
   * Adónde lleva el nombre: a la ficha pública si la hay.
   *
   * Sólo los profesionales tienen ficha bajo `/p`; la vitrina de un paciente
   * no tiene URL pública, así que su nombre no es enlace.
   */
  protected readonly enlacePublico = computed<readonly string[] | null>(() => {
    const d = this.detalle();
    return d === null ? null : ['/p', d.slug];
  });

  protected readonly esPublica = computed(() => this.perfil()?.visibility === 'PUBLIC');
}

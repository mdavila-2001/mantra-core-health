import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SessionStore } from '@core/auth/session.store';
import { ROLES_DE_QUIEN_ATIENDE } from '@core/navigation/navigation.map';
import type { OwnPublicProfile } from '@core/data-access/community/community.types';
import { inicialesDe } from '@shared/text/initials';
import { Composer } from '../../../../feed/composer/composer';

/**
 * «Crear publicación» — la barra de arriba del feed, para quien tiene sesión.
 *
 * ## Cerrada por omisión, y por qué
 *
 * El compositor entero (`app-composer`) mide cuatro renglones más el selector
 * de visibilidad más las acciones: abierto siempre, empuja la primera
 * publicación media pantalla hacia abajo, y la red social es para leer antes
 * que para escribir. Cerrada es un retrato y una píldora que dice qué pasa al
 * tocarla; abierta es el mismo compositor del muro con sesión —no hay dos
 * formularios de publicar—.
 *
 * ## Sin vitrina no se esconde: se ofrece crearla
 *
 * Publicar exige la vitrina pública, que es una entidad aparte de la cuenta.
 * Quien entró y no la tiene ve la misma barra con la invitación, porque un
 * hueco donde debería estar «Crear publicación» se lee como una pantalla rota.
 */
@Component({
  selector: 'app-feed-crear-publicacion',
  imports: [Composer, RouterLink],
  templateUrl: './feed-crear-publicacion.html',
  styleUrl: './feed-crear-publicacion.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedCrearPublicacion {
  private readonly sesion = inject(SessionStore);

  /** La vitrina propia, o `null` si todavía no la creó. */
  readonly perfil = input<OwnPublicProfile | null>(null);
  /** Si ya se sabe si hay vitrina. Antes de eso, esqueleto. */
  readonly resuelto = input(false);
  /** La foto de la vitrina, ya resuelta a URL, si la hay. */
  readonly foto = input<string | null>(null);

  /** Se publicó algo: quien monta la barra recarga el feed. */
  readonly publicado = output<string>();

  protected readonly abierto = signal(false);

  protected readonly nombre = computed(
    () => this.perfil()?.displayName ?? this.sesion.displayName() ?? 'Su cuenta',
  );

  protected readonly iniciales = computed(() => inicialesDe(this.nombre()));

  /**
   * Si «Escribir artículo» lleva al compositor de artículos médicos.
   *
   * Esa pantalla —títulos desplegables, listas, imágenes intercaladas— es de
   * quien atiende, y la ruta lo exige. Para el resto el atajo sigue abriendo el
   * compositor del muro, como antes: mandar a un paciente a una ruta que lo va
   * a rebotar sería peor que no ofrecérsela.
   */
  protected readonly escribeArticulos = computed(() =>
    this.sesion.roles().some((rol) => ROLES_DE_QUIEN_ATIENDE.includes(rol)),
  );

  protected abrir(): void {
    this.abierto.set(true);
  }

  protected cerrar(): void {
    this.abierto.set(false);
  }

  protected alPublicar(id: string): void {
    this.abierto.set(false);
    this.publicado.emit(id);
  }
}

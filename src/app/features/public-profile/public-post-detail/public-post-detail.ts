import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import type { PerfilPublicoResuelto } from '../public-profile.resolver';
import { inicialesDe } from '@shared/text/iniciales';
import { PublicPostCard } from '../public-post-card/public-post-card';

/**
 * La vista de **una** publicación, con su URL propia
 * (`/p/:slug/post/:postId`).
 *
 * ## Por qué reusa el resolver del perfil
 *
 * La ficha pública ya trae hasta veinte publicaciones en una sola respuesta, y
 * esta pantalla necesita una de ésas. Pedir un endpoint nuevo por publicación
 * sería un viaje de más para un dato que el resolver del perfil ya cargó; acá
 * se busca por id dentro de lo que vino. Si el perfil no existe o la
 * publicación no está entre las públicas, es el mismo «no está» que una ficha
 * inexistente —no se distingue «privada» de «no existe», igual que en la ficha.
 */
@Component({
  selector: 'app-public-post-detail',
  imports: [RouterLink, PublicPostCard],
  templateUrl: './public-post-detail.html',
  styleUrl: './public-post-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicPostDetail {
  private readonly ruta = inject(ActivatedRoute);

  private readonly datos = toSignal(this.ruta.data, { requireSync: true });
  private readonly params = toSignal(this.ruta.paramMap, { requireSync: true });

  protected readonly perfil = computed(
    () => this.datos()['perfil'] as PerfilPublicoResuelto,
  );

  protected readonly publicacion = computed(() => {
    const perfil = this.perfil();
    const id = this.params().get('postId');
    if (!perfil || !id) return null;
    return perfil.posts.find((post) => post.id === id) ?? null;
  });

  protected readonly iniciales = computed(() => {
    const perfil = this.perfil();
    return perfil ? inicialesDe(perfil.displayName) : '';
  });
}

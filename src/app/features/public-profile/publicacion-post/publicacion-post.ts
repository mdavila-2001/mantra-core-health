import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { PublicPostSummary } from '@core/data-access/public-directory/public-directory.types';

/**
 * Una publicación, con la anatomía de una entrada de feed de red social:
 * firma, cuerpo, imágenes y la fila de interacción.
 *
 * Vive en su propio componente porque se dibuja en **dos** pantallas —el feed
 * de la ficha pública y la vista de una publicación suelta (`/p/:slug/publicacion/:id`)—
 * y dos copias del mismo marcado divergen en la primera corrección. La única
 * diferencia entre las dos es `enfocada`: en la vista suelta el cuerpo va
 * entero y no se recorta.
 */
@Component({
  selector: 'app-publicacion-post',
  imports: [DatePipe, RouterLink],
  templateUrl: './publicacion-post.html',
  styleUrl: './publicacion-post.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicacionPost {
  readonly post = input.required<PublicPostSummary>();
  readonly autorNombre = input.required<string>();
  readonly autorHeadline = input<string | null>(null);
  readonly autorAvatar = input<string | null>(null);
  readonly autorIniciales = input.required<string>();
  /** El slug del perfil dueño: la firma y la fecha enlazan a la publicación. */
  readonly slug = input.required<string>();
  /** En la vista de una publicación suelta el cuerpo no se recorta. */
  readonly enfocada = input(false);

  private readonly expandido = signal(false);

  private readonly TOPE_RECORTE = 360;

  protected readonly recortable = computed(
    () => !this.enfocada() && this.post().bodyText.length > this.TOPE_RECORTE,
  );

  protected readonly recortado = computed(() => this.recortable() && !this.expandido());

  protected readonly enlacePost = computed(() => [
    '/p',
    this.slug(),
    'publicacion',
    this.post().id,
  ]);

  protected alternar(): void {
    this.expandido.update((v) => !v);
  }

  /**
   * Parte el cuerpo en texto y enlaces, para pintar las URLs como `<a>` sin
   * pasar por `innerHTML`. Reconoce `http(s)://…` y `www.…`.
   */
  protected readonly segmentos = computed<
    readonly { readonly texto: string; readonly href: string | null }[]
  >(() => {
    const texto = this.post().bodyText;
    const patron = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    const salida: { texto: string; href: string | null }[] = [];
    let ultimo = 0;
    for (const coincidencia of texto.matchAll(patron)) {
      const inicio = coincidencia.index ?? 0;
      if (inicio > ultimo) salida.push({ texto: texto.slice(ultimo, inicio), href: null });
      const crudo = coincidencia[0];
      const limpio = crudo.replace(/[.,;:)\]]+$/, '');
      const sobra = crudo.slice(limpio.length);
      salida.push({ texto: limpio, href: limpio.startsWith('http') ? limpio : `https://${limpio}` });
      if (sobra) salida.push({ texto: sobra, href: null });
      ultimo = inicio + crudo.length;
    }
    if (ultimo < texto.length) salida.push({ texto: texto.slice(ultimo), href: null });
    return salida.length > 0 ? salida : [{ texto, href: null }];
  });
}

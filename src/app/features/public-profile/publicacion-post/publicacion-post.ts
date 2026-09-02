import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SessionStore } from '@core/auth/session.store';
import type { PublicPostSummary } from '@core/data-access/public-directory/public-directory.types';
import { PostPreferencesMenu } from '@shared/components/molecules/post-preferences-menu/post-preferences-menu';

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
  imports: [DatePipe, PostPreferencesMenu, RouterLink],
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
  /**
   * Si el nombre del autor lleva al perfil.
   *
   * En la ficha de alguien, no: el nombre de arriba de cada post es el dueño de
   * la página que ya se está mirando, y un enlace que no lleva a ningún lado
   * nuevo es ruido. En el feed mezclado, sí: es cómo se pasa de leer algo a
   * ver quién lo escribió.
   */
  readonly autorEnlazado = input(false);

  /* ---- menú de preferencias (AC-01-15 a AC-01-18) ------------------------ */

  /**
   * Las tres acciones que exigen dominio suben a quien monte la tarjeta.
   *
   * La molécula del menú resuelve sola copiar, compartir, navegar y mandar a
   * `/auth` con retorno; lo que toca a la comunidad —denunciar, dejar de ver,
   * contactar— sale por acá porque el destinatario cambia según la pantalla, y
   * porque una tarjeta que llamara a `community.client` dejaría de servir para
   * dibujar una publicación de cualquier otra cosa.
   */
  readonly pedidoDeOcultar = output<string>();
  readonly pedidoDeDenuncia = output<string>();
  readonly pedidoDeContacto = output<string>();

  private readonly sesion = inject(SessionStore);

  /** Si hay sesión: decide si el menú actúa o manda a entrar (AC-01-17). */
  protected readonly haySesion = this.sesion.isAuthenticated;

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

  /* ---- galería de imágenes (AC-01-7, AC-01-8) ---------------------------- */

  /**
   * Qué imagen se está viendo, en base 0.
   *
   * Se reinicia sola cuando cambia la publicación: el mismo componente se
   * reutiliza al paginar el feed, y sin esto una publicación de dos imágenes
   * que cae donde había una de cinco abriría en el índice 4 —fuera de rango—.
   * Por eso el índice se acota al leerlo en vez de guardarse ya acotado: es un
   * `computed` derivado, no un estado que haya que recordar sincronizar.
   */
  private readonly indiceElegido = signal(0);

  protected readonly tieneVariasImagenes = computed(() => this.post().mediaUrls.length > 1);

  /** El índice válido: acotado al rango de la publicación que se esté viendo. */
  protected readonly indiceVisible = computed(() => {
    const ultimo = Math.max(0, this.post().mediaUrls.length - 1);
    return Math.min(Math.max(this.indiceElegido(), 0), ultimo);
  });

  /** Lo que ve una persona: 1 de N, no 0 de N. */
  protected readonly numeroVisible = computed(() => this.indiceVisible() + 1);

  protected readonly imagenVisible = computed(
    () => this.post().mediaUrls[this.indiceVisible()] ?? '',
  );

  /**
   * En los extremos el botón queda `disabled` en vez de dar la vuelta.
   *
   * Un carrusel circular sin aviso hace que «siguiente» en la última imagen
   * devuelva a la primera sin decirlo, y quien no ve la pantalla no tiene cómo
   * saber que ya recorrió todo.
   */
  protected readonly hayAnterior = computed(() => this.indiceVisible() > 0);

  protected readonly haySiguiente = computed(
    () => this.indiceVisible() < this.post().mediaUrls.length - 1,
  );

  protected verAnterior(): void {
    this.indiceElegido.set(Math.max(0, this.indiceVisible() - 1));
  }

  protected verSiguiente(): void {
    const ultimo = this.post().mediaUrls.length - 1;
    this.indiceElegido.set(Math.min(ultimo, this.indiceVisible() + 1));
  }

  protected readonly enlaceAutor = computed(() => ['/p', this.slug()]);

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

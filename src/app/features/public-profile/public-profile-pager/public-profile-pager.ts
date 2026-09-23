import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

/**
 * **Anterior / siguiente para una lista de la ficha pública.**
 *
 * Es la misma lógica de botones que el carrusel de imágenes de una publicación
 * (`public-post-card`): dos botones redondos con chevrón, un «n de N» en texto
 * entre ellos, y en los extremos el botón queda deshabilitado en vez de dar la
 * vuelta — quien no ve la pantalla no tiene cómo saber que ya recorrió todo si
 * «siguiente» lo devuelve al principio sin avisar.
 *
 * `page` es **0-based** por dentro y se muestra 1-based. Con una sola página no
 * dibuja nada: un paginador que no pagina es ruido.
 */
@Component({
  selector: 'app-public-profile-pager',
  templateUrl: './public-profile-pager.html',
  styleUrl: './public-profile-pager.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicProfilePager {
  /** Cuántos elementos hay en total. */
  readonly total = input.required<number>();
  /** Cuántos entran en una página. */
  readonly pageSize = input.required<number>();
  /** La página visible, desde 0. */
  readonly page = model(0);
  /** Qué se está paginando, para el nombre accesible: «publicaciones». */
  readonly label = input('elementos');
  /** Prefijo de los `data-testid` de los botones. */
  readonly testId = input('pager');

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(Math.max(0, this.total()) / Math.max(1, this.pageSize()))),
  );

  /** La página pedida, acotada: si la lista se achica, no queda en una que ya no existe. */
  readonly currentPage = computed(() =>
    Math.min(Math.max(0, Math.trunc(this.page()) || 0), this.totalPages() - 1),
  );

  protected readonly hayAnterior = computed(() => this.currentPage() > 0);
  protected readonly haySiguiente = computed(() => this.currentPage() < this.totalPages() - 1);

  protected verAnterior(): void {
    this.page.set(Math.max(0, this.currentPage() - 1));
  }

  protected verSiguiente(): void {
    this.page.set(Math.min(this.totalPages() - 1, this.currentPage() + 1));
  }
}

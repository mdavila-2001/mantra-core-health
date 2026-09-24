import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';
import { filter } from 'rxjs';

import { AppButtonLink } from '../../atoms/button/button-link';
import type { SearchResultItem } from '../search-result/search-result.types';

/**
 * Un resultado de directorio **en tarjeta de grilla**.
 *
 * Es el hermano vertical de {@link SearchResult}: mismo dato de entrada
 * —`SearchResultItem`—, distinta forma. La fila se lee de corrido y sirve para
 * una lista larga que se recorre; la tarjeta se hojea de un vistazo y sirve
 * para una grilla que se compara. El cliente pidió lo segundo para los cuatro
 * directorios (A1 del plan de UX del 22/08/2026): «Grilla de directorio de lab
 * … y todos los anteriores».
 *
 * ## Por qué es un componente hermano y no una variante de `search-result`
 *
 * Porque `search-result` **no tiene CSS propio a propósito**: su diseño vive en
 * `src/styles/alovida.css` §25, que es una copia del CSS de la bóveda y se
 * vuelve a copiar entera cuando diseño corrige algo. Una variante de grilla
 * escrita ahí desaparecería en silencio en la primera recopia — y una que
 * viviera en el componente rompería la regla que ese archivo declara.
 *
 * Así que la grilla nace con estilos **encapsulados** en su propio componente,
 * que es lo que la hace sobrevivir a la próxima copia. Lo que sí se comparte
 * es lo único que importaba compartir: **el tipo de dato**. Los mappers de las
 * cuatro pantallas ya producen `SearchResultItem` y no se toca ninguno.
 *
 * ## Lo que proyecta
 *
 * El pie de la tarjeta (`<ng-content>`): ahí va el botón que cada directorio
 * necesite —«Pedir turno», «Ver oferta», «Cómo llegar»— por la misma razón por
 * la que la fila proyecta su tercera columna. Sin contenido proyectado, el pie
 * no se dibuja.
 */
@Component({
  selector: 'li[app-result-card]',
  imports: [AppButtonLink],
  templateUrl: './result-card.html',
  styleUrl: './result-card.css',
  host: { class: 'tarjeta-resultado' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultCard {
  private readonly router = inject(Router);

  /** El resultado a pintar. Es el mismo tipo que consume la fila. */
  readonly resultado = input.required<SearchResultItem>();

  /**
   * Bloquea activaciones repetidas mientras el router resuelve el destino.
   *
   * Es opt-in porque esta molécula también pinta resultados que no representan
   * una navegación costosa. El directorio de médicos la habilita; sus demás
   * consumidores conservan exactamente su interacción anterior.
   */
  readonly preventDuplicateNavigation = input(false);

  /** El enlace de esta tarjeta ya inició una navegación. */
  protected readonly navegando = signal(false);

  /**
   * Cuántas líneas de contexto entran antes de recortar.
   *
   * En grilla todas las tarjetas comparten alto de fila: una con seis líneas
   * estira a las cinco vecinas y deja la grilla llena de aire. Dos es lo que
   * la maqueta muestra, y lo que se recorta sigue estando en la ficha.
   */
  readonly maximoDeMeta = input(2);

  protected readonly meta = computed(() =>
    (this.resultado().meta ?? []).slice(0, this.maximoDeMeta()),
  );

  /**
   * Una foto rota no puede dejar el cuadrado vacío: cae a `figureText`.
   *
   * Mismo patrón que `Avatar.imageFailed` — `linkedSignal` sobre la fuente y no
   * `signal` + `set` — así una tarjeta que el `@for` reutiliza al pasar de
   * página con una foto nueva tiene su propia oportunidad, en vez de quedar en
   * el fallback para siempre por el error de la anterior. Reproducido con el
   * directorio real: un `avatarUrl` sembrado cuya versión todavía no pasó el
   * escaneo de malware responde 422, y sin esto quedaba un ícono de imagen rota
   * en la tarjeta en vez del cuadrado con iniciales que ya sabe dibujar.
   */
  protected readonly imagenFallo = linkedSignal({
    source: this.resultado,
    computation: () => false,
  });

  protected readonly mostrarImagen = computed(
    () => Boolean(this.resultado().figureImageUrl) && !this.imagenFallo(),
  );

  protected manejarErrorDeImagen(): void {
    this.imagenFallo.set(true);
  }

  constructor() {
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd | NavigationCancel | NavigationError =>
            event instanceof NavigationEnd ||
            event instanceof NavigationCancel ||
            event instanceof NavigationError,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.navegando.set(false));
  }

  /** Inicia una navegación una sola vez; clic y Enter llegan por este mismo evento. */
  protected navegar(event: MouseEvent, link = this.resultado().link, fragment?: string): void {
    if (!this.preventDuplicateNavigation()) {
      return;
    }
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    if (this.navegando()) {
      return;
    }
    this.navegando.set(true);
    void this.router.navigateByUrl(fragment === undefined ? link : `${link}#${fragment}`);
  }
}

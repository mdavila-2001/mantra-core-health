import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';

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
 * `src/styles/redsat.css` §25, que es una copia del CSS de la bóveda y se
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
  imports: [RouterLink],
  templateUrl: './result-card.html',
  styleUrl: './result-card.css',
  host: { class: 'tarjeta-resultado' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultCard {
  /** El resultado a pintar. Es el mismo tipo que consume la fila. */
  readonly resultado = input.required<SearchResultItem>();

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
}

import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import {
  outlineArticle,
  parseArticle,
  type ArticleBlock,
  type ArticleOutline,
} from '../../../text/article-markup';
import { Accordion } from '../../molecules/accordion/accordion';
import { AccordionPanel } from '../../molecules/accordion/accordion-panel/accordion-panel';

/**
 * Un artículo médico, para leer: la introducción a la vista y cada título como
 * una sección desplegable, con sus subtítulos desplegables adentro.
 *
 * ```html
 * <app-article-body [body]="post.bodyText" [images]="urls" />
 * ```
 *
 * ## Qué se abre de entrada
 *
 * La primera sección, y nada más (decisión del propietario, 30/09/2026): se ve
 * el índice del artículo de un vistazo y el comienzo ya está leído. Varias
 * pueden quedar abiertas a la vez (`multi`): leer no es un formulario donde
 * una sección excluye a la otra.
 *
 * ## Sin `innerHTML`
 *
 * El cuerpo lo escribió otra persona. Se parte con `parseArticle` y se pinta
 * nodo por nodo desde la plantilla: lo que no es marca conocida sale como
 * texto, un `<script>` incluido.
 */
@Component({
  selector: 'app-article-body',
  imports: [Accordion, AccordionPanel, NgTemplateOutlet],
  templateUrl: './article-body.html',
  styleUrl: './article-body.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleBody {
  /** El `bodyText` del post, en el formato de `article-markup`. */
  readonly body = input.required<string>();

  /**
   * URL de cada imagen del post, en el orden de `media[]`: la referencia
   * `imagen:N` del texto apunta a `images[N]`. Una referencia sin URL no se pinta.
   */
  readonly images = input<readonly (string | null)[]>([]);

  /**
   * Nivel de los títulos del artículo; los subtítulos van uno más abajo. Por
   * omisión 3: el artículo casi siempre vive dentro de una página que ya tiene
   * su `h1` y un `h2` de sección.
   */
  readonly headingLevel = input<2 | 3>(3);

  protected readonly outline = computed<ArticleOutline>(() => outlineArticle(parseArticle(this.body())));
  protected readonly subheadingLevel = computed(() => (this.headingLevel() + 1) as 3 | 4);

  /** Imágenes que no cargaron: se muestra su descripción en lugar del hueco. */
  private readonly fallidas = signal<ReadonlySet<number>>(new Set());

  protected urlDe(block: ArticleBlock & { kind: 'image' }): string | null {
    return this.images()[block.index] ?? null;
  }

  protected fallo(indice: number): boolean {
    return this.fallidas().has(indice);
  }

  protected alFallar(indice: number): void {
    this.fallidas.update((previas) => new Set(previas).add(indice));
  }
}

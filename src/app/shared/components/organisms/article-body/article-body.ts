import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  signal,
} from '@angular/core';

import {
  articleStats,
  flattenSections,
  outlineArticle,
  parseArticle,
  type ArticleBlock,
  type ArticleOutline,
  type ArticleSection,
} from '../../../text/article-markup';
import { Accordion } from '../../molecules/accordion/accordion';
import { AccordionPanel } from '../../molecules/accordion/accordion-panel/accordion-panel';

/** Nivel HTML más bajo que se usa: por debajo de `h6` no hay encabezado. */
const NIVEL_MAXIMO = 6;

/** Con cuántas secciones en total vale la pena mostrar el índice. */
const SECCIONES_PARA_INDICE = 3;

let instancias = 0;

/**
 * Un artículo médico, para leer: la introducción a la vista y cada título como
 * una sección desplegable, con sus subtítulos y apartados desplegables adentro.
 *
 * ```html
 * <app-article-body [body]="post.bodyText" [images]="urls" />
 * ```
 *
 * ## Qué se abre de entrada
 *
 * La primera sección, y nada más (decisión del propietario, 30/09/2026): se ve
 * la estructura del artículo de un vistazo y el comienzo ya está leído. Varias
 * pueden quedar abiertas a la vez (`multi`): leer no es un formulario donde
 * una sección excluye a la otra. «Expandir todo» y «Contraer todo» están para
 * quien prefiere leer de corrido.
 *
 * ## El índice
 *
 * Con tres secciones o más, arriba va un índice. Tocar una entrada abre esa
 * sección —y las que la contienen— y lleva el foco a su título: con lector de
 * pantalla, es la forma de saltar sin recorrer todo.
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** El `bodyText` del post, en el formato de `article-markup`. */
  readonly body = input.required<string>();

  /**
   * URL de cada imagen del post, en el orden de `media[]`: la referencia
   * `imagen:N` del texto apunta a `images[N]`. Una referencia sin URL no se pinta.
   */
  readonly images = input<readonly (string | null)[]>([]);

  /**
   * Nivel HTML de los títulos del artículo; subtítulos y apartados van uno y dos
   * más abajo. Por omisión 3: el artículo casi siempre vive dentro de una página
   * que ya tiene su `h1` y un `h2` de sección.
   */
  readonly headingLevel = input<2 | 3>(3);

  /** Prefijo de ids, único por artículo: puede haber varios en la misma página. */
  protected readonly prefijo = `articulo-${++instancias}`;

  protected readonly outline = computed<ArticleOutline>(() => outlineArticle(parseArticle(this.body())));
  protected readonly todas = computed(() => flattenSections(this.outline().sections));
  protected readonly stats = computed(() => articleStats(this.body()));
  protected readonly conIndice = computed(() => this.todas().length >= SECCIONES_PARA_INDICE);

  /** De quién cuelga cada sección, para abrir la cadena entera desde el índice. */
  private readonly padres = computed(() => {
    const mapa = new Map<string, string>();
    const recorrer = (secciones: readonly ArticleSection[]): void => {
      for (const s of secciones) {
        for (const hija of s.children) mapa.set(hija.id, s.id);
        recorrer(s.children);
      }
    };
    recorrer(this.outline().sections);
    return mapa;
  });

  /** Qué secciones están abiertas. Vuelve a «sólo la primera» si cambia el texto. */
  protected readonly abiertas = linkedSignal<ReadonlySet<string>>(() => {
    const primera = this.outline().sections[0];
    return new Set(primera ? [primera.id] : []);
  });

  protected readonly todasAbiertas = computed(() => this.todas().every((s) => this.abiertas().has(s.id)));
  protected readonly ningunaAbierta = computed(() => this.abiertas().size === 0);

  /** Imágenes que no cargaron: se muestra su descripción en lugar del hueco. */
  private readonly fallidas = signal<ReadonlySet<number>>(new Set());

  protected nivelDe(seccion: ArticleSection): 2 | 3 | 4 | 5 | 6 {
    return Math.min(this.headingLevel() + seccion.depth, NIVEL_MAXIMO) as 2 | 3 | 4 | 5 | 6;
  }

  protected abierta(id: string): boolean {
    return this.abiertas().has(id);
  }

  protected cambiar(id: string, abierta: boolean): void {
    this.abiertas.update((previas) => {
      const siguientes = new Set(previas);
      if (abierta) siguientes.add(id);
      else siguientes.delete(id);
      return siguientes;
    });
  }

  protected expandirTodo(): void {
    this.abiertas.set(new Set(this.todas().map((s) => s.id)));
  }

  protected contraerTodo(): void {
    this.abiertas.set(new Set());
  }

  /** Abre una sección (y las que la contienen) y lleva el foco a su título. */
  protected irA(id: string): void {
    this.abiertas.update((previas) => {
      const siguientes = new Set(previas);
      for (let actual: string | undefined = id; actual; actual = this.padres().get(actual)) siguientes.add(actual);
      return siguientes;
    });
    afterNextRender(
      () => {
        const disparador = this.host.nativeElement.querySelector<HTMLButtonElement>(
          `#${this.prefijo}-${id} .accordion-panel__trigger`,
        );
        const quieto = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        disparador?.scrollIntoView?.({ block: 'start', behavior: quieto ? 'auto' : 'smooth' });
        disparador?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

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

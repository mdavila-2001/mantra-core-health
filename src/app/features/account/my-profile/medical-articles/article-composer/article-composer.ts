import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { RichTextEditor } from '../../../../../shared/components/molecules/rich-text-editor/rich-text-editor';
import { HERRAMIENTAS } from '../../../../../shared/components/molecules/rich-text-editor/rich-text-editor.types';
import { htmlToArticle } from '../../../../../shared/text/article-markup';
import { SelectorEmojis } from '../../../../messaging/thread/composer/selector-emojis';

/**
 * Tope real de imágenes por publicación (`CreatePostDto.media`,
 * `@ArrayMaxSize(20)`): una más y el servidor rechaza el artículo entero.
 */
export const ARTICLE_IMAGE_MAX = 20;

/** Tope por imagen: el mismo que la foto de la vitrina. */
export const ARTICLE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Formatos que se aceptan. Los que cualquier navegador pinta sin sorpresas. */
export const ARTICLE_IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];

/** Tope real del texto de texto alternativo (`PostMediaInputDto.altText`, `@MaxLength(300)`). */
export const ARTICLE_IMAGE_ALT_MAX = 300;

/**
 * Lo que el artículo NO ofrece: el subrayado. El formato guardado es texto con
 * marcas y no tiene cómo expresarlo, así que aplicarlo sería perderlo al publicar.
 */
const HERRAMIENTAS_DE_ARTICULO = HERRAMIENTAS.filter((h) => h.comando !== 'underline');

/** Una imagen elegida, todavía sin subir. */
interface ImagenElegida {
  readonly key: string;
  readonly file: File;
  /** Vista previa local (`blob:`); se libera al quitarla o al salir. */
  readonly url: string;
  readonly alt: string;
}

/** Una imagen del borrador, en el orden en que aparece en el texto. */
export interface ArticleDraftImage {
  readonly file: File;
  readonly alt: string;
}

/** El artículo listo para publicar. */
export interface ArticleDraft {
  /** El cuerpo en el formato de `article-markup` (`![alt](imagen:N)` = `images[N]`). */
  readonly bodyText: string;
  readonly images: readonly ArticleDraftImage[];
}

/**
 * El compositor de un artículo médico: títulos, listas, negrita, cursiva,
 * emojis e imágenes intercaladas en el texto.
 *
 * ## Qué hace y qué no
 *
 * Arma el borrador ({@link draft}); **no publica**. Subir las imágenes y
 * mandar el post es de la pantalla, que es quien sabe de la vitrina y de qué
 * hacer si falla. Así este componente no depende de la red y se prueba solo.
 *
 * ## Por qué el texto alternativo es obligatorio
 *
 * Una imagen de un artículo médico casi siempre es información —una
 * radiografía, un esquema—, no adorno. Sin descripción, quien lee con lector
 * de pantalla se pierde justo esa parte. Publicar queda apagado hasta que cada
 * imagen tenga la suya, y la pantalla dice cuál falta.
 */
@Component({
  selector: 'app-article-composer',
  imports: [AppButton, FormField, Input, RichTextEditor, SelectorEmojis],
  templateUrl: './article-composer.html',
  styleUrl: './article-composer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleComposer {
  /** Tope del cuerpo ya convertido, el que valida el servidor. */
  readonly maxLength = input(20000);

  /** Mientras se publica, nada se puede tocar. */
  readonly disabled = input(false);

  protected readonly herramientas = HERRAMIENTAS_DE_ARTICULO;
  protected readonly formatos = ARTICLE_IMAGE_TYPES.join(',');
  protected readonly maximoDeImagenes = ARTICLE_IMAGE_MAX;
  protected readonly maximoDeAlt = ARTICLE_IMAGE_ALT_MAX;

  private readonly editor = viewChild.required(RichTextEditor);
  private readonly selectorDeArchivos = viewChild.required<ElementRef<HTMLInputElement>>('archivos');
  private readonly botonEmojis = viewChild<ElementRef<HTMLButtonElement>>('botonEmojis');

  /** El HTML del editor. Sólo se usa como señal de «cambió algo». */
  protected readonly html = signal('');

  private readonly elegidas = signal<ReadonlyMap<string, ImagenElegida>>(new Map());
  private secuencia = 0;

  protected readonly emojisAbiertos = signal(false);

  /** Por qué no se pudo agregar una imagen. Se borra con la siguiente elección. */
  protected readonly aviso = signal<string | null>(null);

  /**
   * Las imágenes que siguen en el texto, en su orden.
   *
   * Se lee del DOM y no del mapa: si alguien borra una imagen con la tecla de
   * borrar, desaparece del texto sin pasar por «Quitar», y el borrador no
   * puede publicarla igual.
   */
  protected readonly imagenes = computed<readonly ImagenElegida[]>(() => {
    this.html();
    const elegidas = this.elegidas();
    return this.clavesEnElTexto()
      .map((key) => elegidas.get(key))
      .filter((imagen): imagen is ImagenElegida => imagen !== undefined);
  });

  /** El borrador, listo para publicar. */
  readonly draft = computed<ArticleDraft>(() => {
    this.html();
    const imagenes = this.imagenes();
    const area = this.editor().element;
    const claves = imagenes.map((imagen) => imagen.key);
    const bodyText =
      area === null
        ? ''
        : htmlToArticle(area, (img) => {
            const indice = claves.indexOf(img.dataset['imageKey'] ?? '');
            return indice === -1 ? null : indice;
          });
    return { bodyText, images: imagenes.map(({ file, alt }) => ({ file, alt: alt.trim() })) };
  });

  protected readonly largo = computed(() => this.draft().bodyText.length);
  protected readonly excedido = computed(() => this.largo() > this.maxLength());

  /** Cuántas imágenes todavía no tienen descripción. */
  protected readonly sinDescripcion = computed(
    () => this.imagenes().filter((imagen) => imagen.alt.trim() === '').length,
  );

  /** Si el borrador se puede publicar tal como está. */
  readonly ready = computed(
    () =>
      this.draft().bodyText.trim() !== '' &&
      !this.excedido() &&
      this.sinDescripcion() === 0 &&
      this.imagenes().length <= ARTICLE_IMAGE_MAX,
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const imagen of this.elegidas().values()) URL.revokeObjectURL(imagen.url);
    });
  }

  /** Deja el compositor en blanco, después de publicar. */
  reset(): void {
    for (const imagen of this.elegidas().values()) URL.revokeObjectURL(imagen.url);
    this.elegidas.set(new Map());
    this.aviso.set(null);
    this.emojisAbiertos.set(false);
    this.editor().clear();
    this.html.set('');
  }

  protected alternarEmojis(): void {
    this.emojisAbiertos.update((abierto) => !abierto);
  }

  private readonly panelEmojis = viewChild<ElementRef<HTMLElement>>('panelEmojis');

  /**
   * Escape cierra el panel desde cualquier lugar del compositor: después de
   * elegir un emoji el foco vuelve a la hoja, y ahí también tiene que cerrarlo.
   * El foco vuelve al botón sólo si estaba dentro del panel —si se estaba
   * escribiendo, se sigue escribiendo—.
   */
  protected cerrarEmojis(): void {
    if (!this.emojisAbiertos()) return;
    const estabaEnElPanel = this.panelEmojis()?.nativeElement.contains(document.activeElement) ?? false;
    this.emojisAbiertos.set(false);
    if (estabaEnElPanel) this.botonEmojis()?.nativeElement.focus();
  }

  protected insertarEmoji(emoji: string): void {
    this.editor().insertText(emoji);
  }

  protected elegirImagenes(): void {
    this.selectorDeArchivos().nativeElement.click();
  }

  /** Valida y agrega las imágenes elegidas, donde estaba el cursor. */
  protected alElegir(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const archivos = Array.from(campo.files ?? []);
    campo.value = ''; // elegir la misma foto dos veces tiene que volver a disparar
    this.aviso.set(null);

    const rechazos: string[] = [];
    for (const archivo of archivos) {
      if (this.imagenes().length >= ARTICLE_IMAGE_MAX) {
        rechazos.push(`Un artículo admite hasta ${ARTICLE_IMAGE_MAX} imágenes.`);
        break;
      }
      if (!ARTICLE_IMAGE_TYPES.includes(archivo.type)) {
        rechazos.push(`«${archivo.name}» no es JPG, PNG ni WebP.`);
        continue;
      }
      if (archivo.size > ARTICLE_IMAGE_MAX_BYTES) {
        rechazos.push(`«${archivo.name}» pesa más de 5 MB.`);
        continue;
      }
      this.agregar(archivo);
    }
    if (rechazos.length > 0) this.aviso.set(rechazos.join(' '));
  }

  protected describir(key: string, alt: string | number | null): void {
    const texto = String(alt ?? '').slice(0, ARTICLE_IMAGE_ALT_MAX);
    const imagen = this.elegidas().get(key);
    if (!imagen) return;
    this.elegidas.update((mapa) => new Map(mapa).set(key, { ...imagen, alt: texto }));
    this.editor().setImageAlt(key, texto);
  }

  protected quitar(key: string): void {
    const imagen = this.elegidas().get(key);
    this.editor().removeImage(key);
    if (imagen) URL.revokeObjectURL(imagen.url);
    this.elegidas.update((mapa) => {
      const copia = new Map(mapa);
      copia.delete(key);
      return copia;
    });
  }

  private agregar(archivo: File): void {
    const key = `imagen-${++this.secuencia}`;
    const imagen: ImagenElegida = { key, file: archivo, url: URL.createObjectURL(archivo), alt: '' };
    this.elegidas.update((mapa) => new Map(mapa).set(key, imagen));
    this.editor().insertImage({ key, src: imagen.url, alt: '' });
  }

  private clavesEnElTexto(): readonly string[] {
    const area = this.editor().element;
    if (area === null) return [];
    return Array.from(area.querySelectorAll('img'))
      .map((img) => img.dataset['imageKey'] ?? '')
      .filter((key) => key !== '');
  }
}

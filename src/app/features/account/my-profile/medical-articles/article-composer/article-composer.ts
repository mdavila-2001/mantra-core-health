import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';

import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { RichTextEditor } from '../../../../../shared/components/molecules/rich-text-editor/rich-text-editor';
import {
  ETIQUETAS_DE_ARTICULO,
  HERRAMIENTAS_DE_ARTICULO,
} from '../../../../../shared/components/molecules/rich-text-editor/rich-text-editor.types';
import { ArticleBody } from '../../../../../shared/components/organisms/article-body/article-body';
import { articleStats, htmlToArticle } from '../../../../../shared/text/article-markup';
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

/** Tope real del texto alternativo (`PostMediaInputDto.altText`, `@MaxLength(300)`). */
export const ARTICLE_IMAGE_ALT_MAX = 300;

/** Cuánto se espera sin teclear antes de guardar el borrador. */
const PAUSA_DE_GUARDADO_MS = 800;

/** Un enlace sólo puede ir a la web. */
const ENLACE_SEGURO = /^https?:\/\/[^\s<>"]+$/i;

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

/** Lo que se guarda del borrador en el navegador. */
interface BorradorGuardado {
  readonly html: string;
  readonly savedAt: string;
}

/**
 * El compositor de un artículo médico: un editor completo.
 *
 * - **Formato:** negrita, cursiva, tachado; Título › Subtítulo › Apartado (los
 *   tres se despliegan al leer); listas, listas numeradas, citas, separadores;
 *   deshacer y rehacer. Atajos tipo Markdown al escribir (`## `, `- `, `1. `,
 *   `> `) y los de siempre (Ctrl+B, Ctrl+I, Ctrl+Z).
 * - **Enlaces** con su texto (botón o Ctrl/Cmd+K), sólo `http(s)`.
 * - **Emojis** del mismo catálogo que el chat.
 * - **Imágenes** intercaladas donde está el cursor, con descripción obligatoria.
 * - **Vista previa** idéntica a lo que ve el lector: el mismo `ArticleBody`.
 * - **Borrador** guardado en este navegador mientras se escribe.
 *
 * ## Qué hace y qué no
 *
 * Arma el borrador ({@link draft}); **no publica**. Subir las imágenes y
 * mandar el post es de la pantalla, que es quien sabe de la vitrina y de qué
 * hacer si falla.
 *
 * ## Por qué el texto alternativo es obligatorio
 *
 * Una imagen de un artículo médico casi siempre es información —una
 * radiografía, un esquema—, no adorno. Sin descripción, quien lee con lector
 * de pantalla se pierde justo esa parte.
 *
 * ## El borrador no guarda imágenes
 *
 * Vive en `localStorage` (es de esta persona en este navegador, nada más), y
 * ahí no entran archivos de varios megas. Se guarda el texto con su formato;
 * al recuperarlo, la pantalla avisa que las imágenes hay que volver a
 * agregarlas.
 */
@Component({
  selector: 'app-article-composer',
  imports: [AppButton, ArticleBody, DatePipe, FormField, Input, RichTextEditor, SelectorEmojis],
  templateUrl: './article-composer.html',
  styleUrl: './article-composer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleComposer {
  /** Tope del cuerpo ya convertido, el que valida el servidor. */
  readonly maxLength = input(20000);

  /** Mientras se publica, nada se puede tocar. */
  readonly disabled = input(false);

  /**
   * Dónde se guarda el borrador en este navegador (una clave por vitrina).
   * Sin clave, no se guarda nada.
   */
  readonly draftKey = input<string | null>(null);

  protected readonly herramientas = HERRAMIENTAS_DE_ARTICULO;
  protected readonly etiquetasExtra = ETIQUETAS_DE_ARTICULO;
  protected readonly formatos = ARTICLE_IMAGE_TYPES.join(',');
  protected readonly maximoDeImagenes = ARTICLE_IMAGE_MAX;
  protected readonly maximoDeAlt = ARTICLE_IMAGE_ALT_MAX;

  private readonly injector = inject(Injector);
  private readonly editor = viewChild.required(RichTextEditor);
  private readonly selectorDeArchivos = viewChild.required<ElementRef<HTMLInputElement>>('archivos');
  private readonly botonEmojis = viewChild<ElementRef<HTMLButtonElement>>('botonEmojis');
  private readonly botonEnlace = viewChild<ElementRef<HTMLButtonElement>>('botonEnlace');
  private readonly panelActivo = viewChild<ElementRef<HTMLElement>>('panelActivo');
  private readonly campoUrl = viewChild('campoUrl', { read: ElementRef<HTMLElement> });

  /** El HTML del editor. Sólo se usa como señal de «cambió algo». */
  protected readonly html = signal('');

  private readonly elegidas = signal<ReadonlyMap<string, ImagenElegida>>(new Map());
  private secuencia = 0;

  /** Qué panel de la barra está abierto. Uno por vez. */
  protected readonly panel = signal<'emojis' | 'enlace' | null>(null);

  /** Escribir o ver cómo queda. */
  protected readonly modo = signal<'escribir' | 'vista'>('escribir');

  /** El formulario de enlace. */
  protected readonly enlaceUrl = signal('');
  protected readonly enlaceTexto = signal('');
  protected readonly enlaceError = signal('');

  /** Por qué no se pudo agregar una imagen. Se borra con la siguiente elección. */
  protected readonly aviso = signal<string | null>(null);

  /** Un borrador guardado que todavía no se recuperó ni se descartó. */
  protected readonly borradorPendiente = signal<BorradorGuardado | null>(null);
  /** Cuándo se guardó por última vez lo que se está escribiendo. */
  protected readonly guardadoA = signal<Date | null>(null);

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

  /** Las vistas previas, en el orden de `draft().images`: para la vista previa. */
  protected readonly urlsDeVista = computed(() => this.imagenes().map((imagen) => imagen.url));

  protected readonly largo = computed(() => this.draft().bodyText.length);
  protected readonly excedido = computed(() => this.largo() > this.maxLength());
  protected readonly stats = computed(() => articleStats(this.draft().bodyText));

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
    const destroy = inject(DestroyRef);
    destroy.onDestroy(() => {
      for (const imagen of this.elegidas().values()) URL.revokeObjectURL(imagen.url);
    });

    afterNextRender(() => this.ofrecerBorrador());

    // Guardado del borrador: con una pausa, para no escribir en cada tecla.
    effect((onCleanup) => {
      const html = this.html();
      const clave = this.draftKey();
      if (clave === null || this.borradorPendiente() !== null) return;
      const temporizador = setTimeout(() => this.guardarBorrador(clave, html), PAUSA_DE_GUARDADO_MS);
      onCleanup(() => clearTimeout(temporizador));
    });
  }

  /** Deja el compositor en blanco, después de publicar. Borra el borrador guardado. */
  reset(): void {
    for (const imagen of this.elegidas().values()) URL.revokeObjectURL(imagen.url);
    this.elegidas.set(new Map());
    this.aviso.set(null);
    this.panel.set(null);
    this.modo.set('escribir');
    this.editor().clear();
    this.html.set('');
    this.olvidarBorrador();
  }

  // ─── Paneles de la barra ──────────────────────────────────────────────────

  protected alternarEmojis(): void {
    this.panel.update((abierto) => (abierto === 'emojis' ? null : 'emojis'));
  }

  /** Abre el formulario de enlace, con lo seleccionado como texto propuesto. */
  protected abrirEnlace(): void {
    if (this.panel() === 'enlace') {
      this.panel.set(null);
      return;
    }
    this.enlaceTexto.set(this.editor().selectedText());
    this.enlaceUrl.set('');
    this.enlaceError.set('');
    this.panel.set('enlace');
    afterNextRender(() => this.campoUrl()?.nativeElement.querySelector('input')?.focus(), {
      injector: this.injector,
    });
  }

  protected alCambiarUrl(valor: string | number | null): void {
    this.enlaceUrl.set(String(valor ?? ''));
    this.enlaceError.set('');
  }

  protected alCambiarTextoDelEnlace(valor: string | number | null): void {
    this.enlaceTexto.set(String(valor ?? ''));
  }

  protected insertarEnlace(): void {
    let url = this.enlaceUrl().trim();
    if (url !== '' && !/^[a-z]+:/i.test(url)) url = `https://${url}`;
    if (!ENLACE_SEGURO.test(url)) {
      this.enlaceError.set('Escribí una dirección web, por ejemplo https://www.who.int');
      return;
    }
    if (this.editor().insertLink(url, this.enlaceTexto())) {
      this.panel.set(null);
    }
  }

  /** Ctrl/Cmd+K abre el enlace; Escape cierra el panel abierto. */
  protected alTeclear(evento: KeyboardEvent): void {
    if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
      evento.preventDefault();
      this.abrirEnlace();
      return;
    }
    if (evento.key === 'Escape') this.cerrarPanel();
  }

  /**
   * Escape cierra el panel desde cualquier lugar del compositor: después de
   * elegir un emoji el foco vuelve a la hoja, y ahí también tiene que cerrarlo.
   * El foco vuelve al botón sólo si estaba dentro del panel —si se estaba
   * escribiendo, se sigue escribiendo—.
   */
  protected cerrarPanel(): void {
    const abierto = this.panel();
    if (abierto === null) return;
    const estabaEnElPanel = this.panelActivo()?.nativeElement.contains(document.activeElement) ?? false;
    this.panel.set(null);
    if (!estabaEnElPanel) return;
    (abierto === 'emojis' ? this.botonEmojis() : this.botonEnlace())?.nativeElement.focus();
  }

  protected insertarEmoji(emoji: string): void {
    this.editor().insertText(emoji);
  }

  // ─── Imágenes ─────────────────────────────────────────────────────────────

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

  // ─── Borrador ─────────────────────────────────────────────────────────────

  protected recuperarBorrador(): void {
    const borrador = this.borradorPendiente();
    if (borrador === null) return;
    this.editor().load(borrador.html);
    this.borradorPendiente.set(null);
  }

  protected descartarBorrador(): void {
    this.borradorPendiente.set(null);
    this.olvidarBorrador();
  }

  private ofrecerBorrador(): void {
    const clave = this.draftKey();
    if (clave === null) return;
    try {
      const crudo = localStorage.getItem(clave);
      if (crudo === null) return;
      const guardado = JSON.parse(crudo) as Partial<BorradorGuardado>;
      if (typeof guardado.html === 'string' && guardado.html.trim() !== '' && typeof guardado.savedAt === 'string') {
        this.borradorPendiente.set({ html: guardado.html, savedAt: guardado.savedAt });
      }
    } catch {
      // Almacenamiento bloqueado o basura: se arranca en blanco.
    }
  }

  private guardarBorrador(clave: string, html: string): void {
    // Sin imágenes: son archivos locales que no sobreviven a la recarga.
    const sinImagenes = html.replace(/<img\b[^>]*>/gi, '');
    try {
      if (sinImagenes.replace(/<[^>]*>|&nbsp;/g, '').trim() === '') {
        localStorage.removeItem(clave);
        this.guardadoA.set(null);
        return;
      }
      const ahora = new Date();
      localStorage.setItem(clave, JSON.stringify({ html: sinImagenes, savedAt: ahora.toISOString() }));
      this.guardadoA.set(ahora);
    } catch {
      // Cuota llena o almacenamiento bloqueado: se sigue sin borrador.
    }
  }

  private olvidarBorrador(): void {
    const clave = this.draftKey();
    this.guardadoA.set(null);
    if (clave === null) return;
    try {
      localStorage.removeItem(clave);
    } catch {
      // Nada que hacer.
    }
  }

  // ─── Internos ─────────────────────────────────────────────────────────────

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

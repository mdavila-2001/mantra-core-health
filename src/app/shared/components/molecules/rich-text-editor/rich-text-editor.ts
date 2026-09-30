import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  model,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';

import {
  ETIQUETAS_PERMITIDAS,
  HERRAMIENTAS,
  type BloqueDeTexto,
  type HerramientaDeEditor,
  type ImagenDeEditor,
} from './rich-text-editor.types';

/** Los orígenes de imagen que se aceptan: sólo vistas previas locales. */
const ORIGEN_DE_IMAGEN = /^(blob:|data:image\/(png|jpeg|webp|gif);)/;

/**
 * Deja en una imagen sólo lo que el editor mismo pone: la vista previa local,
 * el texto alternativo y la clave. Una imagen con otro origen no se conserva.
 */
function conservarImagen(imagen: HTMLImageElement): void {
  const src = imagen.getAttribute('src') ?? '';
  if (!ORIGEN_DE_IMAGEN.test(src)) {
    imagen.remove();
    return;
  }
  const alt = imagen.getAttribute('alt') ?? '';
  const key = imagen.getAttribute('data-image-key') ?? '';
  for (const atributo of Array.from(imagen.attributes)) imagen.removeAttribute(atributo.name);
  imagen.setAttribute('src', src);
  imagen.setAttribute('alt', alt);
  imagen.setAttribute('data-image-key', key);
}

/**
 * Una hoja en blanco con lo mínimo para escribir: negrita, cursiva, subrayado,
 * títulos y listas.
 *
 * ```html
 * <app-rich-text-editor
 *   [(html)]="nota"
 *   label="Nota de evolución"
 *   placeholder="Escribí la consulta…"
 * />
 * ```
 *
 * ## Para qué existe
 *
 * Hay médicos que no quieren completar campos: quieren escribir. Este editor es
 * esa opción, y convive con las fichas por especialidad en el mismo selector —
 * «hoja en blanco» es una plantilla más de la lista, no otra pantalla.
 *
 * ## Tres cosas que no se leen en el código
 *
 * - **Sin dependencias.** Es `contenteditable` más `document.execCommand`. La
 *   API está marcada como obsoleta pero la implementan todos los navegadores, y
 *   traer un editor entero (Quill, TipTap) por cinco botones costaría más de lo
 *   que el presupuesto de bundle admite: la vitrina ya se llevó puesto el de 500
 *   kB una vez.
 * - **Sanea al pegar y al leer.** Pegar desde Word trae tablas, fuentes y
 *   estilos en línea; se conservan {@link ETIQUETAS_PERMITIDAS} y el resto se
 *   aplana a texto. Importa por dos motivos: este HTML se vuelve a pintar, y la
 *   nota clínica se firma por el hash de su contenido —dos notas iguales a la
 *   vista tienen que dar el mismo hash—.
 * - **Inerte bajo SSR.** El servidor no tiene `document`, así que se pinta el
 *   contenido sin barra y sin edición; al hidratar toma el control. Igual que el
 *   tooltip y el menú.
 */
@Component({
  selector: 'app-rich-text-editor',
  templateUrl: './rich-text-editor.html',
  styleUrl: './rich-text-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichTextEditor {
  /** El contenido, como HTML saneado. Doble vía. */
  readonly html = model<string>('');

  /** Nombre accesible del área de escritura. */
  readonly label = input<string>('Nota');

  /** Lo que se ve mientras está vacío. */
  readonly placeholder = input<string>('Escribí acá…');

  /** Deja el contenido a la vista pero sin poder tocarlo. */
  readonly readOnly = input(false, { transform: booleanAttribute });

  /**
   * Qué botones de formato se ofrecen. Por omisión, todos.
   *
   * Existe para quien guarda en un formato que no admite alguna marca: el
   * artículo médico se guarda como texto con marcas y no tiene subrayado, así
   * que ofrecerlo sería dejar aplicar algo que se pierde al publicar.
   */
  readonly tools = input<readonly HerramientaDeEditor[]>(HERRAMIENTAS);

  /**
   * Si se admiten imágenes dentro de la hoja (las inserta quien monta el
   * editor con {@link insertImage}). Apagado por omisión: la nota clínica no
   * lleva imágenes y su saneado no cambia.
   */
  readonly allowImages = input(false, { transform: booleanAttribute });

  /** Se emite cuando el contenido cambió por acción de la persona. */
  readonly edited = output<string>();

  /** La barra, en el orden en que se dibuja. */
  protected readonly herramientas = this.tools;

  /** Verdadero cuando no hay nada escrito, para pintar el marcador de posición. */
  protected readonly vacio = signal(true);

  /** El navegador está disponible: sólo entonces hay edición y barra. */
  protected readonly interactivo = signal(false);

  private readonly area = viewChild<ElementRef<HTMLElement>>('area');
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Dónde estaba el cursor la última vez que estuvo en la hoja.
   *
   * Un botón de afuera —el de emojis, el de imagen— se lleva el foco al
   * pulsarlo, y con el foco se va la selección: sin guardarla, lo insertado
   * caería al principio o en ningún lado.
   */
  private cursor: Range | null = null;

  /** Prepara el editor y vuelca en él el contenido inicial. */
  constructor() {
    afterNextRender(() => {
      this.interactivo.set(true);
      // Enter abre un `<p>` y no un `<div>`: el `<div>` no es una etiqueta
      // permitida y el saneado lo desarma, pegando el renglón al anterior.
      if (typeof document.execCommand === 'function') {
        document.execCommand('defaultParagraphSeparator', false, 'p');
      }
      this.volcar(this.html());
    });
  }

  /**
   * Aplica una herramienta a lo seleccionado.
   *
   * @param herramienta - Qué se pulsó.
   */
  protected aplicar(herramienta: HerramientaDeEditor): void {
    if (!this.esNavegador || this.readOnly()) return;
    this.area()?.nativeElement.focus();
    if (herramienta.tipo === 'bloque') {
      document.execCommand(
        'formatBlock',
        false,
        `<${herramienta.comando as BloqueDeTexto}>`,
      );
    } else {
      document.execCommand(herramienta.comando, false);
    }
    this.recoger();
  }

  /**
   * Inserta texto donde estaba el cursor (o al final si nunca estuvo).
   *
   * @param texto - Lo que se inserta, tal cual: un emoji, por ejemplo.
   */
  insertText(texto: string): void {
    if (!this.esNavegador || this.readOnly() || !this.volverAlCursor()) return;
    document.execCommand('insertText', false, texto);
    this.recoger();
    this.guardarCursor();
  }

  /**
   * Inserta una imagen donde estaba el cursor. Requiere {@link allowImages}.
   *
   * Se arma con el DOM y no con `insertHTML`: así ningún texto de quien llama
   * se interpreta como marcado.
   *
   * @param imagen - Vista previa (`blob:` o `data:image`), texto alternativo y
   *   una clave con la que quien llama la reconoce después.
   */
  insertImage(imagen: ImagenDeEditor): void {
    if (!this.esNavegador || this.readOnly() || !this.allowImages() || !this.volverAlCursor()) return;
    const seleccion = document.getSelection();
    const rango = seleccion?.rangeCount ? seleccion.getRangeAt(0) : null;
    if (!rango) return;
    const elemento = document.createElement('img');
    elemento.src = imagen.src;
    elemento.alt = imagen.alt;
    elemento.dataset['imageKey'] = imagen.key;
    rango.deleteContents();
    rango.insertNode(elemento);
    rango.setStartAfter(elemento);
    rango.collapse(true);
    seleccion?.removeAllRanges();
    seleccion?.addRange(rango);
    this.recoger();
    this.guardarCursor();
  }

  /**
   * Quita una imagen de la hoja.
   *
   * @param key - La clave con la que se insertó.
   */
  removeImage(key: string): void {
    const elemento = this.area()?.nativeElement;
    if (!elemento) return;
    for (const imagen of Array.from(elemento.querySelectorAll('img'))) {
      if (imagen.dataset['imageKey'] === key) imagen.remove();
    }
    this.recoger();
  }

  /**
   * Cambia el texto alternativo de una imagen ya insertada.
   *
   * @param key - La clave con la que se insertó.
   * @param alt - El texto nuevo.
   */
  setImageAlt(key: string, alt: string): void {
    const elemento = this.area()?.nativeElement;
    if (!elemento) return;
    for (const imagen of Array.from(elemento.querySelectorAll('img'))) {
      if (imagen.dataset['imageKey'] === key) imagen.alt = alt;
    }
    this.recoger();
  }

  /** Deja la hoja en blanco, por ejemplo después de publicar. */
  clear(): void {
    this.cursor = null;
    this.volcar('');
    this.html.set('');
  }

  /** El área editable, para quien necesita recorrer su DOM (convertirlo, por ejemplo). */
  get element(): HTMLElement | null {
    return this.area()?.nativeElement ?? null;
  }

  /** Recuerda el cursor si está dentro de la hoja. */
  protected guardarCursor(): void {
    const elemento = this.area()?.nativeElement;
    const seleccion = this.esNavegador ? document.getSelection() : null;
    if (!elemento || !seleccion?.rangeCount) return;
    const rango = seleccion.getRangeAt(0);
    if (elemento.contains(rango.commonAncestorContainer)) this.cursor = rango.cloneRange();
  }

  /** Devuelve el foco a la hoja con el cursor donde estaba; si no hay, al final. */
  private volverAlCursor(): boolean {
    const elemento = this.area()?.nativeElement;
    const seleccion = document.getSelection();
    if (!elemento || !seleccion) return false;
    elemento.focus();
    let rango = this.cursor;
    if (!rango || !elemento.contains(rango.commonAncestorContainer)) {
      rango = document.createRange();
      rango.selectNodeContents(elemento);
      rango.collapse(false);
    }
    seleccion.removeAllRanges();
    seleccion.addRange(rango);
    return true;
  }

  /** Lee lo escrito, lo sanea y lo publica. */
  protected recoger(): void {
    const elemento = this.area()?.nativeElement;
    if (!elemento) return;
    const limpio = this.sanear(elemento.innerHTML);
    this.vacio.set(this.aTexto(limpio).trim() === '' && !elemento.querySelector('img'));
    this.html.set(limpio);
    this.edited.emit(limpio);
  }

  /**
   * Intercepta el pegado para que no entre el HTML de Word.
   *
   * Se pega **texto plano** y no el HTML saneado: el portapapeles de un
   * procesador de textos trae tablas, fuentes y medidas en centímetros que no
   * significan nada acá, y aplanarlas después es más frágil que no dejarlas
   * entrar.
   *
   * @param evento - El pegado del navegador.
   */
  protected pegar(evento: ClipboardEvent): void {
    if (!this.esNavegador || this.readOnly()) return;
    evento.preventDefault();
    const texto = evento.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, texto);
    this.recoger();
  }

  /**
   * Deja el contenido dentro del área editable.
   *
   * Sólo al montar: escribir en `innerHTML` mientras alguien tipea le mueve el
   * cursor al principio, que es la forma más rápida de volver inusable un
   * editor.
   *
   * @param contenido - HTML a mostrar.
   */
  private volcar(contenido: string): void {
    const elemento = this.area()?.nativeElement;
    if (!elemento) return;
    elemento.innerHTML = this.sanear(contenido);
    this.vacio.set(this.aTexto(contenido).trim() === '' && !elemento.querySelector('img'));
  }

  /**
   * Deja pasar sólo las etiquetas permitidas y ningún atributo.
   *
   * Los atributos se van todos —incluidos `style` y `class`—: lo único que este
   * editor produce es estructura, y cualquier atributo que llegue viene de
   * afuera. Sin `DOMParser` (o sea, en el servidor) devuelve el texto plano, que
   * es la degradación segura.
   *
   * @param sucio - HTML de origen desconocido.
   * @returns HTML con la estructura permitida y nada más.
   */
  private sanear(sucio: string): string {
    if (!this.esNavegador || typeof DOMParser === 'undefined') {
      return this.aTexto(sucio);
    }
    const documento = new DOMParser().parseFromString(sucio, 'text/html');
    const limpiar = (nodo: Element): void => {
      for (const hijo of Array.from(nodo.children)) {
        limpiar(hijo);
        if (hijo.tagName === 'IMG' && this.allowImages()) {
          conservarImagen(hijo as HTMLImageElement);
          continue;
        }
        if (ETIQUETAS_PERMITIDAS.includes(hijo.tagName)) {
          for (const atributo of Array.from(hijo.attributes)) {
            hijo.removeAttribute(atributo.name);
          }
          continue;
        }
        // No se borra el nodo: se conserva lo que tenía dentro. Un `<div>` de
        // Word envuelve texto de verdad, y tirarlo perdería la frase.
        hijo.replaceWith(...Array.from(hijo.childNodes));
      }
    };
    limpiar(documento.body);
    return documento.body.innerHTML;
  }

  /**
   * El texto sin marcas, para saber si hay algo escrito.
   *
   * @param contenido - HTML.
   * @returns Sólo las letras.
   */
  private aTexto(contenido: string): string {
    return contenido
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
  }
}

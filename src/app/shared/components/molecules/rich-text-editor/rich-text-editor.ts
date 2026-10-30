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

/** Un enlace sólo puede ir a la web: nada de `javascript:`, `data:` ni `mailto:`. */
const ENLACE_SEGURO = /^https?:\/\/[^\s<>"]+$/i;

/** Los atajos tipo Markdown, en el orden en que se prueban. */
const ATAJOS: readonly { readonly marca: string; readonly bloque?: BloqueDeTexto; readonly comando?: string }[] = [
  { marca: '## ', bloque: 'h2' },
  { marca: '### ', bloque: 'h3' },
  { marca: '#### ', bloque: 'h4' },
  { marca: '> ', bloque: 'blockquote' },
  { marca: '- ', comando: 'insertUnorderedList' },
  { marca: '* ', comando: 'insertUnorderedList' },
  { marca: '1. ', comando: 'insertOrderedList' },
];

/** Etiquetas cuyo contenido no es prosa: se van enteras, no se aplanan. */
const DESCARTAR_CON_CONTENIDO = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'IFRAME', 'OBJECT']);

/** Renglones donde un atajo aplica: texto normal (o suelto en la hoja). */
const RENGLON_COMUN = new Set(['P', 'DIV']);

/** Un rango que cubre los primeros `n` caracteres de texto de un nodo. */
function rangoDeLosPrimeros(nodo: Node, n: number): Range | null {
  const rango = document.createRange();
  if (nodo.nodeType === Node.TEXT_NODE) {
    if ((nodo.textContent ?? '').length < n) return null;
    rango.setStart(nodo, 0);
    rango.setEnd(nodo, n);
    return rango;
  }
  const caminante = document.createTreeWalker(nodo, NodeFilter.SHOW_TEXT);
  let restante = n;
  let primero = true;
  for (let actual = caminante.nextNode(); actual; actual = caminante.nextNode()) {
    const largo = (actual.textContent ?? '').length;
    if (primero) {
      rango.setStart(actual, 0);
      primero = false;
    }
    if (largo >= restante) {
      rango.setEnd(actual, restante);
      return rango;
    }
    restante -= largo;
  }
  return null;
}

/** Etiquetas de bloque dentro de la hoja. */
const BLOQUES = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'LI', 'BLOCKQUOTE']);

/** El bloque que contiene un nodo, o la hoja misma si el texto está suelto. */
function bloqueDe(nodo: Node, area: HTMLElement): Node {
  for (let actual: Node | null = nodo; actual && actual !== area; actual = actual.parentNode) {
    if (actual instanceof Element && BLOQUES.has(actual.tagName)) return actual;
  }
  // Texto suelto en la hoja: el «renglón» empieza en el primer nodo de la hoja
  // o después del último bloque/salto que lo precede.
  let inicio: Node = nodo;
  while (inicio.parentNode && inicio.parentNode !== area) inicio = inicio.parentNode;
  return inicio;
}

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
  readonly placeholder = input<string>('Escriba acá…');

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

  /**
   * Etiquetas que, además de {@link ETIQUETAS_PERMITIDAS}, sobreviven al
   * saneado (por ejemplo `ETIQUETAS_DE_ARTICULO`). Un `A` conserva sólo un
   * `href` `http(s)`; cualquier otro enlace se aplana a su texto.
   */
  readonly extraTags = input<readonly string[]>([]);

  /**
   * Atajos tipo Markdown al escribir: `## ` título, `### ` subtítulo,
   * `#### ` apartado, `- ` lista, `1. ` numerada, `> ` cita. Apagado por
   * omisión: la nota clínica no los ofrece.
   */
  readonly markdownShortcuts = input(false, { transform: booleanAttribute });

  /** Qué herramientas están activas donde está el cursor (para `aria-pressed`). */
  protected readonly activas = signal<ReadonlySet<string>>(new Set());

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
    if (!this.esNavegador || this.readOnly() || !this.volverAlCursor()) return;
    if (herramienta.tipo === 'bloque') {
      // Un bloque que ya está aplicado se quita: pulsar «Título» sobre un
      // título lo vuelve texto normal, como en cualquier procesador de textos.
      const bloque = herramienta.comando as BloqueDeTexto;
      const destino = bloque !== 'p' && this.activas().has(bloque) ? 'p' : bloque;
      document.execCommand('formatBlock', false, `<${destino}>`);
    } else {
      document.execCommand(herramienta.comando, false);
    }
    this.recoger();
    this.guardarCursor();
  }

  /**
   * Enter en una cita vacía sale de la cita, como en cualquier procesador de
   * textos. Sin esto Chrome abre otra cita vacía debajo y no hay forma
   * evidente de volver a texto normal (medido 30/09/2026).
   *
   * @param evento - La tecla.
   */
  protected alPresionar(evento: KeyboardEvent): void {
    if (evento.key !== 'Enter' || evento.shiftKey || !this.esNavegador) return;
    const area = this.area()?.nativeElement;
    const seleccion = document.getSelection();
    if (!area || !seleccion?.rangeCount) return;
    const bloque = bloqueDe(seleccion.getRangeAt(0).startContainer, area);
    if (!(bloque instanceof Element) || bloque.tagName !== 'BLOCKQUOTE') return;
    if ((bloque.textContent ?? '').replace(/\u00a0/g, ' ').trim() !== '') return;
    evento.preventDefault();
    document.execCommand('formatBlock', false, '<p>');
    this.recoger();
  }

  /** Si hay que dibujar un separador antes de la herramienta `i` (cambia el grupo). */
  protected empiezaGrupo(i: number): boolean {
    const lista = this.herramientas();
    return i > 0 && lista[i]!.grupo !== undefined && lista[i]!.grupo !== lista[i - 1]!.grupo;
  }

  /** `aria-pressed` de un botón: sólo los interruptores lo llevan. */
  protected presionada(herramienta: HerramientaDeEditor): 'true' | 'false' | null {
    if (herramienta.sinEstado) return null;
    return this.activas().has(herramienta.comando) ? 'true' : 'false';
  }

  /**
   * Convierte en enlace lo seleccionado, o inserta el enlace donde está el
   * cursor si no hay selección. Sólo `http(s)`: cualquier otra cosa se ignora.
   *
   * @param url - El destino.
   * @param texto - Lo que se lee, si no hay selección. Sin él, la propia URL.
   * @returns Si se insertó.
   */
  insertLink(url: string, texto = ''): boolean {
    const destino = url.trim();
    if (!this.esNavegador || this.readOnly() || !ENLACE_SEGURO.test(destino) || !this.volverAlCursor()) return false;
    const seleccion = document.getSelection();
    const rango = seleccion?.rangeCount ? seleccion.getRangeAt(0) : null;
    if (!rango) return false;
    if (rango.collapsed) {
      const enlace = document.createElement('a');
      enlace.href = destino;
      enlace.textContent = texto.trim() || destino;
      rango.insertNode(enlace);
      rango.setStartAfter(enlace);
      rango.collapse(true);
      seleccion?.removeAllRanges();
      seleccion?.addRange(rango);
    } else {
      document.execCommand('createLink', false, destino);
    }
    this.recoger();
    this.guardarCursor();
    return true;
  }

  /** El texto seleccionado en la hoja, si hay (para proponerlo como texto del enlace). */
  selectedText(): string {
    const rango = this.cursor;
    return rango && !rango.collapsed ? rango.toString() : '';
  }

  /**
   * Carga un contenido (un borrador recuperado, por ejemplo). Se sanea igual
   * que lo pegado.
   */
  load(contenido: string): void {
    this.cursor = null;
    this.volcar(contenido);
    this.recoger();
  }

  /**
   * Atajos tipo Markdown: cuando un renglón de texto normal EMPIEZA con `## `,
   * `### `, `#### `, `> `, `- `, `* ` o `1. `, se quita la marca y se aplica
   * el formato.
   *
   * No se mira sólo la tecla espacio: al pegar «## Síntomas», o con un teclado
   * que inserta palabras enteras (dictado, autocompletado del móvil), el
   * `input` trae el texto de una vez —medido el 30/09/2026—. Lo que decide es
   * cómo empieza el renglón. Un renglón que ya es título, lista o cita no se
   * toca.
   *
   * @param evento - El `input` del área.
   */
  protected alEscribir(evento: Event): void {
    if (!this.markdownShortcuts() || !(evento instanceof InputEvent)) return;
    if (evento.inputType !== 'insertText' || !(evento.data ?? '').includes(' ')) return;
    const area = this.area()?.nativeElement;
    const seleccion = document.getSelection();
    if (!area || !seleccion?.rangeCount || !seleccion.isCollapsed) return;
    const bloque = bloqueDe(seleccion.getRangeAt(0).startContainer, area);
    if (bloque instanceof Element && !RENGLON_COMUN.has(bloque.tagName)) return;
    const texto = (bloque.textContent ?? '').replace(/\u00a0/g, ' ');
    const atajo = ATAJOS.find((a) => texto.startsWith(a.marca));
    if (!atajo) return;
    const marca = rangoDeLosPrimeros(bloque, atajo.marca.length);
    if (!marca) return;
    marca.deleteContents();
    // El cursor al final del renglón antes del comando, para que el formato se
    // aplique a este renglón y no al que el navegador crea más convenientes.
    const final = document.createRange();
    final.selectNodeContents(bloque);
    final.collapse(false);
    seleccion.removeAllRanges();
    seleccion.addRange(final);
    if (atajo.bloque) document.execCommand('formatBlock', false, `<${atajo.bloque}>`);
    else if (atajo.comando) document.execCommand(atajo.comando, false);
    // Y otra vez DESPUÉS del comando: Chrome deja el cursor en la posición 0
    // del ítem nuevo (medido 30/09/2026 con `insertUnorderedList`).
    const actual = seleccion.rangeCount ? seleccion.getRangeAt(0).startContainer : null;
    if (!actual) return;
    const nuevo = bloqueDe(actual, area);
    const alFinal = document.createRange();
    alFinal.selectNodeContents(nuevo);
    alFinal.collapse(false);
    seleccion.removeAllRanges();
    seleccion.addRange(alFinal);
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
    if (!elemento.contains(rango.commonAncestorContainer)) return;
    this.cursor = rango.cloneRange();
    this.actualizarActivas();
  }

  /** Lee del navegador qué marcas y qué bloque hay donde está el cursor. */
  private actualizarActivas(): void {
    if (typeof document.queryCommandState !== 'function') return;
    const activas = new Set<string>();
    for (const herramienta of this.herramientas()) {
      if (herramienta.sinEstado || herramienta.tipo !== 'marca') continue;
      try {
        if (document.queryCommandState(herramienta.comando)) activas.add(herramienta.comando);
      } catch {
        // Un navegador que no conoce el comando: sin estado, no es un error.
      }
    }
    const bloque = String(document.queryCommandValue?.('formatBlock') ?? '').toLowerCase().replace(/[<>]/g, '');
    if (bloque !== '') activas.add(bloque === 'div' ? 'p' : bloque);
    this.activas.set(activas);
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
        if (DESCARTAR_CON_CONTENIDO.has(hijo.tagName)) {
          // Su contenido no es texto de nadie: aplanarlo dejaba código a la vista.
          hijo.remove();
          continue;
        }
        if (hijo.tagName === 'IMG' && this.allowImages()) {
          conservarImagen(hijo as HTMLImageElement);
          continue;
        }
        if (hijo.tagName === 'A' && this.extraTags().includes('A')) {
          const href = (hijo.getAttribute('href') ?? '').trim();
          for (const atributo of Array.from(hijo.attributes)) hijo.removeAttribute(atributo.name);
          if (ENLACE_SEGURO.test(href)) {
            hijo.setAttribute('href', href);
            continue;
          }
          hijo.replaceWith(...Array.from(hijo.childNodes));
          continue;
        }
        if (ETIQUETAS_PERMITIDAS.includes(hijo.tagName) || this.extraTags().includes(hijo.tagName)) {
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

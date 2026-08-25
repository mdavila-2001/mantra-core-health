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
} from './rich-text-editor.types';

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

  /** Se emite cuando el contenido cambió por acción de la persona. */
  readonly edited = output<string>();

  /** La barra, en el orden en que se dibuja. */
  protected readonly herramientas: readonly HerramientaDeEditor[] = HERRAMIENTAS;

  /** Verdadero cuando no hay nada escrito, para pintar el marcador de posición. */
  protected readonly vacio = signal(true);

  /** El navegador está disponible: sólo entonces hay edición y barra. */
  protected readonly interactivo = signal(false);

  private readonly area = viewChild<ElementRef<HTMLElement>>('area');
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  /** Prepara el editor y vuelca en él el contenido inicial. */
  constructor() {
    afterNextRender(() => {
      this.interactivo.set(true);
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

  /** Lee lo escrito, lo sanea y lo publica. */
  protected recoger(): void {
    const elemento = this.area()?.nativeElement;
    if (!elemento) return;
    const limpio = this.sanear(elemento.innerHTML);
    this.vacio.set(this.aTexto(limpio).trim() === '');
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
    this.vacio.set(this.aTexto(contenido).trim() === '');
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

import { Menu } from '../../../../shared/components/molecules/menu/menu';
import { MenuItem } from '../../../../shared/components/molecules/menu/menu-item/menu-item';
import { MenuTrigger } from '../../../../shared/components/molecules/menu/menu-trigger/menu-trigger';
import { Tooltip } from '../../../../shared/components/atoms/tooltip/tooltip';
import { FileDropTarget } from '../../../../shared/forms/file-drop-target';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ChatStore } from '../../../../core/messaging/chat.store';
import { MessageTemplates } from '../../../../core/messaging/message-templates';
import { EmojiPicker } from './emoji-picker';
import { StickerPicker } from './sticker-picker/sticker-picker';
import { Recorder } from './recorder';
import type { Sticker } from '../../../../core/messaging/sticker-pack.generated';
import { AttachmentPreview } from './attachment-preview/attachment-preview';
import { ATTACHMENT_ACCEPT, type AttachmentDraft, createDraft, DOCUMENT_ACCEPT, PHOTO_ACCEPT } from './attachment-draft';
import { AttachmentPreparer } from './attachment-preparer';
import { LoadingState } from '../../../../shared/components/molecules/loading-state/loading-state';

/**
 * Las respuestas rápidas cuando el hilo está vacío y nadie pasó otras.
 *
 * Genéricas a propósito: el mismo composer sirve para hablar con una farmacia,
 * un profesional o un proveedor. Quien abre el chat desde un contexto sabe qué
 * preguntar y pasa las suyas (`thread-context.ts`).
 *
 * Son la voz de quien escribe, no la de AloVida: hablan de usted a la otra
 * parte, como el resto de la app.
 */
export const SUGERENCIAS_POR_OMISION: readonly string[] = [
  '¡Hola! Tengo una consulta',
  '¿Tienen disponibilidad?',
  'Le mando la foto de mi receta',
];

/** Una sugerencia que habla de una foto abre el selector en vez de sólo escribir. */
const PIDE_FOTO = /\b(foto|imagen)\b/i;

/**
 * La barra de escribir — carril P2 y P9.
 *
 * ## Por qué es un componente y no parte del hilo
 *
 * Porque tiene cuatro cosas dentro que no son «un campo de texto»: el menú de
 * adjuntar, el selector de emojis, el grabador de audio y las plantillas del
 * profesional. Metidas en el hilo, su plantilla pasaba de 200 a 400 líneas y
 * el scroll —que es lo delicado del hilo— quedaba mezclado con el estado de un
 * panel de emojis.
 *
 * ## El envío no espera al servidor
 *
 * `ChatStore.enviar()` pinta la burbuja en el acto y después la reemplaza por
 * la del servidor. Acá sólo se limpia el campo, que es lo que corresponde
 * hacer cuando el mensaje ya está en la pantalla.
 */
@Component({
  selector: 'app-composer',
  imports: [
    AttachmentPreview,
    FileDropTarget,
    FormsModule,
    Recorder,
    EmojiPicker,
    Menu,
    MenuItem,
    MenuTrigger,
    StickerPicker,
    Tooltip,
    LoadingState,
  ],
  templateUrl: './composer.html',
  styleUrl: './composer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Composer {
  protected readonly store = inject(ChatStore);
  private readonly plantillas = inject(MessageTemplates);
  private readonly route = inject(ActivatedRoute);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly preparador = inject(AttachmentPreparer);

  /** Avisa que se envió, para que el hilo baje del todo. */
  readonly enviado = output<void>();

  /**
   * Respuestas rápidas que se ofrecen como chips arriba del campo.
   *
   * Vacío —el valor por omisión— significa «las de siempre, y sólo con el hilo
   * vacío» ({@link SUGERENCIAS_POR_OMISION}). Con algo, se muestran aunque el
   * hilo ya tenga mensajes: quien las pasa viene de un contexto (un producto,
   * un pedido) y sabe que son pertinentes. En los dos casos se retiran después
   * del primer envío.
   */
  readonly sugerencias = input<readonly string[]>([]);

  private readonly campo = viewChild<ElementRef<HTMLTextAreaElement>>('campo');
  private readonly archivo = viewChild<ElementRef<HTMLInputElement>>('archivo');
  private readonly camara = viewChild<ElementRef<HTMLInputElement>>('camara');
  private readonly menuAdjuntar = viewChild<Menu>('menuAdjuntar');
  private readonly filaChips = viewChild<ElementRef<HTMLElement>>('filaChips');

  /** El `accept` de arranque del selector, que también filtra el arrastre. */
  protected readonly aceptaPorOmision = ATTACHMENT_ACCEPT;

  protected readonly texto = signal('');
  protected readonly panel = signal<'ninguno' | 'emojis' | 'plantillas'>('ninguno');

  /**
   * Qué pestaña del panel de figuritas está abierta.
   *
   * Emojis y stickers comparten panel y botón: son la misma pregunta —«mandar
   * algo que no es texto»— y dos botones al lado del campo obligarían a
   * decidir cuál de los dos antes de abrir ninguno.
   */
  protected readonly solapa = signal<'emojis' | 'stickers'>('emojis');
  protected readonly error = signal('');

  /**
   * Lo elegido para mandar, con su pie de foto. Mientras no esté vacía, la
   * vista previa tapa el hilo (ver `AttachmentPreview`).
   */
  protected readonly adjuntos = signal<readonly AttachmentDraft[]>([]);

  /**
   * Lo que quedó afuera de lo elegido, para decirlo **dentro** de la vista
   * previa: el aviso del composer queda tapado por ella.
   */
  protected readonly avisoDeAdjuntos = signal('');

  /**
   * El borrador que heredó lo escrito en el campo. Sólo si ése sale se vacía
   * el campo: si se lo quitó de la vista previa, la frase sigue ahí.
   */
  private heredoElTexto: string | null = null;

  /**
   * Cuántas tandas se están preparando (achicar, convertir, quitar metadatos)
   * antes de abrir la vista previa. Una foto de 12 MP tarda un instante: la
   * barra lo dice en vez de parecer que no pasó nada.
   */
  protected readonly preparando = signal(0);

  /**
   * Sube cada vez que lo elegido deja de valer —cambio de conversación,
   * edición, cierre—: una tanda que termina de prepararse después no abre la
   * vista previa en otro chat.
   */
  private generacion = 0;

  /**
   * Si la fila de respuestas rápidas tiene más chips de un lado o del otro:
   * prende el degradado de ese borde.
   */
  protected readonly chipsDesbordan = signal({ inicio: false, final: false });

  /** Si ya se mandó algo en esta conversación: los chips se retiran. */
  private readonly sugerenciasRetiradas = signal(false);

  protected readonly chips = computed<readonly string[]>(() => {
    if (
      this.sugerenciasRetiradas() ||
      this.editando() !== null ||
      this.texto().trim() !== '' ||
      this.adjuntos().length > 0
    ) {
      return [];
    }
    const propias = this.sugerencias();
    if (propias.length > 0) {
      return propias;
    }
    const activa = this.store.activaId();
    const hiloVacio =
      this.store.hiloCargado() &&
      this.store.mensajes().length === 0 &&
      !this.store.pendientes().some((p) => p.conversationId === activa);
    return hiloVacio ? SUGERENCIAS_POR_OMISION : [];
  });

  /** Las plantillas de fábrica más las propias (carril P9). */
  protected readonly plantillasDisponibles = this.plantillas.todas;
  protected readonly plantillaNueva = signal('');

  /** El mensaje que se está editando, si alguno (F4.5). */
  protected readonly editando = this.store.editando;

  /**
   * Lo que se estaba escribiendo antes de entrar a editar.
   *
   * Editar toma prestado el campo; cancelar tiene que devolver la frase a
   * medias que había, no dejarlo vacío.
   */
  private readonly borradorEnEspera = signal<string | null>(null);

  protected readonly puedeEnviar = computed(() => this.texto().trim() !== '');

  constructor() {
    // Al cambiar de conversación se recupera lo que se había escrito ahí:
    // cambiar de chat y volver no puede tirar media frase.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => {
      this.texto.set(this.store.borrador());
      this.cerrarPanel();
      this.sugerenciasRetiradas.set(false);
      this.limpiarAdjuntos();
    });

    // El modo edición nace en el hilo (`store.editar()`), así que el campo
    // tiene que reaccionar a él y no al revés: es el store el que sabe si el
    // mensaje todavía está dentro de la ventana de cinco minutos.
    effect(() => {
      const mensaje = this.store.editando();
      untracked(() => {
        if (mensaje !== null) {
          if (this.borradorEnEspera() === null) {
            this.borradorEnEspera.set(this.texto());
          }
          this.texto.set(mensaje.bodyText ?? '');
          this.cerrarPanel();
          this.limpiarAdjuntos();
          this.enfocar();
          return;
        }
        const enEspera = this.borradorEnEspera();
        if (enEspera !== null) {
          this.texto.set(enEspera);
          this.borradorEnEspera.set(null);
        }
      });
    });

    // El «responder» llega desde el hilo: cuando aparece, el foco va al campo,
    // que es lo único que se quiere hacer después de elegir responder.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
      if (query.get('responder') !== null) {
        this.enfocar();
      }
    });

    // Se mide después de pintar: con chips nuevos, o al cambiar el ancho. Un
    // `ResizeObserver` y no `resize` de la ventana: el panel lateral del chat
    // también cambia el ancho de la fila.
    let observador: ResizeObserver | null = null;
    afterRenderEffect(() => {
      const fila = this.filaChips()?.nativeElement;
      this.chips();
      observador?.disconnect();
      observador = null;
      if (!fila) {
        return;
      }
      this.medirChips();
      if (typeof ResizeObserver !== 'undefined') {
        observador = new ResizeObserver(() => this.medirChips());
        observador.observe(fila);
      }
    });

    inject(DestroyRef).onDestroy(() => {
      observador?.disconnect();
      this.limpiarAdjuntos();
    });
  }

  /** Cuánto queda de la fila de chips fuera de la vista, de cada lado. */
  protected medirChips(): void {
    const fila = this.filaChips()?.nativeElement;
    if (!fila) {
      return;
    }
    // `scrollLeft` es negativo en RTL; con `Math.abs` sirve en los dos sentidos.
    const recorrido = Math.abs(fila.scrollLeft);
    const sobra = fila.scrollWidth - fila.clientWidth;
    const inicio = recorrido > 1;
    const final = sobra - recorrido > 1;
    const actual = this.chipsDesbordan();
    if (actual.inicio !== inicio || actual.final !== final) {
      this.chipsDesbordan.set({ inicio, final });
    }
  }

  protected alEscribir(valor: string): void {
    this.texto.set(valor);
    // Editando, lo que se teclea es el texto del mensaje, no un borrador de la
    // conversación: guardarlo dejaría el composer con esa frase después de
    // cancelar.
    if (this.editando() === null) {
      this.store.guardarBorrador(valor);
    }
  }

  /** Enter envía; Shift+Enter hace salto de línea. */
  protected alTeclear(evento: KeyboardEvent): void {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      this.enviar();
    }
    if (evento.key === 'Escape') {
      if (this.editando() !== null) {
        this.cancelarEdicion();
      } else if (this.store.respondiendoA() !== null) {
        this.store.responder(null);
      }
    }
  }

  /** Sale del modo edición sin guardar. */
  protected cancelarEdicion(): void {
    this.store.editar(null);
    this.enfocar();
  }

  protected enviar(): void {
    // Editando, «enviar» es guardar el cambio: no nace un mensaje nuevo.
    if (this.editando() !== null) {
      this.store.confirmarEdicion(this.texto());
      this.enfocar();
      return;
    }

    if (this.texto().trim() === '') {
      return;
    }
    this.store.enviar(this.texto());
    this.texto.set('');
    this.sugerenciasRetiradas.set(true);
    this.enviado.emit();
    this.enfocar();
  }

  /* --- Respuestas rápidas -------------------------------------------------- */

  /**
   * Tocar un chip **escribe** la frase y deja el foco en el campo; no la manda.
   *
   * Es una pregunta a una farmacia o a un profesional, no un «me gusta»: a
   * «¿Lo tienen en stock?» casi siempre le falta la presentación o la dosis, y
   * un mensaje mandado sin querer no se borra. Escribirla cuesta un toque más
   * —el de enviar, que ya está a la vista— y se puede corregir antes.
   *
   * La que habla de una foto además abre el selector de imágenes: la frase
   * pasa a ser el pie de la primera foto, como cualquier texto ya escrito.
   */
  protected usarSugerencia(sugerencia: string): void {
    this.alEscribir(sugerencia);
    if (PIDE_FOTO.test(sugerencia)) {
      this.elegirArchivo(true);
      return;
    }
    this.enfocar();
  }

  protected alternar(cual: 'emojis' | 'plantillas'): void {
    this.panel.set(this.panel() === cual ? 'ninguno' : cual);
  }

  /** Cierra el panel abierto y, si estaba abierto, el menú de adjuntar. */
  protected cerrarPanel(): void {
    this.panel.set('ninguno');
    this.menuAdjuntar()?.close();
  }

  /* --- Stickers ------------------------------------------------------------ */

  /** Un sticker se manda al tocarlo: es el mensaje, no parte de uno. */
  protected mandarSticker(sticker: Sticker): void {
    this.store.enviarSticker(sticker);
    this.panel.set('ninguno');
    this.enviado.emit();
  }

  /**
   * Un sticker o GIF de la persona: sube y se manda en el acto, marcado como
   * sticker para que el otro lado lo vea sin burbuja.
   */
  protected async mandarStickerPropio(archivo: File): Promise<void> {
    this.panel.set('ninguno');
    // También pasa por la preparación: un GIF o un WEBP guardado de la web
    // puede traer XMP o EXIF, y un sticker no es excepción a quitarlos.
    const generacion = this.generacion;
    let listo: File;
    try {
      listo = await this.preparador.prepare(archivo);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : `No pudimos preparar «${archivo.name}».`);
      return;
    }
    if (generacion !== this.generacion) {
      return;
    }
    this.store.enviarAdjunto(listo, '', true);
    this.enviado.emit();
  }

  /* --- Emojis -------------------------------------------------------------- */

  /**
   * Inserta el emoji donde está el cursor, no al final: alguien que vuelve a
   * mitad de la frase para poner una carita espera que quede ahí.
   */
  protected insertar(emoji: string): void {
    const nodo = this.campo()?.nativeElement;
    const actual = this.texto();
    if (!nodo) {
      this.alEscribir(actual + emoji);
      return;
    }
    const desde = nodo.selectionStart ?? actual.length;
    const hasta = nodo.selectionEnd ?? actual.length;
    const nuevo = actual.slice(0, desde) + emoji + actual.slice(hasta);
    this.alEscribir(nuevo);
    setTimeout(() => {
      nodo.focus();
      const cursor = desde + emoji.length;
      nodo.setSelectionRange(cursor, cursor);
    });
  }

  /* --- Adjuntos ------------------------------------------------------------ */

  /** Abre el selector: de fotos (galería) o de documentos. */
  protected elegirArchivo(soloImagenes: boolean): void {
    const entrada = this.archivo()?.nativeElement;
    if (entrada) {
      entrada.accept = soloImagenes ? PHOTO_ACCEPT : DOCUMENT_ACCEPT;
      entrada.click();
    }
    this.panel.set('ninguno');
  }

  /** Abre la cámara trasera (en el teléfono; en la compu, el selector). */
  protected tomarFoto(): void {
    this.camara()?.nativeElement.click();
    this.panel.set('ninguno');
  }

  /** El `change` de los dos selectores y del arrastre (`appFileDropTarget`). */
  protected alElegir(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivos = Array.from(entrada.files ?? []);
    entrada.value = '';
    if (entrada === this.archivo()?.nativeElement) {
      // Vuelve al `accept` amplio: el arrastre lo usa para filtrar, y un PDF
      // soltado después de abrir la galería no tiene por qué rebotar.
      entrada.accept = ATTACHMENT_ACCEPT;
    }
    void this.recibir(archivos);
  }

  /**
   * Ctrl+V de una captura o de una foto copiada: entra al mismo flujo que lo
   * elegido con el selector.
   */
  protected alPegar(evento: ClipboardEvent): void {
    const datos = evento.clipboardData;
    const archivos = Array.from(datos?.files ?? []);
    if (archivos.length === 0 || this.editando() !== null) {
      return;
    }
    // Si además viene texto (copiar de una página trae los dos), el texto se
    // pega igual; si sólo hay imagen, se evita que el navegador pegue nada.
    if (!Array.from(datos?.types ?? []).includes('text/plain')) {
      evento.preventDefault();
    }
    void this.recibir(archivos);
  }

  /**
   * Valida y prepara lo que llegó, y abre la vista previa con lo que entró.
   *
   * Devuelve la promesa para las pruebas; la pantalla no la espera.
   */
  async recibir(archivos: readonly File[]): Promise<void> {
    // Editando no se adjunta, tampoco soltando ni pegando un archivo: la
    // edición cambia un mensaje que ya salió, y el pie de foto se llevaría
    // ese texto a un mensaje nuevo.
    if (archivos.length === 0 || this.editando() !== null) {
      return;
    }
    const generacion = this.generacion;
    this.preparando.update((n) => n + 1);
    try {
      const { accepted, rejection } = await this.preparador.prepareAll(archivos);
      if (generacion !== this.generacion) {
        return;
      }
      if (accepted.length === 0) {
        this.error.set(rejection ?? '');
        return;
      }
      this.error.set('');
      this.avisoDeAdjuntos.set(rejection ?? '');
      this.ponerAdjuntos(accepted);
    } finally {
      this.preparando.update((n) => Math.max(0, n - 1));
    }
  }

  /**
   * Abre la vista previa con lo elegido.
   *
   * Lo que ya estaba escrito en el campo pasa a ser el pie de foto del primer
   * archivo, como en WhatsApp: escribir «le mando el análisis» y después
   * adjuntarlo es un solo mensaje, no dos.
   */
  private ponerAdjuntos(archivos: readonly File[]): void {
    const leyenda = this.texto().trim();
    this.panel.set('ninguno');
    const borradores = archivos.map((archivo, indice) => createDraft(archivo, indice === 0 ? leyenda : ''));
    this.heredoElTexto = leyenda === '' ? null : borradores[0].id;
    this.adjuntos.set(borradores);
  }

  /**
   * Manda la tanda en **una** llamada al store: cada archivo sale como su
   * propio mensaje, con su pie de foto como texto, en el orden de la tira. El
   * store los sube de a uno y no manda un mensaje antes que el anterior
   * (`ChatStore.enviarAdjuntos`). Sin `vistaPrevia`: la tira usa `blob:` y el
   * store lee la miniatura de la burbuja por su cuenta.
   */
  protected enviarAdjuntos(): void {
    const borradores = this.adjuntos();
    if (borradores.length === 0) {
      return;
    }
    this.store.enviarAdjuntos(
      borradores.map((borrador) => ({ archivo: borrador.file, leyenda: borrador.caption, vistaPrevia: null })),
    );
    const salioElTexto = borradores.some((borrador) => borrador.id === this.heredoElTexto);
    this.limpiarAdjuntos();
    if (salioElTexto) {
      this.texto.set('');
      this.store.guardarBorrador('');
    }
    this.sugerenciasRetiradas.set(true);
    this.enviado.emit();
    this.enfocar();
  }

  /** Cierra la vista previa sin mandar nada. Lo escrito en el campo queda. */
  protected descartarAdjuntos(): void {
    this.limpiarAdjuntos();
  }

  protected limpiarAdjuntos(): void {
    this.generacion += 1;
    this.preparando.set(0);
    this.adjuntos.set([]);
    this.avisoDeAdjuntos.set('');
    this.heredoElTexto = null;
  }

  /* --- Audio --------------------------------------------------------------- */

  /** La nota de voz sale sin pasar por la previsualización: se suelta y va. */
  protected alGrabar(audio: File): void {
    this.store.enviarAdjunto(audio, '');
    this.enviado.emit();
  }

  protected alFallarElMicrofono(mensaje: string): void {
    this.error.set(mensaje);
  }

  /* --- Plantillas (carril P9) ---------------------------------------------- */

  /**
   * **Reemplaza el borrador vacío y se agrega al que no lo está**: quien ya
   * escribió media frase y elige una plantilla la está agregando, no
   * descartando lo que escribió.
   */
  protected usarPlantilla(plantilla: string): void {
    const actual = this.texto().trim();
    this.alEscribir(actual === '' ? plantilla : `${actual} ${plantilla}`);
    this.panel.set('ninguno');
    this.enfocar();
  }

  protected guardarPlantilla(): void {
    this.plantillas.agregar(this.plantillaNueva());
    this.plantillaNueva.set('');
  }

  protected olvidarPlantilla(texto: string): void {
    this.plantillas.quitar(texto);
  }

  protected esPropia(texto: string): boolean {
    return this.plantillas.mias().includes(texto);
  }

  /* --- Varios -------------------------------------------------------------- */

  protected cancelarRespuesta(): void {
    this.store.responder(null);
  }

  private enfocar(): void {
    if (this.isBrowser) {
      setTimeout(() => this.campo()?.nativeElement.focus(), 0);
    }
  }
}

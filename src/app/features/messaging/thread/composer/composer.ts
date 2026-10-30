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
  PendingTasks,
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
import {
  type AttachmentDraft,
  createDraft,
  MAX_DRAFTS,
  partitionFiles,
  rejectionReason,
} from './attachment-draft';
import { LoadingState } from '../../../../shared/components/molecules/loading-state/loading-state';
import { UPLOAD_MAX_BYTES } from '../../../../core/data-access/files/upload-policy';
import { ImagenRechazada, LIENZO, prepararImagen } from './preparar-imagen';

/**
 * Cuántos archivos se juntan para mandar de una vez: el tope de la vista
 * previa ({@link MAX_DRAFTS}). Cada uno sale como su propio mensaje.
 */
export const TOPE_DE_COLA = MAX_DRAFTS;

/** Lo que se deja elegir con el botón de fotos de la píldora y los chips. */
const ACEPTA_FOTOS = 'image/*';

/** «Fotos y videos» del menú «+». */
const ACEPTA_FOTOS_Y_VIDEOS = 'image/*,video/*';

/** «Documento» del menú «+»: un PDF o un audio. */
const ACEPTA_DOCUMENTOS = 'application/pdf,audio/*';

/**
 * Lo que acepta el selector por omisión y, con él, el arrastre
 * (`appFileDropTarget` mira este `accept`): lo mismo que acepta la vista
 * previa. `image/*` y no la lista exacta: un HEIC o un BMP se convierten a
 * JPEG antes de subir.
 */
const ACEPTA_POR_OMISION = 'image/*,video/*,audio/*,application/pdf';

/**
 * Las respuestas rápidas cuando el hilo está vacío y nadie pasó otras.
 *
 * Genéricas a propósito: el mismo composer sirve para hablar con una farmacia,
 * un profesional o un proveedor. Quien abre el chat desde un contexto sabe qué
 * preguntar y pasa las suyas — {@link SUGERENCIAS_MARKETPLACE}, por ejemplo.
 */
export const SUGERENCIAS_POR_OMISION: readonly string[] = [
  '¡Hola! Tengo una consulta',
  '¿Tienen disponibilidad?',
  'Te mando la foto de mi receta',
];

/** Las de un producto o un servicio del marketplace. */
export const SUGERENCIAS_MARKETPLACE: readonly string[] = [
  '¿Lo tienen en stock?',
  '¿Cuánto tarda el envío?',
  'Te mando la foto de mi receta',
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
 * ## Los adjuntos pasan por la vista previa
 *
 * Todo lo que se adjunta —el «+», el botón de fotos y la cámara de la píldora,
 * pegar con Ctrl+V, soltar sobre la barra, el chip «Te mando la foto»— entra
 * por {@link agregar}: se valida, **las fotos se preparan** (se achican si
 * pasan el tope del servidor y se les quitan los metadatos con el GPS, ver
 * `prepararImagen`) y recién entonces se abre la vista previa
 * (`AttachmentPreview`) con su pie de foto, su edición y el botón de enviar.
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
  private readonly lienzo = inject(LIENZO);
  private readonly tareas = inject(PendingTasks);

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

  protected readonly texto = signal('');
  /**
   * Los paneles que se abren sobre el composer. El de adjuntar no está: es un
   * `app-menu`, que lleva su propio estado de abierto.
   */
  protected readonly panel = signal<'ninguno' | 'emojis' | 'plantillas'>('ninguno');

  /**
   * Si la fila de respuestas rápidas tiene más chips de un lado o del otro:
   * prende el degradado de ese borde.
   */
  protected readonly chipsDesbordan = signal({ inicio: false, final: false });

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
   * Cuántas fotos se están preparando (achicando, limpiando metadatos). Hasta
   * que terminen no se abre la vista previa ni se envía el texto: la frase
   * escrita va a ser el pie de la primera.
   */
  protected readonly preparandoCuantas = signal(0);
  protected readonly preparando = computed(() => this.preparandoCuantas() > 0);

  /** Lo que se anuncia a los lectores de pantalla al preparar adjuntos. */
  protected readonly anuncio = signal('');

  /** Si ya se mandó algo en esta conversación: los chips se retiran. */
  private readonly sugerenciasRetiradas = signal(false);

  protected readonly chips = computed<readonly string[]>(() => {
    if (
      this.sugerenciasRetiradas() ||
      this.editando() !== null ||
      this.texto().trim() !== '' ||
      this.adjuntos().length > 0 ||
      this.preparando()
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

    // Mientras se prepara una foto, lo escrito espera: va a ser su pie.
    if (this.preparando() || this.texto().trim() === '') {
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
   * queda como pie de la primera foto.
   */
  protected usarSugerencia(sugerencia: string): void {
    this.alEscribir(sugerencia);
    if (PIDE_FOTO.test(sugerencia)) {
      this.elegirArchivo('fotos');
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
    this.sugerenciasRetiradas.set(true);
    this.enviado.emit();
  }

  /**
   * Un sticker o GIF de la persona: sube y se manda en el acto, marcado como
   * sticker para que el otro lado lo vea sin burbuja.
   */
  protected mandarStickerPropio(archivo: File): void {
    this.store.enviarAdjunto(archivo, '', true);
    this.panel.set('ninguno');
    this.sugerenciasRetiradas.set(true);
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

  /**
   * Abre el selector: fotos de la galería (la píldora y los chips), fotos y
   * videos (el «+») o documentos (PDF o audio).
   */
  protected elegirArchivo(que: 'fotos' | 'fotos-y-videos' | 'documento'): void {
    const entrada = this.archivo()?.nativeElement;
    if (entrada) {
      entrada.accept =
        que === 'fotos' ? ACEPTA_FOTOS : que === 'fotos-y-videos' ? ACEPTA_FOTOS_Y_VIDEOS : ACEPTA_DOCUMENTOS;
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
      entrada.accept = ACEPTA_POR_OMISION;
    }
    void this.agregar(archivos);
  }

  /** Ctrl+V de una captura o de una foto copiada la suma a la vista previa. */
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
    void this.agregar(archivos);
  }

  /**
   * Suma archivos a la vista previa: valida, prepara las fotos y dice qué no
   * entró.
   *
   * Editando no se adjunta, tampoco soltando un archivo sobre la barra: la
   * edición cambia un mensaje que ya salió, y el pie de foto se llevaría ese
   * texto a un mensaje nuevo.
   *
   * Devuelve la promesa para las pruebas; la pantalla no la espera. La
   * preparación se registra como tarea pendiente de Angular: `whenStable()`
   * la espera.
   */
  async agregar(archivos: readonly File[]): Promise<void> {
    if (archivos.length === 0 || this.editando() !== null) {
      return;
    }
    const rechazos: string[] = [];
    const libres = MAX_DRAFTS - this.adjuntos().length - this.preparandoCuantas();
    const candidatos: File[] = [];
    for (const archivo of archivos) {
      // Mismos motivos que la vista previa (`rejectionReason`), con el nombre
      // del archivo delante: con varios elegidos hay que saber cuál fue.
      const motivo = rejectionReason(archivo);
      if (motivo !== null) {
        rechazos.push(
          motivo.startsWith('El archivo')
            ? `«${archivo.name}»: ${motivo}`
            : `«${archivo.name}» no se puede mandar. ${motivo}`,
        );
        continue;
      }
      candidatos.push(archivo);
    }
    const { accepted, rejection } = partitionFiles(candidatos, Math.max(0, libres));
    if (rejection !== null) {
      rechazos.push(rejection);
    }

    const terminar = this.tareas.add();
    this.preparandoCuantas.update((n) => n + accepted.length);
    this.anunciar();
    try {
      const listos = await Promise.all(
        accepted.map(async (archivo): Promise<File | null> => {
          try {
            return await this.preparar(archivo);
          } catch (error: unknown) {
            rechazos.push(
              error instanceof ImagenRechazada ? error.message : `No pudimos preparar «${archivo.name}».`,
            );
            return null;
          } finally {
            this.preparandoCuantas.update((n) => n - 1);
          }
        }),
      );
      const archivosListos = listos.filter((archivo): archivo is File => archivo !== null);
      const aviso = rechazos.join(' ');
      if (archivosListos.length === 0) {
        this.error.set(aviso);
        this.anunciar();
        return;
      }
      this.error.set('');
      this.avisoDeAdjuntos.set(aviso);
      this.ponerAdjuntos(archivosListos);
      this.anunciar();
    } finally {
      terminar();
    }
  }

  /**
   * Deja un archivo listo para subir: las fotos pasan por `prepararImagen`
   * (tope del servidor, sin EXIF ni GPS); lo demás tiene que entrar en el tope
   * tal cual, porque no hay cómo achicarlo acá.
   */
  private async preparar(archivo: File): Promise<File> {
    if (archivo.type.toLowerCase().startsWith('image/')) {
      return prepararImagen(archivo, this.isBrowser, this.lienzo);
    }
    if (archivo.size > UPLOAD_MAX_BYTES) {
      throw new ImagenRechazada(`«${archivo.name}» pesa más de 10 MB.`);
    }
    return archivo;
  }

  /**
   * Abre la vista previa con lo elegido, o le suma lo nuevo si ya estaba
   * abierta.
   *
   * Lo que ya estaba escrito en el campo pasa a ser el pie de foto del primer
   * archivo, como en WhatsApp: escribir «le mando el análisis» y después
   * adjuntarlo es un solo mensaje, no dos.
   */
  private ponerAdjuntos(archivos: readonly File[]): void {
    this.cerrarPanel();
    if (this.adjuntos().length > 0) {
      this.adjuntos.update((lista) => [...lista, ...archivos.map((archivo) => createDraft(archivo))]);
      return;
    }
    const leyenda = this.texto().trim();
    const borradores = archivos.map((archivo, indice) => createDraft(archivo, indice === 0 ? leyenda : ''));
    this.heredoElTexto = leyenda === '' ? null : borradores[0].id;
    this.adjuntos.set(borradores);
  }

  /**
   * Manda cada archivo como un mensaje, con su pie de foto como texto: el
   * contrato de siempre del store (`enviarAdjunto`), uno por adjunto.
   */
  protected enviarAdjuntos(): void {
    const borradores = this.adjuntos();
    if (borradores.length === 0) {
      return;
    }
    for (const borrador of borradores) {
      this.store.enviarAdjunto(borrador.file, borrador.caption);
    }
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
    this.enfocar();
  }

  protected limpiarAdjuntos(): void {
    this.adjuntos.set([]);
    this.avisoDeAdjuntos.set('');
    this.heredoElTexto = null;
  }

  private anunciar(): void {
    const preparando = this.preparandoCuantas();
    const n = this.adjuntos().length;
    this.anuncio.set(
      preparando > 0
        ? `Preparando ${preparando === 1 ? '1 archivo' : `${preparando} archivos`}…`
        : n === 0
          ? ''
          : `${n} ${n === 1 ? 'archivo' : 'archivos'} para enviar.`,
    );
  }

  /* --- Audio --------------------------------------------------------------- */

  /** La nota de voz sale sin pasar por la previsualización: se suelta y va. */
  protected alGrabar(audio: File): void {
    this.store.enviarAdjunto(audio, '');
    this.sugerenciasRetiradas.set(true);
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

import { FilePreview } from '../../../../shared/components/molecules/file-preview/file-preview';
import { FileDropTarget } from '../../../../shared/forms/file-drop-target';
import { Menu } from '../../../../shared/components/molecules/menu/menu';
import { MenuItem } from '../../../../shared/components/molecules/menu/menu-item/menu-item';
import { MenuTrigger } from '../../../../shared/components/molecules/menu/menu-trigger/menu-trigger';
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
import { SelectorEmojis } from './selector-emojis';
import { StickerPicker } from './sticker-picker/sticker-picker';
import { Grabador } from './grabador';
import type { Sticker } from '../../../../core/messaging/sticker-pack.generated';
import {
  formatearTamano,
  UPLOAD_MAX_BYTES,
} from '../../../../core/data-access/files/upload-policy';
import { esImagenAceptada, ImagenRechazada, LIENZO, prepararImagen } from './preparar-imagen';

/**
 * Cuántos archivos se juntan para mandar de una vez.
 *
 * Seis entran en una fila de miniaturas a 390 px sin que la tira se vuelva un
 * carrusel, y cubren el caso real —receta de dos hojas, frente y dorso de la
 * credencial, la caja del remedio—. Cada uno sale como su propio mensaje.
 */
export const TOPE_DE_COLA = 6;

/** Lo que se deja elegir con el selector cuando se buscan fotos. */
const ACEPTA_FOTOS = 'image/*';

/**
 * Lo que acepta el selector por omisión y, con él, el arrastre
 * (`appFileDropTarget` mira este `accept`). `image/*` y no la lista exacta:
 * un HEIC o un BMP se convierten a JPEG antes de subir.
 */
const ACEPTA_POR_OMISION = 'image/*,application/pdf';

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

/** Un archivo esperando a salir, con lo necesario para dibujar su miniatura. */
export interface ArchivoEnCola {
  readonly id: number;
  readonly nombre: string;
  readonly tipo: string;
  readonly tamano: number;
  /** `null` mientras se prepara: hasta entonces no se sabe qué va a subir. */
  readonly archivo: File | null;
  /**
   * Miniatura `data:` de la imagen; `null` en un PDF, en SSR o mientras se lee.
   * `data:` y no `blob:`: la CSP (`img-src 'self' data:`) bloquea los `blob:`.
   */
  readonly vistaPrevia: string | null;
  readonly estado: 'preparando' | 'lista';
}

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
    FilePreview,
    FileDropTarget,
    FormsModule,
    Grabador,
    Menu,
    MenuItem,
    MenuTrigger,
    SelectorEmojis,
    StickerPicker,
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

  /** Los archivos elegidos, esperando la leyenda y el envío. */
  protected readonly cola = signal<readonly ArchivoEnCola[]>([]);
  private siguienteId = 0;
  /** El archivo elegido de cada ítem que se está preparando, para comparar. */
  private readonly originales = new Map<number, File>();

  /** Lo que se anuncia a los lectores de pantalla al tocar la cola. */
  protected readonly anuncio = signal('');

  protected readonly tope = TOPE_DE_COLA;

  /** Si alguno todavía se está achicando: hasta que termine no se envía. */
  protected readonly preparando = computed(() =>
    this.cola().some((item) => item.estado === 'preparando'),
  );

  /**
   * Un único PDF conserva la vista previa grande de antes (`app-file-preview`
   * lo rasteriza): de un documento importa ver qué página es. Las fotos van en
   * la tira de miniaturas.
   */
  protected readonly documentoUnico = computed(() => {
    const lista = this.cola();
    return lista.length === 1 && lista[0].archivo !== null && !lista[0].tipo.startsWith('image/')
      ? lista[0].archivo
      : null;
  });

  /** Si ya se mandó algo en esta conversación: los chips se retiran. */
  private readonly sugerenciasRetiradas = signal(false);

  protected readonly chips = computed<readonly string[]>(() => {
    if (
      this.sugerenciasRetiradas() ||
      this.editando() !== null ||
      this.texto().trim() !== '' ||
      this.cola().length > 0
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

  protected readonly puedeEnviar = computed(
    () => this.texto().trim() !== '' || this.cola().length > 0,
  );

  constructor() {
    // Al cambiar de conversación se recupera lo que se había escrito ahí:
    // cambiar de chat y volver no puede tirar media frase.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => {
      this.texto.set(this.store.borrador());
      this.cerrarPanel();
      this.sugerenciasRetiradas.set(false);
      this.limpiarAdjunto();
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
          this.limpiarAdjunto();
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
      this.limpiarAdjunto();
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

    const cola = this.cola();
    if (cola.length > 0) {
      // Mientras se achica una foto no se manda nada: mandar las listas y
      // dejar la otra atrás desordenaría la tanda.
      if (this.preparando()) {
        return;
      }
      const archivos = cola
        .map((item) => item.archivo)
        .filter((archivo): archivo is File => archivo !== null);
      // Un mensaje por archivo; el texto viaja con el primero (ver
      // `ChatStore.enviarAdjuntos`).
      this.store.enviarAdjuntos(archivos, this.texto());
      this.limpiarAdjunto();
      this.texto.set('');
      this.store.guardarBorrador('');
      this.sugerenciasRetiradas.set(true);
      this.enviado.emit();
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
   * queda como leyenda de la primera foto.
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

  /** Abre el selector: de fotos (galería) o de documentos (PDF). */
  protected elegirArchivo(soloImagenes: boolean): void {
    const entrada = this.archivo()?.nativeElement;
    if (entrada) {
      entrada.accept = soloImagenes ? ACEPTA_FOTOS : 'application/pdf';
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

  /** Ctrl+V de una captura o de una foto copiada la suma a la cola. */
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
   * Suma archivos a la cola: valida, achica las fotos y dice qué no entró.
   *
   * Devuelve la promesa para las pruebas; la pantalla no la espera.
   */
  async agregar(archivos: readonly File[]): Promise<void> {
    if (archivos.length === 0 || this.editando() !== null) {
      return;
    }
    const rechazos: string[] = [];
    const libres = TOPE_DE_COLA - this.cola().length;
    const entran = archivos.slice(0, Math.max(0, libres));
    if (archivos.length > entran.length) {
      rechazos.push(`Podés mandar hasta ${TOPE_DE_COLA} archivos por vez.`);
    }

    const tareas: Promise<void>[] = [];
    for (const archivo of entran) {
      const tipo = archivo.type.toLowerCase();
      if (tipo === 'application/pdf') {
        if (archivo.size > UPLOAD_MAX_BYTES) {
          rechazos.push(`«${archivo.name}» pesa más de 10 MB.`);
          continue;
        }
        this.encolar({ archivo, vistaPrevia: null, estado: 'lista' });
        continue;
      }
      if (!tipo.startsWith('image/')) {
        rechazos.push(`«${archivo.name}» no se puede mandar. Podés mandar fotos (JPG, PNG, WEBP o GIF) y PDF.`);
        continue;
      }
      const id = this.encolar({
        archivo: null,
        original: archivo,
        vistaPrevia: null,
        estado: 'preparando',
      });
      // La miniatura sale del original mientras se achica, si el navegador lo
      // dibuja y no es un monstruo: leer 40 MB a `data:` sólo para una
      // miniatura de 72 px congelaría la pestaña.
      if (esImagenAceptada(archivo.type) && archivo.size <= UPLOAD_MAX_BYTES) {
        this.ponerVistaPrevia(id, archivo);
      }
      tareas.push(
        prepararImagen(archivo, this.isBrowser, this.lienzo).then(
          (lista) => this.terminarDePreparar(id, lista),
          (error: unknown) => {
            this.quitarDeLaCola(id);
            rechazos.push(
              error instanceof ImagenRechazada
                ? error.message
                : `No pudimos preparar «${archivo.name}».`,
            );
          },
        ),
      );
    }

    if (rechazos.length > 0) {
      this.error.set(rechazos.join(' '));
    } else {
      this.error.set('');
    }
    this.anunciar();
    this.enfocar();

    await Promise.all(tareas);
    if (rechazos.length > 0) {
      this.error.set(rechazos.join(' '));
    }
    this.anunciar();
  }

  private encolar(datos: {
    archivo: File | null;
    original?: File;
    vistaPrevia: string | null;
    estado: ArchivoEnCola['estado'];
  }): number {
    const base = datos.archivo ?? datos.original!;
    const id = ++this.siguienteId;
    if (datos.original) {
      this.originales.set(id, datos.original);
    }
    this.cola.update((lista) => [
      ...lista,
      {
        id,
        nombre: base.name,
        tipo: base.type,
        tamano: base.size,
        archivo: datos.archivo,
        vistaPrevia: datos.vistaPrevia,
        estado: datos.estado,
      },
    ]);
    return id;
  }

  private terminarDePreparar(id: number, archivo: File): void {
    const actual = this.cola().find((item) => item.id === id);
    if (actual === undefined) {
      // Se quitó mientras se achicaba.
      return;
    }
    // Si cambió el archivo (se achicó o se convirtió), la miniatura se rehace
    // con lo que de verdad va a subir.
    if (actual.vistaPrevia === null || archivo !== this.originales.get(id)) {
      this.ponerVistaPrevia(id, archivo);
    }
    this.originales.delete(id);
    this.cola.update((lista) =>
      lista.map((item) =>
        item.id === id
          ? {
              ...item,
              archivo,
              nombre: archivo.name,
              tipo: archivo.type,
              tamano: archivo.size,
              estado: 'lista' as const,
            }
          : item,
      ),
    );
  }

  /** La × de una miniatura. */
  protected quitar(item: ArchivoEnCola): void {
    this.quitarDeLaCola(item.id);
    this.anunciar(`Se quitó ${item.nombre}.`);
    this.enfocar();
  }

  private quitarDeLaCola(id: number): void {
    this.originales.delete(id);
    this.cola.update((lista) => lista.filter((i) => i.id !== id));
  }

  protected limpiarAdjunto(): void {
    this.originales.clear();
    this.cola.set([]);
  }

  /** El nombre y el peso, para la etiqueta de la miniatura. */
  protected describir(item: ArchivoEnCola): string {
    return item.estado === 'preparando'
      ? `${item.nombre}, preparando`
      : `${item.nombre}, ${formatearTamano(item.tamano)}`;
  }

  protected tamanoLegible(item: ArchivoEnCola): string {
    return formatearTamano(item.tamano);
  }

  /** Puede la imagen dibujarse como miniatura en el navegador. */
  protected esImagen(item: ArchivoEnCola): boolean {
    return item.tipo.startsWith('image/') && item.vistaPrevia !== null;
  }

  private anunciar(texto?: string): void {
    const n = this.cola().length;
    const listos = this.cola().filter((i) => i.estado === 'lista').length;
    this.anuncio.set(
      texto ??
        (n === 0
          ? ''
          : `${n} ${n === 1 ? 'archivo' : 'archivos'} para enviar` +
            (listos < n ? `, ${n - listos} preparándose.` : '.')),
    );
  }

  /** Lee la miniatura como `data:` y la cuelga del ítem, si sigue en la cola. */
  private ponerVistaPrevia(id: number, archivo: File): void {
    // Sólo de lo que el navegador dibuja seguro: un HEIC no se ve en Chrome y
    // muestra el ícono hasta que se convierte.
    if (!this.isBrowser || typeof FileReader === 'undefined' || !esImagenAceptada(archivo.type)) {
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      const vistaPrevia = String(lector.result);
      this.cola.update((lista) =>
        lista.map((item) => (item.id === id ? { ...item, vistaPrevia } : item)),
      );
    };
    lector.readAsDataURL(archivo);
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

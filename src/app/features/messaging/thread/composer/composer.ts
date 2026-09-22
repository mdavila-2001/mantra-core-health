import { FilePreview } from '../../../../shared/components/molecules/file-preview/file-preview';
import { FileDropTarget } from '../../../../shared/forms/file-drop-target';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
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

/** Lo más grande que se deja adjuntar. Más que esto no sube por el móvil. */
const TOPE_DE_ARCHIVO = 20 * 1024 * 1024;

/** Lo que el chat acepta adjuntar. */
const TIPOS_ACEPTADOS = ['image/', 'audio/', 'video/', 'application/pdf'];

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

  /** Avisa que se envió, para que el hilo baje del todo. */
  readonly enviado = output<void>();

  private readonly campo = viewChild<ElementRef<HTMLTextAreaElement>>('campo');
  private readonly archivo = viewChild<ElementRef<HTMLInputElement>>('archivo');

  protected readonly texto = signal('');
  protected readonly panel = signal<'ninguno' | 'emojis' | 'adjuntar' | 'plantillas'>(
    'ninguno',
  );

  /**
   * Qué pestaña del panel de figuritas está abierta.
   *
   * Emojis y stickers comparten panel y botón: son la misma pregunta —«mandar
   * algo que no es texto»— y dos botones al lado del campo obligarían a
   * decidir cuál de los dos antes de abrir ninguno.
   */
  protected readonly solapa = signal<'emojis' | 'stickers'>('emojis');
  protected readonly error = signal('');

  /** El archivo elegido, esperando la leyenda y el envío. */
  protected readonly adjunto = signal<File | null>(null);

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
    () => this.texto().trim() !== '' || this.adjunto() !== null,
  );

  constructor() {
    // Al cambiar de conversación se recupera lo que se había escrito ahí:
    // cambiar de chat y volver no puede tirar media frase.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => {
      this.texto.set(this.store.borrador());
      this.panel.set('ninguno');
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
          this.panel.set('ninguno');
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

    inject(DestroyRef).onDestroy(() => this.limpiarAdjunto());
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

    const archivo = this.adjunto();
    if (archivo !== null) {
      this.store.enviarAdjunto(archivo, this.texto());
      this.limpiarAdjunto();
      this.texto.set('');
      this.store.guardarBorrador('');
      this.enviado.emit();
      return;
    }
    if (this.texto().trim() === '') {
      return;
    }
    this.store.enviar(this.texto());
    this.texto.set('');
    this.enviado.emit();
    this.enfocar();
  }

  protected alternar(cual: 'emojis' | 'adjuntar' | 'plantillas'): void {
    this.panel.set(this.panel() === cual ? 'ninguno' : cual);
  }

  protected cerrarPanel(): void {
    this.panel.set('ninguno');
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

  protected elegirArchivo(soloImagenes: boolean): void {
    const entrada = this.archivo()?.nativeElement;
    if (entrada) {
      entrada.accept = soloImagenes ? 'image/*,video/*' : '*/*';
      entrada.click();
    }
    this.panel.set('ninguno');
  }

  protected alElegir(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (archivo === undefined) {
      return;
    }
    if (archivo.size > TOPE_DE_ARCHIVO) {
      this.error.set('El archivo pesa más de 20 MB.');
      return;
    }
    if (!TIPOS_ACEPTADOS.some((tipo) => archivo.type.startsWith(tipo))) {
      this.error.set('Podés mandar imágenes, videos, audios y PDF.');
      return;
    }
    this.error.set('');
    this.ponerAdjunto(archivo);
  }

  private ponerAdjunto(archivo: File): void {
    this.limpiarAdjunto();
    this.adjunto.set(archivo);
    this.enfocar();
  }

  protected limpiarAdjunto(): void {
    this.adjunto.set(null);
  }

  protected nombreDelAdjunto(): string {
    return this.adjunto()?.name ?? '';
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

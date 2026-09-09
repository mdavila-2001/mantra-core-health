import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ChatStore } from '../../../../core/messaging/chat.store';
import { MessageTemplates } from '../../../../core/messaging/message-templates';
import { SelectorEmojis } from './selector-emojis';
import { Grabador } from './grabador';

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
  imports: [FormsModule, Grabador, SelectorEmojis],
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
  protected readonly error = signal('');

  /** El archivo elegido, esperando la leyenda y el envío. */
  protected readonly adjunto = signal<File | null>(null);
  protected readonly vistaPreviaAdjunto = signal<string | null>(null);

  /** Las plantillas de fábrica más las propias (carril P9). */
  protected readonly plantillasDisponibles = this.plantillas.todas;
  protected readonly plantillaNueva = signal('');

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
    this.store.guardarBorrador(valor);
  }

  /** Enter envía; Shift+Enter hace salto de línea. */
  protected alTeclear(evento: KeyboardEvent): void {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      this.enviar();
    }
    if (evento.key === 'Escape' && this.store.respondiendoA() !== null) {
      this.store.responder(null);
    }
  }

  protected enviar(): void {
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
    if (this.isBrowser && archivo.type.startsWith('image/')) {
      this.vistaPreviaAdjunto.set(URL.createObjectURL(archivo));
    }
    this.enfocar();
  }

  protected limpiarAdjunto(): void {
    const previa = this.vistaPreviaAdjunto();
    if (previa !== null && this.isBrowser) {
      URL.revokeObjectURL(previa);
    }
    this.vistaPreviaAdjunto.set(null);
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

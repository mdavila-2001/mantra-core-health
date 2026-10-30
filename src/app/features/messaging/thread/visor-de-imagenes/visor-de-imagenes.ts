import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  OnDestroy,
  output,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Una foto del hilo, como la necesita el visor. */
export interface ImagenDelVisor {
  /** La clave del mensaje: identidad estable entre redibujos. */
  readonly clave: string;
  readonly url: string;
  readonly alt: string;
  /** «Dra. Quispe · 14:32»: quién la mandó y cuándo. */
  readonly pie: string;
  /** Con qué nombre se guarda al descargarla. */
  readonly nombreArchivo: string;
  /** Si se puede responder o reenviar: sólo las que ya llegaron al servidor. */
  readonly accionable: boolean;
}

/** Lo que se puede tocar dentro del visor. */
const ENFOCABLES = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * El visor de fotos del hilo, a pantalla completa.
 *
 * ## Un `<dialog>` nativo y no `app-dialog`
 *
 * `app-dialog` es un diálogo de confirmación —título, mensaje, aceptar—; acá no
 * hay nada de eso, sólo la foto. Del `<dialog>` nativo se aprovecha lo que
 * importa: `showModal()` pone el resto de la página inerte y lo dibuja en la
 * capa superior, por encima del marco del chat.
 *
 * ## El foco
 *
 * Entra al botón de cerrar, no sale del visor con Tab (la trampa se hace
 * también a mano porque jsdom —y un navegador viejo— no tiene `showModal`), y
 * al cerrar vuelve a la miniatura que lo abrió: quien navega con teclado sigue
 * donde estaba.
 */
@Component({
  selector: 'app-visor-de-imagenes',
  templateUrl: './visor-de-imagenes.html',
  styleUrl: './visor-de-imagenes.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisorDeImagenes implements OnDestroy {
  readonly imagenes = input.required<readonly ImagenDelVisor[]>();
  /** Cuál se está mirando. `model` para que el hilo sepa a cuál volver. */
  readonly indice = model.required<number>();

  readonly cerrado = output<void>();
  readonly responder = output<string>();
  readonly reenviar = output<string>();

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly cerrar = viewChild.required<ElementRef<HTMLButtonElement>>('cerrar');
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Quién tenía el foco antes de abrir: a dónde se devuelve. */
  private readonly focoPrevio: HTMLElement | null = this.isBrowser
    ? (document.activeElement as HTMLElement | null)
    : null;

  private yaCerrado = false;

  protected readonly actual = computed<ImagenDelVisor | null>(() => {
    const lista = this.imagenes();
    if (lista.length === 0) return null;
    const i = Math.min(Math.max(this.indice(), 0), lista.length - 1);
    return lista[i] ?? null;
  });

  protected readonly posicion = computed(() => {
    const total = this.imagenes().length;
    return total <= 1 ? '' : `${Math.min(this.indice(), total - 1) + 1} de ${total}`;
  });

  protected readonly hayAnterior = computed(() => this.indice() > 0);
  protected readonly haySiguiente = computed(() => this.indice() < this.imagenes().length - 1);

  constructor() {
    afterNextRender(() => {
      const nativo = this.dialogo().nativeElement;
      if (typeof nativo.showModal === 'function') {
        if (!nativo.open) nativo.showModal();
      } else {
        nativo.setAttribute('open', '');
      }
      this.cerrar().nativeElement.focus();
    });
  }

  ngOnDestroy(): void {
    const nativo = this.dialogo().nativeElement;
    if (typeof nativo.close === 'function' && nativo.open) {
      nativo.close();
    }
    // Devolver el foco a la miniatura, si todavía está en la página.
    if (this.focoPrevio?.isConnected) {
      this.focoPrevio.focus();
    }
  }

  protected anterior(): void {
    if (this.hayAnterior()) this.indice.update((i) => i - 1);
  }

  protected siguiente(): void {
    if (this.haySiguiente()) this.indice.update((i) => i + 1);
  }

  protected terminar(): void {
    if (this.yaCerrado) return;
    this.yaCerrado = true;
    this.cerrado.emit();
  }

  /** `Escape` del `<dialog>` nativo: lo cierra el hilo, no el navegador. */
  protected alCancelar(evento: Event): void {
    evento.preventDefault();
    this.terminar();
  }

  /** Clic en el fondo —no en la foto ni en un botón— cierra. */
  protected alTocarFondo(evento: MouseEvent): void {
    const objetivo = evento.target as HTMLElement | null;
    if (objetivo !== null && objetivo.closest('img, button, a') === null) {
      this.terminar();
    }
  }

  protected alTeclear(evento: KeyboardEvent): void {
    switch (evento.key) {
      case 'Escape':
        evento.preventDefault();
        this.terminar();
        return;
      case 'ArrowLeft':
        evento.preventDefault();
        this.anterior();
        return;
      case 'ArrowRight':
        evento.preventDefault();
        this.siguiente();
        return;
      case 'Home':
        evento.preventDefault();
        this.indice.set(0);
        return;
      case 'End':
        evento.preventDefault();
        this.indice.set(Math.max(this.imagenes().length - 1, 0));
        return;
      case 'Tab':
        this.atraparFoco(evento);
        return;
    }
  }

  /** Tab desde el último vuelve al primero, y Shift+Tab al revés. */
  private atraparFoco(evento: KeyboardEvent): void {
    const nodos = Array.from(
      this.dialogo().nativeElement.querySelectorAll<HTMLElement>(ENFOCABLES),
    );
    if (nodos.length === 0) return;
    const primero = nodos[0]!;
    const ultimo = nodos[nodos.length - 1]!;
    const activo = document.activeElement;
    if (evento.shiftKey && (activo === primero || !nodos.includes(activo as HTMLElement))) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && (activo === ultimo || !nodos.includes(activo as HTMLElement))) {
      evento.preventDefault();
      primero.focus();
    }
  }

  protected alResponder(imagen: ImagenDelVisor): void {
    this.responder.emit(imagen.clave);
  }

  protected alReenviar(imagen: ImagenDelVisor): void {
    this.reenviar.emit(imagen.clave);
  }
}

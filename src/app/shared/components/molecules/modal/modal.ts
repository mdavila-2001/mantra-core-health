/* ============================================================================
    Modal de contenido, sobre el `<dialog>` nativo.

    ## Por qué existe, si ya hay `molecules/dialog`

    Porque `dialog` es un **diálogo de confirmación**: su plantilla dibuja un
    título, un mensaje, un campo de motivo opcional y dos botones, y su salida
    es `confirmado | cancelado`. Es el diálogo correcto para «¿Anulás la
    orden?», y no sirve para «acá está la lista de quién reaccionó, paginada,
    con sus cuatro estados».

    Las dos alternativas eran meterle proyección de contenido a `dialog`
    —volviéndolo dos componentes con una sola clase, donde la mitad de las
    entradas no aplican según el caso— o esto: una molécula hermana que hace
    sólo lo que las dos comparten, que es hablar con el elemento nativo.

    ## Qué trae gratis `showModal()`

    El fondo, la inertización de lo que queda atrás, la trampa de foco y el
    cierre con Escape. Cuatro cosas que una capa hecha a mano hace siempre a
    medias, y que son exactamente lo que pide AC-01-10.

    Lo que el nativo **no** hace y sí se hace acá: devolver el foco a quien lo
    abrió. Sin eso, cerrar deja el foco en el `<body>` y quien navega con
    teclado vuelve a empezar la página desde arriba.
    ========================================================================== */

import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

import { nextControlId } from '@shared/forms/form-control.context';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.html',
  styleUrl: './modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Modal {
  private readonly nativeRef = viewChild.required<ElementRef<HTMLDialogElement>>('nativeDialog');
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** El título del modal. Es su nombre accesible: no es decorativo. */
  readonly heading = input.required<string>();

  /** Rótulo del botón de cierre, para el lector de pantalla. */
  readonly closeLabel = input<string>('Cerrar');

  readonly closed = output<void>();

  protected readonly headingId = `${nextControlId('modal')}-heading`;

  /**
   * A quién devolverle el foco al cerrar.
   *
   * Se toma **antes** de abrir, porque `showModal()` mueve el foco adentro y
   * después ya no hay forma de saber de dónde vino.
   */
  private origen: HTMLElement | null = null;

  constructor() {
    afterNextRender(() => this.abrir());
  }

  protected cerrar(): void {
    // jsdom no implementa `close()` —sólo el elemento—, así que se comprueba.
    const nativo = this.nativeRef().nativeElement;
    if (typeof nativo.close === 'function' && nativo.open) {
      nativo.close();
    }
    this.origen?.focus();
    this.closed.emit();
  }

  private abrir(): void {
    if (!this.isBrowser) {
      return;
    }
    const activo = this.document.activeElement;
    this.origen = activo instanceof HTMLElement ? activo : null;

    const nativo = this.nativeRef().nativeElement;
    if (typeof nativo.showModal === 'function') {
      nativo.showModal();
    }
  }
}

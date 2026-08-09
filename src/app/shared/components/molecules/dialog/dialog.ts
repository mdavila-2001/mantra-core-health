import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

import { AppButton } from '../../atoms/button/button';
import { nextControlId } from '@shared/forms/form-control.context';
import {
  DEFAULT_CANCEL_LABEL,
  DEFAULT_CONFIRM_LABEL,
  type DialogConfig,
} from './dialog.types';

/**
 * Diálogo de confirmación sobre el `<dialog>` **nativo**. No se usa directo:
 * lo monta `DialogService.confirm()`.
 *
 * `showModal()` trae gratis el fondo, la inertización de lo que queda atrás,
 * la trampa de foco y el cierre con `Escape` — cuatro cosas que una capa
 * hecha a mano hace siempre a medias.
 */
@Component({
  selector: 'app-dialog',
  imports: [AppButton],
  templateUrl: './dialog.html',
  styleUrl: './dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dialog {
  private readonly dialogRef =
    viewChild.required<ElementRef<HTMLDialogElement>>('nativeDialog');

  readonly config = input.required<DialogConfig>();

  /** `true` confirmó; `false` canceló, cerró con Escape o clickeó el fondo. */
  readonly resolved = output<boolean>();

  private readonly baseId = nextControlId('dialog');
  protected readonly titleId = `${this.baseId}-title`;
  protected readonly messageId = `${this.baseId}-message`;

  protected readonly confirmLabel = computed(
    () => this.config().confirmLabel ?? DEFAULT_CONFIRM_LABEL,
  );
  protected readonly cancelLabel = computed(
    () => this.config().cancelLabel ?? DEFAULT_CANCEL_LABEL,
  );
  protected readonly isDestructive = computed(() => this.config().destructive === true);

  constructor() {
    afterNextRender(() => this.showModal());
  }

  /** Cierra devolviendo el resultado. Lo llama el servicio y los botones. */
  close(confirmed: boolean): void {
    this.closeNative();
    this.resolved.emit(confirmed);
  }

  protected handleCancel(): void {
    this.close(false);
  }

  protected handleConfirm(): void {
    this.close(true);
  }

  /**
   * `Escape` lo maneja el navegador y dispara `cancel`: se lo escucha en vez
   * de bloquearlo. Cerrar con Escape es cancelar, nunca confirmar.
   */
  protected handleNativeCancel(event: Event): void {
    event.preventDefault();
    this.close(false);
  }

  /**
   * El `<dialog>` ocupa toda la pantalla y su fondo es el `::backdrop`, así
   * que un click «afuera» es un click sobre el propio `<dialog>` pero fuera
   * de la tarjeta: se distingue por el rectángulo del panel.
   */
  protected handleBackdropClick(event: MouseEvent): void {
    if (this.config().dismissible === false) {
      return;
    }
    const panel = this.dialogRef().nativeElement.querySelector('.dialog__panel');
    if (panel === null || !(event.target instanceof Node)) {
      return;
    }
    if (!panel.contains(event.target)) {
      this.close(false);
    }
  }

  /**
   * jsdom no implementa `showModal()`/`close()` —solo el elemento—, así que
   * los dos accesos caen al atributo `open`. En un navegador real siempre
   * gana el método nativo, que es el que trae fondo y trampa de foco.
   */
  private showModal(): void {
    const nativo = this.dialogRef().nativeElement;
    if (typeof nativo.showModal !== 'function') {
      nativo.setAttribute('open', '');
      return;
    }
    nativo.showModal();
  }

  private closeNative(): void {
    const nativo = this.dialogRef().nativeElement;
    if (typeof nativo.close !== 'function') {
      nativo.removeAttribute('open');
      return;
    }
    if (nativo.open) {
      nativo.close();
    }
  }
}

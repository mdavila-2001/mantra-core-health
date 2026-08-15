import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { AppButton } from '../../atoms/button/button';
import { Textarea } from '../../atoms/textarea/textarea';
import { FormField } from '../form-field/form-field';
import { nextControlId } from '@shared/forms/form-control.context';
import {
  DEFAULT_CANCEL_LABEL,
  DEFAULT_CONFIRM_LABEL,
  DEFAULT_REASON_MAX_LENGTH,
  DEFAULT_REASON_MIN_LENGTH,
  type DialogConfig,
  type DialogResult,
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
  imports: [AppButton, FormField, Textarea],
  templateUrl: './dialog.html',
  styleUrl: './dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dialog {
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('nativeDialog');

  readonly config = input.required<DialogConfig>();

  /** Qué se decidió y, si el diálogo lo pedía, el motivo escrito. */
  readonly resolved = output<DialogResult>();

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

  /* ---- motivo, cuando el diálogo lo exige (corrección #14) ---------------- */

  /** La configuración del campo, o `null` si este diálogo no pide motivo. */
  protected readonly reasonConfig = computed(() => this.config().reason ?? null);

  protected readonly reason = signal('');

  /**
   * Se muestra el error recién cuando alguien intentó confirmar.
   *
   * Un campo que nace en rojo acusa antes de que la persona haya hecho nada; el
   * error tiene que aparecer cuando hay algo que corregir, no al abrir.
   */
  private readonly reasonTouched = signal(false);

  protected readonly reasonMinLength = computed(
    () => this.reasonConfig()?.minLength ?? DEFAULT_REASON_MIN_LENGTH,
  );

  protected readonly reasonMaxLength = computed(
    () => this.reasonConfig()?.maxLength ?? DEFAULT_REASON_MAX_LENGTH,
  );

  /** El motivo alcanza para el servidor. Sin motivo pedido, siempre `true`. */
  protected readonly reasonIsValid = computed(
    () => this.reasonConfig() === null || this.reason().trim().length >= this.reasonMinLength(),
  );

  protected readonly reasonError = computed(() =>
    this.reasonTouched() && !this.reasonIsValid()
      ? `Escribí el motivo (al menos ${this.reasonMinLength()} caracteres). La otra parte lo va a ver.`
      : '',
  );

  constructor() {
    afterNextRender(() => this.showModal());
  }

  /** Cierra devolviendo el resultado. Lo llama el servicio y los botones. */
  close(confirmed: boolean): void {
    this.closeNative();
    this.resolved.emit({
      confirmed,
      ...(confirmed && this.reasonConfig() !== null ? { reason: this.reason().trim() } : {}),
    });
  }

  protected handleCancel(): void {
    this.close(false);
  }

  /**
   * Confirmar con el motivo incompleto **no cierra**: marca el campo y deja el
   * diálogo abierto. Cerrar y mostrar después el rechazo del servidor haría
   * perder lo escrito y obligaría a empezar de nuevo.
   */
  protected handleConfirm(): void {
    if (!this.reasonIsValid()) {
      this.reasonTouched.set(true);
      return;
    }
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

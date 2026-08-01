import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { AppButton } from '../../atoms/button/button';
import { DialogService } from '../../molecules/dialog/dialog-service';

/** Etiqueta obligatoria de las entidades que no se editan (`<<IMMUTABLE>>`). */
export const CORRECTION_LABEL = 'Registrar corrección';

/**
 * Barra de envío de un formulario.
 *
 * ```html
 * <app-form-actions [pending]="guardando()" (submitted)="guardar()" (cancelled)="volver()" />
 * <app-form-actions correctionOnly [pending]="guardando()" (submitted)="corregir()" />
 * ```
 *
 * Dos reglas del modelo que este organismo hace cumplir:
 *
 * - **`correctionOnly`** — las entidades `<<IMMUTABLE>>`/`<<APPEND_ONLY>>` no
 *   se editan: se registra una corrección. La etiqueta lo dice, y no depende
 *   de que quien arme la pantalla se acuerde.
 * - **Idempotencia de envío** — con `pending` el primario queda deshabilitado
 *   *y además* se ignoran los clicks repetidos. Confiar solo en el
 *   deshabilitado visual deja pasar el doble click de un trackpad lento, y en
 *   una orden médica eso es un duplicado real.
 *
 * Con `destructive`, la confirmación es obligatoria: sin ella no se emite nada.
 */
@Component({
  selector: 'app-form-actions',
  imports: [AppButton],
  templateUrl: './form-actions.html',
  styleUrl: './form-actions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'form-actions',
  },
})
export class FormActions {
  private readonly dialogs = inject(DialogService);

  readonly submitLabel = input<string>('Guardar');
  readonly cancelLabel = input<string>('');
  readonly pending = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly destructive = input(false, { transform: booleanAttribute });
  readonly correctionOnly = input(false, { transform: booleanAttribute });

  /** Texto y mensaje del diálogo cuando la acción es destructiva. */
  readonly confirmTitle = input<string>('¿Confirmás la acción?');
  readonly confirmMessage = input<string>('Esta acción no se puede deshacer.');

  readonly submitted = output<void>();
  readonly cancelled = output<void>();

  /**
   * Envío en curso desde el punto de vista de ESTE componente. Se levanta al
   * primer click y no baja hasta que el consumidor apaga `pending`: es lo que
   * hace que el segundo click no llegue a ningún lado.
   */
  private readonly submitting = signal(false);

  /** «Registrar corrección» manda sobre cualquier etiqueta que le pasen. */
  protected readonly primaryLabel = computed(() =>
    this.correctionOnly() ? CORRECTION_LABEL : this.submitLabel(),
  );

  protected readonly isBusy = computed(() => this.pending() || this.submitting());

  protected readonly isBlocked = computed(() => this.disabled() || this.isBusy());

  protected readonly primaryVariant = computed(() => (this.destructive() ? 'danger' : 'primary'));

  protected async handleSubmit(): Promise<void> {
    if (this.isBlocked()) {
      return;
    }
    // Se marca ANTES de cualquier `await`: entre el click y la respuesta del
    // diálogo hay tiempo de sobra para un segundo click.
    this.submitting.set(true);

    if (this.destructive()) {
      const confirmado = await this.dialogs.confirm({
        title: this.confirmTitle(),
        message: this.confirmMessage(),
        confirmLabel: this.primaryLabel(),
        destructive: true,
      });
      if (!confirmado) {
        // Sin confirmación no se emite nada y la barra vuelve a estar viva.
        this.submitting.set(false);
        return;
      }
    }

    this.submitted.emit();

    if (!this.pending()) {
      // El consumidor no declaró trabajo en curso: se libera, pero **un turno
      // después**. Liberar en el mismo turno dejaría pasar el segundo click de
      // un doble click, que es exactamente lo que hay que frenar; liberar
      // nunca dejaría la barra trabada tras un envío que ya terminó.
      queueMicrotask(() => this.submitting.set(false));
    }
  }

  protected handleCancel(): void {
    this.cancelled.emit();
  }
}

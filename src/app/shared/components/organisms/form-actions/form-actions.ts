import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
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
 *
 * ## `Escape` es «Cancelar»
 *
 * Pedido del propietario (30/09/2026): en TODA pantalla de edición, `Escape`
 * descarta lo tipeado igual que el botón. Vive acá y no en cada formulario
 * porque así lo heredan los cuarenta y tantos que ya usan esta barra, y el
 * próximo no depende de que alguien se acuerde. Sólo actúa si la barra tiene
 * «Cancelar» (`cancelLabel`) y no está enviando. Se hace a un lado:
 *
 * - si alguien más ya atendió la tecla (`defaultPrevented`): un desplegable,
 *   un combobox, el calendario o el menú cierran primero su capa, y ese
 *   Escape no debe además tirar el formulario entero;
 * - si hay un `<dialog>` abierto, o si la barra misma vive en uno: el diálogo
 *   tiene su propio Escape, que pasa por su `closeGuard`;
 * - si el foco está en OTRO formulario de la página. Con el foco suelto (en el
 *   `body`, que es donde lo deja Safari al hacer clic en un botón) actúa sólo
 *   si es la única barra con «Cancelar» a la vista: con dos, adivinar cuál
 *   descartar sería perder lo tipeado en el formulario equivocado.
 */
@Component({
  selector: 'app-form-actions',
  imports: [AppButton],
  templateUrl: './form-actions.html',
  styleUrl: './form-actions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'form-actions',
    '(document:keydown.escape)': 'handleEscape($event)',
  },
})
export class FormActions {
  /** Las barras montadas, para saber si con el foco suelto hay una sola candidata. */
  private static readonly montadas = new Set<FormActions>();

  private readonly dialogs = inject(DialogService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly submitLabel = input<string>('Guardar');
  readonly cancelLabel = input<string>('');
  readonly pending = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly destructive = input(false, { transform: booleanAttribute });
  readonly correctionOnly = input(false, { transform: booleanAttribute });
  /**
   * Sin el botón primario: sólo «Cancelar». Para las pantallas donde hay algo
   * que descartar pero nada que ESTA barra guarde —p. ej. las pestañas del
   * editor del médico donde cada bloque tiene su propio «Agregar»—.
   */
  readonly showSubmit = input(true, { transform: booleanAttribute });

  /** Texto y mensaje del diálogo cuando la acción es destructiva. */
  readonly confirmTitle = input<string>('¿Confirma la acción?');
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

  constructor() {
    FormActions.montadas.add(this);
    inject(DestroyRef).onDestroy(() => FormActions.montadas.delete(this));
  }

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

  /** `Escape` en la página: cancela si esta barra es la que corresponde. */
  protected handleEscape(event: Event): void {
    const tecla = event as KeyboardEvent;
    if (tecla.defaultPrevented || tecla.isComposing || !this.cancelaConEscape()) {
      return;
    }
    const documento = this.host.nativeElement.ownerDocument;
    if (documento.querySelector('dialog[open]') !== null) {
      return;
    }
    if (!this.tieneElFoco(documento)) {
      return;
    }
    tecla.preventDefault();
    this.handleCancel();
  }

  /** Tiene «Cancelar», no está enviando y no vive dentro de un diálogo. */
  private cancelaConEscape(): boolean {
    return (
      this.cancelLabel() !== '' &&
      !this.isBusy() &&
      this.host.nativeElement.closest('dialog') === null
    );
  }

  /**
   * El foco está en el formulario de esta barra, o está suelto y esta es la
   * única barra que podría cancelar.
   */
  private tieneElFoco(documento: Document): boolean {
    const enfocado = documento.activeElement;
    if (enfocado === null || enfocado === documento.body) {
      const candidatas = [...FormActions.montadas].filter((barra) => barra.cancelaConEscape());
      return candidatas.length === 1 && candidatas[0] === this;
    }
    const alcance =
      this.host.nativeElement.closest('form, app-card') ?? this.host.nativeElement.parentElement;
    return alcance?.contains(enfocado) ?? false;
  }
}

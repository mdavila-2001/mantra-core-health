import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  type OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { SimpleAccountingClient } from '../../../core/data-access/simple-accounting/simple-accounting.client';
import type {
  AccountClass,
  SimpleAccount,
} from '../../../core/data-access/simple-accounting/simple-accounting.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { motivoDelError } from './errors';
import { NOMBRE_DE_CLASE, OPCIONES_DE_CLASE } from './records.format';

/**
 * **Una cuenta**, nueva o para renombrar.
 *
 * Se abre desde la pestaña «Cuentas» y también **desde el formulario de un
 * gasto, un activo o una deuda** («Nueva cuenta» al lado del tipo): el pedido
 * era poder crear cuentas «ahí mismo». En ese caso llega con la clase fija
 * —la del registro— y al guardar la cuenta nueva queda elegida como tipo.
 *
 * Una cuenta general se puede renombrar pero no cambiar de clase: otros
 * registros y el plan de siempre cuelgan de ella.
 */
@Component({
  selector: 'app-account-dialog',
  imports: [
    ReactiveFormsModule,
    AnnounceOnAppear,
    AppButton,
    Alert,
    ContentDialog,
    FormField,
    Input,
    Select,
  ],
  templateUrl: './account-dialog.html',
  styleUrl: './records-dialogs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CuentaDialog implements OnInit {
  readonly practiceId = input.required<string>();
  /** La cuenta a editar, o `null` para crear una. */
  readonly cuenta = input<SimpleAccount | null>(null);
  /** Clase fija: la del registro desde el que se abrió. */
  readonly claseFija = input<AccountClass | null>(null);

  readonly saved = output<SimpleAccount>();
  readonly closed = output<void>();

  private readonly contabilidad = inject(SimpleAccountingClient);
  private readonly fb = inject(FormBuilder);
  protected readonly dialog = viewChild.required(ContentDialog);

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly opcionesDeClase = OPCIONES_DE_CLASE;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    accountClass: this.fb.nonNullable.control<AccountClass>('EXPENSE', Validators.required),
  });

  protected readonly titulo = computed(() => {
    if (this.cuenta() !== null) return 'Editar la cuenta';
    const clase = this.claseFija();
    return clase === null
      ? 'Nueva cuenta'
      : `Nueva cuenta de ${NOMBRE_DE_CLASE[clase].toLowerCase()}`;
  });

  /** La clase no se toca en una general, ni cuando llega fija. */
  protected readonly claseBloqueada = computed(
    () => this.claseFija() !== null || this.cuenta()?.seeded === true,
  );

  ngOnInit(): void {
    const cuenta = this.cuenta();
    if (cuenta !== null) {
      this.form.setValue({ name: cuenta.name, accountClass: cuenta.accountClass });
    } else if (this.claseFija() !== null) {
      this.form.controls.accountClass.setValue(this.claseFija()!);
    }
    if (this.claseBloqueada()) {
      this.form.controls.accountClass.disable();
    }
  }

  protected guardar(): void {
    if (this.guardando()) return;
    if (this.form.controls.name.invalid || this.form.controls.name.value.trim() === '') {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    const valor = this.form.getRawValue();
    const datos = { name: valor.name.trim(), accountClass: valor.accountClass };
    const cuenta = this.cuenta();
    const pedido =
      cuenta === null
        ? this.contabilidad.createAccount(this.practiceId(), datos)
        : this.contabilidad.updateAccount(cuenta.id, datos);
    pedido.subscribe({
      next: (guardada) => {
        this.guardando.set(false);
        this.saved.emit(guardada);
        this.dialog().close(true);
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.error.set(motivoDelError(error));
      },
    });
  }
}

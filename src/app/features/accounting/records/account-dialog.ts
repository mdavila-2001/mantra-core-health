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
import { errorReason } from './errors';
import { CLASS_NAME, CLASS_OPTIONS } from './records.format';

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
export class AccountDialog implements OnInit {
  readonly practiceId = input.required<string>();
  /** La cuenta a editar, o `null` para crear una. */
  readonly cuenta = input<SimpleAccount | null>(null);
  /** Clase fija: la del registro desde el que se abrió. */
  readonly claseFija = input<AccountClass | null>(null);

  readonly saved = output<SimpleAccount>();
  readonly closed = output<void>();

  private readonly accounting = inject(SimpleAccountingClient);
  private readonly fb = inject(FormBuilder);
  protected readonly dialog = viewChild.required(ContentDialog);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly classOptions = CLASS_OPTIONS;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    accountClass: this.fb.nonNullable.control<AccountClass>('EXPENSE', Validators.required),
  });

  protected readonly title = computed(() => {
    if (this.cuenta() !== null) return 'Editar la cuenta';
    const clase = this.claseFija();
    return clase === null
      ? 'Nueva cuenta'
      : `Nueva cuenta de ${CLASS_NAME[clase].toLowerCase()}`;
  });

  /** La clase no se toca en una general, ni cuando llega fija. */
  protected readonly blockedClass = computed(
    () => this.claseFija() !== null || this.cuenta()?.seeded === true,
  );

  ngOnInit(): void {
    const cuenta = this.cuenta();
    if (cuenta !== null) {
      this.form.setValue({ name: cuenta.name, accountClass: cuenta.accountClass });
    } else if (this.claseFija() !== null) {
      this.form.controls.accountClass.setValue(this.claseFija()!);
    }
    if (this.blockedClass()) {
      this.form.controls.accountClass.disable();
    }
  }

  protected save(): void {
    if (this.saving()) return;
    if (this.form.controls.name.invalid || this.form.controls.name.value.trim() === '') {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const valor = this.form.getRawValue();
    const datos = { name: valor.name.trim(), accountClass: valor.accountClass };
    const cuenta = this.cuenta();
    const pedido =
      cuenta === null
        ? this.accounting.createAccount(this.practiceId(), datos)
        : this.accounting.updateAccount(cuenta.id, datos);
    pedido.subscribe({
      next: (guardada) => {
        this.saving.set(false);
        this.saved.emit(guardada);
        this.dialog().close(true);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(errorReason(error));
      },
    });
  }
}

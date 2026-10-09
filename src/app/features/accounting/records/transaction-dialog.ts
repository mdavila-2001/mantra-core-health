import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { CustomField } from '../../../shared/components/organisms/paginated-form/custom-field';
import type { PaginaDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';
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
  SimpleAccount,
  SimpleTransaction,
} from '../../../core/data-access/simple-accounting/simple-accounting.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { errorReason } from './errors';
import {
  toDay,
  fromDay,
  editableAmount,
  normalizedAmount,
  accountsOptions,
} from './records.format';

/**
 * **Una transacción**: debe, haber y monto. Nada más, a pedido: sin centros de
 * costo, sin líneas múltiples, sin flujo de aprobación. Una cuenta recibe (el
 * debe) y otra entrega (el haber), por el mismo monto.
 */
@Component({
  selector: 'app-transaction-dialog',
  imports: [PaginatedForm, CustomField,
    ReactiveFormsModule,
    AnnounceOnAppear,
    Alert,
    ContentDialog,
    DatePicker,
    FormField,
    Input,
    Select,
  ],
  templateUrl: './transaction-dialog.html',
  styleUrl: './records-dialogs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionDialog implements OnInit {
  protected readonly transactionPages: readonly PaginaDeFormulario[] = [
    { titulo: 'Descripción y cuentas', campos: ['description', 'debitAccountId', 'creditAccountId'].map((key) => ({ key, label: '', control: 'custom' })) },
    { titulo: 'Fecha y monto', campos: ['date', 'amount'].map((key) => ({ key, label: '', control: 'custom' })) },
  ];

  readonly practiceId = input.required<string>();
  readonly cuentas = input.required<readonly SimpleAccount[]>();
  readonly transaccion = input<SimpleTransaction | null>(null);

  readonly saved = output<SimpleTransaction>();
  readonly closed = output<void>();

  private readonly accounting = inject(SimpleAccountingClient);
  private readonly fb = inject(FormBuilder);
  protected readonly dialog = viewChild.required(ContentDialog);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly date = signal<Date | null>(new Date());
  protected readonly touchedDate = signal(false);

  protected readonly options = computed(() => accountsOptions(this.cuentas()));
  protected readonly title = computed(() =>
    this.transaccion() === null ? 'Nueva transacción' : 'Editar la transacción',
  );

  protected readonly form = this.fb.nonNullable.group({
    description: ['', [Validators.required, Validators.maxLength(160)]],
    debitAccountId: ['', Validators.required],
    creditAccountId: ['', Validators.required],
    amount: ['', Validators.required],
  });

  protected accountSame(): boolean {
    const { debitAccountId, creditAccountId } = this.form.getRawValue();
    return debitAccountId !== '' && debitAccountId === creditAccountId;
  }

  protected invalidAmount(): boolean {
    return (
      this.form.controls.amount.touched &&
      normalizedAmount(this.form.controls.amount.value) === null
    );
  }

  ngOnInit(): void {
    const transaccion = this.transaccion();
    if (transaccion !== null) {
      this.form.setValue({
        description: transaccion.description,
        debitAccountId: transaccion.debitAccountId,
        creditAccountId: transaccion.creditAccountId,
        amount: editableAmount(transaccion.amount),
      });
      this.date.set(fromDay(transaccion.date));
    }
  }

  protected save(): void {
    if (this.saving()) return;
    const fecha = this.date();
    const monto = normalizedAmount(this.form.controls.amount.value);
    if (this.form.invalid || fecha === null || monto === null || this.accountSame()) {
      this.form.markAllAsTouched();
      this.touchedDate.set(true);
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const valor = this.form.getRawValue();
    const datos = {
      date: toDay(fecha),
      description: valor.description.trim(),
      debitAccountId: valor.debitAccountId,
      creditAccountId: valor.creditAccountId,
      amount: monto,
    };
    const transaccion = this.transaccion();
    const pedido =
      transaccion === null
        ? this.accounting.createTransaction(this.practiceId(), datos)
        : this.accounting.updateTransaction(transaccion.id, datos);
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

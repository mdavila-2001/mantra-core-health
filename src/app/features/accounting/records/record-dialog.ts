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
import {
  CLASS_OF_KIND,
  type RecordKind,
  type SimpleAccount,
  type SimpleRecord,
} from '../../../core/data-access/simple-accounting/simple-accounting.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { AccountDialog } from './account-dialog';
import { errorReason } from './errors';
import {
  toDay,
  fromDay,
  editableAmount,
  normalizedAmount,
  accountsOptions,
  TEXTS,
} from './records.format';

/**
 * **Un gasto, un activo o una deuda**: fecha, tipo, descripción y monto.
 *
 * Los tres son el mismo formulario con otros rótulos, que es lo que el pedido
 * decía: «gasto → tipo, activo → tipo, deuda → tipo». El tipo se elige entre
 * las cuentas de la clase que corresponde, y **«Nueva cuenta»** abre el modal
 * de cuenta ahí mismo: la cuenta recién creada queda elegida.
 */
@Component({
  selector: 'app-record-dialog',
  imports: [
    ReactiveFormsModule,
    AnnounceOnAppear,
    AppButton,
    Alert,
    ContentDialog,
    AccountDialog,
    DatePicker,
    FormField,
    Input,
    Select,
  ],
  templateUrl: './record-dialog.html',
  styleUrl: './records-dialogs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordDialog implements OnInit {
  readonly practiceId = input.required<string>();
  readonly kind = input.required<RecordKind>();
  readonly cuentas = input.required<readonly SimpleAccount[]>();
  /** El registro a editar, o `null` para cargar uno nuevo. */
  readonly registro = input<SimpleRecord | null>(null);

  readonly saved = output<SimpleRecord>();
  /** Se creó una cuenta desde acá: la lista de cuentas tiene que releerse. */
  readonly cuentaCreada = output<SimpleAccount>();
  readonly closed = output<void>();

  private readonly accounting = inject(SimpleAccountingClient);
  private readonly fb = inject(FormBuilder);
  protected readonly dialog = viewChild.required(ContentDialog);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly date = signal<Date | null>(new Date());
  protected readonly touchedDate = signal(false);
  protected readonly accountCreating = signal(false);
  /** Las cuentas creadas desde este modal, hasta que la lista de afuera las traiga. */
  private readonly new = signal<readonly SimpleAccount[]>([]);

  protected readonly texts = computed(() => TEXTS[this.kind()]);
  protected readonly class = computed(() => CLASS_OF_KIND[this.kind()]);
  protected readonly title = computed(() =>
    this.registro() === null ? this.texts().nuevo : `Editar ${this.texts().conArticulo}`,
  );
  protected readonly typeOptions = computed(() => {
    const conocidas = new Set(this.cuentas().map((cuenta) => cuenta.id));
    return accountsOptions(
      [...this.cuentas(), ...this.new().filter((cuenta) => !conocidas.has(cuenta.id))],
      this.class(),
    );
  });

  protected readonly form = this.fb.nonNullable.group({
    accountId: ['', Validators.required],
    description: ['', [Validators.required, Validators.maxLength(160)]],
    amount: ['', Validators.required],
  });

  /** El monto escrito, ya normalizado; `null` si no es un monto válido. */
  private amount(): string | null {
    return normalizedAmount(this.form.controls.amount.value);
  }

  protected invalidAmount(): boolean {
    return this.form.controls.amount.touched && this.amount() === null;
  }

  ngOnInit(): void {
    const registro = this.registro();
    if (registro !== null) {
      this.form.setValue({
        accountId: registro.accountId,
        description: registro.description,
        amount: editableAmount(registro.amount),
      });
      this.date.set(fromDay(registro.date));
    }
  }

  protected toCreateAccount(cuenta: SimpleAccount): void {
    this.new.update((nuevas) => [...nuevas, cuenta]);
    this.form.controls.accountId.setValue(cuenta.id);
    this.cuentaCreada.emit(cuenta);
  }

  protected save(): void {
    if (this.saving()) return;
    const fecha = this.date();
    const monto = this.amount();
    if (this.form.invalid || fecha === null || monto === null) {
      this.form.markAllAsTouched();
      this.touchedDate.set(true);
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const datos = {
      kind: this.kind(),
      date: toDay(fecha),
      accountId: this.form.controls.accountId.value,
      description: this.form.controls.description.value.trim(),
      amount: monto,
    };
    const registro = this.registro();
    const pedido =
      registro === null
        ? this.accounting.createRecord(this.practiceId(), datos)
        : this.accounting.updateRecord(registro.id, datos);
    pedido.subscribe({
      next: (guardado) => {
        this.saving.set(false);
        this.saved.emit(guardado);
        this.dialog().close(true);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(errorReason(error));
      },
    });
  }
}

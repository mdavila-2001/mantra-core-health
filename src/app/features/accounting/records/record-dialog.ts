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
import { CuentaDialog } from './account-dialog';
import { motivoDelError } from './errors';
import {
  aDia,
  deDia,
  montoEditable,
  montoNormalizado,
  opcionesDeCuentas,
  TEXTOS,
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
    CuentaDialog,
    DatePicker,
    FormField,
    Input,
    Select,
  ],
  templateUrl: './record-dialog.html',
  styleUrl: './records-dialogs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroDialog implements OnInit {
  readonly practiceId = input.required<string>();
  readonly kind = input.required<RecordKind>();
  readonly cuentas = input.required<readonly SimpleAccount[]>();
  /** El registro a editar, o `null` para cargar uno nuevo. */
  readonly registro = input<SimpleRecord | null>(null);

  readonly saved = output<SimpleRecord>();
  /** Se creó una cuenta desde acá: la lista de cuentas tiene que releerse. */
  readonly cuentaCreada = output<SimpleAccount>();
  readonly closed = output<void>();

  private readonly contabilidad = inject(SimpleAccountingClient);
  private readonly fb = inject(FormBuilder);
  protected readonly dialog = viewChild.required(ContentDialog);

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly fechaTocada = signal(false);
  protected readonly creandoCuenta = signal(false);
  /** Las cuentas creadas desde este modal, hasta que la lista de afuera las traiga. */
  private readonly nuevas = signal<readonly SimpleAccount[]>([]);

  protected readonly textos = computed(() => TEXTOS[this.kind()]);
  protected readonly clase = computed(() => CLASS_OF_KIND[this.kind()]);
  protected readonly titulo = computed(() =>
    this.registro() === null ? this.textos().nuevo : `Editar ${this.textos().conArticulo}`,
  );
  protected readonly opcionesDeTipo = computed(() => {
    const conocidas = new Set(this.cuentas().map((cuenta) => cuenta.id));
    return opcionesDeCuentas(
      [...this.cuentas(), ...this.nuevas().filter((cuenta) => !conocidas.has(cuenta.id))],
      this.clase(),
    );
  });

  protected readonly form = this.fb.nonNullable.group({
    accountId: ['', Validators.required],
    description: ['', [Validators.required, Validators.maxLength(160)]],
    amount: ['', Validators.required],
  });

  /** El monto escrito, ya normalizado; `null` si no es un monto válido. */
  private monto(): string | null {
    return montoNormalizado(this.form.controls.amount.value);
  }

  protected montoInvalido(): boolean {
    return this.form.controls.amount.touched && this.monto() === null;
  }

  ngOnInit(): void {
    const registro = this.registro();
    if (registro !== null) {
      this.form.setValue({
        accountId: registro.accountId,
        description: registro.description,
        amount: montoEditable(registro.amount),
      });
      this.fecha.set(deDia(registro.date));
    }
  }

  protected alCrearCuenta(cuenta: SimpleAccount): void {
    this.nuevas.update((nuevas) => [...nuevas, cuenta]);
    this.form.controls.accountId.setValue(cuenta.id);
    this.cuentaCreada.emit(cuenta);
  }

  protected guardar(): void {
    if (this.guardando()) return;
    const fecha = this.fecha();
    const monto = this.monto();
    if (this.form.invalid || fecha === null || monto === null) {
      this.form.markAllAsTouched();
      this.fechaTocada.set(true);
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    const datos = {
      kind: this.kind(),
      date: aDia(fecha),
      accountId: this.form.controls.accountId.value,
      description: this.form.controls.description.value.trim(),
      amount: monto,
    };
    const registro = this.registro();
    const pedido =
      registro === null
        ? this.contabilidad.createRecord(this.practiceId(), datos)
        : this.contabilidad.updateRecord(registro.id, datos);
    pedido.subscribe({
      next: (guardado) => {
        this.guardando.set(false);
        this.saved.emit(guardado);
        this.dialog().close(true);
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.error.set(motivoDelError(error));
      },
    });
  }
}

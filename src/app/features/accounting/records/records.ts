import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  type TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SimpleAccountingClient } from '../../../core/data-access/simple-accounting/simple-accounting.client';
import type {
  PractitionerSummary,
  RecordKind,
  SimpleAccount,
  SimpleRecord,
  SimpleTransaction,
  SummaryPeriod,
} from '../../../core/data-access/simple-accounting/simple-accounting.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { RowActions } from '../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import { SectionHeading } from '../../../shared/components/molecules/section-heading/section-heading';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { amountBs } from '../summary/windows';
import { AccountDialog } from './account-dialog';
import { errorReason } from './errors';
import { RecordDialog } from './record-dialog';
import { readableDay, CLASS_NAME, accountLabel, TEXTS } from './records.format';
import { TransactionDialog } from './transaction-dialog';

/** Una fila de la tabla de gastos, activos o deudas, ya en palabras. */
interface RecordRow {
  readonly id: string;
  readonly fecha: string;
  readonly tipo: string;
  readonly descripcion: string;
  readonly monto: string;
  readonly registro: SimpleRecord;
}

interface TransactionRow {
  readonly id: string;
  readonly fecha: string;
  readonly descripcion: string;
  readonly debe: string;
  readonly haber: string;
  readonly monto: string;
  readonly transaccion: SimpleTransaction;
}

interface AccountRow {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly clase: string;
  readonly origen: string;
  readonly cuenta: SimpleAccount;
}

type Cell<Fila> = TemplateRef<{ $implicit: Fila }>;

/** Qué modal está abierto, con lo que necesita. */
type Modal =
  | { readonly tipo: 'registro'; readonly kind: RecordKind; readonly registro: SimpleRecord | null }
  | { readonly tipo: 'transaccion'; readonly transaccion: SimpleTransaction | null }
  | { readonly tipo: 'cuenta'; readonly cuenta: SimpleAccount | null };

/** Ver {@link SimpleAccounting.parte}. */
export type AccountingPart = 'todo' | 'numeros' | 'registros';

const PERIODS: readonly SegmentedOption<SummaryPeriod>[] = [
  { value: 'month', label: 'Este mes' },
  { value: 'year', label: 'Este año' },
];

const ACTIONS: readonly RowAction[] = [
  { code: 'editar', label: 'Editar', icon: 'edit' },
  { code: 'borrar', label: 'Borrar', icon: 'remove', destructive: true },
];

const WITHOUT_DELETE: readonly RowAction[] = [{ code: 'editar', label: 'Editar', icon: 'edit' }];

const KINDS: readonly RecordKind[] = ['EXPENSE', 'ASSET', 'DEBT'];

/**
 * **La contabilidad simple del doctor** (28/09/2026), arriba del resumen de
 * «Contabilidad».
 *
 * Lo que pidió el propietario, en su orden:
 *
 * 1. **Tres números a la vista**: cuántos pacientes se atendieron, cuánto
 *    dinero se hizo y cuánto se espera recibir de las aseguradoras —los dos
 *    importes separados, «como dos números»—.
 * 2. **Gasto → tipo, activo → tipo, deuda → tipo, transacción debe/haber** y
 *    nada más: sin centros de costo, sin flujo de aprobación. Cada uno con su
 *    alta, edición y baja.
 * 3. **Cuentas con modal y tabla**, con las generales ya sembradas y la
 *    posibilidad de crear las propias «ahí mismo» (también desde el
 *    formulario de un gasto, un activo o una deuda).
 *
 * Una tarjeta con cinco pestañas (regla 6) y la misma tabla y el mismo modal
 * del sistema en las cinco. El resto de la pantalla de Contabilidad no cambia.
 */
@Component({
  selector: 'app-simple-accounting',
  imports: [
    AppButton,
    Card,
    AccountDialog,
    DataTable,
    RecordDialog,
    RowActions,
    SectionHeading,
    SegmentedControl,
    Tab,
    Tabs,
    TransactionDialog,
    ViewStateHost,
  ],
  templateUrl: './records.html',
  styleUrl: './records.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimpleAccounting {
  /** La práctica cuyos números y registros se muestran. */
  readonly practiceId = input.required<string>();

  /**
   * Qué parte de la contabilidad simple se pinta.
   *
   * La pantalla de Contabilidad separa **tableros** de **registros** en dos
   * pestañas (30/09/2026): los tres números son un tablero y van con el resto
   * del resumen; las tablas con su alta, edición y baja van en «Registros».
   * Cada instancia sólo lee lo que pinta. `todo` es el comportamiento de
   * antes de la separación.
   */
  readonly parte = input<AccountingPart>('todo');

  private readonly accounting = inject(SimpleAccountingClient);
  private readonly dialogs = inject(DialogService);
  private readonly notices = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly periods = PERIODS;
  protected readonly period = signal<SummaryPeriod>('month');
  protected readonly tab = signal(0);
  protected readonly texts = TEXTS;
  protected readonly kinds = KINDS;
  protected readonly modal = signal<Modal | null>(null);

  protected readonly summary = signal<ViewState<PractitionerSummary>>(loading());
  protected readonly accounts = signal<ViewState<readonly SimpleAccount[]>>(loading());
  protected readonly records = signal<
    Readonly<Record<RecordKind, ViewState<readonly SimpleRecord[]>>>
  >({
    EXPENSE: loading(),
    ASSET: loading(),
    DEBT: loading(),
  });
  protected readonly transactions = signal<ViewState<readonly SimpleTransaction[]>>(loading());

  protected readonly numbers = computed(() => dataOf(this.summary()));
  protected readonly accountsList = computed(() => dataOf(this.accounts()) ?? []);
  private readonly accountById = computed(
    () => new Map(this.accountsList().map((cuenta) => [cuenta.id, cuenta] as const)),
  );

  /* ---- las celdas de acciones, una por tabla ---------------------------- */

  private readonly accionesDeRegistro = viewChild<Cell<RecordRow>>('accionesDeRegistro');
  private readonly accionesDeTransaccion =
    viewChild<Cell<TransactionRow>>('accionesDeTransaccion');
  private readonly accionesDeCuenta = viewChild<Cell<AccountRow>>('accionesDeCuenta');

  protected readonly recordColumns = computed<readonly ColumnDef<RecordRow>[]>(() => [
    { key: 'fecha', header: 'Fecha', priority: 2 },
    { key: 'tipo', header: 'Tipo', priority: 1 },
    { key: 'descripcion', header: 'Descripción', priority: 1 },
    { key: 'monto', header: 'Monto', priority: 1, align: 'end' },
    { key: 'acciones', header: 'Acciones', priority: 1, cell: this.accionesDeRegistro() },
  ]);

  protected readonly transactionColumns = computed<readonly ColumnDef<TransactionRow>[]>(
    () => [
      { key: 'fecha', header: 'Fecha', priority: 2 },
      { key: 'descripcion', header: 'Descripción', priority: 1 },
      { key: 'debe', header: 'Debe', priority: 1 },
      { key: 'haber', header: 'Haber', priority: 1 },
      { key: 'monto', header: 'Monto', priority: 1, align: 'end' },
      { key: 'acciones', header: 'Acciones', priority: 1, cell: this.accionesDeTransaccion() },
    ],
  );

  protected readonly accountColumns = computed<readonly ColumnDef<AccountRow>[]>(() => [
    { key: 'codigo', header: 'Código', priority: 2 },
    { key: 'nombre', header: 'Nombre', priority: 1 },
    { key: 'clase', header: 'Clase', priority: 1 },
    { key: 'origen', header: 'Origen', priority: 3 },
    { key: 'acciones', header: 'Acciones', priority: 1, cell: this.accionesDeCuenta() },
  ]);

  protected readonly byId = (fila: { readonly id: string }): string => fila.id;

  /* ---- las filas, ya en palabras ---------------------------------------- */

  private accountName(id: string): string {
    const cuenta = this.accountById().get(id);
    return cuenta === undefined ? 'Cuenta borrada' : accountLabel(cuenta);
  }

  protected rowsOf(kind: RecordKind): ViewState<readonly RecordRow[]> {
    return map(this.records()[kind], (registro) => ({
      id: registro.id,
      fecha: readableDay(registro.date),
      tipo: this.accountName(registro.accountId),
      descripcion: registro.description,
      monto: sinCortes(amountBs(registro.amount)),
      registro,
    }));
  }

  protected readonly transactionsRows = computed(() =>
    map(this.transactions(), (transaccion) => ({
      id: transaccion.id,
      fecha: readableDay(transaccion.date),
      descripcion: transaccion.description,
      debe: this.accountName(transaccion.debitAccountId),
      haber: this.accountName(transaccion.creditAccountId),
      monto: sinCortes(amountBs(transaccion.amount)),
      transaccion,
    })),
  );

  protected readonly accountsRows = computed(() =>
    map(this.accounts(), (cuenta) => ({
      id: cuenta.id,
      codigo: cuenta.code,
      nombre: cuenta.name,
      clase: CLASS_NAME[cuenta.accountClass],
      origen: cuenta.seeded ? 'General' : 'Suya',
      cuenta,
    })),
  );

  /** Cuántos hay de cada cosa, para el rótulo de la pestaña. */
  protected count(estado: ViewState<readonly unknown[]>): string {
    const datos = dataOf(estado);
    return datos === null ? '' : ` (${datos.length})`;
  }

  protected actionsOf(cuenta: SimpleAccount): readonly RowAction[] {
    return cuenta.seeded ? WITHOUT_DELETE : ACTIONS;
  }

  protected readonly actions = ACTIONS;
  protected readonly amount = amountBs;

  constructor() {
    // Cada vez que cambia la práctica elegida, se vuelve a leer todo.
    effect(() => {
      this.practiceId();
      untracked(() => this.loadAll());
    });
  }

  /* ---- lecturas ---------------------------------------------------------- */

  private loadAll(): void {
    const parte = this.parte();
    if (parte !== 'registros') this.loadSummary();
    if (parte === 'numeros') return;
    this.loadAccounts();
    for (const kind of KINDS) this.loadRecords(kind);
    this.loadTransactions();
  }

  protected choosePeriod(periodo: SummaryPeriod): void {
    this.period.set(periodo);
    this.loadSummary();
  }

  protected loadSummary(): void {
    this.summary.set(loading());
    this.accounting
      .summary(this.practiceId(), this.period())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (datos) => this.summary.set(ready(datos)),
        error: (error: unknown) => this.summary.set(errorToViewState<PractitionerSummary>(error)),
      });
  }

  protected loadAccounts(): void {
    this.accounting
      .listAccounts(this.practiceId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cuentas) => this.accounts.set(ready(cuentas)),
        error: (error: unknown) =>
          this.accounts.set(errorToViewState<readonly SimpleAccount[]>(error)),
      });
  }

  protected loadRecords(kind: RecordKind): void {
    this.accounting
      .listRecords(this.practiceId(), kind)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (registros) =>
          this.records.update((todos) => ({ ...todos, [kind]: ready(registros) })),
        error: (error: unknown) =>
          this.records.update((todos) => ({
            ...todos,
            [kind]: errorToViewState<readonly SimpleRecord[]>(error),
          })),
      });
  }

  protected loadTransactions(): void {
    this.accounting
      .listTransactions(this.practiceId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (transacciones) => this.transactions.set(ready(transacciones)),
        error: (error: unknown) =>
          this.transactions.set(errorToViewState<readonly SimpleTransaction[]>(error)),
      });
  }

  /* ---- altas y ediciones ------------------------------------------------- */

  protected newRecord(kind: RecordKind): void {
    this.modal.set({ tipo: 'registro', kind, registro: null });
  }

  protected recordAction(fila: RecordRow, accion: string): void {
    if (accion === 'editar') {
      this.modal.set({ tipo: 'registro', kind: fila.registro.kind, registro: fila.registro });
      return;
    }
    void this.delete(
      `Borrar ${TEXTS[fila.registro.kind].conArticulo}`,
      `«${fila.descripcion}», ${fila.monto}. No se puede deshacer.`,
      () => this.accounting.deleteRecord(fila.id),
      () => this.loadRecords(fila.registro.kind),
    );
  }

  protected transactionAction(fila: TransactionRow, accion: string): void {
    if (accion === 'editar') {
      this.modal.set({ tipo: 'transaccion', transaccion: fila.transaccion });
      return;
    }
    void this.delete(
      'Borrar la transacción',
      `«${fila.descripcion}», ${fila.monto}. No se puede deshacer.`,
      () => this.accounting.deleteTransaction(fila.id),
      () => this.loadTransactions(),
    );
  }

  protected accountAction(fila: AccountRow, accion: string): void {
    if (accion === 'editar') {
      this.modal.set({ tipo: 'cuenta', cuenta: fila.cuenta });
      return;
    }
    void this.delete(
      'Borrar la cuenta',
      `«${fila.nombre}». Sólo se puede si ningún registro la usa.`,
      () => this.accounting.deleteAccount(fila.id),
      () => this.loadAccounts(),
    );
  }

  private async delete(
    titulo: string,
    mensaje: string,
    pedido: () => ReturnType<SimpleAccountingClient['deleteRecord']>,
    despues: () => void,
  ): Promise<void> {
    const confirmado = await this.dialogs.confirm({
      title: titulo,
      message: mensaje,
      confirmLabel: 'Borrar',
      destructive: true,
    });
    if (!confirmado) return;
    pedido()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notices.success('Se borró.', titulo.replace('Borrar', 'Borrado:'));
          despues();
        },
        error: (error: unknown) => this.notices.error(errorReason(error), 'No se pudo borrar'),
      });
  }

  /* ---- al guardar un modal ------------------------------------------------ */

  protected savedRecord(registro: SimpleRecord): void {
    this.notices.success(TEXTS[registro.kind].guardado, 'Guardado');
    this.loadRecords(registro.kind);
  }

  protected savedTransaction(): void {
    this.notices.success('La transacción quedó guardada.', 'Guardado');
    this.loadTransactions();
  }

  protected savedAccount(): void {
    this.notices.success('La cuenta quedó guardada.', 'Guardado');
    this.loadAccounts();
    // Un nombre cambiado se ve también en las tablas que la usan: ya las
    // traduce `nombreDeCuenta` desde la lista de cuentas recién leída.
  }
}

/** Un importe que no se parte en dos renglones en la columna angosta. */
function sinCortes(importe: string): string {
  return importe.replace(/ /gu, '\u00a0');
}

/** Aplica `fn` a los datos de un estado listo; los demás estados pasan igual. */
function map<T, U>(
  estado: ViewState<readonly T[]>,
  fn: (fila: T) => U,
): ViewState<readonly U[]> {
  return estado.status === 'ready'
    ? ready(estado.data.map(fn))
    : (estado as ViewState<readonly U[]>);
}

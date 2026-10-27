import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
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
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../../shared/components/atoms/nav-icon/nav-icon.types';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { Pagination } from '../../../shared/components/molecules/pagination/pagination';
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
import { FilterBar } from '../../../shared/components/organisms/filter-bar/filter-bar';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { amountBs } from '../summary/windows';
import { AccountDialog } from './account-dialog';
import { errorReason } from './errors';
import { RecordDialog } from './record-dialog';
import {
  readableDay,
  EXPLICACION_DE_CUENTAS,
  EXPLICACION_DE_TRANSACCIONES,
  glosarioDe,
  CLASS_NAME,
  accountLabel,
  TEXTS,
} from './records.format';
import type { AccountingVersion } from '../accounting-version';
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

/** Cada tabla de la tarjeta, para su búsqueda y su página. */
type Tabla = RecordKind | 'TX' | 'CUENTAS';
const TAMANO_INICIAL = 10;
const PORTABLAS = <T,>(valor: T): Record<Tabla, T> => ({
  EXPENSE: valor,
  ASSET: valor,
  DEBT: valor,
  TX: valor,
  CUENTAS: valor,
});

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
    FilterBar,
    NavIcon,
    Pagination,
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

  /**
   * Qué versión de la pantalla se lee. En «doctor», los registros son los tres
   * que un médico anota —gastos, activos y deudas—; «contador» suma las
   * transacciones (debe y haber) y el plan de cuentas. Las dos versiones leen y
   * guardan los mismos datos: es qué se ve, no qué se puede. Quién puede
   * escribir lo resuelve la API.
   */
  readonly version = input<AccountingVersion>('doctor');

  /**
   * Avisa que se guardó un gasto, un activo o una deuda. El resumen lo usa
   * para volver a leer sus cifras sin que el médico tenga que recargar.
   */
  readonly anotado = output<void>();

  /**
   * Los atajos de «¿Qué quiere anotar?» bajo las tres cifras: lo que un médico
   * viene a hacer, a un clic y con ícono y texto, sin pasar por la pestaña de
   * tablas. Abren el mismo formulario que el botón «Nuevo …» de cada tabla.
   */
  protected readonly atajos: readonly { kind: RecordKind; rotulo: string; icono: NavIconName }[] = [
    { kind: 'EXPENSE', rotulo: 'Anotar un gasto', icono: 'receipt' },
    { kind: 'ASSET', rotulo: 'Registrar un equipo', icono: 'package' },
    { kind: 'DEBT', rotulo: 'Anotar una deuda', icono: 'billing' },
  ];

  /** El ícono de cada pestaña de registros, junto a su nombre. */
  protected readonly iconoDe: Readonly<Record<RecordKind, NavIconName>> = {
    EXPENSE: 'receipt',
    ASSET: 'package',
    DEBT: 'billing',
  };
  protected readonly isAccountant = computed(() => this.version() === 'contador');

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
  protected readonly glosario = computed(() => glosarioDe(this.isAccountant()));
  protected readonly explicacionDeTransacciones = EXPLICACION_DE_TRANSACCIONES;
  protected readonly explicacionDeCuentas = EXPLICACION_DE_CUENTAS;

  /* ---- búsqueda y página de cada tabla ------------------------------------ */

  protected readonly busqueda = signal<Record<Tabla, string>>(PORTABLAS(''));
  protected readonly pagina = signal<Record<Tabla, number>>(PORTABLAS(1));
  protected readonly tamano = signal<Record<Tabla, number>>(PORTABLAS(TAMANO_INICIAL));

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
      { key: 'debe', header: 'Debe (llega a)', priority: 1 },
      { key: 'haber', header: 'Haber (sale de)', priority: 1 },
      { key: 'monto', header: 'Monto', priority: 1, align: 'end' },
      { key: 'acciones', header: 'Acciones', priority: 1, cell: this.accionesDeTransaccion() },
    ],
  );

  protected readonly accountColumns = computed<readonly ColumnDef<AccountRow>[]>(() => [
    { key: 'codigo', header: 'Código', priority: 2 },
    { key: 'nombre', header: 'Nombre', priority: 1 },
    { key: 'clase', header: 'Tipo', priority: 1 },
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
      origen: cuenta.seeded ? 'Del sistema' : 'Creada por usted',
      cuenta,
    })),
  );

  /* ---- lo filtrado y la página visible de cada tabla ------------------------ */

  private filasFiltradas(tabla: Tabla): readonly { readonly id: string }[] {
    const estado: ViewState<readonly { readonly id: string }[]> =
      tabla === 'TX'
        ? this.transactionsRows()
        : tabla === 'CUENTAS'
          ? this.accountsRows()
          : this.rowsOf(tabla);
    const filas = dataOf(estado) ?? [];
    const buscado = normalizar(this.busqueda()[tabla].trim());
    if (buscado === '') return filas;
    return filas.filter((fila) =>
      Object.values(fila).some((valor) => typeof valor === 'string' && normalizar(valor).includes(buscado)),
    );
  }

  /** La página visible; los estados que no son «listo» pasan igual. */
  private paginaDe<T>(tabla: Tabla, estado: ViewState<readonly T[]>): ViewState<readonly T[]> {
    if (estado.status !== 'ready') return estado;
    const filtradas = this.filasFiltradas(tabla) as readonly T[];
    const inicio = (this.pagina()[tabla] - 1) * this.tamano()[tabla];
    return ready(filtradas.slice(inicio, inicio + this.tamano()[tabla]));
  }

  protected paginaDeRegistros(kind: RecordKind): ViewState<readonly RecordRow[]> {
    return this.paginaDe(kind, this.rowsOf(kind));
  }

  protected readonly paginaDeTransacciones = computed(() =>
    this.paginaDe('TX', this.transactionsRows()),
  );

  protected readonly paginaDeCuentas = computed(() => this.paginaDe('CUENTAS', this.accountsRows()));

  protected totalDe(tabla: Tabla): number {
    return this.filasFiltradas(tabla).length;
  }

  protected buscar(tabla: Tabla, termino: string): void {
    this.busqueda.update((todas) => ({ ...todas, [tabla]: termino }));
    this.pagina.update((todas) => ({ ...todas, [tabla]: 1 }));
  }

  protected irAPagina(tabla: Tabla, numero: number): void {
    this.pagina.update((todas) => ({ ...todas, [tabla]: numero }));
  }

  protected cambiarTamano(tabla: Tabla, tamano: number): void {
    this.tamano.update((todos) => ({ ...todos, [tabla]: tamano }));
    this.pagina.update((todas) => ({ ...todas, [tabla]: 1 }));
  }

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

    // Transacciones y Cuentas sólo existen en la versión Contador. Si se vuelve
    // a Doctor estando en una de ellas, se vuelve a la primera pestaña: dejar
    // el índice apuntando a una pestaña que ya no está deja el panel en blanco.
    effect(() => {
      if (!this.isAccountant() && this.tab() >= KINDS.length) {
        untracked(() => this.tab.set(0));
      }
    });
  }

  /* ---- lecturas ---------------------------------------------------------- */

  private loadAll(): void {
    const parte = this.parte();
    if (parte !== 'registros') this.loadSummary();
    // Las cuentas también en el resumen: los atajos «Anotar un gasto»… abren
    // el formulario, y su lista de tipos sale de estas cuentas.
    this.loadAccounts();
    if (parte === 'numeros') return;
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
    // En el resumen no hay tabla que refrescar: sólo se avisa.
    if (this.parte() !== 'numeros') this.loadRecords(registro.kind);
    this.anotado.emit();
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

/** Para buscar sin tildes ni mayúsculas. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase();
}

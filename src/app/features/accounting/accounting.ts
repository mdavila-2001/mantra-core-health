import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  catchError,
  map,
  of,
  startWith,
  switchMap,
  type Observable,
} from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { AccountingClient } from '../../core/data-access/accounting/accounting.client';
import type {
  BalanceSheet,
  ChartOfAccounts,
  FinancialStatementLine,
  GeneralLedgerEntry,
  IncomeStatement,
  JournalTransaction,
  LedgerAccount,
  PaidConsultation,
  PostJournalInput,
  Practice,
  TrialBalance,
  TrialBalanceRow,
} from '../../core/data-access/accounting/accounting.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../shared/a11y/announce-on-appear';
import type { SelectOption } from '../../shared/components/atoms/select/select.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { Input } from '../../shared/components/atoms/input/input';
import { Select } from '../../shared/components/atoms/select/select';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../shared/components/organisms/status-seal/status-seal';
import { errorMessageOf } from '../../shared/forms/form-support';

/**
 * Agrupa las consultas cobradas por mes de emisión, la más reciente arriba.
 *
 * ## Los importes se suman **para mostrar**, nunca para mandar
 *
 * `paidTotal` es decimal como texto por contrato, y la cabecera de
 * `accounting.types.ts` es explícita: sumar decimales en el navegador da
 * descuadres de un céntimo indistinguibles de un error contable real. Acá el
 * total es un resumen que se lee, no un asiento: lo que viaja al servidor sigue
 * siendo el texto de cada factura, sin tocar.
 */
export function agruparPorMes(
  consultas: readonly PaidConsultation[],
): readonly MesFacturado[] {
  const porClave = new Map<string, { etiqueta: string; total: number; cuantas: number }>();

  for (const consulta of consultas) {
    const mes = String(consulta.issueDate.getMonth() + 1).padStart(2, '0');
    const clave = `${consulta.issueDate.getFullYear()}-${mes}`;
    const previo = porClave.get(clave) ?? {
      etiqueta: consulta.issueDate.toLocaleDateString('es', { month: 'long', year: 'numeric' }),
      total: 0,
      cuantas: 0,
    };
    previo.total += Number(consulta.paidTotal);
    previo.cuantas += 1;
    porClave.set(clave, previo);
  }

  return [...porClave.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([clave, mes]) => ({
      clave,
      etiqueta: mes.etiqueta,
      total: mes.total.toFixed(2),
      cuantas: mes.cuantas,
      promedio: (mes.total / mes.cuantas).toFixed(2),
    }));
}

/**
 * Formatea una fecha para una celda de tabla: corta, sin día de semana ni
 * huso horario.
 *
 * `app-data-table` no formatea: una columna sin `cell` pinta
 * `String(valor)` (`data-table.ts: cellValue`), y `String(unaFecha)` es
 * `Date.prototype.toString()` — `"Thu Mar 12 2026 00:00:00 GMT-0400 (hora de
 * Bolivia)"`. A 390 px ese texto no entra en la celda y se parte en varias
 * líneas, y ni ahí es legible como fecha contable. Se formatea acá, antes de
 * llegar a la tabla, a `dd/mm/aaaa`.
 */
function formatearFechaDeTabla(fecha: Date): string {
  return fecha.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Un asiento del diario, ya listo para la tabla: fechas como texto corto en
 * vez de `Date` cruda (ver `formatearFechaDeTabla`).
 */
export interface FilaDelDiario extends Omit<JournalTransaction, 'transactionDate' | 'postedAt'> {
  readonly transactionDate: string;
  readonly postedAt?: string;
}

/** Un movimiento del libro mayor, ya listo para la tabla: misma razón que `FilaDelDiario`. */
export interface FilaDelMayor extends Omit<GeneralLedgerEntry, 'transactionDate'> {
  readonly transactionDate: string;
}

/** Un mes de facturación, ya resuelto para pintar. */
export interface MesFacturado {
  readonly clave: string;
  readonly etiqueta: string;
  /** Decimal como texto, con dos posiciones. */
  readonly total: string;
  readonly cuantas: number;
  /** Cuánto salió en promedio cada consulta, decimal como texto. */
  readonly promedio: string;
}

/**
 * Los libros contables de una práctica: balance de sumas y saldos y libro
 * diario.
 *
 * ## Qué se enseña primero, y por qué
 *
 * El **balance cuadra o no cuadra**. Es la comprobación de la que depende que
 * el resto del informe signifique algo, así que va arriba y como sello —color,
 * forma y texto—, no como un número más entre otros. Un balance descuadrado no
 * es un detalle: invalida todo lo que hay debajo.
 *
 * Lo declara la API en `balanced`; la pantalla **no suma dos columnas** para
 * averiguarlo. Sumar importes decimales en el navegador daría descuadres de un
 * céntimo indistinguibles de un error contable real.
 *
 * ## `truncated` se dice, no se calla
 *
 * Si la agregación alcanzó su tope, el balance está incompleto. Un balance
 * recortado en silencio es un balance que miente, así que sale un aviso.
 *
 * ## Todo cuelga de la práctica elegida
 *
 * Ninguna lectura del mayor responde sin `practiceId`, y una organización puede
 * tener varias prácticas. Por eso lo primero que se pide es el listado, y hasta
 * que hay una elegida no se pide ningún libro.
 */
@Component({
  selector: 'app-accounting',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AnnounceOnAppear,
    Alert,
    AppButton,
    Badge,
    Card,
    DataTable,
    FormField,
    Input,
    PageHeader,
    ReactiveFormsModule,
    Select,
    StatusSeal,
    Tab,
    Tabs,
  ],
  templateUrl: './accounting.html',
  styleUrl: './accounting.css',
})
export class Accounting {
  private readonly libros = inject(AccountingClient);
  private readonly auth = inject(AuthService);

  /* ---- Quién está mirando (H4 del plan de UX del 22/08/2026) --------------- */

  /**
   * Si quien mira es un médico y no quien lleva los libros.
   *
   * El cliente dijo del módulo contable que «está pésimo», y mirando la
   * pantalla se entiende: al `PRACTITIONER` se le servía **la vista del
   * contador** —balance de sumas y saldos, libro diario, y una nota sobre que
   * «los saldos llevan el signo de la naturaleza de la cuenta»—. Nada de eso
   * está mal; simplemente no es lo que un médico viene a preguntar. Él viene a
   * preguntar cuánto cobró.
   *
   * Se decide por rol y no por una preferencia: quien además administra la
   * contabilidad de la organización tiene ese rol y ve los libros primero.
   */
  protected readonly esMedico = computed(() => {
    const roles = this.auth.roles();
    if (roles.includes('SECURITY_ADMIN') || roles.includes('ACCOUNTING_APPROVER')) {
      return false;
    }
    return roles.includes('PRACTITIONER');
  });

  /** Los libros, para quien no los ve por omisión, se piden. */
  protected readonly librosAbiertos = signal(false);

  /** Si se dibujan el balance y el libro diario. */
  protected readonly muestraLibros = computed(() => !this.esMedico() || this.librosAbiertos());

  /** Las prácticas de la organización. Sin esto no hay `practiceId` que pedir. */
  private readonly practicas = toSignal(
    this.libros.listPractices().pipe(catchError(() => of<readonly Practice[]>([]))),
    { initialValue: undefined },
  );

  protected readonly opcionesDePractica = computed<readonly SelectOption<string>[]>(
    () => (this.practicas() ?? []).map((p) => ({ value: p.id, label: p.name })),
  );

  /**
   * La práctica elegida. `linkedSignal` y no `signal`: cuando llega el listado
   * hay que preseleccionar la primera —lo normal es que haya una sola— sin
   * pisar la elección de quien ya tocó el selector.
   */
  protected readonly practicaElegida = linkedSignal<
    readonly Practice[] | undefined,
    string | null
  >({
    source: this.practicas,
    computation: (lista, previo) => previo?.value ?? lista?.[0]?.id ?? null,
  });

  /** Reintento manual: cambiarlo vuelve a disparar las dos lecturas. */
  private readonly intento = signal(0);

  private readonly practicaYIntento = computed(() => ({
    practiceId: this.practicaElegida(),
    intento: this.intento(),
  }));

  protected readonly balance = toSignal(
    toObservable(this.practicaYIntento).pipe(
      switchMap(({ practiceId }): Observable<ViewState<TrialBalance>> => {
        if (practiceId === null) {
          return of(
            empty(
              { label: 'Elegir una práctica' },
              'Elegí una práctica para ver sus libros.',
            ),
          );
        }
        return this.libros.trialBalance(practiceId).pipe(
          map((datos): ViewState<TrialBalance> => ready(datos)),
          startWith(loading()),
          catchError((error: unknown) =>
            of(errorToViewState<TrialBalance>(error)),
          ),
        );
      }),
    ),
    { initialValue: loading() as ViewState<TrialBalance> },
  );

  protected readonly diario = toSignal(
    toObservable(this.practicaYIntento).pipe(
      switchMap(
        ({
          practiceId,
        }): Observable<ViewState<readonly JournalTransaction[]>> => {
        if (practiceId === null) {
          return of(empty({ label: 'Elegir una práctica' }));
        }
        return this.libros.listJournal(practiceId).pipe(
          map((pagina): ViewState<readonly JournalTransaction[]> =>
            pagina.items.length === 0
              ? empty(
                  { label: 'Registrar un asiento' },
                  'Esta práctica todavía no tiene asientos.',
                )
              : ready(pagina.items),
          ),
          startWith(loading()),
          catchError((error: unknown) =>
            of(errorToViewState<readonly JournalTransaction[]>(error)),
          ),
        );
        },
      ),
    ),
    { initialValue: loading() as ViewState<readonly JournalTransaction[]> },
  );

  /** Las filas del balance, ya listas para la tabla. */
  protected readonly filasDelBalance = computed<ViewState<readonly TrialBalanceRow[]>>(
    () => {
      const estado = this.balance();
      return estado.status === 'ready'
        ? ready(estado.data.items)
        : (estado as ViewState<readonly TrialBalanceRow[]>);
    },
  );

  /**
   * Las filas del diario, con las fechas ya formateadas para la tabla (ver
   * `formatearFechaDeTabla`). `postedAt` es opcional: un asiento sin postear
   * no tiene fecha de posteo, y forzar `Date` ahí rompería el `?` del tipo.
   */
  protected readonly filasDelDiario = computed<ViewState<readonly FilaDelDiario[]>>(() => {
    const estado = this.diario();
    return estado.status === 'ready'
      ? ready(
          estado.data.map((t): FilaDelDiario => {
            const { postedAt, ...resto } = t;
            return {
              ...resto,
              transactionDate: formatearFechaDeTabla(t.transactionDate),
              ...(postedAt === undefined ? {} : { postedAt: formatearFechaDeTabla(postedAt) }),
            };
          }),
        )
      : (estado as ViewState<readonly FilaDelDiario[]>);
  });

  /** El sello del cuadre: color, forma y texto, no sólo color. */
  protected readonly selloDelCuadre = computed(() => {
    const estado = this.balance();
    if (estado.status !== 'ready') return null;
    return estado.data.balanced
      ? { variant: 'approved' as const, label: 'El balance cuadra' }
      : { variant: 'rejected' as const, label: 'El balance NO cuadra' };
  });

  protected readonly resumen = computed(() => {
    const estado = this.balance();
    return estado.status === 'ready' ? estado.data : null;
  });

  protected readonly columnasDelBalance: readonly ColumnDef<TrialBalanceRow>[] = [
    { key: 'code', header: 'Código', priority: 1 },
    { key: 'name', header: 'Cuenta', priority: 1 },
    { key: 'debit', header: 'Debe', priority: 2, align: 'end' },
    { key: 'credit', header: 'Haber', priority: 2, align: 'end' },
    { key: 'balance', header: 'Saldo', priority: 1, align: 'end' },
  ];

  protected readonly columnasDelDiario: readonly ColumnDef<FilaDelDiario>[] = [
    { key: 'transactionNumber', header: 'Número', priority: 1 },
    { key: 'transactionDate', header: 'Fecha', priority: 1 },
    { key: 'totalAmount', header: 'Importe', priority: 1, align: 'end' },
    { key: 'postedAt', header: 'Posteado', priority: 3 },
  ];

  protected readonly claveDeFila = (fila: TrialBalanceRow): string => fila.accountId;
  protected readonly claveDeAsiento = (fila: FilaDelDiario): string => fila.id;

  protected reintentar(): void {
    this.intento.update((n) => n + 1);
  }

  /* ============================================================================
      Carril 18 — auto-servicio contable del doctor: el plan de cuentas (para
      elegir cuentas en los formularios), las consultas pagadas sin asiento
      todavía, y los dos formularios de registro (ingreso de consulta / gasto).
      ========================================================================== */

  protected readonly cuentas = toSignal(
    toObservable(this.practicaYIntento).pipe(
      switchMap(({ practiceId }): Observable<readonly LedgerAccount[]> => {
        if (practiceId === null) return of([]);
        return this.libros
          .chartOfAccounts(practiceId)
          .pipe(map((pagina: ChartOfAccounts) => pagina.items));
      }),
    ),
    { initialValue: [] as readonly LedgerAccount[] },
  );

  protected readonly opcionesDeCuenta = computed<readonly SelectOption<string>[]>(() =>
    this.cuentas().map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
  );

  protected readonly consultasPagadas = toSignal(
    toObservable(this.practicaYIntento).pipe(
      switchMap(({ practiceId }): Observable<readonly PaidConsultation[]> => {
        if (practiceId === null) return of([]);
        return this.libros.listPaidConsultations(practiceId).pipe(catchError(() => of([])));
      }),
    ),
    { initialValue: [] as readonly PaidConsultation[] },
  );

  protected readonly opcionesDeConsulta = computed<readonly SelectOption<string>[]>(() =>
    this.consultasPagadas().map((c) => ({
      value: c.invoiceId,
      label: `Factura ${c.invoiceNumber} — ${c.paidTotal}`,
    })),
  );

  /* ---- «Mi facturación» (H4) ---------------------------------------------- */

  /**
   * Lo cobrado y todavía sin registrar, mes por mes.
   *
   * ## Por qué es **esto** y no «cuánto facturaste este mes» a secas
   *
   * Porque es lo único que la API sabe decir por profesional.
   * `GET /accounting/practitioner/paid-consultations` devuelve las facturas
   * pagadas **sin asiento contable todavía**, y el libro diario es de la
   * práctica entera —no distingue quién atendió—. Un total de «facturado este
   * mes» sacado de acá bajaría solo a medida que el médico registra sus
   * asientos, que es exactamente la clase de número que hace desconfiar de una
   * pantalla de plata.
   *
   * Así que el rótulo dice lo que el dato es, y encima resulta ser el número
   * accionable: son las consultas que cobró y que le faltan pasar a los libros.
   */
  protected readonly porMes = computed(() => agruparPorMes(this.consultasPagadas()));

  /** El total pendiente de registrar, sumando todos los meses. */
  protected readonly totalPendiente = computed(() =>
    this.consultasPagadas()
      .reduce((suma, consulta) => suma + Number(consulta.paidTotal), 0)
      .toFixed(2),
  );

  /* ---- Registrar ingreso de consulta pagada -------------------------------- */

  protected readonly formularioDeIngreso = new FormGroup({
    invoiceId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    debitAccountId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    creditAccountId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected readonly estadoDeIngreso = signal<ViewState<null>>(ready(null));
  protected readonly enviandoIngreso = computed(
    () => this.estadoDeIngreso().status === 'loading',
  );
  protected readonly errorDeIngreso = computed(() =>
    errorMessageOf(this.estadoDeIngreso(), 'No tenés permiso para registrar este ingreso.'),
  );
  protected readonly ingresoRegistrado = signal(false);

  protected registrarIngreso(): void {
    const practiceId = this.practicaElegida();
    if (practiceId === null || this.enviandoIngreso()) return;
    if (this.formularioDeIngreso.invalid) {
      this.formularioDeIngreso.markAllAsTouched();
      return;
    }
    const { invoiceId, debitAccountId, creditAccountId } =
      this.formularioDeIngreso.getRawValue();

    this.estadoDeIngreso.set(loading());
    this.ingresoRegistrado.set(false);
    this.libros
      .registerConsultationIncome({
        practiceId,
        invoiceId,
        debitAccountId,
        creditAccountId,
        // Hoy, no ayer: el doctor registra el ingreso en el momento en que lo
        // hace, no elige una fecha contable distinta desde este formulario simple.
        transactionDate: new Date().toISOString().slice(0, 10),
      })
      .subscribe({
        next: () => {
          this.estadoDeIngreso.set(ready(null));
          this.ingresoRegistrado.set(true);
          this.formularioDeIngreso.reset({
            invoiceId: '',
            debitAccountId: '',
            creditAccountId: '',
          });
          this.reintentar();
        },
        error: (error: unknown) => this.estadoDeIngreso.set(errorToViewState<null>(error)),
      });
  }

  /* ---- Registrar gasto ------------------------------------------------------ */

  protected readonly formularioDeGasto = new FormGroup({
    debitAccountId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    creditAccountId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    amount: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(500)],
    }),
  });

  protected readonly estadoDeGasto = signal<ViewState<null>>(ready(null));
  protected readonly enviandoGasto = computed(() => this.estadoDeGasto().status === 'loading');
  protected readonly errorDeGasto = computed(() =>
    errorMessageOf(this.estadoDeGasto(), 'No tenés permiso para registrar este gasto.'),
  );
  protected readonly gastoRegistrado = signal(false);

  protected registrarGasto(): void {
    const practiceId = this.practicaElegida();
    if (practiceId === null || this.enviandoGasto()) return;
    if (this.formularioDeGasto.invalid) {
      this.formularioDeGasto.markAllAsTouched();
      return;
    }
    const { debitAccountId, creditAccountId, amount, description } =
      this.formularioDeGasto.getRawValue();

    this.estadoDeGasto.set(loading());
    this.gastoRegistrado.set(false);
    this.libros
      .registerSimpleEntry({
        practiceId,
        kind: 'EXPENSE',
        debitAccountId,
        creditAccountId,
        amount,
        description,
        transactionDate: new Date().toISOString().slice(0, 10),
      })
      .subscribe({
        next: () => {
          this.estadoDeGasto.set(ready(null));
          this.gastoRegistrado.set(true);
          this.formularioDeGasto.reset({
            debitAccountId: '',
            creditAccountId: '',
            amount: '',
            description: '',
          });
          this.reintentar();
        },
        error: (error: unknown) => this.estadoDeGasto.set(errorToViewState<null>(error)),
      });
  }

  /* ============================================================================
      TAREA-20 S3 — libro mayor, estado de resultados y balance general.

      Tres pestañas nuevas. El panel inactivo no pide nada: cada lectura
      cuelga de `pestanaActiva`, y sólo la pestaña que se está mirando dispara
      su `switchMap` — evitar pedir los tres informes de golpe es justamente
      lo que el plan pide (§5.7 de la ficha).
      ========================================================================== */

  /** Índice de la pestaña activa entre los tres informes nuevos. */
  protected readonly pestanaActiva = signal(0);

  protected readonly opcionesDeCuentaParaMayor = this.opcionesDeCuenta;

  /** La cuenta elegida para el libro mayor. Sin ella no hay qué pedir. */
  protected readonly cuentaDelMayor = linkedSignal<
    readonly SelectOption<string>[],
    string | null
  >({
    source: this.opcionesDeCuentaParaMayor,
    computation: (opciones, previo) =>
      opciones.some((o) => o.value === previo?.value)
        ? (previo?.value ?? null)
        : (opciones[0]?.value ?? null),
  });

  private readonly parametrosDelMayor = computed(() => ({
    practiceId: this.practicaElegida(),
    accountId: this.cuentaDelMayor(),
    pestana: this.pestanaActiva(),
    intento: this.intento(),
  }));

  protected readonly libroMayor = toSignal(
    toObservable(this.parametrosDelMayor).pipe(
      switchMap(
        ({ practiceId, accountId, pestana }): Observable<ViewState<GeneralLedgerEntry[]>> => {
          // Sólo se pide cuando la pestaña del libro mayor está activa.
          if (pestana !== 0 || practiceId === null || accountId === null) {
            return of(empty({ label: 'Elegir una cuenta' }));
          }
          return this.libros.generalLedger(practiceId, { accountId }).pipe(
            map((pagina): ViewState<GeneralLedgerEntry[]> =>
              pagina.items.length === 0
                ? empty({ label: 'Sin movimientos' }, 'Esta cuenta no tiene movimientos posteados.')
                : ready([...pagina.items]),
            ),
            startWith(loading()),
            catchError((error: unknown) => of(errorToViewState<GeneralLedgerEntry[]>(error))),
          );
        },
      ),
    ),
    { initialValue: loading() as ViewState<GeneralLedgerEntry[]> },
  );

  /** El libro mayor, con la fecha ya formateada para la tabla (ver `formatearFechaDeTabla`). */
  protected readonly filasDelMayor = computed<ViewState<readonly FilaDelMayor[]>>(() => {
    const estado = this.libroMayor();
    return estado.status === 'ready'
      ? ready(
          estado.data.map(
            (m): FilaDelMayor => ({ ...m, transactionDate: formatearFechaDeTabla(m.transactionDate) }),
          ),
        )
      : (estado as ViewState<readonly FilaDelMayor[]>);
  });

  protected readonly columnasDelMayor: readonly ColumnDef<FilaDelMayor>[] = [
    { key: 'transactionDate', header: 'Fecha', priority: 1 },
    { key: 'transactionNumber', header: 'Asiento', priority: 2 },
    { key: 'debit', header: 'Debe', priority: 1, align: 'end' },
    { key: 'credit', header: 'Haber', priority: 1, align: 'end' },
    { key: 'runningBalance', header: 'Saldo', priority: 1, align: 'end' },
  ];

  protected readonly claveDeMovimiento = (fila: FilaDelMayor): string => fila.id;

  private readonly practicaEIntentoYPestana = computed(() => ({
    practiceId: this.practicaElegida(),
    pestana: this.pestanaActiva(),
    intento: this.intento(),
  }));

  protected readonly estadoDeResultados = toSignal(
    toObservable(this.practicaEIntentoYPestana).pipe(
      switchMap(({ practiceId, pestana }): Observable<ViewState<IncomeStatement>> => {
        if (pestana !== 1 || practiceId === null) {
          return of(empty({ label: 'Elegir una práctica' }));
        }
        return this.libros.incomeStatement(practiceId).pipe(
          map((datos): ViewState<IncomeStatement> => ready(datos)),
          startWith(loading()),
          catchError((error: unknown) => of(errorToViewState<IncomeStatement>(error))),
        );
      }),
    ),
    { initialValue: loading() as ViewState<IncomeStatement> },
  );

  protected readonly filasDelEstadoDeResultados = computed<ViewState<readonly FinancialStatementLine[]>>(
    () => {
      const estado = this.estadoDeResultados();
      return estado.status === 'ready'
        ? ready([...estado.data.revenueItems, ...estado.data.expenseItems])
        : (estado as ViewState<readonly FinancialStatementLine[]>);
    },
  );

  protected readonly columnasDelEstadoFinanciero: readonly ColumnDef<FinancialStatementLine>[] = [
    { key: 'code', header: 'Código', priority: 1 },
    { key: 'name', header: 'Cuenta', priority: 1 },
    { key: 'amount', header: 'Importe', priority: 1, align: 'end' },
  ];

  protected readonly claveDeLineaFinanciera = (fila: FinancialStatementLine): string => fila.accountId;

  protected readonly balanceGeneral = toSignal(
    toObservable(this.practicaEIntentoYPestana).pipe(
      switchMap(({ practiceId, pestana }): Observable<ViewState<BalanceSheet>> => {
        if (pestana !== 2 || practiceId === null) {
          return of(empty({ label: 'Elegir una práctica' }));
        }
        return this.libros.balanceSheet(practiceId).pipe(
          map((datos): ViewState<BalanceSheet> => ready(datos)),
          startWith(loading()),
          catchError((error: unknown) => of(errorToViewState<BalanceSheet>(error))),
        );
      }),
    ),
    { initialValue: loading() as ViewState<BalanceSheet> },
  );

  protected readonly filasDelBalanceGeneral = computed<ViewState<readonly FinancialStatementLine[]>>(
    () => {
      const estado = this.balanceGeneral();
      return estado.status === 'ready'
        ? ready([...estado.data.assetItems, ...estado.data.liabilityItems, ...estado.data.equityItems])
        : (estado as ViewState<readonly FinancialStatementLine[]>);
    },
  );

  /** El sello del balance general: activo == pasivo + patrimonio, o no. */
  protected readonly selloDelBalanceGeneral = computed(() => {
    const estado = this.balanceGeneral();
    if (estado.status !== 'ready') return null;
    return estado.data.balanced
      ? { variant: 'approved' as const, label: 'Activo = Pasivo + Patrimonio' }
      : { variant: 'rejected' as const, label: 'El balance general NO cuadra' };
  });

  /* ============================================================================
      TAREA-20 S2 — MODO CONTADOR: asiento de N filas.

      «Ocultas» (punto 4 del pedido) es densidad visual, no autorización: el
      plegable sólo evita mostrar el formulario por omisión. El límite real lo
      pone el servidor — `POST .../drafts` sólo acepta SECURITY_ADMIN y
      PRACTITIONER, y `POST /journal-transactions` (postear directo) sólo
      SECURITY_ADMIN — así que un PRACTITIONER que abra el plegable igual no
      puede postear directo: el botón se deshabilita para ese rol, y si de
      todos modos se fuerza la llamada, el 403 del servidor es quien manda.
      ========================================================================== */

  protected readonly puedeUsarModoContador = computed(() => {
    const roles = this.auth.roles();
    return roles.includes('SECURITY_ADMIN') || roles.includes('PRACTITIONER');
  });

  protected readonly puedePostearDirecto = computed(() => this.auth.roles().includes('SECURITY_ADMIN'));

  protected readonly modoContadorAbierto = signal(false);

  protected alternarModoContador(): void {
    this.modoContadorAbierto.update((abierto) => !abierto);
  }

  protected readonly cabeceraDelAsiento = new FormGroup({
    transactionDate: new FormControl(new Date().toISOString().slice(0, 10), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  /** La fila que se está agregando o modificando; no forma parte todavía del asiento. */
  protected readonly filaEnCurso = new FormGroup({
    accountId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    direction: new FormControl<'DEBIT' | 'CREDIT'>('DEBIT', { nonNullable: true }),
    amount: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)],
    }),
    memo: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  protected readonly opcionesDeDireccion: readonly SelectOption<'DEBIT' | 'CREDIT'>[] = [
    { value: 'DEBIT', label: 'Debe' },
    { value: 'CREDIT', label: 'Haber' },
  ];

  /** Índice de la fila del asiento que `filaEnCurso` está modificando; `null` si es alta nueva. */
  protected readonly filaEnEdicion = signal<number | null>(null);

  /** Las filas ya agregadas al asiento en curso. */
  protected readonly filasDelAsiento = signal<
    readonly {
      readonly accountId: string;
      readonly accountLabel: string;
      readonly direction: 'DEBIT' | 'CREDIT';
      readonly amount: string;
      readonly memo: string;
    }[]
  >([]);

  /**
   * El descuadre en vivo, calculado en el cliente **sólo para mostrar**: el
   * rechazo autoritativo sigue siendo el `422` del servidor (AC-20-8). Suma
   * en `number` a propósito, igual que `agruparPorMes` — es un resumen que se
   * lee, no el importe que viaja al servidor (que sigue siendo el texto de
   * cada fila, sin tocar).
   */
  protected readonly descuadreEnVivo = computed(() => {
    const filas = this.filasDelAsiento();
    const debe = filas.filter((f) => f.direction === 'DEBIT').reduce((s, f) => s + Number(f.amount), 0);
    const haber = filas.filter((f) => f.direction === 'CREDIT').reduce((s, f) => s + Number(f.amount), 0);
    return { debe: debe.toFixed(2), haber: haber.toFixed(2), diferencia: (debe - haber).toFixed(2) };
  });

  protected readonly asientoBalanceado = computed(() => this.descuadreEnVivo().diferencia === '0.00');

  protected agregarOModificarFila(): void {
    if (this.filaEnCurso.invalid) {
      this.filaEnCurso.markAllAsTouched();
      return;
    }
    const { accountId, direction, amount, memo } = this.filaEnCurso.getRawValue();
    const opcion = this.opcionesDeCuenta().find((o) => o.value === accountId);
    const fila = { accountId, accountLabel: opcion?.label ?? accountId, direction, amount, memo };

    const indice = this.filaEnEdicion();
    this.filasDelAsiento.update((filas) =>
      indice === null ? [...filas, fila] : filas.map((f, i) => (i === indice ? fila : f)),
    );
    this.filaEnEdicion.set(null);
    this.filaEnCurso.reset({ accountId: '', direction: 'DEBIT', amount: '', memo: '' });
  }

  /** Trae los valores de una fila ya agregada de vuelta al formulario, para modificarla. */
  protected editarFila(indice: number): void {
    const fila = this.filasDelAsiento()[indice];
    if (fila === undefined) return;
    this.filaEnEdicion.set(indice);
    this.filaEnCurso.setValue({
      accountId: fila.accountId,
      direction: fila.direction,
      amount: fila.amount,
      memo: fila.memo,
    });
  }

  protected cancelarEdicionDeFila(): void {
    this.filaEnEdicion.set(null);
    this.filaEnCurso.reset({ accountId: '', direction: 'DEBIT', amount: '', memo: '' });
  }

  protected eliminarFila(indice: number): void {
    this.filasDelAsiento.update((filas) => filas.filter((_, i) => i !== indice));
    if (this.filaEnEdicion() === indice) {
      this.cancelarEdicionDeFila();
    }
  }

  protected readonly estadoDelAsiento = signal<ViewState<null>>(ready(null));
  protected readonly enviandoAsiento = computed(() => this.estadoDelAsiento().status === 'loading');
  protected readonly errorDelAsiento = computed(() =>
    errorMessageOf(this.estadoDelAsiento(), 'No se pudo guardar el asiento.'),
  );
  protected readonly asientoGuardado = signal<'draft' | 'posted' | null>(null);

  private cuerpoDelAsiento(): PostJournalInput | null {
    const practiceId = this.practicaElegida();
    const filas = this.filasDelAsiento();
    if (practiceId === null || filas.length < 2) return null;
    const { transactionDate, description } = this.cabeceraDelAsiento.getRawValue();
    return {
      practiceId,
      transactionDate,
      ...(description ? { description } : {}),
      lines: filas.map((f) => ({
        accountId: f.accountId,
        direction: f.direction,
        amount: f.amount,
        ...(f.memo ? { memo: f.memo } : {}),
      })),
    };
  }

  /** Guarda en DRAFT (sin postear). Disponible para SECURITY_ADMIN y PRACTITIONER. */
  protected guardarBorrador(): void {
    if (this.enviandoAsiento()) return;
    const cuerpo = this.cuerpoDelAsiento();
    if (cuerpo === null) return;

    this.estadoDelAsiento.set(loading());
    this.asientoGuardado.set(null);
    this.libros.createJournalDraft(cuerpo).subscribe({
      next: () => {
        this.estadoDelAsiento.set(ready(null));
        this.asientoGuardado.set('draft');
        this.reiniciarFormularioDelAsiento();
        this.reintentar();
      },
      error: (error: unknown) => this.estadoDelAsiento.set(errorToViewState<null>(error)),
    });
  }

  /** Registra y postea en un solo paso. Sólo SECURITY_ADMIN (el botón se deshabilita para el resto). */
  protected postearDirecto(): void {
    if (this.enviandoAsiento() || !this.puedePostearDirecto()) return;
    const cuerpo = this.cuerpoDelAsiento();
    if (cuerpo === null) return;

    this.estadoDelAsiento.set(loading());
    this.asientoGuardado.set(null);
    this.libros.postJournal(cuerpo).subscribe({
      next: () => {
        this.estadoDelAsiento.set(ready(null));
        this.asientoGuardado.set('posted');
        this.reiniciarFormularioDelAsiento();
        this.reintentar();
      },
      error: (error: unknown) => this.estadoDelAsiento.set(errorToViewState<null>(error)),
    });
  }

  private reiniciarFormularioDelAsiento(): void {
    this.filasDelAsiento.set([]);
    this.filaEnEdicion.set(null);
    this.filaEnCurso.reset({ accountId: '', direction: 'DEBIT', amount: '', memo: '' });
    this.cabeceraDelAsiento.reset({
      transactionDate: new Date().toISOString().slice(0, 10),
      description: '',
    });
  }
}

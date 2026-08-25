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
  ChartOfAccounts,
  JournalTransaction,
  LedgerAccount,
  PaidConsultation,
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
import { Input } from '../../shared/components/atoms/input/input';
import { Select } from '../../shared/components/atoms/select/select';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
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
    Card,
    DataTable,
    FormField,
    Input,
    PageHeader,
    ReactiveFormsModule,
    Select,
    StatusSeal,
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

  protected readonly columnasDelDiario: readonly ColumnDef<JournalTransaction>[] = [
    { key: 'transactionNumber', header: 'Número', priority: 1 },
    { key: 'transactionDate', header: 'Fecha', priority: 1 },
    { key: 'totalAmount', header: 'Importe', priority: 1, align: 'end' },
    { key: 'postedAt', header: 'Posteado', priority: 3 },
  ];

  protected readonly claveDeFila = (fila: TrialBalanceRow): string => fila.accountId;
  protected readonly claveDeAsiento = (fila: JournalTransaction): string => fila.id;

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
}

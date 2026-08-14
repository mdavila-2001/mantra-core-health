import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  map,
  of,
  startWith,
  switchMap,
  type Observable,
} from 'rxjs';

import { AccountingClient } from '../../core/data-access/accounting/accounting.client';
import type {
  JournalTransaction,
  Practice,
  TrialBalance,
  TrialBalanceRow,
} from '../../core/data-access/accounting/accounting.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../shared/a11y/announce-on-appear';
import type { SelectOption } from '../../shared/components/atoms/select/select.types';
import { Select } from '../../shared/components/atoms/select/select';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { DataTable } from '../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../shared/components/organisms/status-seal/status-seal';

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
    Card,
    DataTable,
    FormField,
    PageHeader,
    Select,
    StatusSeal,
  ],
  templateUrl: './accounting.html',
  styleUrl: './accounting.css',
})
export class Accounting {
  private readonly libros = inject(AccountingClient);

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
}

import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, map, of, startWith, switchMap, type Observable } from 'rxjs';

import { AccountingClient } from '../../core/data-access/accounting/accounting.client';
import type { ChartOfAccounts, LedgerAccount, Practice } from '../../core/data-access/accounting/accounting.types';
import { AssetsLiabilitiesClient } from '../../core/data-access/assets-liabilities/assets-liabilities.client';
import type {
  AssetSummary,
  LiabilitySummary,
} from '../../core/data-access/assets-liabilities/assets-liabilities.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../shared/a11y/announce-on-appear';
import type { SelectOption } from '../../shared/components/atoms/select/select.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Input } from '../../shared/components/atoms/input/input';
import { Select } from '../../shared/components/atoms/select/select';
import { Switch } from '../../shared/components/atoms/switch/switch';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { errorMessageOf } from '../../shared/forms/form-support';

/**
 * FT-26 — módulo de activos y pasivos del doctor.
 *
 * ## Qué reutiliza, y por qué
 *
 * La práctica y el plan de cuentas salen de `AccountingClient` —el mismo
 * selector que ya usa "Contabilidad"— en vez de pedirlos de nuevo: son datos
 * de la misma práctica, y una segunda copia de "elegí una práctica" en el
 * menú de al lado sería la misma pregunta dos veces. Lo nuevo es
 * `AssetsLiabilitiesClient` (FT-26), que cuelga del mismo `PRACTITIONER`
 * autenticado que ya usa el resto del auto-servicio contable (Carril 18).
 *
 * ## "Automatización" y "registrar avance"
 *
 * El interruptor (`automated`) declara si un proceso programado **podría**
 * avanzarlo solo — ese proceso todavía no existe (ver el patch
 * `2026-09-05_t26_...`, sección "qué no trae"), así que hoy el interruptor
 * sólo guarda la preferencia. "Registrar avance" funciona igual con el
 * interruptor prendido o apagado: es la acción manual que el pedido exige
 * "en ambos casos".
 */
@Component({
  selector: 'app-assets-liabilities',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AnnounceOnAppear,
    Alert,
    AppButton,
    Card,
    FormField,
    Input,
    PageHeader,
    ReactiveFormsModule,
    Select,
    Switch,
    Tab,
    Tabs,
  ],
  templateUrl: './assets-liabilities.html',
  styleUrl: './assets-liabilities.css',
})
export class AssetsLiabilities {
  private readonly accounting = inject(AccountingClient);
  private readonly client = inject(AssetsLiabilitiesClient);

  protected readonly pestanaActiva = signal(0);

  /** Reintento manual: cambiarlo vuelve a pedir todo lo que cuelga de la práctica. */
  private readonly intento = signal(0);

  private readonly practicas = toSignal(
    this.accounting.listPractices().pipe(catchError(() => of<readonly Practice[]>([]))),
    { initialValue: undefined },
  );

  protected readonly opcionesDePractica = computed<readonly SelectOption<string>[]>(() =>
    (this.practicas() ?? []).map((p) => ({ value: p.id, label: p.name })),
  );

  protected readonly practicaElegida = linkedSignal<readonly Practice[] | undefined, string | null>({
    source: this.practicas,
    computation: (lista, previo) => previo?.value ?? lista?.[0]?.id ?? null,
  });

  private readonly practicaYIntento = computed(() => ({
    practiceId: this.practicaElegida(),
    intento: this.intento(),
  }));

  protected readonly cuentas = toSignal(
    toObservable(this.practicaYIntento).pipe(
      switchMap(({ practiceId }): Observable<readonly LedgerAccount[]> => {
        if (practiceId === null) return of([]);
        return this.accounting
          .chartOfAccounts(practiceId)
          .pipe(map((pagina: ChartOfAccounts) => pagina.items));
      }),
    ),
    { initialValue: [] as readonly LedgerAccount[] },
  );

  protected readonly opcionesDeCuenta = computed<readonly SelectOption<string>[]>(() =>
    this.cuentas().map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
  );

  protected reintentar(): void {
    this.intento.update((n) => n + 1);
  }

  /* ============================================================================
      Activos.
      ========================================================================== */

  protected readonly assets = toSignal(
    toObservable(this.practicaYIntento).pipe(
      switchMap(({ practiceId }): Observable<ViewState<readonly AssetSummary[]>> => {
        if (practiceId === null) return of(empty({ label: 'Elegir una práctica' }));
        return this.client.listAssets(practiceId).pipe(
          map((items): ViewState<readonly AssetSummary[]> =>
            items.length === 0
              ? empty({ label: 'Dar de alta un activo' }, 'Esta práctica todavía no tiene activos.')
              : ready(items),
          ),
          startWith(loading()),
          catchError((error: unknown) => of(errorToViewState<readonly AssetSummary[]>(error))),
        );
      }),
    ),
    { initialValue: loading() as ViewState<readonly AssetSummary[]> },
  );

  protected readonly formularioDeActivo = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    acquisitionAccountId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    offsetAccountId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    acquisitionCost: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    acquisitionDate: new FormControl(new Date().toISOString().slice(0, 10), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    usefulLifeMonths: new FormControl('', { nonNullable: true }),
    salvageValue: new FormControl('', { nonNullable: true }),
  });

  protected readonly estadoDeAltaDeActivo = signal<ViewState<null>>(ready(null));
  protected readonly enviandoAltaDeActivo = computed(
    () => this.estadoDeAltaDeActivo().status === 'loading',
  );
  protected readonly errorDeAltaDeActivo = computed(() =>
    errorMessageOf(this.estadoDeAltaDeActivo(), 'No se pudo dar de alta el activo.'),
  );
  protected readonly activoDadoDeAlta = signal(false);

  protected darDeAltaActivo(): void {
    const practiceId = this.practicaElegida();
    if (practiceId === null || this.enviandoAltaDeActivo()) return;
    if (this.formularioDeActivo.invalid) {
      this.formularioDeActivo.markAllAsTouched();
      return;
    }
    const valores = this.formularioDeActivo.getRawValue();

    this.estadoDeAltaDeActivo.set(loading());
    this.activoDadoDeAlta.set(false);
    this.client
      .capitalizeAsset({
        practiceId,
        code: valores.code,
        name: valores.name,
        acquisitionAccountId: valores.acquisitionAccountId,
        offsetAccountId: valores.offsetAccountId,
        acquisitionCost: valores.acquisitionCost,
        acquisitionDate: valores.acquisitionDate,
        usefulLifeMonths: valores.usefulLifeMonths === '' ? undefined : Number(valores.usefulLifeMonths),
        salvageValue: valores.salvageValue === '' ? undefined : valores.salvageValue,
      })
      .subscribe({
        next: () => {
          this.estadoDeAltaDeActivo.set(ready(null));
          this.activoDadoDeAlta.set(true);
          this.formularioDeActivo.reset({
            code: '',
            name: '',
            acquisitionAccountId: '',
            offsetAccountId: '',
            acquisitionCost: '',
            acquisitionDate: new Date().toISOString().slice(0, 10),
            usefulLifeMonths: '',
            salvageValue: '',
          });
          this.reintentar();
        },
        error: (error: unknown) => this.estadoDeAltaDeActivo.set(errorToViewState<null>(error)),
      });
  }

  /** Cuentas para "registrar avance" de cualquier activo — ver el JSDoc de la clase. */
  protected readonly cuentaDeGastoDepreciacion = signal<string | null>(null);
  protected readonly cuentaDeDepreciacionAcumulada = signal<string | null>(null);
  protected readonly avanceDeActivoEnCurso = signal<string | null>(null);
  protected readonly errorDeAvanceDeActivo = signal<string | null>(null);

  protected alternarAutomatizacionDeActivo(asset: AssetSummary, automated: boolean): void {
    this.client.setAssetAutomation(asset.id, automated).subscribe({ next: () => this.reintentar() });
  }

  protected registrarAvanceDeActivo(asset: AssetSummary): void {
    const depreciationExpenseAccountId = this.cuentaDeGastoDepreciacion();
    const accumulatedDepreciationAccountId = this.cuentaDeDepreciacionAcumulada();
    if (depreciationExpenseAccountId === null || accumulatedDepreciationAccountId === null) {
      this.errorDeAvanceDeActivo.set(
        'Elegí primero la cuenta de gasto por depreciación y la de depreciación acumulada.',
      );
      return;
    }
    this.errorDeAvanceDeActivo.set(null);
    this.avanceDeActivoEnCurso.set(asset.id);
    this.client
      .registerAssetProgress(asset.id, { depreciationExpenseAccountId, accumulatedDepreciationAccountId })
      .subscribe({
        next: () => {
          this.avanceDeActivoEnCurso.set(null);
          this.reintentar();
        },
        error: (error: unknown) => {
          this.avanceDeActivoEnCurso.set(null);
          this.errorDeAvanceDeActivo.set(errorMessageOf(errorToViewState(error), 'No se pudo registrar el avance.'));
        },
      });
  }

  /* ============================================================================
      Pasivos.
      ========================================================================== */

  protected readonly liabilities = toSignal(
    toObservable(this.practicaYIntento).pipe(
      switchMap(({ practiceId }): Observable<ViewState<readonly LiabilitySummary[]>> => {
        if (practiceId === null) return of(empty({ label: 'Elegir una práctica' }));
        return this.client.listLiabilities(practiceId).pipe(
          map((items): ViewState<readonly LiabilitySummary[]> =>
            items.length === 0
              ? empty({ label: 'Dar de alta un pasivo' }, 'Esta práctica todavía no tiene pasivos.')
              : ready(items),
          ),
          startWith(loading()),
          catchError((error: unknown) => of(errorToViewState<readonly LiabilitySummary[]>(error))),
        );
      }),
    ),
    { initialValue: loading() as ViewState<readonly LiabilitySummary[]> },
  );

  protected readonly formularioDePasivo = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    creditorName: new FormControl('', { nonNullable: true }),
    accountId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    principalAmount: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    interestRate: new FormControl('', { nonNullable: true }),
    installments: new FormControl('1', { nonNullable: true, validators: [Validators.required] }),
    startDate: new FormControl(new Date().toISOString().slice(0, 10), {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected readonly estadoDeAltaDePasivo = signal<ViewState<null>>(ready(null));
  protected readonly enviandoAltaDePasivo = computed(
    () => this.estadoDeAltaDePasivo().status === 'loading',
  );
  protected readonly errorDeAltaDePasivo = computed(() =>
    errorMessageOf(this.estadoDeAltaDePasivo(), 'No se pudo dar de alta el pasivo.'),
  );
  protected readonly pasivoDadoDeAlta = signal(false);

  protected darDeAltaPasivo(): void {
    const practiceId = this.practicaElegida();
    if (practiceId === null || this.enviandoAltaDePasivo()) return;
    if (this.formularioDePasivo.invalid) {
      this.formularioDePasivo.markAllAsTouched();
      return;
    }
    const valores = this.formularioDePasivo.getRawValue();

    this.estadoDeAltaDePasivo.set(loading());
    this.pasivoDadoDeAlta.set(false);
    this.client
      .createLiability({
        practiceId,
        code: valores.code,
        name: valores.name,
        creditorName: valores.creditorName === '' ? undefined : valores.creditorName,
        accountId: valores.accountId,
        principalAmount: valores.principalAmount,
        interestRate: valores.interestRate === '' ? undefined : valores.interestRate,
        installments: Number(valores.installments),
        startDate: valores.startDate,
      })
      .subscribe({
        next: () => {
          this.estadoDeAltaDePasivo.set(ready(null));
          this.pasivoDadoDeAlta.set(true);
          this.formularioDePasivo.reset({
            code: '',
            name: '',
            creditorName: '',
            accountId: '',
            principalAmount: '',
            interestRate: '',
            installments: '1',
            startDate: new Date().toISOString().slice(0, 10),
          });
          this.reintentar();
        },
        error: (error: unknown) => this.estadoDeAltaDePasivo.set(errorToViewState<null>(error)),
      });
  }

  /** Cuentas para "registrar avance" de cualquier pasivo — ver el JSDoc de la clase. */
  protected readonly cuentaDeBanco = signal<string | null>(null);
  protected readonly cuentaDeGastoPorInteres = signal<string | null>(null);
  protected readonly avanceDePasivoEnCurso = signal<string | null>(null);
  protected readonly errorDeAvanceDePasivo = signal<string | null>(null);

  protected alternarAutomatizacionDePasivo(liability: LiabilitySummary, automated: boolean): void {
    this.client.setLiabilityAutomation(liability.id, automated).subscribe({ next: () => this.reintentar() });
  }

  protected registrarAvanceDePasivo(liability: LiabilitySummary): void {
    const bankAccountId = this.cuentaDeBanco();
    const interestExpenseAccountId = this.cuentaDeGastoPorInteres();
    if (bankAccountId === null || interestExpenseAccountId === null) {
      this.errorDeAvanceDePasivo.set('Elegí primero la cuenta de banco y la de gasto por interés.');
      return;
    }
    this.errorDeAvanceDePasivo.set(null);
    this.avanceDePasivoEnCurso.set(liability.id);
    this.client
      .registerLiabilityProgress(liability.id, { bankAccountId, interestExpenseAccountId })
      .subscribe({
        next: () => {
          this.avanceDePasivoEnCurso.set(null);
          this.reintentar();
        },
        error: (error: unknown) => {
          this.avanceDePasivoEnCurso.set(null);
          this.errorDeAvanceDePasivo.set(
            errorMessageOf(errorToViewState(error), 'No se pudo registrar el avance.'),
          );
        },
      });
  }
}

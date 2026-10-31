import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, type TemplateRef } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, map, of, startWith, switchMap } from 'rxjs';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import type { CensusAdjustment, CensusDayView, CensusField } from '../../../core/data-access/adt/adt.types';
import { InfrastructureClient } from '../../../core/data-access/infrastructure/infrastructure.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, forbidden, loading, mapData, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { InpatientAccessStore } from '../inpatient-access.store';
import { BED_BOARD_ROUTE, DEFAULT_TIME_ZONE, dateKey, keyToDate, shortDate, shortDateTime, siteToday, validDateKey } from '../inpatient-presentation';
import { AdjustDialog } from './adjust-dialog';
import { CENSUS_CLOSE_GRACE_MS, CENSUS_LABEL, censusFieldLabel } from './census-fields';

/** Las columnas que se ven en la tabla (las 12 están en el ajuste y en la API). */
const SHOWN: readonly CensusField[] = ['bedsCensable', 'bedsAvailable', 'bedsBlocked', 'patientsAtCutoff', 'admissions', 'discharges', 'deaths', 'transfersIn', 'transfersOut', 'sameDayStays', 'patientDays'];

/** El día de la API y el nombre de su unidad (de la estructura de F1). */
export interface CensusDayRow extends CensusDayView {
  readonly unitName: string;
}

/** Una fila de la tabla: la unidad del día y sus números ya escritos. */
export type CensusRow = { readonly id: string; readonly unitName: string; readonly day: CensusDayRow } & Readonly<Partial<Record<CensusField, string>>>;

export function toRow(d: CensusDayRow): CensusRow {
  const numeros = Object.fromEntries(
    SHOWN.map((f) => [f, d.counts[f] === d.adjustedTotals[f] ? String(d.counts[f]) : `${d.counts[f]} → ${d.adjustedTotals[f]}`]),
  ) as Partial<Record<CensusField, string>>;
  return { id: d.id ?? `abierto-${d.unitId ?? 'sin-unidad'}`, unitName: d.unitName, day: d, ...numeros };
}

/**
 * **Censo diario** — `/inpatient/census` (F3.4).
 *
 * La API devuelve un arreglo de `CensusDayView`, una fila por unidad: día
 * abierto = vista previa calculada (`status: OPEN`, no se persiste); día
 * cerrado = la foto, sellada, con sus ajustes. **El número original nunca se
 * reescribe**: si hubo ajuste se muestra «original → ajustado».
 *
 * «Cerrar censo» manda `unitIds` con las unidades **abiertas que se ven**
 * (M4): no cierra lo que la persona no tiene en pantalla. La fecha y el corte
 * se leen en la zona de la sede (M3).
 */
@Component({
  selector: 'app-census',
  imports: [AdjustDialog, AppButton, Card, DataTable, DatePicker, FormField, PageHeader, StatusSeal, ViewStateHost],
  templateUrl: './census.html',
  styleUrl: './census.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Census {
  private readonly adt = inject(AdtClient);
  private readonly infra = inject(InfrastructureClient);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly access = inject(InpatientAccessStore);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly fieldLabel = censusFieldLabel;
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  protected readonly site = computed(() => this.access.pickSite(this.query().get('site'), 'f3.census.read'));
  protected readonly siteId = computed(() => this.site()?.siteId ?? null);
  protected readonly timeZone = computed(() => this.site()?.timeZone ?? DEFAULT_TIME_ZONE);
  protected readonly when = (iso: string | null) => shortDateTime(iso, this.timeZone()) ?? '—';
  protected readonly date = computed(() => validDateKey(this.query().get('date')) ?? siteToday(-1, Date.now(), this.timeZone()));
  protected readonly pickerDate = computed(() => keyToDate(this.date()));
  protected readonly dateLabel = computed(() => shortDate(this.date()));

  protected readonly gate = computed<ViewState<string>>(() => {
    const a = this.access.state();
    if (a.status !== 'ready') return a as ViewState<string>;
    const s = this.site();
    return s === null ? forbidden({ message: 'Su rol no incluye el censo de ningún establecimiento de esta organización.' }) : ready(s.siteId);
  });

  private readonly reloads = signal(0);
  private readonly view = signal<ViewState<readonly CensusDayRow[]>>(loading());
  protected readonly data = computed(() => dataOf(this.view()));
  protected readonly failure = signal<ViewState<never> | null>(null);
  protected readonly working = signal(false);
  protected readonly adjusting = signal<CensusDayRow | null>(null);

  protected readonly openUnits = computed(() => (this.data() ?? []).filter((d) => d.status === 'OPEN' && d.unitId !== null).map((d) => d.unitId!));
  protected readonly allClosed = computed(() => (this.data() ?? []).every((d) => d.status === 'CLOSED'));
  /** Se puede cerrar pasado el corte + la gracia de la sede; la API vuelve a decidir (422). */
  protected readonly closableFrom = computed(() => {
    const d = this.data()?.[0];
    return d === undefined ? null : new Date(Date.parse(d.cutoffAt) + CENSUS_CLOSE_GRACE_MS).toISOString();
  });
  protected readonly closable = computed(() => {
    const desde = this.closableFrom();
    return desde !== null && Date.now() >= Date.parse(desde) && this.openUnits().length > 0;
  });

  protected readonly days = computed<ViewState<readonly CensusDayRow[]>>(() => {
    const m = this.view();
    return m.status === 'ready' && m.data.length === 0
      ? empty({ label: 'Ver el tablero de camas', route: BED_BOARD_ROUTE }, 'Este establecimiento no tiene camas censables.')
      : m;
  });

  protected readonly adjustments = computed<ViewState<readonly (CensusAdjustment & { readonly unitName: string })[]>>(() => {
    const m = mapData(this.view(), (v) => v.flatMap((d) => d.adjustments.map((a) => ({ ...a, createdAt: this.when(a.createdAt), unitName: d.unitName }))));
    return m.status === 'ready' && m.data.length === 0
      ? empty({ label: 'Ajustar desde la fila de la unidad (sólo días cerrados)' }, 'Sin ajustes: la foto del día es la que se cerró.')
      : m;
  });

  private readonly cellUnit = viewChild<TemplateRef<{ $implicit: CensusRow }>>('cellUnit');
  private readonly cellStatus = viewChild<TemplateRef<{ $implicit: CensusRow }>>('cellStatus');
  private readonly cellActions = viewChild<TemplateRef<{ $implicit: CensusRow }>>('cellActions');
  private readonly cellAdj = viewChild<TemplateRef<{ $implicit: CensusAdjustment & { readonly unitName: string } }>>('cellAdj');

  /** Las filas, con cada número ya escrito: «3», o «3 → 4» si hubo ajuste. */
  protected readonly rows = computed<ViewState<readonly CensusRow[]>>(() => mapData(this.days(), (d) => d.map(toRow)));

  protected readonly columns = computed<readonly ColumnDef<CensusRow>[]>(() => [
    { key: 'unitName', header: 'Unidad', priority: 1, cell: this.cellUnit() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.cellStatus() },
    ...SHOWN.map((f, i) => ({ key: f, header: CENSUS_LABEL[f], priority: i < 4 ? 2 : 3, align: 'end' as const })),
    { key: 'id', header: 'Acciones', priority: 1, align: 'end', accion: true, cell: this.cellActions() },
  ]);

  protected readonly adjColumns = computed<readonly ColumnDef<CensusAdjustment & { readonly unitName: string }>[]>(() => [
    { key: 'unitName', header: 'Unidad', priority: 1 },
    { key: 'fieldCode', header: 'Campo', priority: 1, cell: this.cellAdj() },
    { key: 'reasonText', header: 'Motivo', priority: 2 },
    { key: 'createdAt', header: 'Cuándo', priority: 3 },
  ]);

  protected readonly byId = (r: { readonly id: string }): string => r.id;

  constructor() {
    this.access.ensure();
    toObservable(computed(() => ({ site: this.siteId(), date: this.date(), n: this.reloads() })))
      .pipe(
        switchMap(({ site, date }) =>
          site === null
            ? of(loading() as ViewState<readonly CensusDayRow[]>)
            : forkJoin({
                days: this.adt.getCensus(site, date),
                units: this.infra.listClinicalUnits(site).pipe(catchError(() => of([]))),
              }).pipe(
                map(({ days, units }) => {
                  const nombre = new Map(units.map((u) => [u.id, u.name]));
                  return ready(days.map((d) => ({ ...d, unitName: d.unitId === null ? 'Sin unidad' : (nombre.get(d.unitId) ?? 'Unidad') }))) as ViewState<readonly CensusDayRow[]>;
                }),
                catchError((e: unknown) => of(errorToViewState<readonly CensusDayRow[]>(e))),
                startWith(loading() as ViewState<readonly CensusDayRow[]>),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.view.set(s));
  }

  protected pickDate(d: Date | null): void {
    if (d === null) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { date: dateKey(d) }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected reload(): void {
    this.reloads.update((n) => n + 1);
  }

  protected async close(): Promise<void> {
    const id = this.siteId();
    const unidades = this.openUnits();
    if (id === null || unidades.length === 0) return;
    const ok = await this.dialogs.confirm({
      title: `Cerrar el censo del ${this.dateLabel()}`,
      message: `Se cierran ${unidades.length} unidad(es). La foto del día queda inmutable: una corrección posterior es un ajuste con motivo, nunca una edición.`,
      confirmLabel: 'Cerrar censo',
    });
    if (!ok) return;
    this.working.set(true);
    this.failure.set(null);
    this.adt.closeCensus(id, this.date(), unidades).subscribe({
      next: () => {
        this.working.set(false);
        this.reload();
      },
      error: (e: unknown) => {
        this.working.set(false);
        this.failure.set(errorToViewState<never>(e));
      },
    });
  }

  protected afterAdjust(): void {
    this.adjusting.set(null);
    this.reload();
  }
}

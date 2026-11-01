import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, startWith, switchMap } from 'rxjs';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import type { InpatientIndicators } from '../../../core/data-access/adt/adt.types';
import { INDICATOR_FORMULAS } from '../../../core/data-access/adt/inpatient-indicators';
import { InfrastructureClient } from '../../../core/data-access/infrastructure/infrastructure.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, forbidden, loading, mapData, ready, stale } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Link } from '../../../shared/components/atoms/link/link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { MetricCard } from '../../../shared/components/molecules/metric-card/metric-card';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { InpatientAccessStore } from '../inpatient-access.store';
import { CENSUS_ROUTE, DEFAULT_TIME_ZONE, dateKey, keyToDate, shiftDateKey, shortDate, siteMidnight, siteToday, validDateKey } from '../inpatient-presentation';

const n = (v: number | null | undefined, suffix = '') =>
  v === null || v === undefined || !Number.isFinite(v) ? null : `${v.toLocaleString('es-BO', { maximumFractionDigits: 2 })}${suffix}`;

/** Una fila por unidad: los indicadores de la API pedidos con `unitId`. */
interface UnitIndicators {
  readonly unitId: string;
  readonly unitName: string;
  readonly data: InpatientIndicators;
}

interface Loaded {
  readonly site: InpatientIndicators;
  readonly units: readonly UnitIndicators[];
}

/**
 * Hasta qué instante describen los números (S7): el corte del **último día
 * cerrado** del período, en la zona de la sede. Con días sin cerrar, el dato
 * tiene esa antigüedad, no la del pedido.
 */
export function coverageAsOf(d: InpatientIndicators, timeZone: string): Date | null {
  const faltan = new Set(d.coverage.daysMissing);
  let dia = d.period.to;
  for (let i = 0; i < 400 && dia >= d.period.from; i += 1) {
    if (!faltan.has(dia)) return siteMidnight(shiftDateKey(dia, 1), timeZone);
    dia = shiftDateKey(dia, -1);
  }
  return null;
}

/**
 * **Indicadores hospitalarios** — `/inpatient/indicators` (F3.4).
 *
 * Los números vienen **tal cual** de `GET /sites/:siteId/inpatient-indicators`
 * (sin redondear: la pantalla formatea). La tabla por unidad pide el mismo
 * endpoint con `unitId` por cada unidad de la sede. Sólo con días de censo
 * cerrados: si faltan días se dice cuáles y se ofrece cerrarlos (S7 con la
 * antigüedad real del dato: el corte del último día cerrado); sin ningún día
 * cerrado es S3 con próxima acción.
 */
@Component({
  selector: 'app-indicators',
  imports: [Alert, Card, DataTable, DatePicker, FormField, Link, MetricCard, PageHeader, RouterLink, ViewStateHost],
  templateUrl: './indicators.html',
  styleUrl: './indicators.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Indicators {
  private readonly adt = inject(AdtClient);
  private readonly infra = inject(InfrastructureClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly access = inject(InpatientAccessStore);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;
  protected readonly formula = INDICATOR_FORMULAS;
  protected readonly censusRoute = CENSUS_ROUTE;
  protected readonly short = shortDate;
  protected readonly fmt = n;

  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly site = computed(() => this.access.pickSite(this.query().get('site'), 'f3.indicators.read'));
  protected readonly siteId = computed(() => this.site()?.siteId ?? null);
  protected readonly timeZone = computed(() => this.site()?.timeZone ?? DEFAULT_TIME_ZONE);
  protected readonly to = computed(() => validDateKey(this.query().get('to')) ?? siteToday(-1, Date.now(), this.timeZone()));
  protected readonly from = computed(() => validDateKey(this.query().get('from')) ?? siteToday(-7, Date.now(), this.timeZone()));

  protected readonly gate = computed<ViewState<string>>(() => {
    const a = this.access.state();
    if (a.status !== 'ready') return a as ViewState<string>;
    const s = this.site();
    return s === null ? forbidden({ message: 'Su rol no incluye los indicadores de internación.' }) : ready(s.siteId);
  });

  private readonly reloads = signal(0);
  private readonly raw = signal<ViewState<Loaded>>(loading());
  protected readonly data = computed(() => dataOf(this.state())?.site ?? null);

  protected readonly state = computed<ViewState<Loaded>>(() => {
    const s = this.raw();
    if (s.status !== 'ready') return s;
    const d = s.data.site;
    if (d.coverage.daysClosed === 0) {
      return empty({ label: `Cerrar el censo del ${shortDate(d.period.to)}`, route: CENSUS_ROUTE, queryParams: { date: d.period.to } }, 'No hay ningún día de censo cerrado en el período: los indicadores sólo se calculan con días cerrados.');
    }
    if (d.coverage.daysMissing.length > 0) {
      const asOf = coverageAsOf(d, this.timeZone());
      if (asOf !== null) return stale(s.data, asOf);
    }
    return s;
  });

  /** Las filas por unidad con los números ya escritos en castellano (coma decimal). */
  protected readonly unitRows = computed<ViewState<readonly Readonly<Record<string, string>>[]>>(() =>
    mapData(this.state(), (d) =>
      d.units
        .filter((u) => u.data.coverage.daysClosed > 0)
        .map((u) => ({
          id: u.unitId,
          unitName: u.unitName,
          days: String(u.data.coverage.daysClosed),
          bedDaysAvailable: String(u.data.bedDaysAvailable),
          patientDays: String(u.data.patientDays),
          occupancyPct: n(u.data.occupancyPct, ' %') ?? '—',
          alos: n(u.data.alos) ?? '—',
          bedTurnover: n(u.data.bedTurnover) ?? '—',
          turnoverInterval: n(u.data.turnoverInterval) ?? '—',
        })),
    ),
  );

  protected readonly columns: readonly ColumnDef<Readonly<Record<string, string>>>[] = [
    { key: 'unitName', header: 'Unidad', priority: 1 },
    { key: 'days', header: 'Días cerrados', priority: 2, align: 'end' },
    { key: 'bedDaysAvailable', header: 'Días-cama', priority: 2, align: 'end' },
    { key: 'patientDays', header: 'Días-paciente', priority: 2, align: 'end' },
    { key: 'occupancyPct', header: '% ocupación', priority: 1, align: 'end' },
    { key: 'alos', header: 'Estancia media', priority: 3, align: 'end' },
    { key: 'bedTurnover', header: 'Giro', priority: 3, align: 'end' },
    { key: 'turnoverInterval', header: 'Intervalo de sustitución', priority: 4, align: 'end' },
  ];

  protected readonly kpis = computed(() => {
    const d = this.data();
    if (d === null) return [];
    const t = d.bedTurnaroundMinutes;
    return [
      { label: '% de ocupación', value: n(d.occupancyPct, ' %'), hint: INDICATOR_FORMULAS.occupancyPct, tone: 'primary' as const, testId: 'kpi-occupancy' },
      { label: 'Promedio de estancia', value: n(d.alos, ' días'), hint: INDICATOR_FORMULAS.alos, tone: 'neutral' as const, testId: 'kpi-alos' },
      { label: 'Giro de cama', value: n(d.bedTurnover), hint: INDICATOR_FORMULAS.bedTurnover, tone: 'neutral' as const, testId: 'kpi-turnover' },
      { label: 'Intervalo de sustitución', value: n(d.turnoverInterval, ' días'), hint: INDICATOR_FORMULAS.turnoverInterval, tone: 'neutral' as const, testId: 'kpi-interval' },
      { label: 'Días-cama disponibles', value: n(d.bedDaysAvailable), hint: INDICATOR_FORMULAS.bedDaysAvailable, tone: 'neutral' as const, testId: 'kpi-bed-days' },
      { label: 'Días-paciente', value: n(d.patientDays), hint: INDICATOR_FORMULAS.patientDays, tone: 'neutral' as const, testId: 'kpi-patient-days' },
      { label: 'Camas promedio', value: n(d.avgBeds), hint: INDICATOR_FORMULAS.avgBeds, tone: 'neutral' as const, testId: 'kpi-avg-beds' },
      { label: 'Rotación de cama (p50 / p90)', value: t.p50 === null ? null : `${n(t.p50)} / ${n(t.p90) ?? '—'} min`, hint: INDICATOR_FORMULAS.bedTurnaround, tone: 'neutral' as const, testId: 'kpi-turnaround' },
    ];
  });

  protected readonly byId = (u: Readonly<Record<string, string>>): string => u['id'] ?? '';

  constructor() {
    this.access.ensure();
    toObservable(computed(() => ({ site: this.siteId(), from: this.from(), to: this.to(), n: this.reloads() })))
      .pipe(
        switchMap(({ site, from, to }) => {
          if (site === null) return of(loading() as ViewState<Loaded>);
          return forkJoin({
            site: this.adt.getIndicators(site, from, to),
            units: this.infra.listClinicalUnits(site).pipe(catchError(() => of([]))),
          }).pipe(
            switchMap(({ site: totals, units }) => {
              const lista = units.slice(0, 30);
              if (lista.length === 0) return of(ready({ site: totals, units: [] }) as ViewState<Loaded>);
              return forkJoin(
                lista.map((u) =>
                  this.adt.getIndicators(site, from, to, u.id).pipe(
                    map((data): UnitIndicators | null => ({ unitId: u.id, unitName: u.name, data })),
                    catchError(() => of(null)),
                  ),
                ),
              ).pipe(map((filas) => ready({ site: totals, units: filas.filter((f): f is UnitIndicators => f !== null) }) as ViewState<Loaded>));
            }),
            catchError((e: unknown) => of(errorToViewState<Loaded>(e))),
            startWith(loading() as ViewState<Loaded>),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.raw.set(s));
  }

  protected setRange(which: 'from' | 'to', d: Date | null): void {
    if (d === null) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { [which]: dateKey(d) }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected pickerOf(key: string): Date {
    return keyToDate(key);
  }

  protected reload(): void {
    this.reloads.update((x) => x + 1);
  }
}

import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import type { IndicatorTotals, InpatientIndicators } from '../../../core/data-access/adt/adt.types';
import { INDICATOR_FORMULAS } from '../../../core/data-access/adt/inpatient-indicators';
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
import { CENSUS_ROUTE, dateKey, keyToDate, shortDate, siteToday } from '../inpatient-presentation';

const n = (v: number | null, suffix = '') => (v === null ? null : `${v.toLocaleString('es-BO', { maximumFractionDigits: 2 })}${suffix}`);

/**
 * **Indicadores hospitalarios** — `/inpatient/indicators` (F3.4).
 *
 * Sólo con días de censo **cerrados** (y sus ajustes). Si faltan días en el
 * período se dice cuáles y se ofrece cerrarlos (S7 con la antigüedad de la
 * cobertura); sin ningún día cerrado es S3 con próxima acción. Cada tarjeta
 * dice su fórmula.
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly access = inject(InpatientAccessStore);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;
  protected readonly formula = INDICATOR_FORMULAS;
  protected readonly censusRoute = CENSUS_ROUTE;
  protected readonly short = shortDate;

  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly site = computed(() => this.access.pickSite(this.query().get('site'), 'indicators.view'));
  protected readonly siteId = computed(() => this.site()?.siteId ?? null);
  protected readonly to = computed(() => this.query().get('to') ?? siteToday(-1));
  protected readonly from = computed(() => this.query().get('from') ?? siteToday(-7));

  protected readonly gate = computed<ViewState<string>>(() => {
    const a = this.access.state();
    if (a.status !== 'ready') return a as ViewState<string>;
    const s = this.site();
    return s === null ? forbidden({ message: 'Su rol no incluye los indicadores de internación.' }) : ready(s.siteId);
  });

  private readonly raw = signal<ViewState<InpatientIndicators>>(loading());
  protected readonly data = computed(() => dataOf(this.state()));

  protected readonly state = computed<ViewState<InpatientIndicators>>(() => {
    const s = this.raw();
    if (s.status !== 'ready') return s;
    if (s.data.coverage.daysClosed === 0) {
      return empty({ label: `Cerrar el censo del ${shortDate(s.data.period.to)}`, route: CENSUS_ROUTE, queryParams: { date: s.data.period.to } }, 'No hay ningún día de censo cerrado en el período: los indicadores sólo se calculan con días cerrados.');
    }
    // S7: con días sin cerrar, el número describe hasta el último cerrado.
    const faltan = s.data.coverage.daysMissing;
    if (faltan.length > 0) return stale(s.data, keyToDate(faltan[0]!));
    return s;
  });

  protected readonly units = computed<ViewState<readonly (IndicatorTotals & { readonly unitId: string; readonly unitName: string; readonly id: string })[]>>(() =>
    mapData(this.state(), (d) => d.byUnit.map((u) => ({ ...u, id: u.unitId }))),
  );

  /** Las filas con los números ya escritos en castellano (coma decimal). */
  protected readonly unitRows = computed<ViewState<readonly Readonly<Record<string, string>>[]>>(() =>
    mapData(this.units(), (lista) =>
      lista.map((u) => ({
        id: u.unitId,
        unitName: u.unitName,
        days: String(u.days),
        bedDaysAvailable: String(u.bedDaysAvailable),
        patientDays: String(u.patientDays),
        occupancyPct: n(u.occupancyPct, ' %') ?? '—',
        alos: n(u.alos) ?? '—',
        bedTurnover: n(u.bedTurnover) ?? '—',
        turnoverInterval: n(u.turnoverInterval) ?? '—',
      })),
    ),
  );

  protected readonly fmt = n;

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
    return [
      { label: '% de ocupación', value: n(d.occupancyPct, ' %'), hint: INDICATOR_FORMULAS.occupancyPct, tone: 'primary' as const, testId: 'kpi-occupancy' },
      { label: 'Promedio de estancia', value: n(d.alos, ' días'), hint: INDICATOR_FORMULAS.alos, tone: 'neutral' as const, testId: 'kpi-alos' },
      { label: 'Giro de cama', value: n(d.bedTurnover), hint: INDICATOR_FORMULAS.bedTurnover, tone: 'neutral' as const, testId: 'kpi-turnover' },
      { label: 'Intervalo de sustitución', value: n(d.turnoverInterval, ' días'), hint: INDICATOR_FORMULAS.turnoverInterval, tone: 'neutral' as const, testId: 'kpi-interval' },
      { label: 'Días-cama disponibles', value: n(d.bedDaysAvailable), hint: INDICATOR_FORMULAS.bedDaysAvailable, tone: 'neutral' as const, testId: 'kpi-bed-days' },
      { label: 'Días-paciente', value: n(d.patientDays), hint: INDICATOR_FORMULAS.patientDays, tone: 'neutral' as const, testId: 'kpi-patient-days' },
      { label: 'Camas promedio', value: n(d.avgBeds), hint: INDICATOR_FORMULAS.avgBeds, tone: 'neutral' as const, testId: 'kpi-avg-beds' },
      { label: 'Rotación de cama (p50 / p90)', value: d.bedTurnaroundMinutes.p50 === null ? null : `${d.bedTurnaroundMinutes.p50} / ${d.bedTurnaroundMinutes.p90} min`, hint: INDICATOR_FORMULAS.bedTurnaround, tone: 'neutral' as const, testId: 'kpi-turnaround' },
    ];
  });

  protected readonly byId = (u: Readonly<Record<string, string>>): string => u['id'] ?? '';

  constructor() {
    this.access.ensure();
    effect(() => {
      const id = this.siteId();
      const f = this.from();
      const t = this.to();
      if (id === null) return;
      untracked(() => this.load(id, f, t));
    });
  }

  protected setRange(which: 'from' | 'to', d: Date | null): void {
    if (d === null) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { [which]: dateKey(d) }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected pickerOf(key: string): Date {
    return keyToDate(key);
  }

  protected reload(): void {
    const id = this.siteId();
    if (id !== null) this.load(id, this.from(), this.to());
  }

  private load(siteId: string, from: string, to: string): void {
    this.raw.set(loading());
    this.adt
      .getIndicators(siteId, from, to)
      .pipe(
        map((d) => ready(d) as ViewState<InpatientIndicators>),
        catchError((e: unknown) => of(errorToViewState<InpatientIndicators>(e))),
      )
      .subscribe((s) => this.raw.set(s));
  }
}

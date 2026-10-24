import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import { PatientSpendingClient } from '@core/data-access/patient-spending/patient-spending.client';
import { errorToViewState } from '@core/http/error-to-view-state';
import { NavigationService } from '@core/navigation/navigation.service';
import { empty, loading, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { NavIcon } from '@shared/components/atoms/nav-icon/nav-icon';
import { Alert } from '@shared/components/molecules/alert/alert';
import { Card } from '@shared/components/molecules/card/card';
import { SegmentedControl } from '@shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '@shared/components/molecules/segmented-control/segmented-control.types';
import { PageHeader } from '@shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';

import { SpendingYearChart } from './spending-year-chart/spending-year-chart';
import {
  buildDashboard,
  deltaDirection,
  describeDelta,
  formatMoney,
  formatShare,
  formatWholeMoney,
  requestedRange,
  type CategoryShare,
  type Comparison,
  type DeltaDirection,
  type SpendingDashboard,
  type TrendPoint,
} from './spending.model';

/** La ruta de la pantalla, la que abre la billetera de la barra superior. */
export const SPENDING_ROUTE = '/my-account/spending';

type CategoryPeriod = 'month' | 'year';

const CATEGORY_PERIODS: readonly SegmentedOption<CategoryPeriod>[] = [
  { value: 'month', label: 'Este mes' },
  { value: 'year', label: 'Este año' },
];

/** Geometría lógica de la línea de tendencia (el SVG se estira al ancho). */
const SPARK_WIDTH = 240;
const SPARK_HEIGHT = 56;
const SPARK_PAD = 6;

/** A dónde se ofrece ir cuando todavía no hay ningún gasto. */
const EMPTY_ACTION = { label: 'Buscar un profesional', route: '/directory' };

interface SparkLine {
  readonly path: string;
  readonly area: string;
  readonly lastX: number;
  readonly lastY: number;
}

/**
 * «Mis gastos»: cuánto gastó el paciente en su salud, contado de varias
 * formas — este mes, el anterior, el año contra el pasado, por categoría,
 * dónde, y cuánto le ahorraron el seguro y las promociones.
 *
 * Se llega por la billetera de la barra superior. Lee una sola vez
 * `GET /patient-spending/me` (P43, hoy sólo en la maqueta) con el rango del
 * 1 de enero del año pasado a hoy, y todo lo demás son sumas sobre esa lista
 * (`spending.model.ts`).
 */
@Component({
  selector: 'app-spending',
  imports: [
    Alert,
    Card,
    DatePipe,
    NavIcon,
    PageHeader,
    SegmentedControl,
    SpendingYearChart,
    ViewStateHost,
  ],
  templateUrl: './spending.html',
  styleUrl: './spending.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Spending {
  private readonly client = inject(PatientSpendingClient);
  private readonly auth = inject(AuthService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly categoryPeriods = CATEGORY_PERIODS;
  protected readonly sparkWidth = SPARK_WIDTH;
  protected readonly sparkHeight = SPARK_HEIGHT;

  /** Sin perfil de paciente no hay gastos propios que mirar. */
  protected readonly withoutPatientProfile = this.auth.patientProfileId() === null;

  protected readonly state = signal<ViewState<SpendingDashboard>>(loading());
  protected readonly categoryPeriod = signal<CategoryPeriod>('month');

  protected readonly dashboard = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : null;
  });

  protected readonly categories = computed<readonly CategoryShare[]>(() => {
    const dashboard = this.dashboard();
    if (dashboard === null) return [];
    return this.categoryPeriod() === 'month'
      ? dashboard.categoriesThisMonth
      : dashboard.categoriesThisYear;
  });

  /** El ancho de cada barra de categoría, relativo a la mayor. */
  private readonly categoryMax = computed(() =>
    Math.max(1, ...this.categories().map((category) => category.cents)),
  );

  protected readonly categoryAgainst = computed(() => {
    const dashboard = this.dashboard();
    if (dashboard === null) return '';
    return this.categoryPeriod() === 'month'
      ? `el mismo tramo de ${dashboard.previousMonthLabel}`
      : `el mismo tramo de ${dashboard.previousYear}`;
  });

  protected readonly spark = computed<SparkLine | null>(() => {
    const dashboard = this.dashboard();
    return dashboard === null ? null : sparkLine(dashboard.trend);
  });

  protected readonly providerMax = computed(() =>
    Math.max(1, ...(this.dashboard()?.topProviders.map((provider) => provider.cents) ?? [])),
  );

  /** Lo que pagó el paciente sobre lo que costó su atención en el año, de 0 a 1. */
  protected readonly paidShare = computed(() => {
    const dashboard = this.dashboard();
    if (dashboard === null || dashboard.yearGrossCents === 0) return 0;
    return dashboard.yearToDate.cents / dashboard.yearGrossCents;
  });

  protected readonly savedCents = computed(() => {
    const dashboard = this.dashboard();
    return dashboard === null ? 0 : dashboard.yearCoveredCents + dashboard.yearDiscountCents;
  });

  constructor() {
    if (!this.withoutPatientProfile) {
      this.load();
    }
  }

  protected load(): void {
    const today = new Date();
    const { from, to } = requestedRange(today);
    this.state.set(loading());
    this.client.listMine(from, to).subscribe({
      next: (response) => {
        if (response.items.length === 0) {
          this.state.set(
            empty(
              EMPTY_ACTION,
              'Todavía no tiene gastos registrados. Cuando pague una consulta, una compra de farmacia o un análisis, lo va a ver acá.',
            ),
          );
          return;
        }
        this.state.set(ready(buildDashboard(response, today)));
      },
      error: (error: unknown) => this.state.set(errorToViewState<SpendingDashboard>(error)),
    });
  }

  protected money(cents: number, dashboard: SpendingDashboard): string {
    return formatMoney(cents, dashboard.currencyLabel);
  }

  protected wholeMoney(cents: number, dashboard: SpendingDashboard): string {
    return formatWholeMoney(cents, dashboard.currencyLabel);
  }

  protected share(ratio: number): string {
    return formatShare(ratio);
  }

  protected direction(comparison: Comparison): DeltaDirection {
    return deltaDirection(comparison);
  }

  protected delta(comparison: Comparison, against: string): string {
    return describeDelta(comparison, against);
  }

  protected categoryWidth(category: CategoryShare): number {
    return (category.cents / this.categoryMax()) * 100;
  }

  protected providerWidth(cents: number): number {
    return (cents / this.providerMax()) * 100;
  }
}

/** La tendencia de doce meses como un trazo y su lavado debajo. */
function sparkLine(points: readonly TrendPoint[]): SparkLine | null {
  if (points.length < 2) return null;
  const max = Math.max(1, ...points.map((point) => point.cents));
  const step = (SPARK_WIDTH - SPARK_PAD * 2) / (points.length - 1);
  const coords = points.map((point, index) => ({
    x: SPARK_PAD + index * step,
    y: SPARK_HEIGHT - SPARK_PAD - (point.cents / max) * (SPARK_HEIGHT - SPARK_PAD * 2),
  }));
  const path = coords
    .map((c, index) => `${index === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const first = coords[0]!;
  const last = coords[coords.length - 1]!;
  const baseline = SPARK_HEIGHT - SPARK_PAD;
  return {
    path,
    area: `${path} L${last.x.toFixed(1)} ${baseline} L${first.x.toFixed(1)} ${baseline} Z`,
    lastX: last.x,
    lastY: last.y,
  };
}

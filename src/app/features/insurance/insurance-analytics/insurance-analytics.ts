import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { InsuranceAnalyticsClient } from '../../../core/data-access/insurance/insurance-analytics.client';
import type {
  InsuranceDashboardAnalytics,
  PrevalentPathology,
  SpecialtyDistribution,
  TopMedication,
} from '../../../core/data-access/insurance/insurance-analytics.types';
import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type { CarrierDetail } from '../../../core/data-access/insurance/insurance.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Progress } from '../../../shared/components/atoms/progress/progress';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Card } from '../../../shared/components/molecules/card/card';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { CsvExportService, type CsvColumn } from '../../../shared/utils/csv-export/csv-export';
import { formatKpiAmount } from '../money-format';
import { displayCurrency } from '../../../core/money/display-currency';
import { MonthlyTrendChart } from './monthly-trend-chart/monthly-trend-chart';
import { displayCurrency } from '../../../core/money/display-currency';

/** Las cinco ventanas del filtro de periodo. `'all'` envía un `startDate` muy anterior. */
type RangeOption = '30d' | '90d' | '180d' | '1y' | 'all';

const RANGE_DAYS: Readonly<Record<Exclude<RangeOption, 'all'>, number>> = {
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '1y': 365,
};

const RANGE_OPTIONS: readonly SegmentedOption<RangeOption>[] = [
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: '180d', label: '180 días' },
  { value: '1y', label: '1 año' },
  { value: 'all', label: 'Todo' },
];

const ALL_PLANS = 'all';

/** Fecha civil de hoy en `America/La_Paz` (`YYYY-MM-DD`), sin `Date` de por medio. */
function hoyEnLaPaz(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? '';
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

/** `hoy - dias`, en aritmética de fecha civil pura (sin huso horario de por medio). */
function restarDias(hoy: string, dias: number): string {
  const [anio, mes, dia] = hoy.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio!, mes! - 1, dia!));
  fecha.setUTCDate(fecha.getUTCDate() - dias);
  return fecha.toISOString().slice(0, 10);
}

/** Fila plana para el CSV: una sección del tablero, una etiqueta, un valor. */
interface FilaDeExportacion {
  readonly section: string;
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly unit: string;
}

/**
 * Tablero de siniestralidad, gasto per cápita y métricas de salud de la
 * aseguradora — `administration/insurance-analytics` (subtarea 3.1, v4.2.14).
 *
 * ## Cara de la aseguradora, no del prestador
 *
 * Mismo alcance que `/administration/insurance` (el catálogo): la aseguradora
 * del tenant activo, resuelta por la API a partir de `X-Tenant-Id`. No hay
 * `carrierId` en la URL ni en la pantalla — un solo tenant, una sola
 * aseguradora administrable.
 *
 * ## El filtro vive en la URL
 *
 * Mismo patrón que «Solicitudes de seguro»: `range` y `plan` son parámetros de
 * consulta, no señales sueltas — una URL con filtros pegada en un mensaje
 * reproduce la misma vista.
 *
 * ## Nada se recalcula acá
 *
 * Todos los importes y tasas llegan ya sumados y redondeados en Postgres
 * (`InsuranceAnalyticsService`); esta pantalla sólo formatea texto
 * (`formatKpiAmount`) y arma las filas del CSV — nunca hace `Number()` sobre
 * un importe para mostrarlo o exportarlo (sólo el gráfico, para su geometría).
 *
 * ## Especialidad y CIE-10 son de la POBLACIÓN AFILIADA, no del reclamo
 *
 * `insurance_claims.encounter_id` no lo escribe ningún camino de alta: la API
 * no puede decir «esta consulta generó este reclamo». Las dos tablas lo
 * declaran en su título y, la de especialidad, en una nota bajo la tabla.
 */
@Component({
  selector: 'app-insurance-analytics',
  imports: [
    AppButton,
    Badge,
    Card,
    DataTable,
    EmptyState,
    FormField,
    MonthlyTrendChart,
    PageHeader,
    Progress,
    SegmentedControl,
    Select,
    ViewStateHost,
  ],
  templateUrl: './insurance-analytics.html',
  styleUrl: './insurance-analytics.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsuranceAnalytics {

  /**
   * La moneda visible de un importe: «Bs» para el boliviano y la UMA del
   * arancel, el código tal cual para cualquier otra. Ver `display-currency.ts`.
   */
  protected moneda(code?: string | null): string {
    return displayCurrency(code);
  }
  private readonly analytics = inject(InsuranceAnalyticsClient);
  private readonly insurance = inject(InsuranceClient);
  private readonly csv = inject(CsvExportService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly rangeOptions = RANGE_OPTIONS;

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly range = computed<RangeOption>(() => {
    const valor = this.queryParams().get('range');
    return (RANGE_OPTIONS.find((opcion) => opcion.value === valor)?.value ?? '1y') as RangeOption;
  });

  protected readonly planId = computed(() => this.queryParams().get('plan') ?? ALL_PLANS);

  protected readonly data = signal<ViewState<InsuranceDashboardAnalytics>>(loading());
  private readonly carrier = signal<CarrierDetail | null>(null);

  protected readonly planOptions = computed<readonly SelectOption<string>[]>(() => {
    const detalle = this.carrier();
    const planes = detalle?.products.flatMap((producto) => producto.plans) ?? [];
    return [
      { value: ALL_PLANS, label: 'Todos los planes' },
      ...planes.map((plan) => ({ value: plan.id, label: plan.name })),
    ];
  });

  protected readonly canExport = computed(() => dataOf(this.data()) !== null);

  constructor() {
    this.insurance.listCarriers().subscribe({
      next: (directory) => {
        const first = directory.items[0];
        if (first === undefined) return;
        this.insurance.getCarrier(first.id).subscribe({
          next: (detail) => this.carrier.set(detail),
        });
      },
    });

    effect(() => {
      // Se leen para que el efecto se re-dispare con cada cambio de filtro.
      this.range();
      this.planId();
      untracked(() => this.load());
    });
  }

  protected changeRange(range: RangeOption): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { range, plan: this.planId() === ALL_PLANS ? null : this.planId() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected changePlan(planId: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { plan: planId === null || planId === ALL_PLANS ? null : planId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected retry(): void {
    this.load();
  }

  private load(): void {
    this.data.set(loading());
    const hoy = hoyEnLaPaz();
    const range = this.range();
    const startDate = range === 'all' ? '2000-01-01' : restarDias(hoy, RANGE_DAYS[range]);
    const planId = this.planId();
    this.analytics
      .getLossRatioAnalytics({
        startDate,
        endDate: hoy,
        ...(planId === ALL_PLANS ? {} : { planId }),
      })
      .subscribe({
        next: (dashboard) => this.data.set(ready(dashboard)),
        error: (error: unknown) =>
          this.data.set(errorToViewState<InsuranceDashboardAnalytics>(error)),
      });
  }

  /** Semáforo del loss ratio: verde < 75 %, ámbar 75–85 %, rojo > 85 %. */
  protected lossRatioTone(percent: string | null): 'success' | 'warning' | 'error' | 'secondary' {
    if (percent === null) return 'secondary';
    const valor = Number(percent);
    if (valor < 75) return 'success';
    if (valor <= 85) return 'warning';
    return 'error';
  }

  protected formatear(amount: string): string {
    return formatKpiAmount(amount, dataOf(this.data())?.currency ?? null);
  }

  /**
   * La moneda visible de un importe: «Bs» para el boliviano y la UMA del
   * arancel, el código tal cual para cualquier otra. Ver `display-currency.ts`.
   */
  protected moneda(code?: string | null): string {
    return displayCurrency(code);
  }

  /** Envuelve una serie ya cargada (parte de una respuesta `ready`) para `app-data-table`. */
  protected readyRows<Row>(rows: readonly Row[]): ViewState<readonly Row[]> {
    return ready(rows);
  }

  protected medicationTrackBy = (row: TopMedication): string =>
    row.medicationCode ?? row.medicationName;
  /** Row name for screen readers (`rowLabel` of the table). */
  protected medicationLabel = (row: TopMedication): string => row.medicationName;
  protected specialtyTrackBy = (row: SpecialtyDistribution): string =>
    row.specialtyCode ?? row.specialtyName;
  /** Row name for screen readers (`rowLabel` of the table). */
  protected specialtyLabel = (row: SpecialtyDistribution): string => row.specialtyName;
  protected pathologyTrackBy = (row: PrevalentPathology): string => row.code;
  /** Row name for screen readers (`rowLabel` of the table). */
  protected pathologyLabel = (row: PrevalentPathology): string => row.description;

  protected readonly medicationColumns: readonly ColumnDef<TopMedication>[] = [
    { key: 'medicationName', header: 'Medicamento', priority: 1 },
    { key: 'dispensationsCount', header: 'Unidades', priority: 2, align: 'end' },
    { key: 'totalExpenseAmount', header: 'Importe', priority: 1, align: 'end' },
    { key: 'sharePercent', header: '% del gasto farmacéutico', priority: 3, align: 'end' },
  ];

  protected readonly specialtyColumns: readonly ColumnDef<SpecialtyDistribution>[] = [
    { key: 'specialtyName', header: 'Especialidad', priority: 1 },
    { key: 'consultationsCount', header: 'Consultas', priority: 1, align: 'end' },
  ];

  protected readonly pathologyColumns: readonly ColumnDef<PrevalentPathology>[] = [
    { key: 'code', header: 'CIE-10', priority: 2 },
    { key: 'description', header: 'Patología', priority: 1 },
    { key: 'casesCount', header: 'Casos', priority: 1, align: 'end' },
    { key: 'percentage', header: '%', priority: 3, align: 'end' },
  ];

  protected exportCsv(): void {
    const dashboard = dataOf(this.data());
    if (dashboard === null) return;
    const filas: FilaDeExportacion[] = [];
    const k = dashboard.kpis;
    filas.push(
      seccion(
        'KPI',
        'lossRatioPercent',
        'Loss ratio',
        k.lossRatioPercent ?? 'Sin prima registrada',
        '%',
      ),
      seccion(
        'KPI',
        'totalApprovedAmount',
        'Total indemnizado',
        k.totalApprovedAmount,
        dashboard.currency?.code ?? '',
      ),
      seccion(
        'KPI',
        'averageMonthlyPerCapitaExpense',
        'Gasto per cápita mensual',
        k.averageMonthlyPerCapitaExpense ?? 'Sin datos',
        dashboard.currency?.code ?? '',
      ),
      seccion('KPI', 'totalClaimsCount', 'Reclamos totales', String(k.totalClaimsCount), ''),
      seccion(
        'KPI',
        'approvalRatePercent',
        'Tasa de aprobación',
        k.approvalRatePercent ?? 'Sin datos',
        '%',
      ),
      seccion(
        'KPI',
        'activeAffiliatesCount',
        'Afiliados activos',
        String(k.activeAffiliatesCount),
        '',
      ),
    );
    for (const mes of dashboard.monthlyTrends) {
      filas.push(
        seccion(
          'Tendencia mensual',
          mes.period,
          `${mes.period} · facturado`,
          mes.billedAmount,
          dashboard.currency?.code ?? '',
        ),
        seccion(
          'Tendencia mensual',
          mes.period,
          `${mes.period} · aprobado`,
          mes.approvedAmount,
          dashboard.currency?.code ?? '',
        ),
      );
    }
    for (const med of dashboard.topMedications) {
      filas.push(
        seccion(
          'Top medicamentos',
          med.medicationCode ?? med.medicationName,
          med.medicationName,
          med.totalExpenseAmount,
          dashboard.currency?.code ?? '',
        ),
      );
    }
    for (const esp of dashboard.specialties) {
      filas.push(
        seccion(
          'Especialidades',
          esp.specialtyCode ?? esp.specialtyName,
          esp.specialtyName,
          String(esp.consultationsCount),
          'consultas',
        ),
      );
    }
    for (const cie of dashboard.prevalentPathologies) {
      filas.push(
        seccion('Patologías CIE-10', cie.code, cie.description, String(cie.casesCount), 'casos'),
      );
    }
    filas.push(
      seccion(
        'Inmunización',
        'vaccinatedCount',
        'Afiliados vacunados',
        String(dashboard.immunization.vaccinatedCount),
        '',
      ),
      seccion(
        'Inmunización',
        'vaccinationRatePercent',
        'Tasa de inmunización',
        dashboard.immunization.vaccinationRatePercent ?? 'Sin datos',
        '%',
      ),
    );
    this.csv.download(
      filas,
      EXPORT_COLUMNS,
      `siniestralidad-${dashboard.startDate}-${dashboard.endDate}`,
    );
  }
}

function seccion(
  section: string,
  key: string,
  label: string,
  value: string,
  unit: string,
): FilaDeExportacion {
  return { section, key, label, value, unit };
}

const EXPORT_COLUMNS: readonly CsvColumn<FilaDeExportacion>[] = [
  { header: 'Sección', value: (f) => f.section },
  { header: 'Indicador', value: (f) => f.label },
  { header: 'Valor', value: (f) => f.value },
  { header: 'Unidad', value: (f) => f.unit },
];

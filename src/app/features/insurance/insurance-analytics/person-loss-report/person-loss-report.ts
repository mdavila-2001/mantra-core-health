import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  TemplateRef,
  viewChild,
} from '@angular/core';

import { InsuranceClient } from '../../../../core/data-access/insurance/insurance.client';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { EmptyState } from '../../../../shared/components/molecules/empty-state/empty-state';
import { SearchField } from '../../../../shared/components/molecules/search-field/search-field';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { CsvExportService, type CsvColumn } from '../../../../shared/utils/csv-export/csv-export';
import {
  buildPersonLossReport,
  lossRatioTone,
  type PersonLossReport,
  type PersonLossRow,
  type PlanPremium,
} from './person-loss-report.model';
import { PersonLossReportStore } from './person-loss-report.store';

/** Una fila lista para la tabla: todo texto, salvo el semáforo que lleva su celda propia. */
interface TableRow {
  readonly id: string;
  readonly person: string;
  readonly planName: string;
  readonly claims: string;
  readonly billed: string;
  readonly approved: string;
  readonly denied: string;
  readonly approvalRate: string;
  readonly premium: string;
  readonly lossRatio: string | null;
}

const NOT_COMPUTABLE = '—';

/**
 * Informe de siniestralidad por persona — pestaña «Por persona» del tablero.
 *
 * Es una pantalla de **generación**, no de lectura continua: el informe se
 * arma cuando alguien lo pide con «Generar informe», porque recorre todas las
 * solicitudes recibidas. Si después cambia el periodo o el plan, el informe
 * mostrado deja de corresponder a los filtros y la pantalla lo dice (no lo
 * recalcula a escondidas ni lo deja pasar como vigente).
 *
 * El cálculo vive en `person-loss-report.model.ts` (puro, con su spec); este
 * componente sólo lo pide, lo muestra y lo exporta.
 *
 * **Alcance honesto:** el listado de solicitudes del servidor viene con tope.
 * Cuando llega recortado (`truncated`) el informe se rotula parcial. El
 * agregado exacto por persona necesita un endpoint propio: `PENDIENTES-BACKEND.md`.
 */
@Component({
  selector: 'app-person-loss-report',
  imports: [AppButton, Badge, DataTable, EmptyState, SearchField, ViewStateHost],
  templateUrl: './person-loss-report.html',
  styleUrl: './person-loss-report.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonLossReportView {
  private readonly insurance = inject(InsuranceClient);
  private readonly csv = inject(CsvExportService);
  private readonly store = inject(PersonLossReportStore);

  /** `YYYY-MM-DD`; `null` = desde la primera solicitud. */
  readonly startDate = input.required<string | null>();
  readonly endDate = input.required<string>();
  /** Nombre del plan filtrado; `null` = todos. */
  readonly planName = input<string | null>(null);
  readonly plans = input<readonly PlanPremium[]>([]);

  protected readonly state = this.store.state;
  protected readonly search = this.store.search;
  protected readonly report = this.store.report;

  private readonly ratioCell =
    viewChild.required<TemplateRef<{ $implicit: TableRow }>>('ratioCell');

  protected readonly isGenerating = computed(() => this.state()?.status === 'loading');

  private readonly filtersKey = computed(() =>
    JSON.stringify([this.startDate(), this.endDate(), this.planName()]),
  );
  /** El informe mostrado ya no corresponde a los filtros de arriba. */
  protected readonly isStale = computed(
    () => this.report() !== null && this.store.generatedFor() !== this.filtersKey(),
  );
  protected readonly isPartial = computed(() => this.report() !== null && this.store.truncated());

  private readonly visibleRows = computed<readonly PersonLossRow[]>(() => {
    const needle = this.search().trim().toLowerCase();
    const rows = this.report()?.rows ?? [];
    if (needle === '') return rows;
    return rows.filter((row) => `${row.name} ${row.memberCode}`.toLowerCase().includes(needle));
  });

  protected readonly tableState = computed<ViewState<readonly TableRow[]>>(() =>
    ready(this.visibleRows().map((row) => this.toTableRow(row))),
  );

  protected readonly columns = computed<readonly ColumnDef<TableRow>[]>(() => {
    const code = this.report()?.currencyCode;
    const unit = code ? ` · ${code}` : '';
    return [
      { key: 'person', header: 'Nombre', priority: 1 },
      { key: 'claims', header: 'Solicitudes', priority: 2, align: 'end' },
      { key: 'approved', header: `Monto aprobado${unit}`, priority: 1, align: 'end' },
      { key: 'denied', header: `Monto rechazado${unit}`, priority: 2, align: 'end' },
      { key: 'premium', header: `Cuota pagada${unit}`, priority: 2, align: 'end' },
      {
        key: 'lossRatio',
        header: '% Siniestralidad',
        priority: 1,
        align: 'end',
        cell: this.ratioCell(),
      },
    ];
  });

  protected readonly trackBy = (row: TableRow): string => row.id;
  protected readonly rowLabel = (row: TableRow): string => row.person;

  protected tone(row: TableRow) {
    return lossRatioTone(row.lossRatio);
  }

  protected toneLabel(row: TableRow): string {
    const tone = lossRatioTone(row.lossRatio);
    if (tone === 'secondary') return 'Sin prima';
    return tone === 'success' ? 'Saludable' : tone === 'warning' ? 'Atención' : 'Crítica';
  }

  protected generate(): void {
    this.state.set(loading());
    const key = this.filtersKey();
    this.insurance.listReceivedClaims().subscribe({
      next: (list) => {
        this.store.truncated.set(list.truncated);
        this.store.generatedFor.set(key);
        this.state.set(
          ready(
            buildPersonLossReport(list.items, {
              startDate: this.startDate(),
              endDate: this.endDate(),
              planName: this.planName(),
              plans: this.plans(),
            }),
          ),
        );
      },
      error: (error: unknown) => this.state.set(errorToViewState<PersonLossReport>(error)),
    });
  }

  protected retry(): void {
    this.generate();
  }

  protected exportCsv(): void {
    const report = this.report();
    if (report === null) return;
    this.csv.download(
      report.rows,
      this.csvColumns(report.currencyCode ?? ''),
      `siniestralidad-por-persona-${report.startDate}-${report.endDate}`,
    );
  }

  private csvColumns(currency: string): readonly CsvColumn<PersonLossRow>[] {
    return [
      { header: 'Persona', value: (row) => row.name },
      { header: 'Código de afiliado', value: (row) => row.memberCode },
      { header: 'Plan', value: (row) => row.planName },
      { header: 'Reclamos', value: (row) => String(row.claimsCount) },
      { header: 'Pendientes', value: (row) => String(row.pendingCount) },
      { header: 'Facturado', value: (row) => row.billedAmount },
      { header: 'Aprobado', value: (row) => row.approvedAmount },
      { header: 'Denegado', value: (row) => row.deniedAmount },
      { header: '% aprobación', value: (row) => row.approvalRatePercent ?? 'Sin dictaminar' },
      { header: 'Prima del período', value: (row) => row.premiumAmount ?? 'Sin prima registrada' },
      { header: 'Siniestralidad %', value: (row) => row.lossRatioPercent ?? 'No computable' },
      { header: 'Moneda', value: () => currency },
    ];
  }

  private toTableRow(row: PersonLossRow): TableRow {
    return {
      id: row.personId,
      person: row.memberCode === '' ? row.name : `${row.name} · ${row.memberCode}`,
      planName: row.planName,
      claims:
        row.pendingCount === 0
          ? String(row.claimsCount)
          : `${row.claimsCount} (${row.pendingCount} pend.)`,
      billed: row.billedAmount,
      approved: row.approvedAmount,
      denied: row.deniedAmount,
      approvalRate:
        row.approvalRatePercent === null ? NOT_COMPUTABLE : `${row.approvalRatePercent} %`,
      premium: row.premiumAmount ?? NOT_COMPUTABLE,
      lossRatio: row.lossRatioPercent,
    };
  }
}

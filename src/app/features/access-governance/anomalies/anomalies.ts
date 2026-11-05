import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
  type OnInit,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  ANOMALY_KINDS,
  accessFailureOf,
  AccessGovernanceClient,
  type Anomaly,
  type AnomalyKind,
  type AnomalyQuery,
  type AnomalyResolution,
  type AnomalyStatus,
} from '../../../core/data-access/access-governance';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, mapData, ready, stale } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type {
  ColumnDef,
  CursorState,
  SortState,
} from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { formatDateTime } from '../../support-access/support-labels';
import { anomalyChart, kindLabel, type AnomalyChart } from './anomaly-evidence';

type StatusFilter = AnomalyStatus | 'ALL';
type KindFilter = AnomalyKind | 'ALL';
type Resolution = AnomalyResolution['status'];

const PAGE_SIZE = 10;
/** Descartar y escalar piden un comentario de al menos este largo (la API lo exige al descartar). */
export const MIN_COMMENT_LENGTH = 10;

const STATUS_OPTIONS: readonly SelectOption<StatusFilter>[] = [
  { value: 'OPEN', label: 'Abiertas' },
  { value: 'ACKNOWLEDGED', label: 'Reconocidas' },
  { value: 'DISMISSED', label: 'Descartadas' },
  { value: 'ESCALATED', label: 'Escaladas' },
  { value: 'ALL', label: 'Todas' },
];
const KIND_OPTIONS: readonly SelectOption<KindFilter>[] = [
  { value: 'ALL', label: 'Todos los tipos' },
  ...ANOMALY_KINDS.map((kind) => ({ value: kind as KindFilter, label: kindLabel(kind) })),
];

const STATUS_TEXT: Readonly<Record<string, string>> = {
  OPEN: 'Abierta',
  ACKNOWLEDGED: 'Reconocida',
  DISMISSED: 'Descartada',
  ESCALATED: 'Escalada',
};
const STATUS_TONE: Readonly<Record<string, BadgeVariant>> = {
  OPEN: 'warning',
  ACKNOWLEDGED: 'success',
  DISMISSED: 'secondary',
  ESCALATED: 'error',
};
const STATUS_GLYPH: Readonly<Record<string, string>> = {
  OPEN: '!',
  ACKNOWLEDGED: '✓',
  DISMISSED: '–',
  ESCALATED: '▲',
};
const RESOLVED_TEXT: Readonly<Record<Resolution, string>> = {
  ACKNOWLEDGED: 'Se reconoció la anomalía.',
  DISMISSED: 'Se descartó la anomalía.',
  ESCALATED:
    'Se escaló la anomalía: queda sugerida la suspensión de la persona, que nadie ejecuta sola.',
};
const COMMENT_NEEDED: Readonly<Partial<Record<Resolution, string>>> = {
  DISMISSED: `Escriba un comentario de al menos ${MIN_COMMENT_LENGTH} caracteres para descartar la anomalía.`,
  ESCALATED: `Escriba un comentario de al menos ${MIN_COMMENT_LENGTH} caracteres para escalar la anomalía.`,
};

const compare = (a: string, b: string): number => a.localeCompare(b, 'es');

/**
 * **Anomalías** — actividad fuera de lo habitual, con su evidencia, para reconocerla, descartarla o escalarla
 * (CONTRATO-GOBIERNO §6.6 y §9.3 fila 11).
 *
 * Lista accesible (encabezados, orden y paginación) y, debajo, el detalle de la elegida: gráfico de barras con la línea base
 * y **su descripción en texto**. Descartar y escalar piden comentario; la API tiene la última palabra.
 */
@Component({
  selector: 'app-anomalies',
  imports: [
    AppButton,
    Alert,
    Badge,
    Card,
    DataTable,
    FormField,
    PageHeader,
    RouterLink,
    Select,
    Textarea,
  ],
  templateUrl: './anomalies.html',
  styleUrl: './anomalies.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Anomalies implements OnInit {
  private readonly client = inject(AccessGovernanceClient);
  private readonly toasts = inject(ToastService);
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly kindOptions = KIND_OPTIONS;
  protected readonly statusFilter = signal<StatusFilter>('OPEN');
  protected readonly kindFilter = signal<KindFilter>('ALL');

  private readonly list = signal<ViewState<readonly Anomaly[]>>(loading());
  private lastItems: { readonly items: readonly Anomaly[]; readonly at: Date } | null = null;
  protected readonly sort = signal<SortState>({ key: 'window', direction: 'desc' });
  private readonly page = signal(0);

  protected readonly selected = signal<Anomaly | null>(null);
  protected readonly comment = signal('');
  protected readonly commentError = signal<string | null>(null);
  protected readonly busy = signal<Resolution | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly resolvedNotice = signal<string | null>(null);

  private readonly detailRef = viewChild<ElementRef<HTMLElement>>('detail');
  private readonly personCell =
    viewChild.required<TemplateRef<{ $implicit: Anomaly }>>('personCell');
  private readonly kindCell = viewChild.required<TemplateRef<{ $implicit: Anomaly }>>('kindCell');
  private readonly windowCell =
    viewChild.required<TemplateRef<{ $implicit: Anomaly }>>('windowCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: Anomaly }>>('statusCell');
  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: Anomaly }>>('actionCell');

  protected readonly columns = computed<readonly ColumnDef<Anomaly>[]>(() => [
    { key: 'person', header: 'Persona', priority: 1, sortable: true, cell: this.personCell() },
    { key: 'kind', header: 'Qué se detectó', priority: 1, sortable: true, cell: this.kindCell() },
    { key: 'window', header: 'Ventana', priority: 2, sortable: true, cell: this.windowCell() },
    { key: 'status', header: 'Estado', priority: 1, sortable: true, cell: this.statusCell() },
    { key: 'actions', header: 'Acciones', priority: 1, accion: true, cell: this.actionCell() },
  ]);
  protected readonly rowId = (row: Anomaly): string => row.id;
  protected readonly rowLabel = (row: Anomaly): string =>
    `${this.personName(row)}, ${kindLabel(row.kind)}`;

  /** Total de anomalías del filtro, para el resumen de la página. */
  private readonly total = computed(() => dataOf(this.list())?.length ?? 0);
  private readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  /** La página visible, ya ordenada: es lo que recibe la tabla. */
  protected readonly tableState = computed<ViewState<readonly Anomaly[]>>(() => {
    const { key, direction } = this.sort();
    const sign = direction === 'asc' ? 1 : -1;
    const start = Math.min(this.page(), this.pages() - 1) * PAGE_SIZE;
    return mapData(this.list(), (items) =>
      [...items].sort((a, b) => sign * this.sortValue(key, a, b)).slice(start, start + PAGE_SIZE),
    );
  });

  protected readonly cursor = computed<CursorState>(() => {
    const page = Math.min(this.page(), this.pages() - 1);
    return {
      prevCursor: page > 0 ? String(page - 1) : null,
      nextCursor: page + 1 < this.pages() ? String(page + 1) : null,
    };
  });

  protected readonly pageSummary = computed(() => {
    const total = this.total();
    return `Página ${Math.min(this.page(), this.pages() - 1) + 1} de ${this.pages()} · ${total} ${total === 1 ? 'anomalía' : 'anomalías'}`;
  });

  protected readonly chart = computed<AnomalyChart | null>(() => {
    const anomaly = this.selected();
    return anomaly === null ? null : anomalyChart(anomaly);
  });

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const status = params.get('status');
    const kind = params.get('kind');
    if (status !== null && STATUS_OPTIONS.some((o) => o.value === status))
      this.statusFilter.set(status as StatusFilter);
    if (kind !== null && (ANOMALY_KINDS as readonly string[]).includes(kind))
      this.kindFilter.set(kind as KindFilter);
    this.load();
  }

  protected load(): void {
    const query: AnomalyQuery = {
      ...(this.statusFilter() === 'ALL' ? {} : { status: this.statusFilter() as AnomalyStatus }),
      ...(this.kindFilter() === 'ALL' ? {} : { kind: this.kindFilter() as AnomalyKind }),
    };
    this.list.set(loading());
    this.client.listAnomalies(query).subscribe({
      next: ({ items }) => {
        this.lastItems = { items, at: new Date() };
        this.page.set(0);
        this.list.set(items.length === 0 ? this.emptyState() : ready(items));
      },
      error: (failure: unknown) => {
        const state = errorToViewState<readonly Anomaly[]>(failure);
        // Sin conexión al actualizar: se conserva lo que ya se tenía, con su antigüedad (S7).
        this.list.set(
          state.status === 'offline' && this.lastItems !== null
            ? stale(this.lastItems.items, this.lastItems.at)
            : state,
        );
      },
    });
  }

  protected setStatus(value: StatusFilter | null): void {
    if (value === null || value === this.statusFilter()) return;
    this.statusFilter.set(value);
    this.lastItems = null;
    this.load();
  }

  protected setKind(value: KindFilter | null): void {
    if (value === null || value === this.kindFilter()) return;
    this.kindFilter.set(value);
    this.lastItems = null;
    this.load();
  }

  protected changeSort(sort: SortState): void {
    this.sort.set(sort);
    this.page.set(0);
  }

  protected changePage(cursor: string): void {
    this.page.set(Number(cursor));
  }

  /* ---- detalle ------------------------------------------------------------------------------------------------- */

  protected open(anomaly: Anomaly): void {
    this.selected.set(anomaly);
    this.comment.set('');
    this.commentError.set(null);
    this.actionError.set(null);
    this.resolvedNotice.set(null);
    // El foco va al detalle: quien navega con teclado o lector de pantalla llega a lo que pidió.
    afterNextRender(() => this.detailRef()?.nativeElement.focus(), { injector: this.injector });
  }

  protected changeComment(value: string): void {
    this.comment.set(value);
    if (this.commentError() !== null) this.commentError.set(null);
  }

  protected resolve(status: Resolution): void {
    const anomaly = this.selected();
    if (anomaly === null || this.busy() !== null) return;
    const comment = this.comment().trim();
    const needed = COMMENT_NEEDED[status];
    if (needed !== undefined && comment.length < MIN_COMMENT_LENGTH) {
      this.commentError.set(needed);
      return;
    }
    this.commentError.set(null);
    this.actionError.set(null);
    this.busy.set(status);
    this.client
      .resolveAnomaly(anomaly.id, { status, ...(comment === '' ? {} : { comment }) })
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.selected.set({
            ...anomaly,
            status,
            ...(comment === '' ? {} : { resolutionComment: comment }),
          });
          this.comment.set('');
          this.resolvedNotice.set(RESOLVED_TEXT[status]);
          this.toasts.success(RESOLVED_TEXT[status]);
          this.load();
        },
        error: (failure: unknown) => {
          this.busy.set(null);
          this.actionError.set(
            accessFailureOf(failure)?.message ??
              'No pudimos completar la acción. Intente de nuevo.',
          );
          // Puede que otra persona ya la haya atendido: se vuelve a leer la lista.
          this.load();
        },
      });
  }

  /* ---- texto ------------------------------------------------------------------------------------------------ */

  protected personName(anomaly: Anomaly): string {
    return anomaly.userName ?? 'Persona del equipo';
  }
  protected kind(anomaly: Anomaly): string {
    return kindLabel(anomaly.kind);
  }
  protected statusText(status: string): string {
    return STATUS_TEXT[status] ?? status;
  }
  protected statusTone(status: string): BadgeVariant {
    return STATUS_TONE[status] ?? 'info';
  }
  protected statusGlyph(status: string): string {
    return STATUS_GLYPH[status] ?? 'i';
  }
  protected windowText(anomaly: Anomaly): string {
    return `${formatDateTime(anomaly.windowStart)} – ${formatDateTime(anomaly.windowEnd)}`;
  }
  protected compactText(anomaly: Anomaly): string {
    return anomaly.baseline === null
      ? `Observado ${anomaly.observed}, umbral ${anomaly.threshold}`
      : `Observado ${anomaly.observed}, habitual ${anomaly.baseline}, umbral ${anomaly.threshold}`;
  }
  protected resolvedAt(anomaly: Anomaly): string | null {
    return anomaly.acknowledgedAt === undefined ? null : formatDateTime(anomaly.acknowledgedAt);
  }

  private emptyState(): ViewState<readonly Anomaly[]> {
    if (this.statusFilter() === 'OPEN' && this.kindFilter() === 'ALL') {
      return empty(
        { label: 'Volver al tablero de gobierno', route: '/administration/access-governance' },
        'No hay anomalías abiertas. Todo tranquilo por ahora.',
      );
    }
    return empty(
      {
        label: 'Ver las abiertas',
        route: '/administration/access-governance/anomalies',
        queryParams: { status: 'OPEN' },
      },
      'No hay anomalías con ese filtro.',
    );
  }

  private sortValue(key: string, a: Anomaly, b: Anomaly): number {
    switch (key) {
      case 'person':
        return compare(this.personName(a), this.personName(b));
      case 'kind':
        return compare(kindLabel(a.kind), kindLabel(b.kind));
      case 'status':
        return compare(this.statusText(a.status), this.statusText(b.status));
      default:
        return compare(a.windowStart, b.windowStart);
    }
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { Subscription } from 'rxjs';

import { MutabilityClient } from '../../../../core/data-access/admin-portal/mutability.client';
import {
  EVIDENCE_LEVELS,
  type MutabilityDetail,
  type MutabilityItem,
  type MutabilitySummary,
} from '../../../../core/data-access/admin-portal/mutability.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { Breakpoints } from '../../../../core/layout/breakpoints';
import { empty, loading, notFound, ready } from '../../../../core/view-state/view-state';
import type { EmptyViewState, ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { MetricCard } from '../../../../shared/components/molecules/metric-card/metric-card';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import {
  FilterBar,
  type FilterDef,
} from '../../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { portalUrl } from '../portal-nav';
import { pagedList } from '../support/paged-list';
import { patchQuery, queryFilters, queryParamsSignal } from '../support/route-query';
import {
  DISPOSITION_OPTIONS,
  EVIDENCE_HELP,
  EVIDENCE_OPTIONS,
  FINDING_OPTIONS,
  LEGAL_HOLD_OPTIONS,
  MUTABILITY_URL_KEYS,
  MUTABILITY_VIEWS,
  WRITE_MODE_HELP,
  WRITE_MODE_OPTIONS,
  disposition,
  emptyReason,
  evidenceLevel,
  findingCode,
  findingKind,
  hasMutabilityFilters,
  legalHold,
  mutabilityQuery,
  parseTableParam,
  ratioText,
  retentionText,
  severity,
  writeMode,
  type MutabilityUrlValues,
  type MutabilityView,
} from './mutability.model';

const PAGE_SIZE = 50;
const SCREEN = portalUrl('governance/mutability');
const NO_FILTERS: MutabilityUrlValues = {
  q: '',
  schema: '',
  writeMode: '',
  evidence: '',
  finding: '',
  disposition: '',
  legalHold: '',
};

/**
 * Mutabilidad de datos: qué tablas son append-only, cuáles se pueden borrar, cuáles se purgan por
 * retención y cuáles aceptan un legal hold. Cada valor se muestra con su nivel de evidencia y su
 * fuente exacta; las contradicciones entre fuentes se muestran con las dos caras y NO se resuelven.
 *
 * Una sola tarjeta ancha con cuatro pestañas: Resumen, Tablas, Contradicciones y Evidencia. Es el
 * catálogo DERIVADO del modelo y del código (ni oficial ni revisado por una persona); la pantalla lo
 * dice y no presenta «sin evidencia» como un «No».
 */
@Component({
  selector: 'app-portal-mutability-page',
  imports: [
    Alert,
    Badge,
    Card,
    MetricCard,
    Tab,
    Tabs,
    DataTable,
    PageHeader,
    ViewStateHost,
    FilterBar,
    RouterLink,
  ],
  templateUrl: './mutability-page.html',
  styleUrl: './mutability-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MutabilityPage {
  private readonly client = inject(MutabilityClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly params = queryParamsSignal(this.route);
  protected readonly values = queryFilters(this.params, MUTABILITY_URL_KEYS);
  protected readonly view = computed<MutabilityView>(() => {
    const v = this.params().get('view');
    return (MUTABILITY_VIEWS as readonly (string | null)[]).includes(v)
      ? (v as MutabilityView)
      : 'summary';
  });
  protected readonly tabIndex = computed(() => MUTABILITY_VIEWS.indexOf(this.view()));
  private readonly selectedKey = computed(() => this.params().get('table') ?? '');

  protected readonly writeMode = writeMode;
  protected readonly evidence = evidenceLevel;
  protected readonly disposition = disposition;
  protected readonly legalHold = legalHold;
  protected readonly kind = findingKind;
  protected readonly severity = severity;
  protected readonly findingCode = findingCode;
  protected readonly ratio = ratioText;
  protected readonly retention = retentionText;
  protected readonly modeHelp = WRITE_MODE_HELP;
  protected readonly evidenceHelp = EVIDENCE_HELP;
  protected readonly levels = EVIDENCE_LEVELS;

  // ---- Resumen (base de la pantalla) --------------------------------------------------------
  protected readonly summaryState = signal<ViewState<MutabilitySummary>>(loading());
  protected readonly summary = computed(() => {
    const s = this.summaryState();
    return s.status === 'ready' ? s.data : null;
  });
  protected readonly contradictionTone = computed(() =>
    (this.summary()?.withContradictions.numerator ?? 0) > 0 ? 'warning' : 'success',
  );

  // ---- Filtros y listas ---------------------------------------------------------------------
  /**
   * La barra de filtros escribe cada clave en la URL (`q` el buscador); la pantalla los lee de ahí
   * con `values()`. «Esquema exacto» no tiene control propio: llega por enlace (`?schema=`) y se
   * muestra como alcance con su forma de quitarlo; el buscador ya cubre esquema o tabla.
   */
  protected readonly filterDefs: readonly FilterDef[] = [
    { key: 'writeMode', label: 'Modo de escritura', placeholder: 'Cualquier modo', options: WRITE_MODE_OPTIONS },
    { key: 'evidence', label: 'Nivel de evidencia', placeholder: 'Cualquier nivel', options: EVIDENCE_OPTIONS },
    { key: 'finding', label: 'Hallazgos', placeholder: 'Con o sin hallazgos', options: FINDING_OPTIONS },
    { key: 'disposition', label: 'Retención', placeholder: 'Cualquier retención', options: DISPOSITION_OPTIONS },
    { key: 'legalHold', label: 'Legal hold', placeholder: 'Con o sin legal hold', options: LEGAL_HOLD_OPTIONS },
  ];

  protected readonly tables = pagedList<MutabilityItem>(
    (cursor) =>
      this.client.list({
        ...mutabilityQuery(this.values()),
        limit: PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
      }),
    () => this.whenEmpty(false),
  );

  protected readonly contradictions = pagedList<MutabilityItem>(
    (cursor) =>
      this.client.list({
        ...mutabilityQuery(NO_FILTERS, { finding: 'CONTRADICTION' }),
        limit: PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
      }),
    () => this.whenEmpty(true),
  );

  // ---- Evidencia de una tabla ---------------------------------------------------------------
  /** `null`: no se eligió ninguna tabla (se muestra la guía de niveles). */
  protected readonly detailState = signal<ViewState<MutabilityDetail> | null>(null);
  protected readonly detail = computed(() => {
    const s = this.detailState();
    return s !== null && s.status === 'ready' ? s.data : null;
  });

  // ---- Columnas -----------------------------------------------------------------------------
  private readonly tableCell =
    viewChild.required<TemplateRef<{ $implicit: MutabilityItem }>>('tableCell');
  private readonly modeCell =
    viewChild.required<TemplateRef<{ $implicit: MutabilityItem }>>('modeCell');
  private readonly keepCell =
    viewChild.required<TemplateRef<{ $implicit: MutabilityItem }>>('keepCell');
  private readonly findingsCell =
    viewChild.required<TemplateRef<{ $implicit: MutabilityItem }>>('findingsCell');

  /** Teléfono: tabla y modo; los hallazgos van dentro de la fila y la retención, en «Evidencia». */
  protected readonly narrow = inject(Breakpoints).isNavDrawer;
  protected readonly tableColumns = computed<readonly ColumnDef<MutabilityItem>[]>(() =>
    this.narrow()
      ? [
          { key: 'table', header: 'Tabla', priority: 1, cell: this.tableCell() },
          { key: 'mode', header: 'Modo y evidencia', priority: 1, cell: this.modeCell() },
        ]
      : [
          { key: 'table', header: 'Tabla', priority: 1, cell: this.tableCell() },
          { key: 'mode', header: 'Modo y evidencia', priority: 1, cell: this.modeCell() },
          { key: 'keep', header: 'Retención', priority: 2, cell: this.keepCell() },
          { key: 'findings', header: 'Hallazgos', priority: 2, cell: this.findingsCell() },
        ],
  );
  protected readonly contradictionColumns = computed<readonly ColumnDef<MutabilityItem>[]>(() =>
    this.narrow()
      ? [
          { key: 'table', header: 'Tabla', priority: 1, cell: this.tableCell() },
          { key: 'mode', header: 'Modo y evidencia', priority: 1, cell: this.modeCell() },
        ]
      : [
          { key: 'table', header: 'Tabla', priority: 1, cell: this.tableCell() },
          { key: 'mode', header: 'Modo y evidencia', priority: 1, cell: this.modeCell() },
          { key: 'findings', header: 'Hallazgos', priority: 1, cell: this.findingsCell() },
        ],
  );

  protected readonly keyOf = (row: MutabilityItem): string => `${row.schema}.${row.table}`;
  /** «schema.tabla» con cortes permitidos sólo tras «.» y «_»: nunca a mitad de palabra. */
  protected readonly breakable = (name: string): readonly string[] => name.split(/(?<=[._])/);
  protected readonly rowName = (row: MutabilityItem): string => this.keyOf(row);
  protected readonly hasFilters = computed(() => hasMutabilityFilters(this.values()));

  private pendingSummary: Subscription | null = null;
  private pendingDetail: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.pendingSummary?.unsubscribe();
      this.pendingDetail?.unsubscribe();
    });
    this.loadSummary();
    effect(() => {
      const view = this.view();
      this.values();
      if (view === 'tables') untracked(() => this.tables.restart());
    });
    effect(() => {
      if (this.view() === 'contradictions') untracked(() => this.contradictions.restart());
    });
    effect(() => {
      const key = this.selectedKey();
      untracked(() => this.loadDetail(key));
    });
  }

  protected loadSummary(): void {
    this.pendingSummary?.unsubscribe();
    this.summaryState.set(loading());
    this.pendingSummary = this.client.summary().subscribe({
      next: (s) => this.summaryState.set(ready(s)),
      error: (e: unknown) => this.summaryState.set(errorToViewState<MutabilitySummary>(e)),
    });
  }

  protected loadDetail(key: string): void {
    this.pendingDetail?.unsubscribe();
    if (key === '') {
      this.detailState.set(null);
      return;
    }
    const target = parseTableParam(key);
    if (target === null) {
      this.detailState.set(notFound());
      return;
    }
    this.detailState.set(loading());
    this.pendingDetail = this.client.detail(target.schema, target.table).subscribe({
      next: (d) => this.detailState.set(ready(d)),
      error: (e: unknown) => this.detailState.set(errorToViewState<MutabilityDetail>(e)),
    });
  }

  protected retryDetail(): void {
    this.loadDetail(this.selectedKey());
  }

  protected selectTab(index: number): void {
    const view = MUTABILITY_VIEWS[index] ?? 'summary';
    void patchQuery(this.router, this.route, { view: view === 'summary' ? null : view });
  }

  protected clearSchema(): void {
    void patchQuery(this.router, this.route, { schema: null });
  }

  protected open(row: MutabilityItem): void {
    void patchQuery(this.router, this.route, { view: 'evidence', table: this.keyOf(row) });
  }

  protected goTo(view: MutabilityView): void {
    void patchQuery(this.router, this.route, { view: view === 'summary' ? null : view });
  }

  private whenEmpty(contradictions: boolean): EmptyViewState {
    const filtered = !contradictions && this.hasFilters();
    return empty(
      filtered
        ? { label: 'Quitar los filtros', route: SCREEN }
        : { label: 'Ver el resumen', route: SCREEN },
      emptyReason(filtered, contradictions),
    );
  }
}

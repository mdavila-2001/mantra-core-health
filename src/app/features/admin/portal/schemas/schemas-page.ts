import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { DataCatalogClient } from '../../../../core/data-access/admin-portal/data-catalog.client';
import type {
  Coverage,
  SchemaSummary,
} from '../../../../core/data-access/admin-portal/data-catalog.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../shared/components/atoms/link/link';
import { MetricCard } from '../../../../shared/components/molecules/metric-card/metric-card';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { entero } from '../../platform/platform-labels';
import { paramValue, patchQuery, queryParamsSignal } from '../support/route-query';
import { splitAfter } from '../support/route-segments';
import { SchemaDrawer } from './schema-drawer';

/** Una fila de schema con el texto ya armado: la tabla sólo lo pinta. */
export interface SchemaRow {
  readonly schemaName: string;
  readonly module: string;
  readonly domain: string;
  readonly objects: number;
  readonly notObserved: number;
  readonly annotated: string;
  readonly approved: string;
}

export function toSchemaRow(s: SchemaSummary): SchemaRow {
  const d = s.description;
  return {
    schemaName: s.schemaName,
    module: d ? `M${String(d.moduleNumber).padStart(2, '0')} · ${d.title}` : 'Sin módulo en la bóveda',
    domain: d?.domain ?? '—',
    objects: s.objects,
    notObserved: s.notObserved,
    annotated: entero(s.annotated),
    approved: entero(s.approved),
  };
}

/**
 * Esquema: los schemas de la base tal como los ve el catálogo vivo, con el
 * módulo del modelo que los declara, cuántos objetos tienen y cuántos dejaron
 * de verse en el último escaneo (la deriva con la base). Un schema se abre en
 * un cajón (`?schema=`) con su explicación y sus objetos.
 */
@Component({
  selector: 'app-portal-schemas-page',
  imports: [RouterLink, Badge, Link, MetricCard, DataTable, PageHeader, SchemaDrawer],
  templateUrl: './schemas-page.html',
  styleUrl: './schemas-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemasPage {
  private readonly catalog = inject(DataCatalogClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly selected = paramValue(queryParamsSignal(this.route), 'schema');
  protected readonly coverage = signal<ViewState<Coverage>>(loading());
  private readonly schemas = signal<ViewState<readonly SchemaSummary[]>>(loading());

  protected readonly rows = computed<ViewState<readonly SchemaRow[]>>(() => {
    const s = this.schemas();
    if (s.status !== 'ready') return s as ViewState<readonly SchemaRow[]>;
    return s.data.length === 0
      ? empty(
          { label: 'Ir al catálogo vivo para escanear', route: '/superadmin/data-catalog' },
          'Todavía no hay schemas catalogados: el catálogo se llena con un escaneo técnico de la base.',
        )
      : ready(s.data.map(toSchemaRow));
  });
  protected readonly totals = computed(() => {
    const s = this.schemas();
    const list = s.status === 'ready' ? s.data : [];
    return {
      schemas: list.length,
      objects: list.reduce((n, x) => n + x.objects, 0),
      notObserved: list.reduce((n, x) => n + x.notObserved, 0),
    };
  });
  /** Versión del informe de cobertura (no la del modelo). Dato secundario: si no llega se dice, sin tapar la tabla. */
  protected readonly segments = (text: string): readonly string[] => splitAfter(text, '/-');
  protected readonly coverageVersion = computed(() => {
    const c = this.coverage();
    return c.status === 'ready' ? c.data.modelVersion : null;
  });
  protected readonly coverageNote = computed(() =>
    this.coverage().status === 'loading' ? 'leyendo…' : 'no disponible',
  );
  protected readonly selectedSummary = computed(() => {
    const s = this.schemas();
    return s.status === 'ready' ? (s.data.find((x) => x.schemaName === this.selected()) ?? null) : null;
  });

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: SchemaRow }>>('nameCell');
  private readonly driftCell = viewChild.required<TemplateRef<{ $implicit: SchemaRow }>>('driftCell');
  protected readonly columns = computed<readonly ColumnDef<SchemaRow>[]>(() => [
    { key: 'schemaName', header: 'Schema', priority: 1, cell: this.nameCell() },
    { key: 'module', header: 'Módulo del modelo', priority: 2 },
    { key: 'domain', header: 'Dominio', priority: 3 },
    { key: 'objects', header: 'Objetos', priority: 2, align: 'end' },
    { key: 'notObserved', header: 'Deriva con la base', priority: 1, cell: this.driftCell() },
    { key: 'annotated', header: 'Con ficha', priority: 3, align: 'end' },
    { key: 'approved', header: 'Aprobadas', priority: 3, align: 'end' },
  ]);
  protected readonly bySchema = (row: SchemaRow): string => row.schemaName;

  constructor() {
    this.loadSchemas();
    this.loadCoverage();
  }

  protected loadSchemas(): void {
    this.schemas.set(loading());
    this.catalog.listSchemas().subscribe({
      next: (list) => this.schemas.set(ready(list)),
      error: (e: unknown) => this.schemas.set(errorToViewState<readonly SchemaSummary[]>(e)),
    });
  }

  protected loadCoverage(): void {
    this.coverage.set(loading());
    this.catalog.coverage().subscribe({
      next: (c) => this.coverage.set(ready(c)),
      error: (e: unknown) => this.coverage.set(errorToViewState<Coverage>(e)),
    });
  }

  protected open(row: SchemaRow): void {
    void patchQuery(this.router, this.route, { schema: row.schemaName });
  }

  protected close(): void {
    void patchQuery(this.router, this.route, { schema: null });
  }
}

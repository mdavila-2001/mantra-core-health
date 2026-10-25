import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { PortalClient } from '../../../../core/data-access/admin-portal/portal.client';
import type {
  LinajeDominio,
  TerminoGlosario,
} from '../../../../core/data-access/admin-portal/portal.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Link } from '../../../../shared/components/atoms/link/link';
import { Card } from '../../../../shared/components/molecules/card/card';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { FilterBar } from '../../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { partirTabla } from '../portal-labels';
import { portalUrl } from '../portal-nav';
import { pagedList } from '../support/paged-list';
import { plainText } from '../support/plain-text';
import { paramValue, patchQuery, queryParamsSignal } from '../support/route-query';

const PAGE_SIZE = 25;
const PAGE_ROUTE = portalUrl('catalog/domains');
const TABLES_ROUTE = portalUrl('catalog/tables');
const VIEWS = ['glosario', 'dominios'] as const;

/**
 * Dominios y glosario: los términos que usan la API y el frontend, con su
 * definición y de dónde sale, y los dominios de negocio en que se agrupan las
 * tablas. La búsqueda del glosario vive en la URL (`?q=`).
 */
@Component({
  selector: 'app-portal-domains-page',
  imports: [RouterLink, Link, Card, Tab, Tabs, DataTable, FilterBar, PageHeader],
  templateUrl: './domains-page.html',
  styleUrl: './domains-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DomainsPage {
  private readonly client = inject(PortalClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  private readonly params = queryParamsSignal(this.route);
  private readonly search = paramValue(this.params, 'q');
  private readonly view = paramValue(this.params, 'vista');
  protected readonly tabIndex = computed(() =>
    Math.max(0, VIEWS.indexOf(this.view() as (typeof VIEWS)[number])),
  );
  protected readonly tablesRoute = TABLES_ROUTE;

  protected readonly glossary = pagedList<TerminoGlosario>(
    (cursor) =>
      this.client.glossary({
        ...(this.search() ? { q: this.search() } : {}),
        ...(cursor ? { cursor } : {}),
        limit: PAGE_SIZE,
      }),
    () =>
      this.search()
        ? empty(
            { label: 'Ver todo el glosario', route: PAGE_ROUTE },
            `Ningún término coincide con «${this.search()}».`,
          )
        : empty(
            { label: 'Ver los dominios', route: PAGE_ROUTE, queryParams: { vista: 'dominios' } },
            'El glosario todavía no tiene términos.',
          ),
  );
  protected readonly domains = signal<ViewState<readonly LinajeDominio[]>>(loading());

  private readonly termCell =
    viewChild.required<TemplateRef<{ $implicit: TerminoGlosario }>>('termCell');
  private readonly definitionCell =
    viewChild.required<TemplateRef<{ $implicit: TerminoGlosario }>>('definitionCell');
  private readonly tablesCell =
    viewChild.required<TemplateRef<{ $implicit: TerminoGlosario }>>('tablesCell');
  private readonly domainCell =
    viewChild.required<TemplateRef<{ $implicit: LinajeDominio }>>('domainCell');

  protected readonly glossaryColumns = computed<readonly ColumnDef<TerminoGlosario>[]>(() => [
    { key: 'termino', header: 'Término', priority: 1, cell: this.termCell() },
    { key: 'definicion', header: 'Definición', priority: 1, cell: this.definitionCell() },
    { key: 'tablasRelacionadas', header: 'Tablas', priority: 3, cell: this.tablesCell() },
  ]);
  protected readonly domainColumns = computed<readonly ColumnDef<LinajeDominio>[]>(() => [
    { key: 'etiqueta', header: 'Dominio', priority: 1, cell: this.domainCell() },
    { key: 'tablas', header: 'Tablas', priority: 1, align: 'end' },
  ]);
  protected readonly plain = plainText;
  protected readonly byTerm = (row: TerminoGlosario): string => `${row.termino}|${row.fuente}`;
  protected readonly termName = (row: TerminoGlosario): string => row.termino;
  protected readonly byDomain = (row: LinajeDominio): string => row.id;
  protected readonly tableUrl = (qualified: string): string | null => {
    const parts = partirTabla(qualified);
    return parts
      ? `${TABLES_ROUTE}/${encodeURIComponent(parts.schema)}/${encodeURIComponent(parts.tabla)}`
      : null;
  };

  constructor() {
    this.loadDomains();
    effect(() => {
      this.search();
      untracked(() => this.glossary.restart());
    });
  }

  protected loadDomains(): void {
    this.domains.set(loading());
    this.client.lineage().subscribe({
      next: (l) =>
        this.domains.set(
          l.dominios.length === 0
            ? empty(
                { label: 'Ver las tablas', route: TABLES_ROUTE },
                'El linaje no agrupa las tablas en dominios todavía.',
              )
            : ready([...l.dominios].sort((a, b) => b.tablas - a.tablas)),
        ),
      error: (e: unknown) => this.domains.set(errorToViewState<readonly LinajeDominio[]>(e)),
    });
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { vista: index === 0 ? null : VIEWS[index]! });
  }
}

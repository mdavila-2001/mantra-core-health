import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, type TemplateRef } from '@angular/core';
import type { Observable } from 'rxjs';

import { ServicesGridClient } from '../../../core/data-access/admin-portal/services-grid.client';
import type {
  ServicesGridKind,
  ServicesGridPage,
  ServicesGridRow,
} from '../../../core/data-access/admin-portal/services-grid.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { emptyStateFor, SERVICES_GRID_TABS } from './services-grid-tabs';

type DataKind = Exclude<ServicesGridKind, 'hospital'>;

/**
 * Read-only grid of the service catalogs, one tab per provider kind. Each tab
 * loads on first visit; the empty (S3), partial (truncated list) and failure
 * states come from ViewState, never from ad-hoc flags. Hospital has no catalog
 * of its own, and the screen says so instead of faking a list.
 */
@Component({
  selector: 'app-services-grid',
  imports: [Alert, Badge, Card, DataTable, PageHeader, Tab, Tabs],
  templateUrl: './services-grid.html',
  styleUrl: './services-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesGrid {
  private readonly client = inject(ServicesGridClient);

  protected readonly tabs = SERVICES_GRID_TABS;
  protected readonly selected = signal(0);
  protected readonly states = signal<Partial<Record<DataKind, ViewState<ServicesGridPage>>>>({});
  private readonly statusCell = viewChild<TemplateRef<{ $implicit: ServicesGridRow }>>('statusCell');
  private readonly priceCell = viewChild<TemplateRef<{ $implicit: ServicesGridRow }>>('priceCell');

  protected readonly rowKey = (row: ServicesGridRow) => row.id;

  constructor() {
    this.load('doctor');
  }

  /** Called when the person changes tab: loads the tab the first time it is shown. */
  protected onTab(index: number): void {
    this.selected.set(index);
    const kind = this.tabs[index]?.kind;
    if (kind !== undefined && kind !== 'hospital' && this.states()[kind] === undefined) this.load(kind);
  }

  protected load(kind: DataKind): void {
    this.set(kind, loading());
    const source: Record<DataKind, () => Observable<ServicesGridPage>> = {
      doctor: () => this.client.doctor(),
      laboratory: () => this.client.laboratory(),
      pharmacy: () => this.client.pharmacy(),
    };
    source[kind]().subscribe({
      next: (page) => this.set(kind, page.rows.length === 0 ? emptyStateFor(kind) : ready(page)),
      error: (e: unknown) => this.set(kind, errorToViewState<ServicesGridPage>(e)),
    });
  }

  /** Table state for a kind: the page becomes its rows; every other state passes through. */
  protected rowsOf(kind: ServicesGridKind): ViewState<readonly ServicesGridRow[]> {
    const state = kind === 'hospital' ? undefined : this.states()[kind];
    if (state === undefined) return loading();
    if (state.status !== 'ready') return state as ViewState<readonly ServicesGridRow[]>;
    return ready(state.data.rows);
  }

  /** Partial (S3-adjacent): the API returned a truncated page. */
  protected isPartial(kind: ServicesGridKind): boolean {
    const state = kind === 'hospital' ? undefined : this.states()[kind];
    return state?.status === 'ready' && state.data.truncated;
  }

  protected columnsOf(index: number): readonly ColumnDef<ServicesGridRow>[] {
    const tab = this.tabs[index]!;
    return [
      { key: 'code', header: tab.codeHeader, priority: 1 },
      { key: 'name', header: 'Nombre', priority: 1 },
      { key: 'group', header: tab.groupHeader, priority: 2 },
      ...(tab.hasPrice ? [{ key: 'price', header: 'Precio', priority: 2, align: 'end' as const, cell: this.priceCell() }] : []),
      { key: 'statusLabel', header: 'Estado', priority: 1, cell: this.statusCell() },
    ];
  }

  protected readonly selectedKind = computed(() => this.tabs[this.selected()]!.kind);

  private set(kind: DataKind, state: ViewState<ServicesGridPage>): void {
    this.states.update((all) => ({ ...all, [kind]: state }));
  }
}

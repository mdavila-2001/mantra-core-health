import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  viewChild,
  type TemplateRef,
} from '@angular/core';

import type { LabService } from '../../../../core/data-access/lab-portal/lab-portal.types';
import { dataOf, mapData } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Input } from '../../../../shared/components/atoms/input/input';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type {
  ColumnDef,
  CursorState,
} from '../../../../shared/components/organisms/data-table/data-table.types';
import type { PriceEdits } from '../price-edits';

/** Panels (with their components) per page. */
const PAGE_SIZE = 10;
type Cell = TemplateRef<{ $implicit: LabService }>;
interface CellEdit { readonly service: LabService; readonly value: string | number | null }

/**
 * The editable price table: one row per service, a panel followed by its
 * components. Presentational: the edits object and the rows come from the
 * container, which loads and saves.
 */
@Component({
  selector: 'app-lab-prices-table',
  imports: [Badge, DataTable, Input],
  templateUrl: './lab-prices-table.html',
  styleUrl: './lab-prices-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabPricesTable {
  readonly rows = input.required<ViewState<readonly LabService[]>>();
  /** Read-only here: the container applies `priceChanged`/`discountChanged`. */
  readonly edits = input.required<PriceEdits>();
  /** Service name by id, to say which panel a component belongs to. */
  readonly names = input.required<ReadonlyMap<string, string>>();
  readonly retry = output<void>();
  readonly priceChanged = output<CellEdit>();
  readonly discountChanged = output<CellEdit>();

  /** Back to the first page whenever the rows change (search, reload). */
  protected readonly offset = linkedSignal({ source: this.rows, computation: () => 0 });

  /** Pages count panels, not rows: a hemogram never loses its parts to the next page. */
  private readonly groups = computed(() => {
    const out: LabService[][] = [];
    for (const service of dataOf(this.rows()) ?? []) {
      const last = out.at(-1);
      if (service.parentId !== null && last?.[0]?.id === service.parentId) last.push(service);
      else out.push([service]);
    }
    return out;
  });

  protected readonly pageRows = computed(() =>
    mapData(this.rows(), () =>
      this.groups()
        .slice(this.offset(), this.offset() + PAGE_SIZE)
        .flat(),
    ),
  );

  protected readonly cursor = computed<CursorState>(() => {
    const total = this.groups().length;
    return {
      prevCursor: this.offset() > 0 ? String(Math.max(0, this.offset() - PAGE_SIZE)) : null,
      nextCursor: this.offset() + PAGE_SIZE < total ? String(this.offset() + PAGE_SIZE) : null,
    };
  });

  private readonly nameCell = viewChild.required<Cell>('nameCell');
  private readonly priceCell = viewChild.required<Cell>('priceCell');
  private readonly discountCell = viewChild.required<Cell>('discountCell');
  private readonly alovidaCell = viewChild.required<Cell>('alovidaCell');
  private readonly statusCell = viewChild.required<Cell>('statusCell');

  protected readonly columns = computed<readonly ColumnDef<LabService>[]>(() => [
    { key: 'name', header: 'Servicio', priority: 1, cell: this.nameCell() },
    { key: 'price', header: 'Precio de lista (Bs)', priority: 1, cell: this.priceCell() },
    { key: 'discount', header: 'Descuento AloVida (%)', priority: 2, cell: this.discountCell() },
    { key: 'alovida', header: 'Precio AloVida', priority: 2, cell: this.alovidaCell() },
    { key: 'status', header: 'En la vitrina', priority: 3, cell: this.statusCell() },
  ]);

  protected readonly rowId = (service: LabService): string => service.id;
  protected readonly rowLabel = (service: LabService): string => service.name;
  protected readonly panelName = (service: LabService): string | null =>
    service.parentId === null ? null : (this.names().get(service.parentId) ?? null);

  protected goToCursor(cursor: string): void {
    this.offset.set(Math.max(0, Number(cursor) || 0));
  }
}

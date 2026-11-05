import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  viewChild,
  type TemplateRef,
} from '@angular/core';

import type { LabService } from '../../../../core/data-access/lab-portal/lab-portal.types';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Input } from '../../../../shared/components/atoms/input/input';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type {
  ColumnDef,
  CursorState,
} from '../../../../shared/components/organisms/data-table/data-table.types';
import { alovidaPreview, discountText, type PriceEdits } from '../laboratory-prices.rules';

/** One box of one row, as typed. */
export interface RowEdit {
  readonly service: LabService;
  readonly value: string;
}

type Cell = TemplateRef<{ $implicit: LabService }>;

/**
 * The editable price table: list price and AloVida discount per service, with
 * the AloVida price previewed while typing. It owns no state: what was typed
 * and what the API refused come in as inputs, every keystroke goes out.
 */
@Component({
  selector: 'app-lab-price-table',
  imports: [Badge, DataTable, Input],
  templateUrl: './lab-price-table.html',
  styleUrl: './lab-price-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabPriceTable {
  readonly state = input.required<ViewState<readonly LabService[]>>();
  readonly edits = input<PriceEdits>({});
  /** Reason per service id of the rows the last save refused. */
  readonly rejected = input<Readonly<Record<string, string>>>({});
  readonly cursor = input<CursorState>({});

  readonly priceChanged = output<RowEdit>();
  readonly discountChanged = output<RowEdit>();
  readonly cursorChanged = output<string>();
  readonly reload = output<void>();

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

  protected priceOf(service: LabService): string {
    return this.edits()[service.id]?.price ?? service.price ?? '';
  }

  protected discountOf(service: LabService): string {
    return this.edits()[service.id]?.discount ?? discountText(service);
  }

  protected previewOf(service: LabService): string | null | 'invalid' {
    return alovidaPreview(service, this.edits()[service.id]);
  }

  protected isEdited(service: LabService): boolean {
    return this.edits()[service.id] !== undefined;
  }

  protected rejectionOf(service: LabService): string | null {
    return this.rejected()[service.id] ?? null;
  }

  protected emit(target: 'price' | 'discount', service: LabService, value: string | number | null): void {
    const edit = { service, value: value === null ? '' : String(value) };
    (target === 'price' ? this.priceChanged : this.discountChanged).emit(edit);
  }
}

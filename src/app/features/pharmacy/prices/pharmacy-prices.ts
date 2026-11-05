import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import type { PharmacyProduct } from '../../../core/data-access/pharmacy/pharmacy.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { withDisplayCurrency } from '../../../core/money/display-currency';
import { dataOf, empty, loading, mapData, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { RowActions } from '../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type {
  ColumnDef,
  CursorState,
  SortState,
} from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { CsvExportService, type CsvColumn } from '../../../shared/utils/csv-export/csv-export';

import { sortRows } from '../catalog/catalog-sort';
import { ENTITY_COLUMNS } from '../import/entity-import/entity-csv';
import { pharmacyErrorMessage } from '../pharmacy-error-message';
import { PharmacyScope, providePharmacyScope } from '../pharmacy-scope';
import { PRODUCT_SORT_ACCESSORS, productName, productStatus } from '../products/product-view';
import { PriceDialog } from './price-dialog/price-dialog';

/** Tope del listado: el máximo que acepta `GET /pharmacy/products`. */
const LIST_LIMIT = 500;
/** Filas por página: con filas compactas, las que entran en una pantalla. */
const PAGE_SIZE = 25;

const EDIT: RowAction = { code: 'edit', label: 'Editar', icon: 'edit' };
const CLEAR: RowAction = { code: 'clear', label: 'Quitar precio', icon: 'remove', destructive: true };

/**
 * Pharmacy **Prices**: the selling price of every loaded product.
 *
 * It is the price patients see in the showcase and in «dónde comprar la
 * receta». Each row has its actions: «Editar» opens {@link PriceDialog}
 * (Save / Cancel) and «Quitar precio» clears it after confirming. Both save
 * through `PATCH /pharmacies/:id/products/:productId` and re-read the table
 * from the API. Bulk changes go through the prices CSV.
 *
 * Without a price the product stays published, but the showcase does not show
 * what it costs. Withdrawn products are not listed.
 */
@Component({
  selector: 'app-pharmacy-prices',
  imports: [
    Alert,
    AppButton,
    Badge,
    DataTable,
    FormField,
    PageHeader,
    PriceDialog,
    RowActions,
    SearchField,
    Select,
    ViewStateHost,
  ],
  providers: [providePharmacyScope()],
  templateUrl: './pharmacy-prices.html',
  styleUrl: './pharmacy-prices.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyPrices {
  /** Montada como pestaña de «Catálogo»: el membrete lo pone el contenedor. */
  readonly embedded = input(false, { transform: booleanAttribute });

  protected readonly scope = inject(PharmacyScope);
  private readonly pharmacy = inject(PharmacyClient);
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(DialogService);
  private readonly csv = inject(CsvExportService);

  protected readonly products = signal<ViewState<readonly PharmacyProduct[]>>(loading());
  /** La API cortó el listado en 500: lo que no entró no se ve ni se exporta. */
  protected readonly truncated = signal(false);
  protected readonly sort = signal<SortState | null>(null);
  protected readonly term = signal('');
  protected readonly offset = signal(0);
  /** Product whose price is being edited in the modal; `null` while closed. */
  protected readonly editing = signal<PharmacyProduct | null>(null);
  /** Rows with a «Quitar precio» request in flight. */
  protected readonly busy = signal<ReadonlySet<string>>(new Set());

  private readonly visible = computed<ViewState<readonly PharmacyProduct[]>>(() => {
    const state = this.products();
    if (state.status !== 'ready') {
      return state;
    }
    const term = this.term().trim().toLocaleLowerCase('es');
    const list = state.data.filter(
      (product) =>
        term === '' ||
        [product.brandName, product.genericName, product.productCode].some((text) =>
          (text ?? '').toLocaleLowerCase('es').includes(term),
        ),
    );
    return list.length > 0
      ? ready(sortRows(list, this.sort(), PRODUCT_SORT_ACCESSORS))
      : empty({ label: 'Pruebe con otra palabra' }, `Nada coincide con «${this.term().trim()}».`);
  });

  protected readonly pageRows = computed<ViewState<readonly PharmacyProduct[]>>(() =>
    mapData(this.visible(), (list) => list.slice(this.offset(), this.offset() + PAGE_SIZE)),
  );

  protected readonly cursor = computed<CursorState>(() => {
    const total = dataOf(this.visible())?.length ?? 0;
    return {
      prevCursor: this.offset() > 0 ? String(Math.max(0, this.offset() - PAGE_SIZE)) : null,
      nextCursor: this.offset() + PAGE_SIZE < total ? String(this.offset() + PAGE_SIZE) : null,
    };
  });

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('nameCell');
  private readonly currentCell =
    viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('currentCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('statusCell');
  private readonly actionsCell =
    viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('actionsCell');

  protected readonly columns = computed<readonly ColumnDef<PharmacyProduct>[]>(() => [
    { key: 'name', header: 'Producto', priority: 1, sortable: true, cell: this.nameCell() },
    { key: 'current', header: 'Precio publicado', priority: 2, sortable: true, cell: this.currentCell() },
    { key: 'status', header: 'En la vitrina', priority: 3, sortable: true, cell: this.statusCell() },
    { key: 'actions', header: 'Acciones', priority: 1, align: 'end', sticky: 'end', cell: this.actionsCell() },
  ]);

  protected readonly rowId = (product: PharmacyProduct): string => product.id;
  protected readonly rowLabel = (product: PharmacyProduct): string => productName(product);
  protected readonly name = productName;
  protected readonly status = productStatus;

  constructor() {
    effect(() => {
      if (this.scope.pharmacyId() !== null) {
        untracked(() => this.reload());
      }
    });
  }

  /**
   * Reads the catalog. `keepPage` (after a row action) keeps the current page
   * and the table on screen while it re-reads, instead of jumping to page 1.
   */
  protected reload(keepPage = false): void {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null) {
      return;
    }
    if (!keepPage) {
      this.products.set(loading());
      this.truncated.set(false);
      this.offset.set(0);
    }
    this.pharmacy.searchProducts({ pharmacyId, managed: true, limit: LIST_LIMIT }).subscribe({
      next: (page) => {
        this.truncated.set(page.truncated);
        const alive = page.items.filter((product) => productStatus(product) !== 'WITHDRAWN');
        this.offset.update((offset) => (offset < alive.length ? offset : 0));
        this.products.set(
          alive.length > 0
            ? ready(alive)
            : empty(
                { label: 'Cargue productos en «Productos»', route: '/administration/pharmacy-catalog' },
                'Todavía no hay productos a los que ponerles precio.',
              ),
        );
      },
      error: (error: unknown) =>
        this.products.set(errorToViewState<readonly PharmacyProduct[]>(error)),
    });
  }

  protected goToCursor(cursor: string): void {
    this.offset.set(Math.max(0, Number(cursor) || 0));
  }

  protected search(term: string): void {
    this.term.set(term);
    this.offset.set(0);
  }

  protected sortBy(sort: SortState): void {
    this.sort.set(sort);
    this.offset.set(0);
  }

  /**
   * Descarga los precios publicados de lo que la búsqueda deja a la vista, con
   * los encabezados de la importación de precios: se corrige en una planilla y
   * se vuelve a subir con «Importar CSV».
   */
  protected exportCsv(): void {
    const [code, price] = ENTITY_COLUMNS.prices;
    const columns: CsvColumn<PharmacyProduct>[] = [
      { header: code!.header, value: (product) => product.productCode },
      { header: price!.header, value: (product) => product.unitPrice ?? '' },
    ];
    this.csv.download(dataOf(this.visible()) ?? [], columns, 'precios-de-la-farmacia.csv');
  }

  /* ─── Acciones de la fila ────────────────────────────────────────────── */

  protected actionsOf(product: PharmacyProduct): readonly RowAction[] {
    return product.unitPrice ? [EDIT, CLEAR] : [EDIT];
  }

  protected publishedPrice(product: PharmacyProduct): string | null {
    return product.unitPrice ? withDisplayCurrency(product.unitPrice) : null;
  }

  protected async onRowAction(code: string, product: PharmacyProduct): Promise<void> {
    if (code === EDIT.code) {
      this.editing.set(product);
      return;
    }
    if (code === CLEAR.code) {
      await this.clearPrice(product);
    }
  }

  /** The modal saved: close it and re-read the table from the API. */
  protected onSaved(): void {
    this.editing.set(null);
    this.reload(true);
  }

  private async clearPrice(product: PharmacyProduct): Promise<void> {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null) {
      return;
    }
    const confirmed = await this.dialogs.confirm({
      title: '¿Quitar el precio?',
      message: `«${productName(product)}» sigue publicado, pero la vitrina deja de mostrar cuánto cuesta.`,
      confirmLabel: 'Quitar precio',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    const release = (): void => this.busy.update((set) => new Set([...set].filter((id) => id !== product.id)));
    this.busy.update((set) => new Set(set).add(product.id));
    this.pharmacy.updateProduct(pharmacyId, product.id, { unitPrice: null }).subscribe({
      next: () => {
        release();
        this.toasts.success(`Quitó el precio de «${productName(product)}».`);
        this.reload(true);
      },
      error: (error: unknown) => {
        release();
        this.toasts.error(pharmacyErrorMessage(error, 'No se pudo quitar el precio.'));
      },
    });
  }
}

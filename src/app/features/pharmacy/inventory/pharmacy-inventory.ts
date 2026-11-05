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
import { ActivatedRoute } from '@angular/router';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Select } from '../../../shared/components/atoms/select/select';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { RowActions } from '../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type {
  ColumnDef,
  CursorState,
  SortState,
} from '../../../shared/components/organisms/data-table/data-table.types';
import { CsvExportService, type CsvColumn } from '../../../shared/utils/csv-export/csv-export';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import type { PharmacyProduct } from '../../../core/data-access/pharmacy/pharmacy.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, mapData, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

import { sortRows } from '../catalog/catalog-sort';
import { pharmacyErrorMessage } from '../pharmacy-error-message';
import { PharmacyScope, providePharmacyScope } from '../pharmacy-scope';
import { PRODUCT_SORT_ACCESSORS, productName, productStatus } from '../products/product-view';
import { INVENTORY_CSV_HEADERS, INVENTORY_DEFAULT_MINIMUM, inventoryCsvRows, type InventoryCsvRow } from './inventory-csv';
import { InventoryDialog, type InventoryView } from './inventory-dialog/inventory-dialog';
import { InventoryUploadDialog } from './upload-dialog/inventory-upload-dialog';
import { ALL_SITES, InventorySites } from './site-stock/inventory-sites';
import { SiteStockPanel } from './site-stock/site-stock-panel';
import { joinNames } from './site-stock/site-stock-rows';

/** Tope del listado: el máximo que acepta `GET /pharmacy/products`. */
const LIST_LIMIT = 500;
/** Filas por página: con filas compactas, las que entran en una pantalla. */
const PAGE_SIZE = 25;
/** Umbral que el servidor asume mientras la farmacia no fije el suyo. */
const DEFAULT_MINIMUM = INVENTORY_DEFAULT_MINIMUM;

const EDIT: RowAction = { code: 'edit', label: 'Editar', icon: 'edit' };
const EMPTY_STOCK: RowAction = { code: 'empty', label: 'Vaciar', icon: 'remove', destructive: true };

const VIEW_OPTIONS: readonly SegmentedOption<InventoryView>[] = [
  { value: 'COUNT', label: 'Con cantidades', description: 'Existencias y umbral de alerta de cada producto' },
  { value: 'AVAILABILITY', label: 'Hay / no hay', description: 'Sólo si lo tiene o no, sin contar unidades' },
];

/** Dónde se recuerda la forma elegida: es una preferencia de la persona, no un dato. */
const VIEW_STORAGE_KEY = 'mch.pharmacy.inventory.view';

function storedView(): InventoryView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'AVAILABILITY' ? 'AVAILABILITY' : 'COUNT';
  } catch {
    // Sin almacenamiento (SSR, ventana privada): arranca con cantidades.
    return 'COUNT';
  }
}

/**
 * Pharmacy **Inventory**: stock and alert threshold of each product, or only
 * «hay / no hay».
 *
 * - Availability is derived: in stock when the quantity is above zero. It is
 *   the same signal patients see in the showcase.
 * - An alert is «out of stock» or «stock at or below the threshold».
 * - Each row has its actions: «Editar» opens {@link InventoryDialog}
 *   (Save / Cancel) and «Vaciar» empties the product after confirming. Both
 *   save through `PATCH /pharmacies/:id/inventory` and re-read the table.
 *   Bulk changes go through «Subir CSV».
 *
 * Los retirados no aparecen: no se venden, no tienen inventario que llevar.
 *
 * «Sucursal» (FAR-06): con «Todas», esta tabla de lo declarado en el catálogo;
 * con una sede, su propio stock (`app-site-stock-panel`). Una sede que lleva su
 * propio stock ya no lee lo de «Todas», y la pantalla lo dice.
 */
@Component({
  selector: 'app-pharmacy-inventory',
  imports: [
    Alert,
    AppButton,
    Badge,
    DataTable,
    FormField,
    InventoryDialog,
    PageHeader,
    InventoryUploadDialog,
    RowActions,
    SearchField,
    SegmentedControl,
    Select,
    SiteStockPanel,
    Switch,
    ViewStateHost,
  ],
  providers: [providePharmacyScope(), InventorySites],
  templateUrl: './pharmacy-inventory.html',
  styleUrl: './pharmacy-inventory.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyInventory {
  /** Montada como pestaña de «Catálogo»: el membrete lo pone el contenedor. */
  readonly embedded = input(false, { transform: booleanAttribute });

  protected readonly scope = inject(PharmacyScope);
  private readonly pharmacy = inject(PharmacyClient);
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly csv = inject(CsvExportService);
  protected readonly sites = inject(InventorySites);
  private readonly sitePanel = viewChild(SiteStockPanel);

  protected readonly allSites = ALL_SITES;
  /** La sucursal elegida, o «Todas». */
  protected readonly site = signal<string>(ALL_SITES);

  /** Con «Todas»: qué sedes tienen productos que ya no leen lo que se cambie acá. */
  protected readonly ledgerNotice = computed(() => {
    const names = this.sites.ledgerNames();
    if (names.length === 0) {
      return '';
    }
    const one = names.length === 1;
    return `${joinNames(names)} ${one ? 'tiene' : 'tienen'} stock propio en algunos productos: en esos, lo que cambie en "Todas" no ${one ? 'la' : 'las'} afecta, tampoco lo que suba por CSV.`;
  });

  protected readonly products = signal<ViewState<readonly PharmacyProduct[]>>(loading());
  /** La API cortó el listado en 500: las alertas y el CSV ven sólo esos. */
  protected readonly truncated = signal(false);
  protected readonly sort = signal<SortState | null>(null);
  protected readonly viewOptions = VIEW_OPTIONS;
  /** Cómo se lleva el inventario: cantidades o sólo hay / no hay. */
  protected readonly view = signal<InventoryView>(storedView());
  /** Product being edited in the modal; `null` while closed. */
  protected readonly editing = signal<PharmacyProduct | null>(null);
  /** Rows with a «Vaciar» request in flight. */
  protected readonly busy = signal<ReadonlySet<string>>(new Set());
  protected readonly uploadOpen = signal(false);
  /** Lo que se buscó por nombre o código. */
  protected readonly term = signal('');
  protected readonly onlyAlerts = signal(this.route.snapshot.queryParamMap.get('alerts') === 'true');
  protected readonly offset = signal(0);

  /** Todo el catálogo vivo leído, sin filtrar; vacío mientras carga. */
  protected readonly allProducts = computed(() => dataOf(this.products()) ?? []);

  /** The CSV is checked against the table: only once the table is loaded. */
  protected readonly canUseCsv = computed(() => this.products().status === 'ready');

  private readonly visible = computed<ViewState<readonly PharmacyProduct[]>>(() => {
    const state = this.products();
    if (state.status !== 'ready') {
      return state;
    }
    const term = this.term().trim().toLocaleLowerCase('es');
    const list = state.data
      .filter((product) => !this.onlyAlerts() || this.isAlert(product))
      .filter(
        (product) =>
          term === '' ||
          [product.brandName, product.genericName, product.productCode].some((text) =>
            (text ?? '').toLocaleLowerCase('es').includes(term),
          ),
      );
    if (list.length > 0) {
      return ready(sortRows(list, this.sort(), PRODUCT_SORT_ACCESSORS));
    }
    return term !== ''
      ? empty({ label: 'Pruebe con otra palabra' }, `Nada coincide con «${this.term().trim()}».`)
      : empty({ label: 'Mostrar todo el inventario' }, 'Ningún producto está en alerta.');
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
  private readonly stockCell = viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('stockCell');
  private readonly minimumCell = viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('minimumCell');
  private readonly hasCell = viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('hasCell');
  private readonly availabilityCell = viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('availabilityCell');
  private readonly actionsCell = viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('actionsCell');

  protected readonly columns = computed<readonly ColumnDef<PharmacyProduct>[]>(() =>
    this.view() === 'AVAILABILITY'
      ? [
          { key: 'name', header: 'Producto', priority: 1, sortable: true, cell: this.nameCell() },
          { key: 'has', header: '¿Lo tiene?', priority: 1, cell: this.hasCell() },
          this.actionsColumn(),
        ]
      : [
          { key: 'name', header: 'Producto', priority: 1, sortable: true, cell: this.nameCell() },
          { key: 'stock', header: 'Existencias', priority: 1, sortable: true, cell: this.stockCell() },
          { key: 'minimum', header: 'Umbral de alerta', priority: 1, cell: this.minimumCell() },
          { key: 'availability', header: 'Disponibilidad', priority: 2, cell: this.availabilityCell() },
          this.actionsColumn(),
        ],
  );

  private actionsColumn(): ColumnDef<PharmacyProduct> {
    return { key: 'actions', header: 'Acciones', priority: 1, align: 'end', sticky: 'end', cell: this.actionsCell() };
  }

  protected readonly rowId = (product: PharmacyProduct): string => product.id;
  protected readonly rowLabel = (product: PharmacyProduct): string => productName(product);
  protected readonly name = productName;
  protected readonly defaultMinimum = DEFAULT_MINIMUM;

  constructor() {
    effect(() => {
      const pharmacyId = this.scope.pharmacyId();
      if (pharmacyId !== null) {
        untracked(() => {
          this.site.set(ALL_SITES);
          this.sites.load(pharmacyId);
          this.reload();
        });
      }
    });
  }

  protected chooseSite(siteId: string | null): void {
    this.site.set(siteId ?? ALL_SITES);
  }

  protected retrySites(): void {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId !== null) {
      this.sites.load(pharmacyId);
    }
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
            : empty({ label: 'Cargue productos en «Productos»' }, 'Todavía no hay productos con inventario.'),
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

  protected toggleAlerts(only: boolean): void {
    this.onlyAlerts.set(only);
    this.offset.set(0);
  }

  protected setView(view: InventoryView): void {
    this.view.set(view);
    this.offset.set(0);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // No se pudo recordar: la pantalla funciona igual.
    }
  }

  /** El texto del filtro de alertas, según cómo se lleva el inventario. */
  protected readonly alertsLabel = computed(() =>
    this.view() === 'AVAILABILITY' ? 'Sólo los que no tengo' : 'Sólo con alertas',
  );

  /** Out of stock, or stock at or below the threshold. */
  protected isAlert(product: PharmacyProduct): boolean {
    if (this.view() === 'AVAILABILITY' || product.stock === null || product.stock === undefined) {
      // Uncounted (the pharmacy only says whether it has it): alert only when it said no.
      return product.inStock === false;
    }
    return product.stock <= 0 || product.stock <= (product.minStock ?? DEFAULT_MINIMUM);
  }

  protected hasStock(product: PharmacyProduct): boolean {
    return product.stock === null || product.stock === undefined ? product.inStock !== false : product.stock > 0;
  }

  /** Whether the row counts as in stock in the current view: «hay / no hay» reads only the flag. */
  private hasNow(product: PharmacyProduct): boolean {
    return this.view() === 'AVAILABILITY' ? product.inStock !== false : this.hasStock(product);
  }

  /* ─── Acciones de la fila ────────────────────────────────────────────── */

  protected actionsOf(product: PharmacyProduct): readonly RowAction[] {
    return this.hasNow(product) ? [EDIT, EMPTY_STOCK] : [EDIT];
  }

  protected async onRowAction(code: string, product: PharmacyProduct): Promise<void> {
    // The «stock propio» notice only matters when changing something in «Todas»: read the sites then.
    this.sites.ensureModes();
    if (code === EDIT.code) {
      this.editing.set(product);
      return;
    }
    if (code === EMPTY_STOCK.code) {
      await this.emptyStock(product);
    }
  }

  /** The modal saved: close it and re-read the table from the API. */
  protected onSaved(): void {
    this.editing.set(null);
    this.reload(true);
  }

  /**
   * «Vaciar» follows the view: with quantities a counted product goes to 0;
   * in «hay / no hay», or without a count, it becomes «no hay» and keeps its count.
   */
  private async emptyStock(product: PharmacyProduct): Promise<void> {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null) {
      return;
    }
    const counted = this.view() === 'COUNT' && product.stock !== null && product.stock !== undefined;
    const confirmed = await this.dialogs.confirm({
      title: '¿Vaciar el inventario?',
      message: [
        `«${productName(product)}» queda ${counted ? 'con 0 existencias' : 'como «no hay»'} y deja de ofrecerse a los pacientes.`,
        this.ledgerNotice(),
      ]
        .filter(Boolean)
        .join(' '),
      confirmLabel: 'Vaciar',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    const release = (): void => this.busy.update((set) => new Set([...set].filter((id) => id !== product.id)));
    this.busy.update((set) => new Set(set).add(product.id));
    const line = counted ? { productId: product.id, stock: 0 } : { productId: product.id, inStock: false };
    this.pharmacy.updateInventory(pharmacyId, [line]).subscribe({
      next: () => {
        release();
        this.toasts.success(`Vació el inventario de «${productName(product)}».`);
        this.reload(true);
      },
      error: (error: unknown) => {
        release();
        this.toasts.error(pharmacyErrorMessage(error, 'No se pudo vaciar el inventario.'));
      },
    });
  }

  /* ─── CSV ─────────────────────────────────────────────────────────────── */

  /**
   * Descarga el inventario tal como está, con los encabezados que la carga
   * entiende: se corrige en una planilla y se sube de nuevo.
   */
  protected exportCsv(): void {
    const columns: CsvColumn<InventoryCsvRow>[] = [
      { header: INVENTORY_CSV_HEADERS.code, value: (row) => row.code },
      { header: INVENTORY_CSV_HEADERS.name, value: (row) => row.name },
      { header: INVENTORY_CSV_HEADERS.stock, value: (row) => row.stock },
      { header: INVENTORY_CSV_HEADERS.minimum, value: (row) => row.minimum },
      { header: INVENTORY_CSV_HEADERS.available, value: (row) => row.available },
    ];
    this.csv.download(inventoryCsvRows(dataOf(this.products()) ?? []), columns, 'inventario-de-la-farmacia.csv');
  }

  /** Tras una subida: se relee el catálogo y, con una sucursal elegida, su stock. */
  protected uploadApplied(): void {
    this.reload();
    this.sitePanel()?.refresh();
  }

  protected openUpload(): void {
    this.sites.ensureModes();
    this.uploadOpen.set(true);
  }

  protected closeUpload(): void {
    this.uploadOpen.set(false);
  }
}

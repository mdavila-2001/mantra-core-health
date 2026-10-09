import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
  type WritableSignal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { concatMap, from, toArray, type Observable, type Subscription } from 'rxjs';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { RowActions } from '../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef, CursorState } from '../../../shared/components/organisms/data-table/data-table.types';
import { FilterBar, type FilterDef } from '../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { CsvExportService, type CsvColumn } from '../../../shared/utils/csv-export/csv-export';

import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import type {
  PharmacyProduct,
  PharmacyProductStatus,
} from '../../../core/data-access/pharmacy/pharmacy.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, mapData, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

import { CSV_COLUMNS } from '../catalog-rules/catalog.rules';
import { pharmacyErrorMessage } from '../pharmacy-error-message';
import { PharmacyScope } from '../pharmacy-scope';
import { ProductDialog } from './product-dialog/product-dialog';
import {
  PRODUCT_STATUS_LABEL,
  isLowStock,
  productName,
  productPresentation,
  productStatus,
} from './product-view';

/** Tope del listado: el máximo que acepta `GET /pharmacy/products`. */
const LIST_LIMIT = 500;
/** Filas por página. */
const PAGE_SIZE = 10;

/** Los filtros del listado, tal como viajan en la URL. */
interface ProductFilters {
  readonly q: string;
  readonly status: string;
  readonly category: string;
  readonly availability: string;
  readonly prescription: string;
}

const STATUS_OPTIONS: readonly SelectOption<string>[] = [
  { value: 'PUBLISHED', label: PRODUCT_STATUS_LABEL.PUBLISHED },
  { value: 'DRAFT', label: PRODUCT_STATUS_LABEL.DRAFT },
  { value: 'WITHDRAWN', label: PRODUCT_STATUS_LABEL.WITHDRAWN },
];

const AVAILABILITY_OPTIONS: readonly SelectOption<string>[] = [
  { value: 'IN', label: 'Disponible' },
  { value: 'OUT', label: 'Sin stock' },
];

const PRESCRIPTION_OPTIONS: readonly SelectOption<string>[] = [
  { value: 'RX', label: 'Bajo receta' },
  { value: 'OTC', label: 'Venta libre' },
];

/** Las acciones de una fila, según su estado. */
function rowActionsOf(product: PharmacyProduct): readonly RowAction[] {
  const status = productStatus(product);
  return [
    { code: 'edit', label: 'Editar', icon: 'edit' },
    ...(status === 'PUBLISHED'
      ? [
          product.inStock === false
            ? { code: 'in-stock', label: 'Marcar disponible', icon: 'check' }
            : { code: 'out-of-stock', label: 'Marcar sin stock', icon: 'package' },
        ]
      : [{ code: 'publish', label: 'Publicar', icon: 'check' }]),
    ...(status === 'WITHDRAWN'
      ? []
      : [{ code: 'withdraw', label: 'Retirar', icon: 'remove', destructive: true }]),
  ] as readonly RowAction[];
}

/**
 * **Productos** de la farmacia: el catálogo completo —publicados, borradores y
 * retirados— como listado con filtros, y el alta y la edición en un modal con
 * pestañas ({@link ProductDialog}).
 *
 * ## Contra qué habla
 *
 * - Lectura: `GET /pharmacy/products?pharmacyId=&managed=true` (P47, sólo
 *   simulador: `managed` trae también borradores y retirados). Se relee entera
 *   —hasta 500— y **se filtra y se pagina acá**: el catálogo de una farmacia
 *   entra en memoria, y así cambiar un filtro no cuesta una petición.
 * - Alta y edición: las hace el modal. Al guardar el listado se relee: la
 *   prueba es la lista, no el aviso.
 * - Publicar en lote: `PATCH` por producto, **en serie** (P47). Retirar en
 *   lote: `DELETE` por producto, también en serie.
 *
 * ## Filtros en la URL
 *
 * Búsqueda, estado, categoría, disponibilidad y receta viven en la URL
 * (`app-filter-bar`), así que un enlace del resumen —«completar borradores»—
 * llega ya filtrado.
 *
 * ## Paginación
 *
 * Por cursor, como exige el M34: el cursor es la posición de la página en la
 * lista ya filtrada. No hay números de página ni total.
 */
@Component({
  selector: 'app-pharmacy-products',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    DataTable,
    DecimalPipe,
    FilterBar,
    FormField,
    PageHeader,
    ProductDialog,
    RowActions,
    Select,
    ViewStateHost,
  ],
  providers: [PharmacyScope],
  templateUrl: './pharmacy-products.html',
  styleUrl: './pharmacy-products.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyProducts {
  protected readonly scope = inject(PharmacyScope);
  private readonly pharmacy = inject(PharmacyClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly csv = inject(CsvExportService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Todo el catálogo de la farmacia elegida, sin filtrar. */
  protected readonly products = signal<ViewState<readonly PharmacyProduct[]>>(loading());
  protected readonly truncated = signal(false);
  protected readonly categoryNames = signal<readonly string[]>([]);
  private listing: Subscription | null = null;
  private query = 0;

  private readonly params = toSignal(
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)),
    { initialValue: {} as Record<string, string> },
  );

  protected readonly filters = computed<ProductFilters>(() => {
    const params = this.params();
    return {
      q: params['q'] ?? '',
      status: params['status'] ?? '',
      category: params['category'] ?? '',
      availability: params['availability'] ?? '',
      prescription: params['prescription'] ?? '',
    };
  });

  protected readonly filterDefs = computed<readonly FilterDef[]>(() => [
    { key: 'status', label: 'Estado', options: STATUS_OPTIONS },
    {
      key: 'category',
      label: 'Categoría',
      options: this.categoryNames().map((name) => ({ value: name, label: name })),
      unavailableReason: 'Todavía no hay categorías.',
    },
    { key: 'availability', label: 'Disponibilidad', options: AVAILABILITY_OPTIONS },
    { key: 'prescription', label: 'Receta', options: PRESCRIPTION_OPTIONS },
  ]);

  private readonly filtered = computed<ViewState<readonly PharmacyProduct[]>>(() => {
    const state = this.products();
    if (state.status !== 'ready') {
      return state;
    }
    const filters = this.filters();
    const term = filters.q.trim().toLocaleLowerCase('es');
    const list = state.data.filter((product) => matches(product, filters, term));
    if (list.length > 0 || state.data.length === 0) {
      return ready(list);
    }
    return empty(
      { label: 'Quite algún filtro', route: this.router.url.split('?')[0] },
      'Ningún producto coincide con estos filtros.',
    );
  });

  protected readonly totalFiltered = computed(() => dataOf(this.filtered())?.length ?? 0);

  /** La posición de la página visible en la lista filtrada; vuelve a 0 al cambiar un filtro. */
  protected readonly offset: WritableSignal<number> = linkedSignal({
    source: this.filters,
    computation: () => 0,
  });

  protected readonly pageRows = computed<ViewState<readonly PharmacyProduct[]>>(() =>
    mapData(this.filtered(), (list) => list.slice(this.offset(), this.offset() + PAGE_SIZE)),
  );

  protected readonly cursor = computed<CursorState>(() => ({
    prevCursor: this.offset() > 0 ? String(Math.max(0, this.offset() - PAGE_SIZE)) : null,
    nextCursor: this.offset() + PAGE_SIZE < this.totalFiltered() ? String(this.offset() + PAGE_SIZE) : null,
  }));

  /** Los renglones tildados, para publicar o retirar en lote. */
  protected readonly selection = signal<readonly PharmacyProduct[]>([]);
  protected readonly bulkBusy = signal(false);
  /** Los productos con un cambio en vuelo. */
  protected readonly busy = signal<ReadonlySet<string>>(new Set());

  /** El modal: `undefined` cerrado, `null` alta, un producto edita. */
  protected readonly dialogTarget = signal<PharmacyProduct | null | undefined>(undefined);

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('nameCell');
  private readonly codeCell = viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('codeCell');
  private readonly categoryCell = viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('categoryCell');
  private readonly priceCell = viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('priceCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('statusCell');
  private readonly availabilityCell = viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('availabilityCell');
  private readonly actionsCell = viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('actionsCell');

  protected readonly columns = computed<readonly ColumnDef<PharmacyProduct>[]>(() => [
    { key: 'name', header: 'Producto', priority: 1, cell: this.nameCell() },
    { key: 'code', header: 'Código', priority: 2, cell: this.codeCell() },
    { key: 'category', header: 'Categoría', priority: 3, cell: this.categoryCell() },
    { key: 'price', header: 'Precio', priority: 2, align: 'end', cell: this.priceCell() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.statusCell() },
    { key: 'availability', header: 'Disponibilidad', priority: 2, cell: this.availabilityCell() },
    { key: 'actions', header: 'Acciones', priority: 1, align: 'end', sticky: 'end', cell: this.actionsCell() },
  ]);

  protected readonly rowId = (product: PharmacyProduct): string => product.id;
  protected readonly rowLabel = (product: PharmacyProduct): string => productName(product);
  protected readonly name = productName;
  protected readonly presentation = productPresentation;
  protected readonly statusOf = productStatus;
  protected readonly statusLabel = PRODUCT_STATUS_LABEL;
  protected readonly actionsOf = rowActionsOf;
  protected readonly isLow = isLowStock;

  constructor() {
    // Elegida la farmacia —sola o por el selector—, se lee su catálogo.
    effect(() => {
      const pharmacyId = this.scope.pharmacyId();
      if (pharmacyId !== null) {
        untracked(() => {
          this.selection.set([]);
          this.reload();
          this.loadCategories(pharmacyId);
        });
      }
    });
    this.destroyRef.onDestroy(() => this.listing?.unsubscribe());
  }

  /* ─── Lectura ─────────────────────────────────────────────────────────── */

  /**
   * Relee el catálogo. Cada consulta cancela la anterior y lleva su número: si
   * dos vuelven desordenadas, la lista mostraría lo que ya no se pidió.
   */
  protected reload(): void {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null) {
      return;
    }
    const query = ++this.query;
    this.listing?.unsubscribe();
    this.truncated.set(false);
    this.products.set(loading());
    this.listing = this.pharmacy
      .searchProducts({ pharmacyId, managed: true, limit: LIST_LIMIT })
      .subscribe({
        next: (page) => {
          if (query !== this.query) {
            return;
          }
          this.truncated.set(page.truncated);
          this.products.set(
            page.items.length > 0
              ? ready(page.items)
              : empty(
                  { label: 'Use «Nuevo producto» o «Importación masiva»' },
                  'Su catálogo todavía no tiene productos.',
                ),
          );
        },
        error: (error: unknown) => {
          if (query === this.query) {
            this.products.set(errorToViewState<readonly PharmacyProduct[]>(error));
          }
        },
      });
  }

  private loadCategories(pharmacyId: string): void {
    this.pharmacy.listCategories(pharmacyId).subscribe({
      next: (page) => this.categoryNames.set(page.items.map((category) => category.name)),
      // Sin categorías el filtro se deshabilita con su motivo; el listado sigue.
      error: () => this.categoryNames.set([]),
    });
  }

  protected goToCursor(cursor: string): void {
    this.offset.set(Math.max(0, Number(cursor) || 0));
  }

  /* ─── Alta y edición ──────────────────────────────────────────────────── */

  protected openNew(): void {
    this.dialogTarget.set(null);
  }

  protected closeDialog(): void {
    this.dialogTarget.set(undefined);
  }

  protected onSaved(): void {
    this.reload();
  }

  /* ─── Acciones de una fila ────────────────────────────────────────────── */

  protected async onRowAction(code: string, product: PharmacyProduct): Promise<void> {
    switch (code) {
      case 'edit':
        this.dialogTarget.set(product);
        return;
      case 'withdraw':
        await this.withdraw([product]);
        return;
      case 'publish':
        this.publish([product]);
        return;
      case 'in-stock':
        this.changeAvailability(product, true);
        return;
      case 'out-of-stock':
        this.changeAvailability(product, false);
        return;
    }
  }

  /**
   * «No lo tengo» / «ya lo tengo». Lo que se marca sin stock deja de ofrecerse:
   * no aparece en la vitrina ni cuenta para «dónde comprar mi receta».
   */
  private changeAvailability(product: PharmacyProduct, inStock: boolean): void {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null) {
      return;
    }
    this.mark(product.id, true);
    this.pharmacy.updateProduct(pharmacyId, product.id, { inStock }).subscribe({
      next: () => {
        this.mark(product.id, false);
        this.toasts.success(
          inStock
            ? `«${productName(product)}» vuelve a estar disponible.`
            : `«${productName(product)}» quedó sin stock: los pacientes ya no lo ven disponible.`,
        );
        this.reload();
      },
      error: (error: unknown) => {
        this.mark(product.id, false);
        this.toasts.error(pharmacyErrorMessage(error, 'No se pudo cambiar la disponibilidad.'));
      },
    });
  }

  /* ─── Publicar y retirar, de a uno o en lote ──────────────────────────── */

  protected publishSelection(): void {
    this.publish(this.selection().filter((product) => productStatus(product) !== 'PUBLISHED'));
  }

  protected async withdrawSelection(): Promise<void> {
    await this.withdraw(this.selection().filter((product) => productStatus(product) !== 'WITHDRAWN'));
  }

  private publish(list: readonly PharmacyProduct[]): void {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null || list.length === 0) {
      return;
    }
    this.runInSeries(list, (product) =>
      this.pharmacy.updateProduct(pharmacyId, product.id, { status: 'PUBLISHED' satisfies PharmacyProductStatus }),
    ).then((failed) =>
      this.report(list.length - failed, failed, 'publicó', 'publicaron'),
    );
  }

  private async withdraw(list: readonly PharmacyProduct[]): Promise<void> {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null || list.length === 0) {
      return;
    }
    const one = list.length === 1 ? `«${productName(list[0]!)}»` : `${list.length} productos`;
    const confirmed = await this.dialogs.confirm({
      title: list.length === 1 ? '¿Retirar este producto del catálogo?' : `¿Retirar ${list.length} productos del catálogo?`,
      message:
        `${one} deja${list.length === 1 ? '' : 'n'} de publicarse y sus precios vigentes quedan ` +
        'reemplazados. Los pedidos ya hechos no cambian. El código queda reservado: no se puede ' +
        'volver a usar para otro producto. Puede volver a publicarlo cuando quiera.',
      confirmLabel: 'Retirar',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    const failed = await this.runInSeries(list, (product) =>
      this.pharmacy.retireProduct(pharmacyId, product.id),
    );
    this.report(list.length - failed, failed, 'retiró', 'retiraron');
  }

  /**
   * Corre un pedido por producto, **en serie**: una farmacia con 300 productos
   * no abre 300 conexiones a la vez. Devuelve cuántos fallaron; un fallo no
   * corta el resto.
   */
  private runInSeries(
    list: readonly PharmacyProduct[],
    request: (product: PharmacyProduct) => Observable<unknown>,
  ): Promise<number> {
    this.bulkBusy.set(true);
    for (const product of list) {
      this.mark(product.id, true);
    }
    return new Promise((resolve) => {
      from(list)
        .pipe(
          concatMap((product) =>
            new Promise<boolean>((done) =>
              request(product).subscribe({
                next: () => done(true),
                error: () => done(false),
              }),
            ),
          ),
          toArray(),
        )
        .subscribe((results) => {
          for (const product of list) {
            this.mark(product.id, false);
          }
          this.bulkBusy.set(false);
          this.selection.set([]);
          resolve(results.filter((ok) => !ok).length);
        });
    });
  }

  private report(done: number, failed: number, singular: string, plural: string): void {
    if (done > 0) {
      this.toasts.success(done === 1 ? `Se ${singular} 1 producto.` : `Se ${plural} ${done} productos.`);
    }
    if (failed > 0) {
      this.toasts.error(
        failed === 1 ? 'Un producto no se pudo cambiar. Pruebe de nuevo.' : `${failed} productos no se pudieron cambiar. Pruebe de nuevo.`,
      );
    }
    this.reload();
  }

  private mark(productId: string, inFlight: boolean): void {
    this.busy.update((current) => {
      const next = new Set(current);
      if (inFlight) {
        next.add(productId);
      } else {
        next.delete(productId);
      }
      return next;
    });
  }

  /* ─── Exportar ────────────────────────────────────────────────────────── */

  /** Descarga lo que el filtro deja a la vista, con las columnas de la plantilla de importación. */
  protected exportCsv(): void {
    const list = dataOf(this.filtered()) ?? [];
    const columns: CsvColumn<PharmacyProduct>[] = CSV_COLUMNS.map((column) => ({
      header: column.encabezado,
      value: (product) => csvValue(product, column.campo),
    }));
    this.csv.download(list, columns, 'productos-de-la-farmacia.csv');
  }
}

function matches(product: PharmacyProduct, filters: ProductFilters, term: string): boolean {
  if (filters.status !== '' && productStatus(product) !== filters.status) {
    return false;
  }
  if (filters.category !== '' && product.category !== filters.category) {
    return false;
  }
  if (filters.availability === 'IN' && product.inStock === false) {
    return false;
  }
  if (filters.availability === 'OUT' && product.inStock !== false) {
    return false;
  }
  if (filters.prescription === 'RX' && product.requiresPrescription !== true) {
    return false;
  }
  if (filters.prescription === 'OTC' && product.requiresPrescription !== false) {
    return false;
  }
  if (term === '') {
    return true;
  }
  return [product.brandName, product.genericName, product.productCode].some((text) =>
    (text ?? '').toLocaleLowerCase('es').includes(term),
  );
}

/** El valor de una columna de la plantilla para un producto ya cargado. */
function csvValue(product: PharmacyProduct, field: string): string {
  switch (field) {
    case 'codigo':
      return product.productCode;
    case 'marca':
      return product.brandName ?? '';
    case 'generico':
      return product.genericName ?? '';
    case 'concentracion':
      return product.strengthText ?? '';
    case 'presentacion':
      return product.packageSizeText ?? '';
    case 'receta':
      return product.requiresPrescription === null ? '' : product.requiresPrescription ? 'sí' : 'no';
    case 'precio':
      return product.unitPrice ?? '';
    case 'categoria':
      return product.category ?? '';
    case 'descripcion':
      return product.description ?? '';
    case 'disponible':
      return product.inStock === false ? 'no' : 'sí';
    default:
      // Cadena de frío y GTIN no se guardan en el catálogo leído: salen vacíos
      // en lugar de inventar un dato.
      return '';
  }
}

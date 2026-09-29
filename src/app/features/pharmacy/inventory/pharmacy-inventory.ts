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
import { ActivatedRoute } from '@angular/router';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef, CursorState } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import type {
  PharmacyInventoryLine,
  PharmacyProduct,
} from '../../../core/data-access/pharmacy/pharmacy.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, mapData, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

import { pharmacyErrorMessage } from '../pharmacy-error-message';
import { PharmacyScope } from '../pharmacy-scope';
import { productName, productStatus } from '../products/product-view';

/** Tope de existencias: el mismo del servidor, que atrapa un dedo de más. */
const STOCK_MAX = 1_000_000;
/** Tope del listado: el máximo que acepta `GET /pharmacy/products`. */
const LIST_LIMIT = 500;
/** Filas por página. */
const PAGE_SIZE = 10;
/** Umbral que el servidor asume mientras la farmacia no fije el suyo. */
const DEFAULT_MINIMUM = 5;

/** Lo que la persona escribió en una fila, todavía como texto. */
interface InventoryEdit {
  readonly stock: string;
  readonly minStock: string;
}

/**
 * **Inventario** de la farmacia: existencias y umbral de alerta de cada
 * producto, todo editable y guardado **junto** con «Guardar cambios».
 *
 * - La disponibilidad se deriva: hay stock si las existencias son mayores que
 *   cero. Es la misma señal que ven los pacientes en la vitrina.
 * - Una alerta es «sin stock» o «existencias en el umbral o por debajo».
 * - Guardar manda **sólo** las filas que cambiaron, en un único
 *   `PATCH /pharmacies/:id/inventory` (P47, sólo simulador): todo o nada, así la
 *   pantalla no queda a medias.
 * - Cuando exista la sincronización con el sistema de la farmacia (registro de
 *   procesos §2.1.2), esta pantalla pasa a ser sólo de lectura; el aviso fijo
 *   de arriba lo dice.
 *
 * Los retirados no aparecen: no se venden, no tienen inventario que llevar.
 */
@Component({
  selector: 'app-pharmacy-inventory',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    DataTable,
    FormField,
    Input,
    PageHeader,
    SearchField,
    Select,
    Switch,
    ViewStateHost,
  ],
  providers: [PharmacyScope],
  templateUrl: './pharmacy-inventory.html',
  styleUrl: './pharmacy-inventory.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyInventory {
  protected readonly scope = inject(PharmacyScope);
  private readonly pharmacy = inject(PharmacyClient);
  private readonly toasts = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  protected readonly products = signal<ViewState<readonly PharmacyProduct[]>>(loading());
  /** Lo escrito y sin guardar, por producto. */
  protected readonly edits = signal<Readonly<Record<string, InventoryEdit>>>({});
  /** Lo que se buscó por nombre o código. */
  protected readonly term = signal('');
  protected readonly onlyAlerts = signal(this.route.snapshot.queryParamMap.get('alerts') === 'true');
  protected readonly errors = signal<readonly string[]>([]);
  protected readonly saving = signal(false);
  protected readonly offset = signal(0);

  protected readonly dirtyCount = computed(() => Object.keys(this.edits()).length);

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
      return ready(list);
    }
    return term !== ''
      ? empty({ label: 'Probá con otra palabra' }, `Nada coincide con «${this.term().trim()}».`)
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
  private readonly availabilityCell = viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('availabilityCell');

  protected readonly columns = computed<readonly ColumnDef<PharmacyProduct>[]>(() => [
    { key: 'name', header: 'Producto', priority: 1, cell: this.nameCell() },
    { key: 'stock', header: 'Existencias', priority: 1, cell: this.stockCell() },
    { key: 'minimum', header: 'Umbral de alerta', priority: 1, cell: this.minimumCell() },
    { key: 'availability', header: 'Disponibilidad', priority: 2, cell: this.availabilityCell() },
  ]);

  protected readonly rowId = (product: PharmacyProduct): string => product.id;
  protected readonly rowLabel = (product: PharmacyProduct): string => productName(product);
  protected readonly name = productName;

  constructor() {
    effect(() => {
      if (this.scope.pharmacyId() !== null) {
        untracked(() => {
          this.edits.set({});
          this.reload();
        });
      }
    });
  }

  protected reload(): void {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null) {
      return;
    }
    this.products.set(loading());
    this.offset.set(0);
    this.pharmacy.searchProducts({ pharmacyId, managed: true, limit: LIST_LIMIT }).subscribe({
      next: (page) => {
        const alive = page.items.filter((product) => productStatus(product) !== 'WITHDRAWN');
        this.products.set(
          alive.length > 0
            ? ready(alive)
            : empty({ label: 'Cargá productos en «Productos»' }, 'Todavía no hay productos con inventario.'),
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

  protected toggleAlerts(only: boolean): void {
    this.onlyAlerts.set(only);
    this.offset.set(0);
  }

  /* ─── Lo escrito ──────────────────────────────────────────────────────── */

  protected stockOf(product: PharmacyProduct): string {
    return this.edits()[product.id]?.stock ?? String(product.stock ?? 0);
  }

  protected minimumOf(product: PharmacyProduct): string {
    return this.edits()[product.id]?.minStock ?? String(product.minStock ?? DEFAULT_MINIMUM);
  }

  protected setStock(product: PharmacyProduct, value: string | number | null): void {
    this.edit(product, { stock: value === null ? '' : String(value), minStock: this.minimumOf(product) });
  }

  protected setMinimum(product: PharmacyProduct, value: string | number | null): void {
    this.edit(product, { stock: this.stockOf(product), minStock: value === null ? '' : String(value) });
  }

  private edit(product: PharmacyProduct, edit: InventoryEdit): void {
    const original: InventoryEdit = {
      stock: String(product.stock ?? 0),
      minStock: String(product.minStock ?? DEFAULT_MINIMUM),
    };
    this.edits.update((current) => {
      const next = { ...current };
      // Volver al valor de origen deja la fila como no editada.
      if (edit.stock === original.stock && edit.minStock === original.minStock) {
        delete next[product.id];
      } else {
        next[product.id] = edit;
      }
      return next;
    });
  }

  /** Sin stock, o con existencias en el umbral o por debajo; lo escrito manda. */
  protected isAlert(product: PharmacyProduct): boolean {
    const stock = Number(this.stockOf(product));
    const minimum = Number(this.minimumOf(product));
    return stock <= 0 || stock <= minimum;
  }

  protected hasStock(product: PharmacyProduct): boolean {
    return Number(this.stockOf(product)) > 0;
  }

  protected isEdited(product: PharmacyProduct): boolean {
    return this.edits()[product.id] !== undefined;
  }

  /* ─── Guardar ─────────────────────────────────────────────────────────── */

  protected save(): void {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null || this.saving() || this.dirtyCount() === 0) {
      return;
    }
    const lines: PharmacyInventoryLine[] = [];
    const problems: string[] = [];
    for (const product of dataOf(this.products()) ?? []) {
      const edit = this.edits()[product.id];
      if (edit === undefined) {
        continue;
      }
      const stock = wholeNumber(edit.stock);
      const minStock = wholeNumber(edit.minStock);
      if (stock === null || minStock === null) {
        problems.push(
          `«${productName(product)}»: las existencias y el umbral son números enteros de 0 a ${STOCK_MAX}.`,
        );
        continue;
      }
      lines.push({ productId: product.id, stock, minStock });
    }
    this.errors.set(problems);
    if (problems.length > 0) {
      return;
    }
    this.saving.set(true);
    this.pharmacy.updateInventory(pharmacyId, lines).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.edits.set({});
        this.toasts.success(
          result.updated === 1 ? 'Guardaste el inventario de 1 producto.' : `Guardaste el inventario de ${result.updated} productos.`,
        );
        // La prueba es la tabla releída de la API.
        this.reload();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errors.set([pharmacyErrorMessage(error, 'No se pudo guardar el inventario.')]);
      },
    });
  }

  protected discard(): void {
    this.edits.set({});
    this.errors.set([]);
  }
}

/** Un entero de 0 a {@link STOCK_MAX} escrito como texto, o `null` si no lo es. */
function wholeNumber(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) {
    return null;
  }
  const value = Number(text);
  return value <= STOCK_MAX ? value : null;
}

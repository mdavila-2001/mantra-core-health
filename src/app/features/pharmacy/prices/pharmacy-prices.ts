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
import { catchError, concatMap, from, map, of, toArray } from 'rxjs';

import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import type { PharmacyProduct } from '../../../core/data-access/pharmacy/pharmacy.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { withDisplayCurrency } from '../../../core/money/display-currency';
import { dataOf, empty, loading, mapData, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type {
  ColumnDef,
  CursorState,
} from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

import { PRECIO_MAXIMO, parsePrice } from '../catalog-rules/catalogo.reglas';
import { pharmacyErrorMessage } from '../pharmacy-error-message';
import { PharmacyScope } from '../pharmacy-scope';
import { productName, productStatus } from '../products/product-view';

/** Tope del listado: el máximo que acepta `GET /pharmacy/products`. */
const LIST_LIMIT = 500;
/** Filas por página. */
const PAGE_SIZE = 10;

/** Un producto que no se pudo guardar, con su motivo. */
interface PriceRejection {
  readonly name: string;
  readonly reason: string;
}

/**
 * **Precios** de la farmacia: el precio de venta de cada producto cargado,
 * editable en la tabla y guardado junto con «Guardar cambios».
 *
 * Es el precio que ven los pacientes en la vitrina y en «dónde comprar la
 * receta». Guardar manda **sólo** las filas que cambiaron, una por una y en
 * serie, con `PATCH /pharmacies/:id/products/:productId` (el mismo que usa el
 * diálogo del producto; P47, sólo simulador). Una que falla no frena a las
 * demás: al final se dice cuáles no entraron y por qué.
 *
 * Un precio vacío es «sin precio»: el producto sigue publicado, pero la
 * vitrina no muestra cuánto cuesta. Los retirados no aparecen.
 */
@Component({
  selector: 'app-pharmacy-prices',
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
    ViewStateHost,
  ],
  providers: [PharmacyScope],
  templateUrl: './pharmacy-prices.html',
  styleUrl: './pharmacy-prices.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyPrices {
  protected readonly scope = inject(PharmacyScope);
  private readonly pharmacy = inject(PharmacyClient);
  private readonly toasts = inject(ToastService);

  protected readonly products = signal<ViewState<readonly PharmacyProduct[]>>(loading());
  /** Lo escrito y sin guardar, por producto. */
  protected readonly edits = signal<Readonly<Record<string, string>>>({});
  protected readonly term = signal('');
  protected readonly errors = signal<readonly string[]>([]);
  protected readonly rejected = signal<readonly PriceRejection[]>([]);
  protected readonly saving = signal(false);
  protected readonly offset = signal(0);

  protected readonly dirtyCount = computed(() => Object.keys(this.edits()).length);

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
      ? ready(list)
      : empty({ label: 'Probá con otra palabra' }, `Nada coincide con «${this.term().trim()}».`);
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
  private readonly priceCell = viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('priceCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('statusCell');

  protected readonly columns = computed<readonly ColumnDef<PharmacyProduct>[]>(() => [
    { key: 'name', header: 'Producto', priority: 1, cell: this.nameCell() },
    { key: 'current', header: 'Precio publicado', priority: 2, cell: this.currentCell() },
    { key: 'price', header: 'Nuevo precio (Bs)', priority: 1, cell: this.priceCell() },
    { key: 'status', header: 'En la vitrina', priority: 3, cell: this.statusCell() },
  ]);

  protected readonly rowId = (product: PharmacyProduct): string => product.id;
  protected readonly rowLabel = (product: PharmacyProduct): string => productName(product);
  protected readonly name = productName;
  protected readonly status = productStatus;

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
            : empty(
                { label: 'Cargá productos en «Productos»', route: '/administration/pharmacy-catalog' },
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

  /* ─── Lo escrito ──────────────────────────────────────────────────────── */

  protected priceOf(product: PharmacyProduct): string {
    return this.edits()[product.id] ?? product.unitPrice ?? '';
  }

  protected publishedPrice(product: PharmacyProduct): string | null {
    return product.unitPrice ? withDisplayCurrency(product.unitPrice) : null;
  }

  protected setPrice(product: PharmacyProduct, value: string | number | null): void {
    const text = value === null ? '' : String(value);
    this.edits.update((current) => {
      const next = { ...current };
      // Volver al valor de origen deja la fila como no editada.
      if (samePrice(text, product.unitPrice ?? '')) {
        delete next[product.id];
      } else {
        next[product.id] = text;
      }
      return next;
    });
  }

  protected isEdited(product: PharmacyProduct): boolean {
    return this.edits()[product.id] !== undefined;
  }

  protected discard(): void {
    this.edits.set({});
    this.errors.set([]);
  }

  /* ─── Guardar ─────────────────────────────────────────────────────────── */

  protected save(): void {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null || this.saving() || this.dirtyCount() === 0) {
      return;
    }
    const changes: { product: PharmacyProduct; unitPrice: number | null }[] = [];
    const problems: string[] = [];
    for (const product of dataOf(this.products()) ?? []) {
      const text = this.edits()[product.id];
      if (text === undefined) {
        continue;
      }
      const unitPrice = parsePrice(text);
      if (unitPrice === 'invalido') {
        problems.push(
          `«${productName(product)}»: el precio va en bolivianos, mayor que 0 y hasta ${PRECIO_MAXIMO.toLocaleString('es-BO')}, con hasta dos decimales.`,
        );
        continue;
      }
      changes.push({ product, unitPrice });
    }
    this.errors.set(problems);
    this.rejected.set([]);
    if (problems.length > 0) {
      return;
    }
    this.saving.set(true);
    from(changes)
      .pipe(
        concatMap(({ product, unitPrice }) =>
          this.pharmacy.updateProduct(pharmacyId, product.id, { unitPrice }).pipe(
            map(() => null),
            catchError((error: unknown) =>
              of({
                name: productName(product),
                reason: pharmacyErrorMessage(error, 'No se pudo guardar el precio.'),
              }),
            ),
          ),
        ),
        toArray(),
      )
      .subscribe((results) => {
        this.saving.set(false);
        const rejected = results.filter((result): result is PriceRejection => result !== null);
        const saved = results.length - rejected.length;
        if (saved > 0) {
          this.toasts.success(
            saved === 1 ? 'Guardaste el precio de 1 producto.' : `Guardaste el precio de ${saved} productos.`,
          );
        }
        this.rejected.set(rejected);
        this.edits.set({});
        // La prueba es la tabla releída de la API.
        this.reload();
      });
  }
}

/** Dos precios escritos son el mismo si valen lo mismo («12,5» = «12.50»). */
function samePrice(a: string, b: string): boolean {
  const left = parsePrice(a);
  const right = parsePrice(b);
  if (left === 'invalido' || right === 'invalido') {
    return a.trim() === b.trim();
  }
  return left === right;
}

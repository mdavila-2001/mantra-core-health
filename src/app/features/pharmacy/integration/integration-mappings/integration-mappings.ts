import {
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
import { DatePipe } from '@angular/common';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';

import { PharmacyIntegrationClient } from '../../../../core/data-access/pharmacy/pharmacy-integration.client';
import type {
  ExternalProduct,
  IntegrationConnection,
  ProductMapping,
} from '../../../../core/data-access/pharmacy/pharmacy-integration.types';
import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import type { PharmacyProduct } from '../../../../core/data-access/pharmacy/pharmacy.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';

import { productName, productStatus } from '../../products/product-view';
import { INTEGRATION_ERROR_TEXT, integrationErrorMessage } from '../integration-error-message';

/** Tope del listado del catálogo propio: el máximo que acepta `GET /pharmacy/products`. */
const PRODUCT_LIMIT = 500;

/**
 * Los productos del catálogo vinculados a un código del sistema de la farmacia,
 * y «Vincular producto».
 *
 * Vincular pide elegir dos cosas, así que va en un modal (composition-rules
 * §6): el producto del catálogo y el código del sistema de la farmacia, este
 * último elegido del catálogo que ese sistema publica y no escrito a mano. No
 * se ofrecen los productos ya vinculados (la API respondería 409) ni los
 * códigos que ya tienen producto (un código con dos productos queda sin
 * vínculo en la sincronización). Después del alta, la tabla se relee.
 */
@Component({
  selector: 'app-integration-mappings',
  imports: [Alert, AppButton, ContentDialog, DataTable, DatePipe, FormField, Select],
  templateUrl: './integration-mappings.html',
  styleUrl: './integration-mappings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationMappings {
  readonly pharmacyId = input.required<string>();
  readonly connection = input.required<IntegrationConnection>();

  private readonly integration = inject(PharmacyIntegrationClient);
  private readonly pharmacy = inject(PharmacyClient);
  private readonly toasts = inject(ToastService);

  protected readonly mappings = signal<ViewState<readonly ProductMapping[]>>(loading());
  protected readonly externals = signal<ViewState<readonly ExternalProduct[]>>(loading());
  protected readonly products = signal<ViewState<readonly PharmacyProduct[]>>(loading());

  protected readonly dialogOpen = signal(false);
  protected readonly productId = signal<string | null>(null);
  protected readonly externalCode = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly dialogError = signal<string | null>(null);

  /** El nombre de cada código del sistema de la farmacia, para la tabla. */
  private readonly externalNames = computed(
    () => new Map((dataOf(this.externals()) ?? []).map((item) => [item.code, item.name])),
  );

  protected readonly productOptions = computed<readonly SelectOption<string>[]>(() => {
    const linked = new Set((dataOf(this.mappings()) ?? []).map((mapping) => mapping.pharmacyProductId));
    return (dataOf(this.products()) ?? [])
      .filter((product) => productStatus(product) !== 'WITHDRAWN' && !linked.has(product.id))
      .map((product) => ({ value: product.id, label: productName(product), description: product.productCode }));
  });

  protected readonly externalOptions = computed<readonly SelectOption<string>[]>(() =>
    (dataOf(this.externals()) ?? []).map((item) => ({
      value: item.code,
      label: `${item.code} · ${item.name}`,
      description: item.mappedProductId === null ? (item.presentation ?? undefined) : 'Ya vinculado a un producto',
      disabled: item.mappedProductId !== null,
    })),
  );

  /** Lo que impide abrir el selector del sistema de la farmacia, dicho para la persona. */
  protected readonly externalsError = signal<string | null>(null);

  protected readonly canSave = computed(
    () => !this.saving() && this.productId() !== null && this.externalCode() !== null,
  );

  private readonly externalCell = viewChild.required<TemplateRef<{ $implicit: ProductMapping }>>('externalCell');
  private readonly productCell = viewChild.required<TemplateRef<{ $implicit: ProductMapping }>>('productCell');
  private readonly dateCell = viewChild.required<TemplateRef<{ $implicit: ProductMapping }>>('dateCell');

  protected readonly columns = computed<readonly ColumnDef<ProductMapping>[]>(() => [
    { key: 'externalProductCode', header: 'Código en su sistema', priority: 1, cell: this.externalCell() },
    { key: 'productName', header: 'Producto del catálogo', priority: 1, cell: this.productCell() },
    { key: 'createdAt', header: 'Vinculado el', priority: 2, cell: this.dateCell() },
  ]);

  protected readonly rowId = (mapping: ProductMapping): string => mapping.id;
  protected readonly rowLabel = (mapping: ProductMapping): string =>
    `${mapping.externalProductCode} · ${mapping.productName}`;

  constructor() {
    const key = computed(() => `${this.pharmacyId()}|${this.connection().id}`);
    effect(() => {
      key();
      untracked(() => {
        this.dialogOpen.set(false);
        this.reload();
      });
    });
  }

  protected externalName(code: string): string | null {
    return this.externalNames().get(code) ?? null;
  }

  protected reload(): void {
    this.loadMappings();
    this.loadExternals();
  }

  protected openDialog(): void {
    this.productId.set(null);
    this.externalCode.set(null);
    this.dialogError.set(null);
    this.dialogOpen.set(true);
    // Frescos al abrir: el catálogo propio y el del sistema pueden haber cambiado.
    this.loadProducts();
    this.loadExternals();
  }

  protected closeDialog(): void {
    if (!this.saving()) {
      this.dialogOpen.set(false);
    }
  }

  protected save(): void {
    const productId = this.productId();
    const code = this.externalCode();
    if (!this.canSave() || productId === null || code === null) {
      return;
    }
    const external = (dataOf(this.externals()) ?? []).find((item) => item.code === code);
    this.saving.set(true);
    this.dialogError.set(null);
    this.integration
      .createMapping(this.pharmacyId(), this.connection().id, {
        pharmacyProductId: productId,
        externalProductCode: code,
        ...(external?.unitCode ? { externalUnitCode: external.unitCode } : {}),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogOpen.set(false);
          this.toasts.success(`Vinculó ${code} con un producto del catálogo.`);
          // La prueba es la tabla releída de la API.
          this.reload();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.dialogError.set(integrationErrorMessage(error, 'No se pudo vincular el producto.'));
        },
      });
  }

  private loadMappings(): void {
    this.mappings.set(loading());
    this.integration.listMappings(this.pharmacyId(), this.connection().id).subscribe({
      next: (list) =>
        this.mappings.set(
          list.items.length > 0
            ? ready(list.items)
            : empty(
                { label: 'Toque «Vincular producto»' },
                'Todavía no vinculó ningún producto. Sin vínculos, la sincronización no cambia ninguna existencia.',
              ),
        ),
      error: (error: unknown) => this.mappings.set(errorToViewState<readonly ProductMapping[]>(error)),
    });
  }

  private loadExternals(): void {
    if (!this.connection().providerConfigured) {
      this.externals.set(ready([]));
      this.externalsError.set(INTEGRATION_ERROR_TEXT.PHARMACY_INTEGRATION_NOT_CONFIGURED);
      return;
    }
    this.externals.set(loading());
    this.externalsError.set(null);
    this.integration.listExternalProducts(this.pharmacyId(), this.connection().id).subscribe({
      next: (list) => this.externals.set(ready(list.items)),
      error: (error: unknown) => {
        this.externals.set(errorToViewState<readonly ExternalProduct[]>(error));
        this.externalsError.set(
          integrationErrorMessage(error, 'No se pudo leer el catálogo del sistema de la farmacia.'),
        );
      },
    });
  }

  private loadProducts(): void {
    this.products.set(loading());
    this.pharmacy.searchProducts({ pharmacyId: this.pharmacyId(), managed: true, limit: PRODUCT_LIMIT }).subscribe({
      next: (page) => this.products.set(ready(page.items)),
      error: (error: unknown) => this.products.set(errorToViewState<readonly PharmacyProduct[]>(error)),
    });
  }
}

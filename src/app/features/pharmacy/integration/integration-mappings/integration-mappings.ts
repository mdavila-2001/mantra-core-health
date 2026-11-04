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
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { RowActions } from '../../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../../shared/components/molecules/row-actions/row-actions.types';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';

import { PharmacyIntegrationClient } from '../../../../core/data-access/pharmacy/pharmacy-integration.client';
import type {
  ExternalMappingStatus,
  ExternalProduct,
  IntegrationConnection,
  ProductMapping,
  ProductMappingUpdate,
} from '../../../../core/data-access/pharmacy/pharmacy-integration.types';
import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import type { PharmacyProduct } from '../../../../core/data-access/pharmacy/pharmacy.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';

import { productName, productStatus } from '../../products/product-view';
import {
  INTEGRATION_ERROR_TEXT,
  integrationErrorMessage,
  integrationReasonOf,
  takenMappingIdOf,
} from '../integration-error-message';

/** Tope del listado del catálogo propio: el máximo que acepta `GET /pharmacy/products`. */
const PRODUCT_LIMIT = 500;

/** Las dos acciones de cada vínculo, en la fila. */
const ROW_ACTIONS: readonly RowAction[] = [
  { code: 'edit', label: 'Corregir', icon: 'edit' },
  { code: 'undo', label: 'Deshacer', icon: 'remove', destructive: true },
];

/** Un código del sistema de la farmacia vinculado a más de un producto. */
export interface AmbiguousCode {
  readonly code: string;
  readonly name: string;
  readonly mappings: readonly ProductMapping[];
}

/** Cómo está vinculado un código; con una API anterior a FAR-C8, por `mappedProductId`. */
export function mappingStatusOf(item: ExternalProduct): ExternalMappingStatus {
  return item.mappingStatus ?? (item.mappedProductId === null ? 'UNMAPPED' : 'MAPPED');
}

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
 *
 * Cada vínculo se puede **corregir** (otro producto, otro código u otra
 * unidad; el mismo modal, sólo viaja lo que cambió) y **deshacer** (con
 * confirmación; el stock ya sincronizado se conserva). Un código vinculado a
 * más de un producto se muestra como «Ambiguo», con sus productos y la forma
 * de deshacer los que sobran. La unidad se precarga con la del catálogo del
 * sistema de la farmacia, para no leer una caja como una tableta.
 */
@Component({
  selector: 'app-integration-mappings',
  imports: [Alert, AppButton, Badge, ContentDialog, DataTable, DatePipe, FormField, Input, RowActions, Select],
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
  private readonly dialogs = inject(DialogService);

  protected readonly mappings = signal<ViewState<readonly ProductMapping[]>>(loading());
  protected readonly externals = signal<ViewState<readonly ExternalProduct[]>>(loading());
  protected readonly products = signal<ViewState<readonly PharmacyProduct[]>>(loading());

  protected readonly dialogOpen = signal(false);
  protected readonly productId = signal<string | null>(null);
  protected readonly externalCode = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly dialogError = signal<string | null>(null);
  /** El vínculo que se corrige; `null` en un alta. */
  protected readonly editing = signal<ProductMapping | null>(null);
  /** La unidad escrita a mano; `null` = la del catálogo del sistema para el código elegido. */
  protected readonly unitCode = signal<string | null>(null);
  /** En un 409, el vínculo que ya tiene el producto, para ofrecer corregir ese. */
  protected readonly takenMappingId = signal<string | null>(null);
  /** Lo que pasó al deshacer, fuera del modal. */
  protected readonly notice = signal<string | null>(null);
  /** El vínculo que se está deshaciendo: no salen dos `DELETE`. */
  protected readonly removing = signal<string | null>(null);
  protected readonly rowActions = ROW_ACTIONS;

  /** El vínculo del 409, cuando la tabla releída ya lo trae. */
  protected readonly takenMapping = computed(
    () => (dataOf(this.mappings()) ?? []).find((item) => item.id === this.takenMappingId()) ?? null,
  );

  /** El nombre de cada código del sistema de la farmacia, para la tabla. */
  private readonly externalNames = computed(
    () => new Map((dataOf(this.externals()) ?? []).map((item) => [item.code, item.name])),
  );

  /** Cada código del sistema de la farmacia con su estado de vínculo. */
  private readonly externalStatus = computed(
    () => new Map((dataOf(this.externals()) ?? []).map((item) => [item.code, mappingStatusOf(item)])),
  );

  /** Los códigos vinculados a más de un producto, con sus vínculos para deshacer los que sobran. */
  protected readonly ambiguous = computed<readonly AmbiguousCode[]>(() => {
    const mappings = dataOf(this.mappings()) ?? [];
    return (dataOf(this.externals()) ?? [])
      .filter((item) => mappingStatusOf(item) === 'AMBIGUOUS')
      .map((item) => ({
        code: item.code,
        name: item.name,
        mappings: mappings.filter((mapping) => mapping.externalProductCode === item.code),
      }));
  });

  /** La unidad que se manda: la escrita, o la del catálogo para el código elegido. */
  protected readonly unit = computed(() => {
    const typed = this.unitCode();
    if (typed !== null) {
      return typed;
    }
    const code = this.externalCode();
    return (dataOf(this.externals()) ?? []).find((item) => item.code === code)?.unitCode ?? '';
  });

  /** Lo que cambió en una corrección; vacío si nada (la API daría 400). */
  private readonly patch = computed<ProductMappingUpdate>(() => {
    const mapping = this.editing();
    if (mapping === null) {
      return {};
    }
    const productId = this.productId();
    const code = this.externalCode();
    const unit = this.unit().trim() === '' ? null : this.unit().trim();
    return {
      ...(productId !== null && productId !== mapping.pharmacyProductId ? { pharmacyProductId: productId } : {}),
      ...(code !== null && code !== mapping.externalProductCode ? { externalProductCode: code } : {}),
      ...(unit !== (mapping.externalUnitCode ?? null) ? { externalUnitCode: unit } : {}),
    };
  });

  protected readonly productOptions = computed<readonly SelectOption<string>[]>(() => {
    const own = this.editing()?.pharmacyProductId;
    const linked = new Set(
      (dataOf(this.mappings()) ?? [])
        .map((mapping) => mapping.pharmacyProductId)
        .filter((productId) => productId !== own),
    );
    return (dataOf(this.products()) ?? [])
      .filter((product) => productStatus(product) !== 'WITHDRAWN' && !linked.has(product.id))
      .map((product) => ({ value: product.id, label: productName(product), description: product.productCode }));
  });

  protected readonly externalOptions = computed<readonly SelectOption<string>[]>(() => {
    const own = this.editing()?.externalProductCode;
    return (dataOf(this.externals()) ?? []).map((item) => {
      const status = mappingStatusOf(item);
      const free = status === 'UNMAPPED' || item.code === own;
      return {
        value: item.code,
        label: `${item.code} · ${item.name}`,
        description: free
          ? (item.presentation ?? undefined)
          : status === 'AMBIGUOUS'
            ? `Ambiguo: vinculado a ${item.mappedProductIds?.length ?? 2} productos`
            : 'Ya vinculado a un producto',
        disabled: !free,
      };
    });
  });

  /** Lo que impide abrir el selector del sistema de la farmacia, dicho para la persona. */
  protected readonly externalsError = signal<string | null>(null);

  protected readonly canSave = computed(
    () =>
      !this.saving() &&
      this.productId() !== null &&
      this.externalCode() !== null &&
      (this.editing() === null || Object.keys(this.patch()).length > 0),
  );

  private readonly externalCell = viewChild.required<TemplateRef<{ $implicit: ProductMapping }>>('externalCell');
  private readonly productCell = viewChild.required<TemplateRef<{ $implicit: ProductMapping }>>('productCell');
  private readonly dateCell = viewChild.required<TemplateRef<{ $implicit: ProductMapping }>>('dateCell');
  private readonly unitCell = viewChild.required<TemplateRef<{ $implicit: ProductMapping }>>('unitCell');
  private readonly actionsCell = viewChild.required<TemplateRef<{ $implicit: ProductMapping }>>('actionsCell');

  protected readonly columns = computed<readonly ColumnDef<ProductMapping>[]>(() => [
    { key: 'externalProductCode', header: 'Código en su sistema', priority: 1, cell: this.externalCell() },
    { key: 'productName', header: 'Producto del catálogo', priority: 1, cell: this.productCell() },
    { key: 'externalUnitCode', header: 'Unidad', priority: 2, cell: this.unitCell() },
    { key: 'createdAt', header: 'Vinculado el', priority: 2, cell: this.dateCell() },
    { key: 'actions', header: 'Acciones', priority: 1, accion: true, cell: this.actionsCell() },
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
        this.notice.set(null);
        this.reload();
      });
    });
  }

  /** Si un código del sistema de la farmacia está vinculado a más de un producto. */
  protected isAmbiguous(code: string): boolean {
    return this.externalStatus().get(code) === 'AMBIGUOUS';
  }

  protected externalName(code: string): string | null {
    return this.externalNames().get(code) ?? null;
  }

  protected reload(): void {
    this.loadMappings();
    this.loadExternals();
  }

  /** «Vincular producto», con un código ya elegido cuando viene de la sincronización. */
  startLink(code: string | null = null): void {
    this.openDialog(null);
    this.externalCode.set(code);
  }

  /** «Corregir»: el mismo modal, con el vínculo cargado. */
  startEdit(mapping: ProductMapping): void {
    this.openDialog(mapping);
    this.productId.set(mapping.pharmacyProductId);
    this.externalCode.set(mapping.externalProductCode);
    this.unitCode.set(mapping.externalUnitCode ?? '');
  }

  protected runAction(mapping: ProductMapping, action: string): void {
    if (action === 'edit') {
      this.startEdit(mapping);
    } else if (action === 'undo') {
      void this.undo(mapping);
    }
  }

  /** Otro código: la unidad vuelve a ser la del catálogo para ese código. */
  protected chooseExternal(code: string | null): void {
    this.externalCode.set(code);
    this.unitCode.set(null);
  }

  protected chooseUnit(value: string | number | null): void {
    this.unitCode.set(value === null ? '' : String(value));
  }

  /** En un 409, pasa a corregir el vínculo que ya tiene el producto. */
  protected editTaken(): void {
    const mapping = this.takenMapping();
    if (mapping !== null) {
      this.startEdit(mapping);
    }
  }

  /**
   * «Deshacer», con confirmación. Lo que se ve después es la tabla releída; un
   * 404 (otro lo deshizo antes) también relee y lo dice.
   */
  async undo(mapping: ProductMapping): Promise<void> {
    if (this.removing() !== null) {
      return;
    }
    const confirmed = await this.dialogs.confirm({
      title: 'Deshacer el vínculo',
      message: `${mapping.externalProductCode} deja de traer existencias para «${mapping.productName}». El stock que ya se sincronizó se conserva.`,
      confirmLabel: 'Deshacer',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.removing.set(mapping.id);
    this.notice.set(null);
    this.integration.deleteMapping(this.pharmacyId(), this.connection().id, mapping.id).subscribe({
      next: () => {
        this.removing.set(null);
        this.toasts.success(`Deshizo el vínculo de ${mapping.externalProductCode}.`);
        this.reload();
      },
      error: (error: unknown) => {
        this.removing.set(null);
        this.notice.set(integrationErrorMessage(error, 'No se pudo deshacer el vínculo.'));
        if (integrationReasonOf(error) === 'EXTERNAL_MAPPING_NOT_AVAILABLE') {
          this.reload();
        }
      },
    });
  }

  protected openDialog(mapping: ProductMapping | null = null): void {
    this.editing.set(mapping);
    this.productId.set(null);
    this.externalCode.set(null);
    this.unitCode.set(null);
    this.takenMappingId.set(null);
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
    const editing = this.editing();
    if (editing !== null) {
      this.saveCorrection(editing);
      return;
    }
    const unit = this.unit().trim();
    this.saving.set(true);
    this.dialogError.set(null);
    this.takenMappingId.set(null);
    this.integration
      .createMapping(this.pharmacyId(), this.connection().id, {
        pharmacyProductId: productId,
        externalProductCode: code,
        ...(unit !== '' ? { externalUnitCode: unit } : {}),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogOpen.set(false);
          this.toasts.success(`Vinculó ${code} con un producto del catálogo.`);
          // La prueba es la tabla releída de la API.
          this.reload();
        },
        error: (error: unknown) => this.failSave(error, 'No se pudo vincular el producto.'),
      });
  }

  /** `PATCH` con lo que cambió; el vínculo vuelve a quedar sin verificar. */
  private saveCorrection(mapping: ProductMapping): void {
    this.saving.set(true);
    this.dialogError.set(null);
    this.takenMappingId.set(null);
    this.integration.updateMapping(this.pharmacyId(), this.connection().id, mapping.id, this.patch()).subscribe({
      next: (changed) => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.toasts.success(`Corrigió el vínculo de ${changed.externalProductCode}.`);
        this.reload();
      },
      error: (error: unknown) => this.failSave(error, 'No se pudo corregir el vínculo.'),
    });
  }

  /**
   * El error de un alta o una corrección, dentro del modal. Un 409 con el
   * vínculo que ya tiene el producto ofrece corregir ese; un 404 relee la tabla.
   */
  private failSave(error: unknown, fallback: string): void {
    this.saving.set(false);
    this.dialogError.set(integrationErrorMessage(error, fallback));
    const taken = takenMappingIdOf(error);
    this.takenMappingId.set(taken);
    // El vínculo que ya tiene el producto puede ser de hace un instante, y el
    // que se corregía puede ya no existir: en los dos casos se relee la tabla.
    if (taken !== null || integrationReasonOf(error) === 'EXTERNAL_MAPPING_NOT_AVAILABLE') {
      this.loadMappings();
    }
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

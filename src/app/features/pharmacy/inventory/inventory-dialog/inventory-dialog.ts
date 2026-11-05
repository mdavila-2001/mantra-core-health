import { ChangeDetectionStrategy, Component, inject, input, output, signal, type OnInit } from '@angular/core';

import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import type {
  PharmacyInventoryLine,
  PharmacyProduct,
} from '../../../../core/data-access/pharmacy/pharmacy.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { pharmacyErrorMessage } from '../../pharmacy-error-message';
import { productName } from '../../products/product-view';
import { INVENTORY_DEFAULT_MINIMUM, INVENTORY_STOCK_MAX, wholeNumber } from '../inventory-csv';

/** How the pharmacy tracks stock: with quantities, or only in stock / out of stock. */
export type InventoryView = 'COUNT' | 'AVAILABILITY';

/**
 * «Editar inventario» modal for an Inventory row, with Save and Cancel.
 *
 * With quantities it asks for stock and alert threshold; with «hay / no hay»,
 * only whether the product is in stock. Saves the row through
 * `PATCH /pharmacies/:id/inventory` and emits `saved` so the table is re-read
 * from the API.
 */
@Component({
  selector: 'app-inventory-dialog',
  imports: [Alert, AppButton, ContentDialog, FormField, Input, Switch],
  templateUrl: './inventory-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryDialog implements OnInit {
  readonly pharmacyId = input.required<string>();
  readonly product = input.required<PharmacyProduct>();
  readonly view = input.required<InventoryView>();
  /** Sites with their own stock, which this change does not reach; empty when none. */
  readonly notice = input('');

  readonly saved = output<void>();
  readonly closed = output<void>();

  private readonly pharmacy = inject(PharmacyClient);
  private readonly toasts = inject(ToastService);

  protected readonly name = productName;
  protected readonly stock = signal('');
  protected readonly minimum = signal('');
  protected readonly has = signal(true);
  /** The product had a count: an empty field cannot erase it, so it is an error. */
  protected readonly counted = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  ngOnInit(): void {
    const product = this.product();
    this.counted.set(product.stock !== null && product.stock !== undefined);
    this.stock.set(this.counted() ? String(product.stock) : '');
    this.minimum.set(String(product.minStock ?? INVENTORY_DEFAULT_MINIMUM));
    this.has.set(product.inStock !== false);
  }

  protected text(value: string | number | null): string {
    return value === null ? '' : String(value).trim();
  }

  protected save(): void {
    const line = this.line();
    if (line === null) {
      this.error.set(
        this.counted() && this.stock() === ''
          ? 'Escriba las existencias: para dejarlo sin stock, ponga 0.'
          : `Las existencias y el umbral son números enteros de 0 a ${INVENTORY_STOCK_MAX}.`,
      );
      return;
    }
    this.saving.set(true);
    this.pharmacy.updateInventory(this.pharmacyId(), [line]).subscribe({
      next: () => {
        this.saving.set(false);
        this.toasts.success(`Guardó el inventario de «${productName(this.product())}».`);
        this.saved.emit();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(pharmacyErrorMessage(error, 'No se pudo guardar el inventario.'));
      },
    });
  }

  /** The API line; `null` when the typed values are not valid integers. */
  private line(): PharmacyInventoryLine | null {
    const productId = this.product().id;
    if (this.view() === 'AVAILABILITY') {
      return { productId, inStock: this.has() };
    }
    const stock = wholeNumber(this.stock());
    const minStock = wholeNumber(this.minimum());
    if (stock === 'invalid' || minStock === 'invalid' || minStock === null || (stock === null && this.counted())) {
      return null;
    }
    // No stock typed: the product stays uncounted and only the threshold is sent.
    return { productId, ...(stock === null ? {} : { stock }), minStock };
  }
}

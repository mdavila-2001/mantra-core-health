import { ChangeDetectionStrategy, Component, inject, input, output, signal, type OnInit } from '@angular/core';

import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import type { PharmacyProduct } from '../../../../core/data-access/pharmacy/pharmacy.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { MAX_PRICE, parsePrice } from '../../catalog-rules/catalog.rules';
import { pharmacyErrorMessage } from '../../pharmacy-error-message';
import { productName } from '../../products/product-view';

/**
 * «Editar precio» modal for a Prices row: one product's selling price, with
 * Save and Cancel.
 *
 * Saves through `PATCH /pharmacies/:id/products/:productId` (`unitPrice`), the
 * same endpoint the product dialog uses, and emits `saved` so the table is
 * re-read from the API: the proof is the table, not the toast. Clearing the
 * price is the row's «Quitar precio» action, not this dialog.
 */
@Component({
  selector: 'app-price-dialog',
  imports: [Alert, AppButton, ContentDialog, FormField, Input],
  templateUrl: './price-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceDialog implements OnInit {
  readonly pharmacyId = input.required<string>();
  readonly product = input.required<PharmacyProduct>();

  readonly saved = output<void>();
  readonly closed = output<void>();

  private readonly pharmacy = inject(PharmacyClient);
  private readonly toasts = inject(ToastService);

  protected readonly name = productName;
  protected readonly draft = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  ngOnInit(): void {
    this.draft.set(this.product().unitPrice ?? '');
  }

  protected setDraft(value: string | number | null): void {
    this.draft.set(value === null ? '' : String(value));
    this.error.set(null);
  }

  protected save(): void {
    const unitPrice = parsePrice(this.draft());
    if (unitPrice === null || unitPrice === 'invalido') {
      this.error.set(
        `Escriba el precio en bolivianos, mayor que 0 y hasta ${MAX_PRICE.toLocaleString('es-BO')}, con hasta dos decimales.`,
      );
      return;
    }
    this.saving.set(true);
    this.pharmacy.updateProduct(this.pharmacyId(), this.product().id, { unitPrice }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toasts.success(`Guardó el precio de «${productName(this.product())}».`);
        this.saved.emit();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(pharmacyErrorMessage(error, 'No se pudo guardar el precio.'));
      },
    });
  }
}

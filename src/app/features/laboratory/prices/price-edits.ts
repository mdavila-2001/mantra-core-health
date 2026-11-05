import { computed, signal } from '@angular/core';

import type { LabService } from '../../../core/data-access/lab-portal/lab-portal.types';
import { withDisplayCurrency } from '../../../core/money/display-currency';
import {
  discountText,
  isUnchanged,
  parseAmount,
  parseDiscount,
  priceText,
  type PriceEdit,
} from './laboratory-prices.rules';

/** What was typed and not saved yet, by service, with the live AloVida price. */
export class PriceEdits {
  readonly all = signal<Readonly<Record<string, PriceEdit>>>({});
  readonly count = computed(() => Object.keys(this.all()).length);

  priceOf(service: LabService): string {
    return this.all()[service.id]?.price ?? priceText(service);
  }

  discountOf(service: LabService): string {
    return this.all()[service.id]?.discount ?? discountText(service);
  }

  setPrice(service: LabService, value: string | number | null): void {
    this.edit(service, {
      price: value === null ? '' : String(value),
      discount: this.discountOf(service),
    });
  }

  setDiscount(service: LabService, value: string | number | null): void {
    this.edit(service, {
      price: this.priceOf(service),
      discount: value === null ? '' : String(value),
    });
  }

  isEdited(service: LabService): boolean {
    return this.all()[service.id] !== undefined;
  }

  clear(): void {
    this.all.set({});
  }

  /** What an AloVida user would pay with what was typed; `null` when it cannot be computed. */
  alovidaPriceOf(service: LabService): string | null {
    const edit = this.all()[service.id];
    if (edit === undefined) {
      return service.hasPrice !== false ? withDisplayCurrency(service.alovidaPrice) : null;
    }
    const price = parseAmount(edit.price);
    const discount = parseDiscount(edit.discount);
    if (price === 'invalid' || discount === 'invalid') {
      return null;
    }
    return withDisplayCurrency(((price * (100 - (discount ?? 0))) / 100).toFixed(2));
  }

  private edit(service: LabService, edit: PriceEdit): void {
    this.all.update((current) => {
      const next = { ...current };
      // Going back to the original value leaves the row unedited.
      if (isUnchanged(service, edit)) {
        delete next[service.id];
      } else {
        next[service.id] = edit;
      }
      return next;
    });
  }
}

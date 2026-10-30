import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { formatReceiptAmount } from '../../../core/data-access/scheduling/payment-receipt-format';
import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import type { ServiceCatalogItem } from '../../../core/data-access/services-catalog/services-catalog.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Input } from '../../../shared/components/atoms/input/input';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { apiMessage } from '../billing-setup-errors';

/** El código del ítem que cobra una consulta (S-4): lo crea la API al dar de alta la práctica. */
export const CONSULTATION_ITEM_CODE = 'CITA_MEDICA';

/** Importe con hasta dos decimales; la coma se acepta y viaja como punto. */
const AMOUNT = /^\d+(\.\d{1,2})?$/;

/** «Mis servicios», donde se corrige el resto del catálogo. */
export const MY_SERVICES_ROUTE = '/my-services';

/**
 * «Precio de la consulta»: el ítem `CITA_MEDICA` de la práctica, editable con
 * el mismo cliente que «Mis servicios». Un precio en 0 nunca se muestra como
 * «0,00 Bs»: dice «Defina el precio». Si la API rechaza lo escrito (422 con un
 * 0), su texto queda junto al campo.
 */
@Component({
  selector: 'app-consultation-price-block',
  imports: [RouterLink, AppButton, AppButtonLink, FormField, Input, ViewStateHost],
  templateUrl: './consultation-price-block.html',
  styleUrl: '../billing-setup-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultationPriceBlock {
  private readonly catalog = inject(ServicesCatalogClient);

  readonly practiceId = input.required<string>();
  /** Lo que se está escribiendo. Vive en la página: la pestaña cerrada no conserva sus controles. */
  readonly priceDraft = model<string>('');

  protected readonly item = signal<ViewState<ServiceCatalogItem>>(loading());
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly saved = signal(false);
  protected readonly myServicesRoute = MY_SERVICES_ROUTE;

  /** «150,00 Bs», o `null` si el precio es 0 y hay que definirlo. */
  protected readonly priceText = computed(() => {
    const state = this.item();
    if (state.status !== 'ready' || Number(state.data.defaultPrice) <= 0) return null;
    return formatReceiptAmount(state.data.defaultPrice);
  });

  protected readonly formatError = computed(() => {
    const draft = normalized(this.priceDraft());
    if (draft === '') return null;
    return AMOUNT.test(draft) ? null : 'Escriba un importe con hasta dos decimales, por ejemplo 150 o 150,50.';
  });

  protected readonly fieldError = computed(() => this.formatError() ?? this.serverError());

  constructor() {
    effect(() => this.load(this.practiceId()));
  }

  protected writePrice(value: string | number | null): void {
    this.priceDraft.set(value === null ? '' : String(value));
    this.serverError.set(null);
    this.saved.set(false);
  }

  protected reload(): void {
    this.load(this.practiceId());
  }

  protected save(): void {
    const state = this.item();
    const price = normalized(this.priceDraft());
    if (state.status !== 'ready' || price === '' || this.formatError() !== null || this.saving()) return;
    this.saving.set(true);
    this.serverError.set(null);
    this.catalog.update(state.data.id, { defaultPrice: price }).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.saved.set(true);
        this.priceDraft.set('');
        this.item.set(ready(updated));
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.serverError.set(apiMessage(error, 'No pudimos guardar el precio. Pruebe de nuevo.'));
      },
    });
  }

  private load(practiceId: string): void {
    this.item.set(loading());
    this.catalog.search(practiceId, { query: CONSULTATION_ITEM_CODE, limit: 20 }).subscribe({
      next: (page) => {
        const found = page.items.find((candidate) => candidate.code === CONSULTATION_ITEM_CODE);
        this.item.set(
          found === undefined
            ? empty(
                { label: 'Ir a «Mis servicios»', route: MY_SERVICES_ROUTE },
                'Esta práctica no tiene el servicio «Cita médica». Desde «Mis servicios» puede darlo de alta.',
              )
            : ready(found),
        );
      },
      error: (error: unknown) => this.item.set(errorToViewState(error)),
    });
  }
}

function normalized(value: string): string {
  return value.trim().replace(',', '.');
}

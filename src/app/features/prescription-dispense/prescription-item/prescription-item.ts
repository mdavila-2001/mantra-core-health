import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type {
  PharmacyPrescriptionItem,
  PrescriptionProductMatch,
  PrescriptionProductSite,
  SiteProductRef,
} from '../../../core/data-access/pharmacy-prescription-shares/pharmacy-prescription-shares.types';
import { withDisplayCurrency } from '../../../core/money/display-currency';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { balanceText, prescribedText, siteKey } from '../dispense-display';
import { PRESCRIPTION_DISPENSE_TESTIDS } from '../prescription-dispense.testids';
import { SiteAvailabilityToggle } from '../site-availability-toggle/site-availability-toggle';

/** Lo que pide el interruptor de una sede: qué producto, dónde y qué valor. */
export interface AvailabilityRequest {
  readonly ref: SiteProductRef;
  readonly available: boolean;
}

/**
 * Un ítem de la receta, visto desde el mostrador (FAR-02, REQ-FAR-02-008):
 * el fármaco y su indicación, lo recetado y lo que queda, y los productos del
 * catálogo que lo surten con una fila por sede.
 *
 * Presentacional: lo que está en vuelo y lo que falló lo dice el contenedor,
 * que es quien llama a la API.
 */
@Component({
  selector: 'app-prescription-item',
  imports: [Badge, DatePipe, SiteAvailabilityToggle],
  templateUrl: './prescription-item.html',
  styleUrl: './prescription-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrescriptionItem {
  readonly item = input.required<PharmacyPrescriptionItem>();
  /**
   * Cuántos ítems de la receta son de este mismo fármaco. Con más de uno, las
   * cantidades son del fármaco en toda la receta y la pantalla lo dice.
   */
  readonly sameDrug = input<number>(1);
  /** Las sedes con el interruptor en vuelo (`siteKey`). */
  readonly pendingKeys = input<ReadonlySet<string>>(new Set());
  /** El motivo del último fallo, por sede (`siteKey`). */
  readonly failures = input<Readonly<Record<string, string>>>({});

  readonly availabilityRequested = output<AvailabilityRequest>();

  protected readonly testids = PRESCRIPTION_DISPENSE_TESTIDS;

  protected readonly prescribed = computed(() => prescribedText(this.item(), this.sameDrug()));
  protected readonly balance = computed(() => balanceText(this.item(), this.sameDrug()));

  protected priceOf(match: PrescriptionProductMatch): string {
    return match.price === null ? 'Sin precio publicado' : withDisplayCurrency(match.price, match.currencyCode);
  }

  protected refOf(match: PrescriptionProductMatch, site: PrescriptionProductSite): SiteProductRef {
    return { pharmacyId: match.pharmacyId, siteId: site.siteId, productId: match.pharmacyProductId };
  }

  protected isPending(match: PrescriptionProductMatch, site: PrescriptionProductSite): boolean {
    return this.pendingKeys().has(siteKey(this.refOf(match, site)));
  }

  protected failureOf(match: PrescriptionProductMatch, site: PrescriptionProductSite): string | null {
    return this.failures()[siteKey(this.refOf(match, site))] ?? null;
  }

  protected quantityOf(site: PrescriptionProductSite): string {
    if (!site.available) {
      return 'Sin unidades';
    }
    if (site.quantity === null) {
      return 'Sin conteo';
    }
    return site.quantity === 1 ? '1 unidad' : `${site.quantity} unidades`;
  }

  protected request(match: PrescriptionProductMatch, site: PrescriptionProductSite, available: boolean): void {
    this.availabilityRequested.emit({ ref: this.refOf(match, site), available });
  }
}

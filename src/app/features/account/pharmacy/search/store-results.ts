import { displayCurrency } from '../../../../core/money/display-currency';
import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { aperturaDe } from '../../../../core/data-access/pharmacy/opening-hours';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { pharmacyStoreRoute } from '../pharmacy.routes';
import { PHARMACY_TESTIDS } from '../pharmacy.testids';
import type { StoreHit } from './pharmacy-search.types';

/**
 * Los resultados del modo **Farmacias**: una tarjeta por sede publicada.
 *
 * El «desde X Bs» existe sólo cuando hay término, porque sólo entonces
 * significa algo: es el más barato **de lo que se buscó** en esa sede, no un
 * precio de la farmacia. Sin término no se pinta — poner ahí el producto más
 * barato del catálogo sería un número que no responde a ninguna pregunta.
 *
 * Las sedes sin nada publicado no llegan hasta acá: las filtra
 * `PharmacySearchService.searchStores` (Q-J2).
 */
@Component({
  selector: 'app-store-results',
  imports: [AppButtonLink, Badge, RouterLink],
  templateUrl: './store-results.html',
  styleUrl: './store-results.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoreResults {
  readonly items = input.required<readonly StoreHit[]>();

  /** Se pidió ordenar por distancia sin origen: nada se reordenó. */
  readonly sinOrigen = input(false, { transform: booleanAttribute });

  protected readonly testids = PHARMACY_TESTIDS;

  protected readonly porId = (sede: StoreHit): string => sede.id;

  /**
   * P34 · la insignia «Abierta 24 h» / «De turno hasta …». Estaba sólo en
   * `PharmacyShop`, que desde la tienda nueva ya no tiene ruta: en «Farmacia»
   * la API la mandaba (`open24h`, `onCallUntil`) y nadie la pintaba (visto en
   * navegador contra la API real el 26/10/2026).
   */
  protected readonly aperturaDe = aperturaDe;

  /** La tienda de la farmacia; `site` viaja por `queryParams` (ver `ProductResults`). */
  protected rutaDeTienda(sede: StoreHit): string {
    return pharmacyStoreRoute(sede.pharmacyId);
  }

  protected parametrosDeTienda(sede: StoreHit): Record<string, string> {
    return { site: sede.siteId };
  }

  /** «desde 6.00 BOB», o vacío si no hay término o la sede no lo publica. */
  protected desdeDe(sede: StoreHit): string {
    if (sede.fromAmount === null) {
      return '';
    }
    return sede.currency === null
      ? `desde ${sede.fromAmount}`
      : `desde ${sede.fromAmount}\u00A0${displayCurrency(sede.currency)}`;
  }

  protected distanciaDe(sede: StoreHit): string {
    if (sede.distanceKm === null) {
      return 'Elija desde dónde medir';
    }
    return `${sede.distanceKm.toLocaleString('es-BO', { maximumFractionDigits: 1 })} km`;
  }
}

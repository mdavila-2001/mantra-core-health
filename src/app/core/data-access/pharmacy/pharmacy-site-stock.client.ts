import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { SiteAvailability, SiteAvailabilityDraft, SiteStock } from './pharmacy-site-stock.types';

/**
 * Cliente del **stock por sucursal** de la farmacia (FAR-06).
 *
 * Aparte de `PharmacyClient` para no seguir engordándolo. Las dos llamadas son
 * del personal de la farmacia: el `X-Tenant-Id` lo agrega el interceptor de
 * autenticación, como en el resto del portal.
 */
@Injectable({ providedIn: 'root' })
export class PharmacySiteStockClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `PUT /pharmacies/:pharmacyId/sites/:siteId/products/:productId/availability`
   * — «lo tengo / no lo tengo» de un producto en una sede, con su cantidad.
   *
   * La primera escritura en una sede la inicializa entera con lo declarado en
   * el catálogo, así que ningún otro producto deja de ofrecerse de rebote.
   * Un 422 trae `details.reason` (ver `SITE_AVAILABILITY_REJECTIONS`) y un
   * `message` para la persona.
   */
  setSiteAvailability(
    pharmacyId: string,
    siteId: string,
    productId: string,
    draft: SiteAvailabilityDraft,
  ): Observable<SiteAvailability> {
    // Sólo las claves del contrato: la API valida con `forbidNonWhitelisted`.
    const body: SiteAvailabilityDraft =
      draft.quantity === undefined ? { available: draft.available } : { available: draft.available, quantity: draft.quantity };
    return this.http.put<SiteAvailability>(
      this.url(
        `/pharmacies/${encodeURIComponent(pharmacyId)}/sites/${encodeURIComponent(siteId)}` +
          `/products/${encodeURIComponent(productId)}/availability`,
      ),
      body,
    );
  }

  /**
   * `GET /pharmacy-inventory/sites/:siteId/stock` — las posiciones de la sede.
   * `items` vacío mientras la sede sigue en modo catálogo.
   */
  getSiteStock(siteId: string): Observable<SiteStock> {
    return this.http.get<SiteStock>(this.url(`/pharmacy-inventory/sites/${encodeURIComponent(siteId)}/stock`));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

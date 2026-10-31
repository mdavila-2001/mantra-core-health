import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { CreateInventoryLocationRequest, InventoryLocation, SpaceStock } from './inventory-locations.types';

/**
 * Cliente del botiquín por unidad — franja F5c.
 *
 * El stock **sigue** a la ubicación: reubicarla cambia su espacio, no mueve
 * líneas de existencias. Un botiquín con stock bloquea el retiro del espacio
 * (`SPACE_RETIRE_BLOCKED` con `kind: INVENTORY_LOCATION`).
 */
@Injectable({ providedIn: 'root' })
export class InventoryLocationsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /care-spaces/:id/stock` — desvío anotado: la pestaña «Stock» de la ficha. */
  listBySpace(careSpaceId: string): Observable<SpaceStock> {
    return this.http.get<SpaceStock>(this.url(`/care-spaces/${encodeURIComponent(careSpaceId)}/stock`));
  }

  /** `POST /pharmacy/:siteId/inventory-locations` — 409 `WARD_STOCK_ALREADY_EXISTS`, 422 `SPACE_NOT_STOCK_POINT`. */
  create(pharmacySiteId: string, body: CreateInventoryLocationRequest): Observable<InventoryLocation> {
    return this.http.post<InventoryLocation>(this.url(`/pharmacy/${encodeURIComponent(pharmacySiteId)}/inventory-locations`), body);
  }

  /** `POST /pharmacy/inventory-locations/:id/relocate {careSpaceId}`. */
  relocate(id: string, careSpaceId: string): Observable<InventoryLocation> {
    return this.http.post<InventoryLocation>(this.url(`/pharmacy/inventory-locations/${encodeURIComponent(id)}/relocate`), { careSpaceId });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import {
  SYNC_BATCH_LIMIT_MAX,
  type ExternalProductList,
  type IntegrationConnectionCreated,
  type IntegrationConnectionDraft,
  type IntegrationConnectionList,
  type ProductMappingCreated,
  type ProductMappingDraft,
  type ProductMappingList,
  type SyncBatchList,
  type SyncResult,
} from './pharmacy-integration.types';

/**
 * Cliente de la integración de una farmacia con su propio sistema (FAR-07).
 *
 * Todo cuelga de `/pharmacies/:pharmacyId/integration-connections`: la API
 * acota cada llamada a la farmacia que administra la organización activa
 * (`X-Tenant-Id`, que pone el interceptor), así que una conexión ajena es un
 * 404 y no un dato filtrado acá.
 *
 * - Altas que ya existían: la conexión y el vínculo producto ↔ código.
 * - Lecturas de FAR-07: conexiones, vínculos, el catálogo del sistema de la
 *   farmacia y los últimos lotes.
 * - `sync`: trae existencias del sistema de la farmacia y las aplica. Puede
 *   responder 422 (no configurado, conexión inactiva) o 502 (no respondió).
 */
@Injectable({ providedIn: 'root' })
export class PharmacyIntegrationClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /pharmacies/:pharmacyId/integration-connections`. */
  listConnections(pharmacyId: string): Observable<IntegrationConnectionList> {
    return this.http.get<IntegrationConnectionList>(this.connectionsUrl(pharmacyId));
  }

  /** `POST /pharmacies/:pharmacyId/integration-connections` — 201. */
  createConnection(
    pharmacyId: string,
    draft: IntegrationConnectionDraft,
  ): Observable<IntegrationConnectionCreated> {
    // Sin sucursal no viaja la clave: la API valida con `forbidNonWhitelisted`
    // y `IsUUID`, y un `undefined` declarado no dice «todas».
    const body: IntegrationConnectionDraft = {
      integrationMode: draft.integrationMode,
      supportsStockQuery: draft.supportsStockQuery,
      ...(draft.pharmacySiteId ? { pharmacySiteId: draft.pharmacySiteId } : {}),
    };
    return this.http.post<IntegrationConnectionCreated>(this.connectionsUrl(pharmacyId), body);
  }

  /** `GET …/:connectionId/product-mappings`. */
  listMappings(pharmacyId: string, connectionId: string): Observable<ProductMappingList> {
    return this.http.get<ProductMappingList>(this.mappingsUrl(pharmacyId, connectionId));
  }

  /** `POST …/:connectionId/product-mappings` — 201; 409 si el producto ya está vinculado. */
  createMapping(
    pharmacyId: string,
    connectionId: string,
    draft: ProductMappingDraft,
  ): Observable<ProductMappingCreated> {
    const body = Object.fromEntries(
      Object.entries(draft).filter(([, value]) => value !== undefined && value !== ''),
    ) as unknown as ProductMappingDraft;
    return this.http.post<ProductMappingCreated>(this.mappingsUrl(pharmacyId, connectionId), body);
  }

  /** `GET …/:connectionId/external-products` — el catálogo del sistema de la farmacia. */
  listExternalProducts(pharmacyId: string, connectionId: string): Observable<ExternalProductList> {
    return this.http.get<ExternalProductList>(
      `${this.connectionUrl(pharmacyId, connectionId)}/external-products`,
    );
  }

  /** `GET …/:connectionId/sync-batches?limit=` — los últimos lotes, del más nuevo al más viejo. */
  listSyncBatches(pharmacyId: string, connectionId: string, limit = 5): Observable<SyncBatchList> {
    const bounded = Math.min(SYNC_BATCH_LIMIT_MAX, Math.max(1, Math.trunc(limit)));
    return this.http.get<SyncBatchList>(`${this.connectionUrl(pharmacyId, connectionId)}/sync-batches`, {
      params: new HttpParams().set('limit', String(bounded)),
    });
  }

  /** `POST …/:connectionId/sync` — 200 con el resumen de lo recibido y lo aplicado. */
  sync(pharmacyId: string, connectionId: string): Observable<SyncResult> {
    return this.http.post<SyncResult>(`${this.connectionUrl(pharmacyId, connectionId)}/sync`, {});
  }

  private connectionsUrl(pharmacyId: string): string {
    return apiUrl(this.baseUrl, `/pharmacies/${encodeURIComponent(pharmacyId)}/integration-connections`);
  }

  private connectionUrl(pharmacyId: string, connectionId: string): string {
    return `${this.connectionsUrl(pharmacyId)}/${encodeURIComponent(connectionId)}`;
  }

  private mappingsUrl(pharmacyId: string, connectionId: string): string {
    return `${this.connectionUrl(pharmacyId, connectionId)}/product-mappings`;
  }
}

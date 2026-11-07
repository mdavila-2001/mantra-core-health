import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, of, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { BulkRequest, BulkResponse } from '../pharmacy/pharmacy-bulk.types';
import type {
  CatalogBulkKind,
  CatalogBulkPharmacy,
  CatalogBulkSnapshotRow,
} from './catalog-bulk.types';

interface CategoriesWire {
  readonly items: readonly { readonly name: string; readonly productCount: number }[];
}
interface ProductsWire {
  readonly items: readonly {
    readonly productCode: string;
    readonly brandName?: string;
    readonly unitPrice?: number | null;
  }[];
}

/**
 * Pharmacy catalog bulk load for the admin portal:
 * `POST /pharmacies/:pharmacyId/{categories,products,prices,sites}/bulk`
 * (modes CREATE / UPDATE / UPSERT, `dryRun`, up to 1000 rows per request).
 * Access (`SECURITY_ADMIN` or `PHARMACY_STAFF`) is decided by the API; a 403
 * is shown, never anticipated.
 */
@Injectable({ providedIn: 'root' })
export class CatalogBulkClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /pharmacy/pharmacies` — the pharmacies the session can load into. */
  pharmacies(): Observable<readonly CatalogBulkPharmacy[]> {
    return this.http
      .get<{ readonly items: readonly CatalogBulkPharmacy[] }>(
        apiUrl(this.baseUrl, '/pharmacy/pharmacies'),
      )
      .pipe(map((page) => page.items.map(({ id, code, name }) => ({ id, code, name }))));
  }

  /** One request of 1..1000 rows. A bad row comes back `REJECTED`, not as an HTTP error. */
  bulk(pharmacyId: string, kind: CatalogBulkKind, request: BulkRequest): Observable<BulkResponse> {
    return this.http.post<BulkResponse>(
      apiUrl(this.baseUrl, `/pharmacies/${encodeURIComponent(pharmacyId)}/${kind}/bulk`),
      { mode: request.mode, dryRun: request.dryRun ?? false, rows: request.rows },
    );
  }

  /**
   * Reloads what the catalog holds, through the regular read endpoints, to
   * prove persistence. `sites` has no read endpoint in this client: `null`.
   */
  snapshot(
    pharmacyId: string,
    kind: CatalogBulkKind,
  ): Observable<readonly CatalogBulkSnapshotRow[] | null> {
    const id = encodeURIComponent(pharmacyId);
    if (kind === 'categories') {
      return this.http.get<CategoriesWire>(apiUrl(this.baseUrl, `/pharmacies/${id}/categories`)).pipe(
        map((r) => r.items.map((c) => ({ key: c.name, detail: `${c.productCount} productos` }))),
      );
    }
    if (kind === 'sites') return of(null);
    return this.http
      .get<ProductsWire>(apiUrl(this.baseUrl, '/pharmacy/products'), {
        params: { pharmacyId, managed: 'true', limit: '500' },
      })
      .pipe(
        map((r) =>
          r.items.map((p) => ({
            key: p.productCode,
            detail: kind === 'prices' ? String(p.unitPrice ?? '—') : (p.brandName ?? ''),
          })),
        ),
      );
  }
}

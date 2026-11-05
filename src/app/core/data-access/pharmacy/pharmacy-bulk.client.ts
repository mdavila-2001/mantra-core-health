import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, concatMap, from, map, scan, takeLast, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import {
  BULK_BATCH_SIZE,
  type BulkProgress,
  type BulkRequest,
  type BulkResponse,
  type BulkRowResult,
  type BulkTarget,
} from './pharmacy-bulk.types';

/** Cómo se parte una carga larga. */
export interface BulkBatchOptions {
  /** Filas por pedido; por defecto {@link BULK_BATCH_SIZE}. */
  readonly batchSize?: number;
  /**
   * Se pregunta **antes** de cada lote: con `false` no sale ninguno más. El
   * lote en vuelo nunca se corta, porque el servidor quizá ya guardó sus filas.
   */
  readonly proceed?: () => boolean;
}

/**
 * Cliente de la carga masiva del catálogo de la farmacia (FAR-05).
 *
 * Vive aparte de `PharmacyClient` a propósito: la carga masiva tiene sus
 * propios tipos y su forma de partir el cuerpo, y el cliente de la farmacia ya
 * es grande. Quién puede cargar lo decide la API (`@Roles` y la guarda de
 * ámbito de la farmacia): un 403 se muestra, no se anticipa.
 */
@Injectable({ providedIn: 'root' })
export class PharmacyBulkClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `POST /pharmacies/:pharmacyId/:entity/bulk` — un pedido, de 1 a 1000
   * filas. Una fila mala vuelve como `REJECTED` en su resultado; el pedido
   * entero sólo falla por algo que no es de una fila (permiso, farmacia no
   * activa, cuerpo de más de 1 MB, red).
   */
  bulk<Row extends object>(
    pharmacyId: string,
    entity: BulkTarget,
    request: BulkRequest<Row>,
  ): Observable<BulkResponse> {
    const target =
      typeof entity === 'string'
        ? entity
        : `sites/${encodeURIComponent(entity.siteAvailability)}/availability`;
    return this.http.post<BulkResponse>(
      apiUrl(this.baseUrl, `/pharmacies/${encodeURIComponent(pharmacyId)}/${target}/bulk`),
      {
        mode: request.mode,
        ...(request.dryRun === undefined ? {} : { dryRun: request.dryRun }),
        rows: request.rows,
      },
    );
  }

  /**
   * La carga entera en lotes, **en serie**: el segundo lote sale cuando vuelve
   * el primero. Emite al volver cada lote con los resultados acumulados y su
   * `row` corrido al número de fila de toda la carga (la fila 1 del segundo
   * lote de 250 es la 251).
   *
   * Si un lote falla, el error corta la carga y lo ya emitido queda como está.
   */
  chunked<Row extends object>(
    pharmacyId: string,
    entity: BulkTarget,
    request: BulkRequest<Row>,
    options: BulkBatchOptions = {},
  ): Observable<BulkProgress> {
    const size = Math.max(1, options.batchSize ?? BULK_BATCH_SIZE);
    const proceed = options.proceed ?? (() => true);
    const total = request.rows.length;
    const batches: { readonly offset: number; readonly rows: readonly Row[] }[] = [];
    for (let offset = 0; offset < total; offset += size) {
      batches.push({ offset, rows: request.rows.slice(offset, offset + size) });
    }
    return from(batches).pipe(
      concatMap(({ offset, rows }) =>
        proceed()
          ? this.bulk(pharmacyId, entity, { ...request, rows }).pipe(
              map((response) => ({
                dryRun: response.dryRun,
                results: response.results.map(
                  (result): BulkRowResult => ({ ...result, row: result.row + offset }),
                ),
              })),
            )
          : EMPTY,
      ),
      scan(
        (progress: BulkProgress, batch: BulkResponse): BulkProgress => ({
          total,
          dryRun: batch.dryRun,
          results: [...progress.results, ...batch.results],
        }),
        { total, dryRun: request.dryRun ?? false, results: [] },
      ),
    );
  }

  /** Lo mismo que {@link chunked}, pero sólo el resultado final, unido. */
  bulkAll<Row extends object>(
    pharmacyId: string,
    entity: BulkTarget,
    request: BulkRequest<Row>,
    options: BulkBatchOptions = {},
  ): Observable<BulkResponse> {
    return this.chunked(pharmacyId, entity, request, options).pipe(
      takeLast(1),
      map(({ dryRun, results }) => ({ dryRun, results })),
    );
  }
}

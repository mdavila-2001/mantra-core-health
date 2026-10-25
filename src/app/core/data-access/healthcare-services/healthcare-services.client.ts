import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  HealthcareServiceOffer,
  HealthcareServiceOfferPatch,
  NewHealthcareServiceOffer,
  PracticeSiteOption,
} from './healthcare-services.types';

/**
 * Cliente del catálogo de procedimientos que una sede publica (CM-06).
 *
 * El precio propio se crea aparte con `ServicesCatalogClient.create` y su `id`
 * viaja acá como `serviceCatalogId`: este cliente no toca `billing`.
 */
@Injectable({ providedIn: 'root' })
export class HealthcareServicesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /practices/:practiceId/sites` — las sedes de la organización.
   *
   * Acepta tanto el array pelado como una página `{ items }`: el contrato de
   * sedes no fija la forma y las dos aparecen en la API.
   */
  listSites(practiceId: string): Observable<readonly PracticeSiteOption[]> {
    return this.http
      .get<readonly PracticeSiteOption[] | { readonly items: readonly PracticeSiteOption[] }>(
        this.url(`/practices/${encodeURIComponent(practiceId)}/sites`),
      )
      .pipe(map((body) => (Array.isArray(body) ? body : (body as { items: readonly PracticeSiteOption[] }).items)));
  }

  /** `GET /practices/:practiceId/healthcare-services?practiceSiteId=` — lo que publica una sede. */
  listOffers(
    practiceId: string,
    practiceSiteId: string,
  ): Observable<readonly HealthcareServiceOffer[]> {
    const params = new HttpParams().set('practiceSiteId', practiceSiteId);
    return this.http
      .get<{ readonly items: readonly HealthcareServiceOffer[] }>(
        this.url(`/practices/${encodeURIComponent(practiceId)}/healthcare-services`),
        { params },
      )
      .pipe(map((body) => body.items));
  }

  /**
   * `POST /practices/:practiceId/healthcare-services` — publica un procedimiento en una sede.
   *
   * Un 409 (ya publicado en la sede) o un 422 (concepto fuera del nomenclador)
   * se propagan como `HttpErrorResponse`: la pantalla los explica, no este cliente.
   */
  createOffer(
    practiceId: string,
    offer: NewHealthcareServiceOffer,
  ): Observable<HealthcareServiceOffer> {
    return this.http.post<HealthcareServiceOffer>(
      this.url(`/practices/${encodeURIComponent(practiceId)}/healthcare-services`),
      withoutUndefined(offer),
    );
  }

  /** `PATCH /practices/:practiceId/healthcare-services/:id` — cambia el precio o activa/desactiva. */
  updateOffer(
    practiceId: string,
    id: string,
    patch: HealthcareServiceOfferPatch,
  ): Observable<HealthcareServiceOffer> {
    return this.http.patch<HealthcareServiceOffer>(
      this.url(
        `/practices/${encodeURIComponent(practiceId)}/healthcare-services/${encodeURIComponent(id)}`,
      ),
      withoutUndefined(patch),
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/** El backend valida con `forbidNonWhitelisted`: un opcional en `undefined` viajaría como clave. */
function withoutUndefined<T extends object>(source: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined));
}

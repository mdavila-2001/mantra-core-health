import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  NewServiceCatalogItem,
  Practice,
  ServiceCatalogItem,
  ServiceCatalogPage,
  ServiceCatalogQuery,
} from './services-catalog.types';

/**
 * Cliente del catálogo maestro de servicios (`billing.service_catalog`, punto 3
 * del reclamo) y de las prácticas sobre las que se organiza.
 *
 * ## Todo cuelga de la práctica elegida
 *
 * Igual que el mayor contable: ninguna lectura del catálogo responde sin
 * `practiceId`, así que `listPractices` va primero. Se lee `GET /practices`
 * directo —no el cliente de contabilidad, que es otro dominio aunque comparta
 * el mismo endpoint— para que este cliente quede autocontenido.
 */
@Injectable({ providedIn: 'root' })
export class ServicesCatalogClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /practices` — las prácticas de la organización.
   *
   * El endpoint devuelve el **array pelado**, no una página `{ items }`: eso
   * último era una suposición de este cliente, y con la respuesta real emitía
   * `undefined` y dejaba a la pantalla clavada en el esqueleto.
   */
  listPractices(): Observable<readonly Practice[]> {
    return this.http.get<readonly Practice[]>(this.url('/practices'));
  }

  /**
   * `GET /billing/service-catalog` — una página del catálogo de una práctica.
   *
   * Sin rol de administración: cualquier profesional que arme un presupuesto
   * necesita leer la lista fija de servicios sobre la que cotiza.
   */
  search(practiceId: string, query: ServiceCatalogQuery = {}): Observable<ServiceCatalogPage> {
    // Parámetro a parámetro y no con un objeto: el backend valida con
    // `forbidNonWhitelisted`, así que un opcional presente en `undefined`
    // viajaría como clave declarada y la petición volvería con 400.
    let params = new HttpParams().set('practiceId', practiceId);
    if (query.query !== undefined && query.query !== '') {
      params = params.set('q', query.query);
    }
    if (query.isActive !== undefined) {
      params = params.set('isActive', String(query.isActive));
    }
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http.get<ServiceCatalogPage>(this.url('/billing/service-catalog'), { params });
  }

  /**
   * `POST /billing/service-catalog` — alta de un servicio nuevo. Sólo
   * `SECURITY_ADMIN`: la lista queda fija y no cada profesional inventando
   * servicios nuevos.
   */
  create(item: NewServiceCatalogItem): Observable<ServiceCatalogItem> {
    return this.http.post<ServiceCatalogItem>(this.url('/billing/service-catalog'), item);
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

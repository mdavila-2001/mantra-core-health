import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  ConsultaDeVitrina,
  DisponibilidadDeMedicamento,
  PaginaDeVitrina,
  PuntoDeOrigen,
} from './public-marketplace.types';

/**
 * Cliente de la vitrina pública de medicamentos — **sin sesión**.
 *
 * ## Qué superficie es
 *
 * La misma familia que `PublicDirectoryClient`: anónima, cacheable, y sin
 * `Authorization` en ninguna petición. Vive aparte porque habla con otro
 * módulo de la API —el catálogo de farmacia, no el índice de perfiles— y
 * porque `GET /public/search/medications` **no sirve para esto**: su índice son
 * perfiles públicos, y un medicamento no es un perfil, así que devuelve vacío
 * por construcción.
 *
 * ## Sólo consulta
 *
 * Las dos lecturas son de exhibición y disponibilidad. No hay reserva, pedido
 * ni carrito, y ninguna respuesta trae un identificador de producto con el que
 * se pueda armar uno: AloVida no vende medicamentos.
 */
@Injectable({ providedIn: 'root' })
export class PublicMarketplaceClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /public/medications` — la vitrina.
   *
   * El origen viaja entero o no viaja: media coordenada no dice desde dónde
   * medir, y el backend la descarta en vez de fallar.
   */
  listMedications(consulta: ConsultaDeVitrina = {}): Observable<PaginaDeVitrina> {
    let params = new HttpParams();
    if (consulta.q !== undefined && consulta.q !== '') {
      params = params.set('q', consulta.q);
    }
    if (consulta.group !== undefined && consulta.group !== '') {
      params = params.set('group', consulta.group);
    }
    params = this.conOrigen(params, consulta.origin, consulta.radiusKm);
    if (consulta.limit !== undefined) {
      params = params.set('limit', String(consulta.limit));
    }
    return this.http.get<PaginaDeVitrina>(this.url('/public/medications'), { params });
  }

  /**
   * `GET /public/medications/:conceptId/availability` — qué farmacias lo
   * tienen, con precio y distancia.
   */
  getAvailability(
    conceptId: string,
    consulta: { origin?: PuntoDeOrigen; radiusKm?: number } = {},
  ): Observable<DisponibilidadDeMedicamento> {
    const params = this.conOrigen(new HttpParams(), consulta.origin, consulta.radiusKm);
    return this.http.get<DisponibilidadDeMedicamento>(
      this.url(`/public/medications/${conceptId}/availability`),
      { params },
    );
  }

  /** El origen y su radio, cuando los hay. */
  private conOrigen(
    params: HttpParams,
    origin: PuntoDeOrigen | undefined,
    radiusKm: number | undefined,
  ): HttpParams {
    if (origin === undefined) {
      return params;
    }
    const conPunto = params.set('lat', String(origin.lat)).set('lng', String(origin.lng));
    return radiusKm === undefined ? conPunto : conPunto.set('radiusKm', String(radiusKm));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

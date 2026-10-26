import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';

/**
 * La calle de un punto del mapa, tal como la devuelve `POST /public/geo/reverse`.
 *
 * `found: false` es «no se conoce ninguna calle ahí», no un error: el alta lo
 * dice y deja escribirla a mano. Un proveedor caído llega como error HTTP (503).
 */
export interface StreetFromPoint {
  readonly found: boolean;
  /** «Calle Guapay 3861, Equipetrol»: calle, número y barrio, lo que haya. */
  readonly line?: string;
  /** La calle sola, sin número ni barrio. */
  readonly road?: string;
  readonly houseNumber?: string;
  /** El barrio, la zona o el distrito (lo primero que conozca el proveedor). */
  readonly neighbourhood?: string;
  readonly city?: string;
  /** La atribución que exige la licencia de los datos (OpenStreetMap, ODbL). */
  readonly attribution: string;
}

/**
 * Del punto del mapa a la línea de dirección (pedido del cliente del 26/10/2026:
 * «llene la línea de dirección»).
 *
 * Va contra la API y no contra un geocodificador externo: la política de
 * seguridad del front deja `connect-src` en `'self'`, y así se queda. La API es
 * la que consulta al proveedor. El punto viaja en el **cuerpo**, no en la URL:
 * es el domicilio de alguien y una URL queda en historiales y registros.
 */
@Injectable({ providedIn: 'root' })
export class ReverseGeocodingClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  streetAt(latitude: number, longitude: number): Observable<StreetFromPoint> {
    return this.http.post<StreetFromPoint>(apiUrl(this.baseUrl, '/public/geo/reverse'), {
      latitude,
      longitude,
    });
  }
}

import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, throwError, timeout, TimeoutError, type Observable } from 'rxjs';

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
  /** El país del punto, ISO 3166-1 alfa-2 en mayúsculas («BO»). */
  readonly countryCode?: string;
  /**
   * Las divisiones administrativas del punto, para cualquier país: 1 =
   * departamento / estado / región, 2 = provincia, 3 = municipio / ciudad, y el
   * distrito o zona. Un nivel que el proveedor no conoce no viene.
   */
  readonly adminAreas?: AdminAreas;
  /** La atribución que exige la licencia de los datos (OpenStreetMap, ODbL). */
  readonly attribution: string;
}

/** Ver {@link StreetFromPoint.adminAreas}. */
export interface AdminAreas {
  readonly level1?: string;
  readonly level2?: string;
  readonly level3?: string;
  readonly district?: string;
}

/** La atribución que exige la licencia ODbL, la misma que pone la API. */
export const OSM_ATTRIBUTION = '© colaboradores de OpenStreetMap (ODbL)';

/** El servidor público de Nominatim, consultado desde el navegador. */
export const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

/**
 * Si la respuesta de la API dice «el geocodificador no contestó»: un 5xx (la
 * API devuelve 503), un 429 o ninguna respuesta. Ante estas, y sólo ante estas,
 * el navegador pregunta por su cuenta. Un 400 es un punto mal formado y se
 * sigue informando como error.
 */
function proveedorCaido(error: unknown): boolean {
  return (
    error instanceof TimeoutError ||
    (error instanceof HttpErrorResponse &&
      (error.status === 0 || error.status === 429 || error.status >= 500))
  );
}

/**
 * Cuánto se espera a la API antes de preguntar desde el navegador (30/10/2026).
 *
 * Con los proveedores colgados —no rechazando— la API tardaba 6 s por cada uno
 * antes de responder 503, y las pantallas se rendían antes (el alta de
 * paciente espera 10 s; el selector del mapa, 20): el respaldo nunca llegaba a
 * correr y la calle seguía «No disponible por ahora.». Una API sana responde
 * en uno o dos segundos.
 */
export const API_BUDGET_MS = 4_000;

/** Cuánto se espera a Nominatim desde el navegador: los dos topes suman menos de 10 s. */
export const BROWSER_BUDGET_MS = 5_000;

/**
 * Del punto del mapa a la línea de dirección (pedido del cliente del 26/10/2026:
 * «llene la línea de dirección»).
 *
 * Primero va contra la API, que consulta al proveedor: el tercero no ve la IP
 * ni la sesión de la persona. El punto viaja en el **cuerpo**, no en la URL: es
 * el domicilio de alguien y una URL queda en historiales y registros.
 *
 * ## Respaldo desde el navegador (28/10/2026)
 *
 * En el servidor desplegado la API respondía 503 a todo punto: Nominatim y
 * Photon rechazan o no alcanzan al servidor, y la calle decía siempre «No
 * disponible por ahora.». Si la API dice que el proveedor no contestó, el
 * navegador le pregunta directo a Nominatim, que admite consultas de
 * aplicaciones web identificadas por su `Referer`. El costo, aceptado a
 * cambio de que la calle aparezca: en ese caso OpenStreetMap ve la IP de la
 * persona y el punto. `connect-src` se abre sólo a ese host
 * (`security-headers.ts`).
 *
 * El pedido sale por un `HttpClient` armado sobre `HttpBackend`, sin la cadena
 * de interceptores: `authInterceptor` le pondría el JWT a un tercero, y sin
 * encabezados propios es un GET simple que no necesita preflight de CORS.
 */
@Injectable({ providedIn: 'root' })
export class ReverseGeocodingClient {
  private readonly http = inject(HttpClient);
  private readonly externo = new HttpClient(inject(HttpBackend));
  private readonly baseUrl = inject(API_BASE_URL);

  streetAt(latitude: number, longitude: number): Observable<StreetFromPoint> {
    return this.http
      .post<StreetFromPoint>(apiUrl(this.baseUrl, '/public/geo/reverse'), {
        latitude,
        longitude,
      })
      .pipe(
        timeout(API_BUDGET_MS),
        catchError((error: unknown) =>
          proveedorCaido(error)
            ? this.desdeElNavegador(latitude, longitude)
            : throwError(() => error),
        ),
      );
  }

  private desdeElNavegador(latitude: number, longitude: number): Observable<StreetFromPoint> {
    return this.externo
      .get<NominatimReverse>(NOMINATIM_REVERSE_URL, {
        params: {
          format: 'jsonv2',
          lat: String(latitude),
          lon: String(longitude),
          zoom: '18',
          addressdetails: '1',
          'accept-language': 'es',
        },
      })
      .pipe(timeout(BROWSER_BUDGET_MS), map(nominatimToStreet));
  }
}

/** Lo que se lee de la respuesta `jsonv2` de Nominatim. */
export interface NominatimReverse {
  readonly error?: string;
  readonly address?: Readonly<Record<string, string | undefined>>;
}

/**
 * La misma traducción que hace la API (`toResult` en
 * `reverse-geocoding.service.ts`): calle, número y barrio en una línea, y los
 * niveles administrativos de cualquier país. Nunca inventa una dirección.
 */
export function nominatimToStreet(respuesta: NominatimReverse): StreetFromPoint {
  const a = respuesta?.address;
  if (!a || respuesta.error) return { found: false, attribution: OSM_ATTRIBUTION };

  const limpio = (...valores: (string | undefined)[]) =>
    valores.map((v) => v?.trim()).find((v): v is string => !!v);
  const road = limpio(a['road'], a['pedestrian'], a['footway'], a['path'], a['residential']);
  const houseNumber = limpio(a['house_number']);
  const neighbourhood = limpio(a['neighbourhood'], a['suburb'], a['quarter'], a['city_district']);
  const city = limpio(a['city'], a['town'], a['village'], a['municipality']);
  const countryCode = limpio(a['country_code'])?.toUpperCase();

  const niveles: AdminAreas = {
    ...entrada('level1', limpio(a['state'], a['region'], a['province'])),
    ...entrada('level2', limpio(a['county'], a['state_district'])),
    ...entrada(
      'level3',
      limpio(a['municipality'], a['city'], a['town'], a['village'], a['hamlet']),
    ),
    ...entrada('district', limpio(a['city_district'], a['suburb'], a['borough'], a['quarter'])),
  };
  const ubicacion = {
    ...(countryCode ? { countryCode } : {}),
    ...(Object.keys(niveles).length > 0 ? { adminAreas: niveles } : {}),
  };

  const calle = [road, houseNumber].filter(Boolean).join(' ');
  const line = [calle, neighbourhood].filter(Boolean).join(', ');
  if (line === '') {
    return { found: false, ...(city ? { city } : {}), ...ubicacion, attribution: OSM_ATTRIBUTION };
  }
  return {
    found: true,
    line,
    ...(road ? { road } : {}),
    ...(houseNumber ? { houseNumber } : {}),
    ...(neighbourhood ? { neighbourhood } : {}),
    ...(city ? { city } : {}),
    ...ubicacion,
    attribution: OSM_ATTRIBUTION,
  };
}

function entrada<K extends keyof AdminAreas>(
  clave: K,
  valor: string | undefined,
): Partial<Record<K, string>> {
  return valor ? ({ [clave]: valor } as Partial<Record<K, string>>) : {};
}

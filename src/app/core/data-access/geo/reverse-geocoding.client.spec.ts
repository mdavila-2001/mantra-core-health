import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { vi } from 'vitest';

import {
  API_BUDGET_MS,
  BROWSER_BUDGET_MS,
  NOMINATIM_REVERSE_URL,
  OSM_ATTRIBUTION,
  ReverseGeocodingClient,
  nominatimToStreet,
  type StreetFromPoint,
} from './reverse-geocoding.client';

/**
 * Lo que estas pruebas fijan:
 *
 * 1. **Primero la API**, con el punto en el cuerpo.
 * 2. **Sólo si la API dice que el proveedor no contestó** (un 5xx, un 429 o
 *    sin respuesta), el navegador pregunta a Nominatim. Un 400 sigue siendo
 *    un error.
 * 3. **Al tercero no le llega el JWT**: el pedido externo no pasa por los
 *    interceptores de la aplicación.
 * 4. **La traducción es la de la API**: misma línea, mismos niveles, y sin
 *    calle no se inventa una.
 */

const SCZ = { lat: -17.7605, lng: -63.13 };

/** Un interceptor que marca todo lo que pasa por la cadena de la aplicación. */
const marcaDeLaApp: HttpInterceptorFn = (req, next) =>
  next(req.clone({ setHeaders: { Authorization: 'Bearer token-del-paciente' } }));

describe('ReverseGeocodingClient', () => {
  let client: ReverseGeocodingClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([marcaDeLaApp])), provideHttpClientTesting()],
    });
    client = TestBed.inject(ReverseGeocodingClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function pedir(): { valor?: StreetFromPoint; error?: unknown } {
    const salida: { valor?: StreetFromPoint; error?: unknown } = {};
    client.streetAt(SCZ.lat, SCZ.lng).subscribe({
      next: (v) => (salida.valor = v),
      error: (e: unknown) => (salida.error = e),
    });
    return salida;
  }

  const apiCaida = (status: number) =>
    http
      .expectOne((r) => r.url.endsWith('/public/geo/reverse'))
      .flush({ reason: 'GEOCODING_PROVIDER_UNAVAILABLE' }, { status, statusText: 'Error' });

  it('correcto: con la API respondiendo, no sale del propio origen', () => {
    const salida = pedir();

    const req = http.expectOne((r) => r.url.endsWith('/public/geo/reverse'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ latitude: SCZ.lat, longitude: SCZ.lng });
    req.flush({ found: true, line: 'Calle 1, Centro', attribution: OSM_ATTRIBUTION });

    expect(salida.valor?.line).toBe('Calle 1, Centro');
    http.expectNone((r) => r.url.startsWith(NOMINATIM_REVERSE_URL));
  });

  it('correcto: 503 de la API → el navegador pregunta a Nominatim y escribe la calle', () => {
    const salida = pedir();
    apiCaida(503);

    const externo = http.expectOne((r) => r.url === NOMINATIM_REVERSE_URL);
    expect(externo.request.method).toBe('GET');
    expect(externo.request.params.get('lat')).toBe(String(SCZ.lat));
    expect(externo.request.params.get('lon')).toBe(String(SCZ.lng));
    expect(externo.request.params.get('format')).toBe('jsonv2');
    expect(externo.request.params.get('accept-language')).toBe('es');
    externo.flush({
      address: {
        road: 'Avenida Virgen de Cotoca',
        neighbourhood: 'Condominio Kerana I',
        city: 'Santa Cruz de la Sierra',
        state: 'Santa Cruz',
        country_code: 'bo',
      },
    });

    expect(salida.error).toBeUndefined();
    expect(salida.valor).toMatchObject({
      found: true,
      line: 'Avenida Virgen de Cotoca, Condominio Kerana I',
      road: 'Avenida Virgen de Cotoca',
      countryCode: 'BO',
      adminAreas: { level1: 'Santa Cruz', level3: 'Santa Cruz de la Sierra' },
    });
  });

  it('correcto: al tercero no le llega el JWT ni ningún encabezado de la aplicación', () => {
    pedir();
    const api = http.expectOne((r) => r.url.endsWith('/public/geo/reverse'));
    expect(api.request.headers.get('Authorization')).toBe('Bearer token-del-paciente');
    api.flush(null, { status: 503, statusText: 'Service Unavailable' });

    const externo = http.expectOne((r) => r.url === NOMINATIM_REVERSE_URL);
    expect(externo.request.headers.keys()).toEqual([]);
    externo.flush({ address: { road: 'Calle 1' } });
  });

  for (const status of [0, 429, 500, 502, 504]) {
    it(`límite: ${status} de la API también cae al navegador`, () => {
      const salida = pedir();
      apiCaida(status);
      http
        .expectOne((r) => r.url === NOMINATIM_REVERSE_URL)
        .flush({ address: { road: 'Calle 2' } });
      expect(salida.valor?.line).toBe('Calle 2');
    });
  }

  describe('con la API colgada', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('correcto: si la API no contesta a tiempo, el navegador pregunta sin esperarla', () => {
      const salida = pedir();
      const api = http.expectOne((r) => r.url.endsWith('/public/geo/reverse'));

      vi.advanceTimersByTime(API_BUDGET_MS);

      expect(api.cancelled).toBe(true);
      http
        .expectOne((r) => r.url === NOMINATIM_REVERSE_URL)
        .flush({ address: { road: 'Calle 3', suburb: 'Centro' } });
      expect(salida.valor?.line).toBe('Calle 3, Centro');
    });

    it('límite: con los dos colgados, la pantalla se entera antes de los 10 s del alta', () => {
      const salida = pedir();
      http.expectOne((r) => r.url.endsWith('/public/geo/reverse'));
      vi.advanceTimersByTime(API_BUDGET_MS);
      const externo = http.expectOne((r) => r.url === NOMINATIM_REVERSE_URL);

      vi.advanceTimersByTime(BROWSER_BUDGET_MS);

      expect(externo.cancelled).toBe(true);
      expect(salida.error).toBeDefined();
      expect(API_BUDGET_MS + BROWSER_BUDGET_MS).toBeLessThan(10_000);
    });
  });

  it('inválido: un 400 de la API se informa como error y no sale a un tercero', () => {
    const salida = pedir();
    apiCaida(400);

    expect(salida.error).toBeDefined();
    http.expectNone((r) => r.url.startsWith(NOMINATIM_REVERSE_URL));
  });

  it('inválido: si Nominatim también falla, se informa el error («No disponible por ahora.»)', () => {
    const salida = pedir();
    apiCaida(503);
    http
      .expectOne((r) => r.url === NOMINATIM_REVERSE_URL)
      .flush(null, { status: 403, statusText: 'Forbidden' });

    expect(salida.valor).toBeUndefined();
    expect(salida.error).toBeDefined();
  });

  describe('nominatimToStreet', () => {
    it('correcto: calle, número y barrio en una línea', () => {
      expect(
        nominatimToStreet({
          address: { road: 'Calle Guapay', house_number: '3861', suburb: 'Equipetrol' },
        }),
      ).toMatchObject({
        found: true,
        line: 'Calle Guapay 3861, Equipetrol',
        houseNumber: '3861',
        adminAreas: { district: 'Equipetrol' },
      });
    });

    it('límite: sin calle ni barrio no hay línea, pero sí país y niveles', () => {
      expect(
        nominatimToStreet({
          address: { town: 'La Guardia', state: 'Santa Cruz', country_code: 'bo' },
        }),
      ).toEqual({
        found: false,
        city: 'La Guardia',
        countryCode: 'BO',
        adminAreas: { level1: 'Santa Cruz', level3: 'La Guardia' },
        attribution: OSM_ATTRIBUTION,
      });
    });

    it('inválido: «Unable to geocode» es «no encontrado», no un error', () => {
      expect(nominatimToStreet({ error: 'Unable to geocode' })).toEqual({
        found: false,
        attribution: OSM_ATTRIBUTION,
      });
    });
  });
});

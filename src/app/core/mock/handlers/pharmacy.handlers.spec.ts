import { HttpHeaders } from '@angular/common/http';

import { crearRouterSimulado } from './index';
import { isMockReply, type MockMethod, type MockRequest } from '../mock-router';

/**
 * Carril Marcelo, «Farmacia: cliente, mocks y contrato real» (2026-09-25),
 * H2-H3: la Ola 0 (`GET /pharmacy/pharmacies/:id`, `GET
 * /pharmacy/sites/:siteId/prices`) y la coherencia de precio del mock —
 * mismo `price`/`stock`/`requiresPrescription` que `productos` en los tres
 * caminos por los que un precio puede salir: `/sites/:siteId/prices`,
 * `/pharmacy-inventory/availability` y `POST /pharmacy/orders`.
 */
describe('handlers de farmacia: perfil, precios de sede y coherencia', () => {
  const router = crearRouterSimulado();

  function pedir(method: MockMethod, path: string, body: unknown = {}) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user: null,
    } satisfies MockRequest);
  }

  function pedirConQuery(method: MockMethod, path: string, query: Record<string, string>) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body: {},
      headers: new HttpHeaders(),
      user: null,
    } satisfies MockRequest);
  }

  function estado(resultado: unknown): number {
    return isMockReply(resultado) ? resultado.status : 200;
  }

  function cuerpoDe<T>(resultado: unknown): T {
    return (isMockReply(resultado) ? resultado.body : resultado) as T;
  }

  it('GET /pharmacy/pharmacies/:id trae el perfil con sus sedes y sus coordenadas', () => {
    const lista = cuerpoDe<{ items: readonly { id: string }[] }>(pedir('GET', '/pharmacy/pharmacies'));
    const id = lista.items[0]!.id;

    const detalle = cuerpoDe<{ sites: readonly { latitude: number | null }[] }>(pedir('GET', `/pharmacy/pharmacies/${id}`));

    expect(detalle.sites[0]!.latitude).not.toBeNull();
  });

  it('GET /pharmacy/pharmacies/:id con un id desconocido responde 404', () => {
    const resultado = pedir('GET', '/pharmacy/pharmacies/00000000-0000-0000-0000-000000000000');
    expect(estado(resultado)).toBe(404);
  });

  it('GET /pharmacy/sites/:siteId/prices con una sede desconocida responde 404', () => {
    const resultado = pedir('GET', '/pharmacy/sites/00000000-0000-0000-0000-000000000000/prices');
    expect(estado(resultado)).toBe(404);
  });

  it('el precio de un producto coincide en /sites/:siteId/prices, /availability y POST /orders', () => {
    const lista = cuerpoDe<{ items: readonly { id: string }[] }>(pedir('GET', '/pharmacy/pharmacies'));
    const farmaciaId = lista.items[0]!.id;
    const detalle = cuerpoDe<{ sites: readonly { id: string }[] }>(pedir('GET', `/pharmacy/pharmacies/${farmaciaId}`));
    const siteId = detalle.sites[0]!.id;

    const precios = cuerpoDe<{ items: readonly { productId: string; unitAmount: string; requiresPrescription: boolean | null }[] }>(
      pedir('GET', `/pharmacy/sites/${siteId}/prices`),
    );
    const productId = precios.items[0]!.productId;
    const precioEnSede = precios.items[0]!.unitAmount;

    const disponibilidad = cuerpoDe<{ items: readonly { siteId: string; products: readonly { productId: string; price: { unitAmount: string } | null }[] }[] }>(
      pedirConQuery('GET', '/pharmacy-inventory/availability', { products: productId }),
    );
    const enDisponibilidad = disponibilidad.items.find((s) => s.siteId === siteId)!.products.find((p) => p.productId === productId)!;
    expect(enDisponibilidad.price!.unitAmount).toBe(precioEnSede);

    const pedido = cuerpoDe<{ lines: readonly { productId: string; unitPriceAmount: string | null }[] }>(
      pedir('POST', '/pharmacy/orders', { siteId, lines: [{ productId, quantity: 1 }] }),
    );
    expect(pedido.lines.find((l) => l.productId === productId)!.unitPriceAmount).toBe(precioEnSede);

    expect(precios.items[0]!.requiresPrescription).not.toBeUndefined();
  });

  it('un producto con stock 0 no aparece ni en /prices ni en /availability', () => {
    const lista = cuerpoDe<{ items: readonly { id: string }[] }>(pedir('GET', '/pharmacy/pharmacies'));
    const farmaciaId = lista.items[0]!.id;
    const detalle = cuerpoDe<{ sites: readonly { id: string }[] }>(pedir('GET', `/pharmacy/pharmacies/${farmaciaId}`));
    const siteId = detalle.sites[0]!.id;

    // Todos los productos publicados en la búsqueda, para encontrar el sin stock.
    const catalogo = cuerpoDe<{ items: readonly { id: string; pharmacyId: string }[] }>(
      pedirConQuery('GET', '/pharmacy/products', { pharmacyId: farmaciaId, limit: '100' }),
    );
    const precios = cuerpoDe<{ items: readonly { productId: string }[] }>(pedir('GET', `/pharmacy/sites/${siteId}/prices`));
    const sinStock = catalogo.items.find((p) => !precios.items.some((i) => i.productId === p.id));
    expect(sinStock).toBeDefined();

    expect(precios.items.some((i) => i.productId === sinStock!.id)).toBe(false);

    const disponibilidad = cuerpoDe<{ items: readonly { siteId: string; products: readonly { productId: string }[] }[] }>(
      pedirConQuery('GET', '/pharmacy-inventory/availability', { products: sinStock!.id }),
    );
    const enEsaSede = disponibilidad.items.find((s) => s.siteId === siteId)!.products;
    expect(enEsaSede.some((p) => p.productId === sinStock!.id)).toBe(false);
  });

  it('/pharmacy/sites ordena por distancia con origen y por nombre de farmacia sin origen', () => {
    const sinOrigen = cuerpoDe<{ items: readonly { pharmacyName: string; distanceKm: number | null }[] }>(
      pedirConQuery('GET', '/pharmacy/sites', {}),
    );
    expect(sinOrigen.items.every((s) => s.distanceKm === null)).toBe(true);
    const nombresOrdenados = [...sinOrigen.items].sort((a, b) => a.pharmacyName.localeCompare(b.pharmacyName, 'es'));
    expect(sinOrigen.items.map((s) => s.pharmacyName)).toEqual(nombresOrdenados.map((s) => s.pharmacyName));

    const conOrigen = cuerpoDe<{ items: readonly { distanceKm: number | null }[] }>(
      pedirConQuery('GET', '/pharmacy/sites', { lat: '-17.7833', lng: '-63.1821' }),
    );
    expect(conOrigen.items.every((s) => s.distanceKm !== null)).toBe(true);
    const distancias = conOrigen.items.map((s) => s.distanceKm!);
    expect([...distancias].sort((a, b) => a - b)).toEqual(distancias);
  });

  it('/pharmacy/products?pharmacyId filtra al catálogo de esa farmacia', () => {
    const lista = cuerpoDe<{ items: readonly { id: string }[] }>(pedir('GET', '/pharmacy/pharmacies'));
    const farmaciaId = lista.items[0]!.id;
    const otraId = lista.items[1]!.id;

    const soloUna = cuerpoDe<{ items: readonly { pharmacyId: string }[] }>(
      pedirConQuery('GET', '/pharmacy/products', { pharmacyId: farmaciaId, limit: '100' }),
    );
    expect(soloUna.items.every((p) => p.pharmacyId === farmaciaId)).toBe(true);

    const soloOtra = cuerpoDe<{ items: readonly { pharmacyId: string }[] }>(
      pedirConQuery('GET', '/pharmacy/products', { pharmacyId: otraId, limit: '100' }),
    );
    expect(soloOtra.items.every((p) => p.pharmacyId === otraId)).toBe(true);
  });
});

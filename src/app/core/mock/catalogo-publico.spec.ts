import { HttpHeaders } from '@angular/common/http';

import { vitrinas } from './fixtures/comunidad';
import { crearRouterSimulado } from './handlers';
import { isMockReply, type MockMethod } from './mock-router';

/* ============================================================================
    Las dos lecturas que alimentan las fichas de clínica y de farmacia dentro
    del panel (P30 y P31 de `PENDIENTES-BACKEND.md`).

    El barrido general sólo comprueba que ningún manejador lance; esto
    comprueba lo que las pantallas necesitan: que cada ficha publique un
    catálogo, que sea el mismo en cada llamada y que un slug del vertical
    equivocado dé 404 en vez de servir cualquier cosa.
    ========================================================================== */

const router = crearRouterSimulado();

function pedir(path: string): unknown {
  const partes = path.split('?');
  const encontrado = router.match('GET' as MockMethod, partes[0]!);
  if (encontrado === null) throw new Error(`sin manejador para ${path}`);
  return encontrado.handler({
    method: 'GET',
    path: partes[0]!,
    params: encontrado.params,
    query: new URLSearchParams(partes[1] ?? ''),
    body: {},
    headers: new HttpHeaders(),
    user: null,
  });
}

function items(respuesta: unknown): readonly Record<string, unknown>[] {
  return (respuesta as { items: readonly Record<string, unknown>[] }).items;
}

const CLINICA = vitrinas.filtrar((v) => v.kind === 'ORGANIZATION')[0]!.slug;
const FARMACIA = vitrinas.filtrar((v) => v.kind === 'PHARMACY')[0]!.slug;

describe('el catálogo que publica cada ficha', () => {
  it('una clínica publica sus servicios con código, nombre y precio', () => {
    const servicios = items(pedir(`/public/profiles/o/${CLINICA}/services`));

    expect(servicios.length).toBeGreaterThan(0);
    for (const servicio of servicios) {
      expect(typeof servicio['code']).toBe('string');
      expect(typeof servicio['name']).toBe('string');
      expect(typeof servicio['isActive']).toBe('boolean');
      // El precio es texto exacto o falta: nunca un `0.00` que se leería como
      // «no se cobra».
      expect(servicio['price'] === null || typeof servicio['price'] === 'string').toBe(true);
      expect(Number(servicio['price'] ?? '1')).not.toBe(0);
    }
  });

  it('una farmacia publica sus medicamentos con marca, precio y stock', () => {
    const productos = items(pedir(`/public/profiles/f/${FARMACIA}/products`));

    expect(productos.length).toBeGreaterThan(0);
    for (const producto of productos) {
      expect(typeof producto['genericName']).toBe('string');
      expect(typeof producto['inStock']).toBe('boolean');
      expect(typeof producto['requiresPrescription']).toBe('boolean');
      expect(typeof producto['price']).toBe('string');
    }
  });

  it('el catálogo es el mismo en cada llamada', () => {
    // Determinismo: un enlace copiado tiene que abrir lo mismo, y una recarga
    // no puede cambiarle el precio a nadie.
    expect(items(pedir(`/public/profiles/f/${FARMACIA}/products`))).toEqual(
      items(pedir(`/public/profiles/f/${FARMACIA}/products`)),
    );
  });

  it('un slug del vertical equivocado da 404 y no el catálogo de al lado', () => {
    const respuesta = pedir(`/public/profiles/o/${FARMACIA}/services`);

    expect(isMockReply(respuesta) && respuesta.status).toBe(404);
  });
});

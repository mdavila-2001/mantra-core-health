import { HttpHeaders } from '@angular/common/http';

import { showcases } from './fixtures/community';
import { crearRouterSimulado } from './handlers';
import { isMockReply, type MockMethod } from './mock-router';

/* ============================================================================
    Las dos lecturas que alimentan las fichas de clínica y de farmacia dentro
    del panel (P30 y P31).

    El barrido general sólo comprueba que ningún manejador lance; esto
    comprueba lo que las pantallas necesitan: que cada ficha publique un
    catálogo, que sea el mismo en cada llamada y que un slug del vertical
    equivocado dé 404 en vez de servir cualquier cosa.
    ========================================================================== */

const router = crearRouterSimulado();

/** Los manejadores de ficha son asíncronos: el directorio oficial se lee bajo demanda. */
async function pedir(path: string): Promise<unknown> {
  const partes = path.split('?');
  const encontrado = router.match('GET' as MockMethod, partes[0]!);
  if (encontrado === null) throw new Error(`sin manejador para ${path}`);
  return await encontrado.handler({
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

const CLINICA = showcases.filtrar((v) => v.kind === 'ORGANIZATION')[0]!.slug;
const FARMACIA = showcases.filtrar((v) => v.kind === 'PHARMACY')[0]!.slug;

describe('el catálogo que publica cada ficha', () => {
  it('una clínica publica sus servicios con código, nombre y precio', async () => {
    const servicios = items(await pedir(`/public/profiles/o/${CLINICA}/services`));

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

  it('una farmacia publica sus medicamentos con marca, precio y stock', async () => {
    const productos = items(await pedir(`/public/profiles/f/${FARMACIA}/products`));

    expect(productos.length).toBeGreaterThan(0);
    for (const producto of productos) {
      expect(typeof producto['genericName']).toBe('string');
      expect(typeof producto['inStock']).toBe('boolean');
      expect(typeof producto['requiresPrescription']).toBe('boolean');
      expect(typeof producto['price']).toBe('string');
    }
  });

  it('el catálogo es el mismo en cada llamada', async () => {
    // Determinismo: un enlace copiado tiene que abrir lo mismo, y una recarga
    // no puede cambiarle el precio a nadie.
    const primera = items(await pedir(`/public/profiles/f/${FARMACIA}/products`));
    expect(primera.length).toBeGreaterThan(0);
    expect(primera).toEqual(items(await pedir(`/public/profiles/f/${FARMACIA}/products`)));
  });

  it('un slug del vertical equivocado da 404 y no el catálogo de al lado', async () => {
    const respuesta = await pedir(`/public/profiles/o/${FARMACIA}/services`);

    expect(isMockReply(respuesta) && respuesta.status).toBe(404);
  });
});

/* ---- P37: la receta viaja por POST con cuerpo, como en la API -------------- */

async function pedirReceta(slug: string, body: unknown): Promise<unknown> {
  const path = `/public/profiles/f/${slug}/branch-availability`;
  const encontrado = router.match('POST' as MockMethod, path);
  if (encontrado === null) throw new Error(`sin manejador POST para ${path}`);
  return await encontrado.handler({
    method: 'POST',
    path,
    params: encontrado.params,
    query: new URLSearchParams(),
    body,
    headers: new HttpHeaders(),
    user: null,
  });
}

describe('la receta entre las sucursales (P37)', () => {
  it('ya no hay lectura por GET con la receta en la URL', () => {
    expect(router.match('GET' as MockMethod, `/public/profiles/f/${FARMACIA}/branch-availability`)).toBeNull();
  });

  it('responde una fila por sucursal con importes exactos o null, completas primero', async () => {
    const respuesta = (await pedirReceta(FARMACIA, { items: ['Paracetamol', ' paracetamol '] })) as {
      items: readonly { complete: boolean; totalAmount: string | null; missing: readonly string[] }[];
      count: number;
    };
    expect(respuesta.count).toBe(respuesta.items.length);
    const completas = respuesta.items.map((fila) => fila.complete);
    // Ninguna incompleta antes de una completa.
    expect(completas.indexOf(false) === -1 || !completas.slice(completas.indexOf(false)).includes(true)).toBe(true);
    for (const fila of respuesta.items) {
      // El renglón repetido se colapsó: a lo sumo un faltante.
      expect(fila.missing.length).toBeLessThanOrEqual(1);
      expect(fila.totalAmount === null || /^\d+\.\d+$/u.test(fila.totalAmount)).toBe(true);
    }
  });

  it.each([
    ['sin renglones', {}],
    ['lista vacía', { items: [] }],
    ['veintiún renglones', { items: Array.from({ length: 21 }, (_, i) => `m${i}`) }],
    ['un renglón larguísimo', { items: ['x'.repeat(121)] }],
    ['una sola coordenada', { items: ['a'], lat: -17.7 }],
    ['una clave que el DTO no declara', { items: ['a'], patientId: 'x' }],
  ])('400 como la API: %s', async (_caso, cuerpo) => {
    const respuesta = await pedirReceta(FARMACIA, cuerpo);
    expect(isMockReply(respuesta) && respuesta.status).toBe(400);
  });
});

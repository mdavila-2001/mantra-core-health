import { HttpHeaders } from '@angular/common/http';

import { crearRouterSimulado } from './index';
import { buscarUsuario, TENANT_FARMACIA } from '../mock-session';
import { isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { uuid } from '../mock-store';
import { ID_PEDIDO_CON_DELIVERY, ID_PEDIDO_CON_SEGURO } from '../fixtures/pedidos-de-farmacia';

/**
 * H3.S2 (carril A, 2026-09-25) — coherencia del mock de farmacia: el precio
 * de un producto tiene que ser el mismo número en `/pharmacy/sites/:siteId/prices`,
 * `/pharmacy-inventory/availability` y `POST /pharmacy/orders`; el stock 0 no
 * aparece en ninguna lectura pública; `/pharmacy/sites` ordena por distancia
 * o nombre; `/pharmacy/products?pharmacyId` filtra; y los 404 son reales.
 *
 * Datos deterministas de `pharmacy.handlers.ts` con `FARMACIAS[0]`
 * (`farmacia-vida`, id = `TENANT_FARMACIA`, `fi = 0`):
 *   - `MED-IBUPROFENO` (i=5): `stock 27`, `price '30.50'`, sin receta.
 *   - `MED-ENALAPRIL` (i=0): con receta.
 *   - `MED-AMOXICILINA` (i=4): `stock 0` (`(i+fi) % 5 === 4`).
 * `productos.get(uuid('product-' + TENANT_FARMACIA + '-<code>'))`.
 */
describe('handlers de farmacia: coherencia de precio y disponibilidad', () => {
  const router = crearRouterSimulado();
  const paciente = buscarUsuario('paciente')!;

  const SITE_ID = uuid('pharmacy-site-farmacia-vida');
  const IBUPROFENO_ID = uuid(`product-${TENANT_FARMACIA}-MED-IBUPROFENO`);
  const AMOXICILINA_ID = uuid(`product-${TENANT_FARMACIA}-MED-AMOXICILINA`);
  const ENALAPRIL_ID = uuid(`product-${TENANT_FARMACIA}-MED-ENALAPRIL`);

  function pedir(
    method: MockMethod,
    path: string,
    query: URLSearchParams = new URLSearchParams(),
    body: unknown = {},
    user: typeof paciente | null = paciente,
  ) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query,
      body,
      headers: new HttpHeaders(),
      user,
    } satisfies MockRequest);
  }

  function estado(resultado: unknown): number {
    return isMockReply(resultado) ? resultado.status : 200;
  }

  function cuerpoDe<T>(resultado: unknown): T {
    return (isMockReply(resultado) ? resultado.body : resultado) as T;
  }

  describe('el precio coincide en las tres lecturas (H3.S2.M2)', () => {
    it('correcto — el mismo ibuprofeno tiene el mismo unitAmount en precios, disponibilidad y el pedido', () => {
      const precios = cuerpoDe<{ items: readonly { productId: string; unitAmount: string }[] }>(
        pedir('GET', `/pharmacy/sites/${SITE_ID}/prices`),
      );
      const itemPrecios = precios.items.find((i) => i.productId === IBUPROFENO_ID)!;

      const disponibilidad = cuerpoDe<{
        items: readonly {
          siteId: string;
          products: readonly { productId: string; price: { unitAmount: string } | null }[];
        }[];
      }>(pedir('GET', '/pharmacy-inventory/availability', new URLSearchParams({ products: IBUPROFENO_ID })));
      // La respuesta se ordena por completa → distancia → nombre, así que la
      // sede de `farmacia-vida` no siempre queda en items[0]: se busca por id.
      const sedeFarmaciaVida = disponibilidad.items.find((i) => i.siteId === SITE_ID);
      const productoDisponible = sedeFarmaciaVida?.products.find((p) => p.productId === IBUPROFENO_ID);

      const pedido = cuerpoDe<{ lines: readonly { productId: string; unitPriceAmount: string | null }[] }>(
        pedir('POST', '/pharmacy/orders', undefined, {
          siteId: SITE_ID,
          lines: [{ productId: IBUPROFENO_ID, quantity: 1 }],
        }),
      );
      const lineaPedido = pedido.lines.find((l) => l.productId === IBUPROFENO_ID)!;

      expect(itemPrecios.unitAmount).toBe('30.50');
      expect(productoDisponible?.price?.unitAmount).toBe('30.50');
      expect(lineaPedido.unitPriceAmount).toBe('30.50');
    });
  });

  describe('stock 0 y receta (H3.S2.M3)', () => {
    it('correcto — la amoxicilina (stock 0) no aparece en /prices', () => {
      const precios = cuerpoDe<{ items: readonly { productId: string }[] }>(
        pedir('GET', `/pharmacy/sites/${SITE_ID}/prices`),
      );
      expect(precios.items.some((i) => i.productId === AMOXICILINA_ID)).toBe(false);
    });

    it('correcto — la amoxicilina (stock 0) no aparece disponible en /availability', () => {
      const disponibilidad = cuerpoDe<{
        items: readonly {
          siteId: string;
          products: readonly { productId: string }[];
          missingProductIds: readonly string[];
        }[];
      }>(pedir('GET', '/pharmacy-inventory/availability', new URLSearchParams({ products: AMOXICILINA_ID })));
      const sedeFarmaciaVida = disponibilidad.items.find((i) => i.siteId === SITE_ID);
      expect(sedeFarmaciaVida?.products.some((p) => p.productId === AMOXICILINA_ID)).toBe(false);
      expect(sedeFarmaciaVida?.missingProductIds).toContain(AMOXICILINA_ID);
    });

    it('correcto — requiresPrescription viaja en /prices: true para enalapril, false para ibuprofeno', () => {
      const precios = cuerpoDe<{ items: readonly { productId: string; requiresPrescription: boolean }[] }>(
        pedir('GET', `/pharmacy/sites/${SITE_ID}/prices`),
      );
      expect(precios.items.find((i) => i.productId === ENALAPRIL_ID)?.requiresPrescription).toBe(true);
      expect(precios.items.find((i) => i.productId === IBUPROFENO_ID)?.requiresPrescription).toBe(false);
    });
  });

  describe('orden de sedes y filtro por farmacia (H3.S2.M4)', () => {
    it('correcto — /pharmacy/sites ordena por distancia ascendente cuando hay origen', () => {
      const sedes = cuerpoDe<{ items: readonly { distanceKm: number | null }[] }>(
        pedir('GET', '/pharmacy/sites', new URLSearchParams({ lat: '-17.78', lng: '-63.18' })),
      );
      const distancias = sedes.items.map((s) => s.distanceKm).filter((d): d is number => d !== null);
      expect(distancias).toEqual([...distancias].sort((a, b) => a - b));
    });

    it('correcto — /pharmacy/sites sin origen ordena por nombre y distanceKm es null', () => {
      const sedes = cuerpoDe<{ items: readonly { distanceKm: number | null; pharmacyName: string }[] }>(
        pedir('GET', '/pharmacy/sites'),
      );
      expect(sedes.items.every((s) => s.distanceKm === null)).toBe(true);
      const nombres = sedes.items.map((s) => s.pharmacyName);
      expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, 'es')));
    });

    it('correcto — /pharmacy/products?pharmacyId sólo trae productos de esa farmacia', () => {
      const productos = cuerpoDe<{ items: readonly { pharmacyId: string }[] }>(
        pedir('GET', '/pharmacy/products', new URLSearchParams({ pharmacyId: TENANT_FARMACIA })),
      );
      expect(productos.items.length).toBeGreaterThan(0);
      expect(productos.items.every((p) => p.pharmacyId === TENANT_FARMACIA)).toBe(true);
    });
  });

  describe('404 y acotamiento por producto (H3.S2.M4)', () => {
    it('inválido — GET /pharmacy/pharmacies/:id con un id inventado responde 404', () => {
      const resultado = pedir('GET', `/pharmacy/pharmacies/${uuid('farmacia-inventada')}`);
      expect(estado(resultado)).toBe(404);
    });

    it('inválido — GET /pharmacy/sites/:siteId/prices con un siteId inventado responde 404', () => {
      const resultado = pedir('GET', `/pharmacy/sites/${uuid('sede-inventada')}/prices`);
      expect(estado(resultado)).toBe(404);
    });

    it('límite — ?product= acota los precios a un solo ítem', () => {
      const precios = cuerpoDe<{ items: readonly { productId: string }[]; count: number }>(
        pedir('GET', `/pharmacy/sites/${SITE_ID}/prices`, new URLSearchParams({ product: IBUPROFENO_ID })),
      );
      expect(precios.count).toBe(1);
      expect(precios.items[0]?.productId).toBe(IBUPROFENO_ID);
    });

    it('correcto — GET /pharmacy/pharmacies/:id de una cadena del corpus trae más de una sede', () => {
      const detalle = cuerpoDe<{ sites: readonly unknown[]; siteCount: number }>(
        pedir('GET', `/pharmacy/pharmacies/${uuid('corpus-tenant-farm_farmacorp')}`),
      );
      expect(detalle.sites.length).toBeGreaterThan(1);
    });
  });

  /**
   * El medio de entrega viaja en el contrato (`deliveryMode`), así que el
   * pedido a domicilio de la bandeja lo declara el backend simulado y la
   * pantalla ya no lo pisa por identificador.
   */
  describe('la modalidad de entrega viaja en el contrato', () => {
    interface WithDeliveryMode {
      readonly id: string;
      readonly deliveryMode: { readonly code: string } | null;
    }

    it('correcto — el pedido de ejemplo a domicilio responde PINV_DELIVERY_DOMICILIO', () => {
      const order = cuerpoDe<WithDeliveryMode>(
        pedir('GET', `/pharmacy/orders/${ID_PEDIDO_CON_DELIVERY}`, undefined, {}, null),
      );
      expect(order.deliveryMode?.code).toBe('PINV_DELIVERY_DOMICILIO');
    });

    it('límite — el resto de los pedidos sigue siendo retiro en la farmacia', () => {
      const order = cuerpoDe<WithDeliveryMode>(
        pedir('GET', `/pharmacy/orders/${ID_PEDIDO_CON_SEGURO}`, undefined, {}, null),
      );
      expect(order.deliveryMode?.code).toBe('PINV_DELIVERY_RETIRO');

      const bandeja = cuerpoDe<{ items: readonly WithDeliveryMode[] }>(
        pedir('GET', '/pharmacy/orders', undefined, {}, null),
      );
      const aDomicilio = bandeja.items.filter(
        (item) => item.deliveryMode?.code !== 'PINV_DELIVERY_RETIRO',
      );
      expect(aDomicilio.map((item) => item.id)).toEqual([ID_PEDIDO_CON_DELIVERY]);
    });

    it('inválido — un pedido inexistente responde 404, no un retiro inventado', () => {
      const resultado = pedir('GET', `/pharmacy/orders/${uuid('pedido-inventado')}`, undefined, {}, null);
      expect(estado(resultado)).toBe(404);
    });
  });

  /**
   * La ficha legal, la carpeta y la gente de la farmacia: lo que la API ya
   * publica (`GET /pharmacy/pharmacies/:id`, `…/licenses`, `…/contacts`). A
   * las sucursales reales del corpus no se les inventa nada.
   */
  describe('la ficha legal, la carpeta y la gente de la farmacia', () => {
    const CORPUS_ID = uuid('corpus-tenant-farm_farmacorp');

    interface LegalDetail {
      readonly taxId: string | null;
      readonly companyType: { readonly code: string } | null;
      readonly legalAddressText: string | null;
      readonly headquarters: { readonly latitude: number; readonly longitude: number } | null;
    }

    interface LicensePage {
      readonly items: readonly { readonly validTo: string | null; readonly daysToExpiry: number | null; readonly siteId: string | null }[];
      readonly count: number;
    }

    interface Contacts {
      readonly legalRepresentative: { readonly role: string; readonly fullName: string } | null;
      readonly executives: readonly { readonly role: string }[];
    }

    it('correcto — la farmacia de la maqueta trae NIT, forma societaria y casa matriz', () => {
      const detalle = cuerpoDe<LegalDetail>(pedir('GET', `/pharmacy/pharmacies/${TENANT_FARMACIA}`));
      expect(detalle.taxId).toMatch(/^\d{10}$/);
      expect(detalle.companyType?.code).toBe('SRL');
      expect(detalle.legalAddressText).not.toBeNull();
      expect(detalle.headquarters).not.toBeNull();
    });

    it('correcto — la carpeta trae una licencia general y una de sede por vencer, con el plazo declarado', () => {
      const carpeta = cuerpoDe<LicensePage>(pedir('GET', `/pharmacy/pharmacies/${TENANT_FARMACIA}/licenses`));
      expect(carpeta.count).toBe(2);
      expect(carpeta.items.map((licencia) => licencia.siteId === null)).toEqual([true, false]);
      expect(carpeta.items.map((licencia) => licencia.daysToExpiry)).toEqual([110, 13]);
      // El plazo y la fecha cuentan lo mismo: los dos son relativos a hoy.
      const vence = new Date(`${carpeta.items[1]!.validTo!}T00:00:00`);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      expect(Math.round((vence.getTime() - hoy.getTime()) / 86_400_000)).toBe(13);
    });

    it('correcto — la gente trae representante legal y gerencias con su rol canónico', () => {
      const gente = cuerpoDe<Contacts>(pedir('GET', `/pharmacy/pharmacies/${TENANT_FARMACIA}/contacts`));
      expect(gente.legalRepresentative?.role).toBe('LEGAL_REPRESENTATIVE');
      expect(gente.executives.map((persona) => persona.role)).toEqual([
        'GENERAL_MANAGER',
        'COMMERCIAL_MANAGER',
      ]);
    });

    it('límite — a una sucursal real del corpus no se le inventa ficha, carpeta ni gente', () => {
      const detalle = cuerpoDe<LegalDetail>(pedir('GET', `/pharmacy/pharmacies/${CORPUS_ID}`));
      expect(detalle).toMatchObject({
        taxId: null,
        companyType: null,
        legalAddressText: null,
        headquarters: null,
      });
      expect(cuerpoDe<LicensePage>(pedir('GET', `/pharmacy/pharmacies/${CORPUS_ID}/licenses`))).toEqual({
        items: [],
        count: 0,
      });
      expect(cuerpoDe<Contacts>(pedir('GET', `/pharmacy/pharmacies/${CORPUS_ID}/contacts`))).toEqual({
        legalRepresentative: null,
        executives: [],
      });
    });

    it('inválido — una farmacia inexistente responde 404 en la carpeta y en la gente', () => {
      const inventada = uuid('farmacia-inventada');
      expect(estado(pedir('GET', `/pharmacy/pharmacies/${inventada}/licenses`))).toBe(404);
      expect(estado(pedir('GET', `/pharmacy/pharmacies/${inventada}/contacts`))).toBe(404);
    });
  });

  /** Quién prescribió y a dónde va el pedido: también del contrato. */
  describe('el prescriptor y la dirección de entrega viajan en el pedido', () => {
    interface OrderReads {
      readonly id: string;
      readonly medicationRequestId: string | null;
      readonly prescriber: { readonly name: string | null; readonly specialty: string | null } | null;
      readonly deliveryAddressText: string | null;
    }

    it('correcto — el pedido con receta nombra a quien la firmó, con su especialidad', () => {
      const order = cuerpoDe<OrderReads>(
        pedir('GET', `/pharmacy/orders/${uuid('pharmacy-order-1')}`, undefined, {}, null),
      );
      expect(order.medicationRequestId).not.toBeNull();
      expect(order.prescriber?.name).toBeTruthy();
      expect(order.prescriber?.specialty).toBeTruthy();
    });

    it('correcto — el pedido a domicilio trae su dirección guardada', () => {
      const order = cuerpoDe<OrderReads>(
        pedir('GET', `/pharmacy/orders/${ID_PEDIDO_CON_DELIVERY}`, undefined, {}, null),
      );
      expect(order.deliveryAddressText).toContain('Cristo Redentor');
    });

    it('límite — sin receta no hay prescriptor, y un retiro no trae dirección', () => {
      const order = cuerpoDe<OrderReads>(
        pedir('GET', `/pharmacy/orders/${ID_PEDIDO_CON_SEGURO}`, undefined, {}, null),
      );
      expect(order.medicationRequestId).toBeNull();
      expect(order.prescriber).toBeNull();
      expect(order.deliveryAddressText).toBeNull();
    });
  });
});

/**
 * Carril B (29/09/2026) — lo que el portal de la farmacia le pide al
 * simulador (P47): estado del producto, inventario, categorías y resumen.
 *
 * Cada caso crea sus propios productos y categorías con nombres únicos: el
 * simulador guarda sus datos en módulo y los casos no se pisan entre sí.
 */
describe('handlers de farmacia: portal de la farmacia (P47)', () => {
  const router = crearRouterSimulado();
  const farmacia = buscarUsuario('farmacia')!;
  const PHARMACY_ID = TENANT_FARMACIA;

  function pedir(method: MockMethod, path: string, body: unknown = {}, query = new URLSearchParams()) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query,
      body,
      headers: new HttpHeaders(),
      user: farmacia,
    } satisfies MockRequest);
  }

  const estado = (resultado: unknown): number => (isMockReply(resultado) ? resultado.status : 200);
  const cuerpoDe = <T>(resultado: unknown): T => (isMockReply(resultado) ? resultado.body : resultado) as T;

  interface Listed {
    id: string;
    productCode: string;
    status?: string;
    stock?: number;
    minStock?: number;
    inStock: boolean;
    category: string | null;
  }

  function crear(codigo: string, extra: Record<string, unknown> = {}): string {
    const resultado = pedir('POST', `/pharmacies/${PHARMACY_ID}/products`, {
      productCode: codigo,
      brandName: `Producto ${codigo}`,
      ...extra,
    });
    expect(estado(resultado)).toBe(201);
    return cuerpoDe<{ id: string }>(resultado).id;
  }

  function gestion(): Listed[] {
    const query = new URLSearchParams({ pharmacyId: PHARMACY_ID, managed: 'true', limit: '500' });
    return cuerpoDe<{ items: Listed[] }>(pedir('GET', '/pharmacy/products', {}, query)).items;
  }

  function publico(): Listed[] {
    const query = new URLSearchParams({ pharmacyId: PHARMACY_ID, limit: '500' });
    return cuerpoDe<{ items: Listed[] }>(pedir('GET', '/pharmacy/products', {}, query)).items;
  }

  describe('estado del producto', () => {
    it('un borrador sólo lo ve la gestión: la vitrina pública no lo lista', () => {
      const id = crear('B-BORRADOR-1', { status: 'DRAFT' });

      expect(gestion().find((p) => p.id === id)?.status).toBe('DRAFT');
      expect(publico().some((p) => p.id === id)).toBe(false);
    });

    it('publicar el borrador lo pasa a la vitrina', () => {
      const id = crear('B-BORRADOR-2', { status: 'DRAFT' });

      pedir('PATCH', `/pharmacies/${PHARMACY_ID}/products/${id}`, { status: 'PUBLISHED' });

      expect(publico().some((p) => p.id === id)).toBe(true);
    });

    it('un retirado sigue en la gestión como WITHDRAWN, no en la vitrina, y se puede volver a publicar', () => {
      const id = crear('B-RETIRADO-1');
      pedir('DELETE', `/pharmacies/${PHARMACY_ID}/products/${id}`);

      expect(gestion().find((p) => p.id === id)?.status).toBe('WITHDRAWN');
      expect(publico().some((p) => p.id === id)).toBe(false);

      const republicado = pedir('PATCH', `/pharmacies/${PHARMACY_ID}/products/${id}`, { status: 'PUBLISHED' });
      expect(estado(republicado)).toBe(200);
      expect(publico().some((p) => p.id === id)).toBe(true);
    });

    it('editar un retirado sin pedir volver a publicarlo sigue siendo un 404', () => {
      const id = crear('B-RETIRADO-2');
      pedir('DELETE', `/pharmacies/${PHARMACY_ID}/products/${id}`);

      expect(estado(pedir('PATCH', `/pharmacies/${PHARMACY_ID}/products/${id}`, { description: 'x' }))).toBe(404);
    });

    it('un estado que no existe es un 400 con su campo', () => {
      const id = crear('B-ESTADO-1');

      const resultado = pedir('PATCH', `/pharmacies/${PHARMACY_ID}/products/${id}`, { status: 'EN_REVISION' });

      expect(estado(resultado)).toBe(400);
      expect(cuerpoDe(resultado)).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: { violations: ['status El estado es publicado, borrador o retirado.'] },
      });
    });
  });

  describe('inventario', () => {
    it('guarda existencias y umbral de varios productos juntos, y la disponibilidad se deriva', () => {
      const a = crear('B-INV-A');
      const b = crear('B-INV-B');

      const resultado = pedir('PATCH', `/pharmacies/${PHARMACY_ID}/inventory`, {
        lines: [
          { productId: a, stock: 0, minStock: 4 },
          { productId: b, stock: 9, minStock: 2 },
        ],
      });

      expect(cuerpoDe<{ updated: number }>(resultado).updated).toBe(2);
      const listado = gestion();
      expect(listado.find((p) => p.id === a)).toMatchObject({ stock: 0, minStock: 4, inStock: false });
      expect(listado.find((p) => p.id === b)).toMatchObject({ stock: 9, minStock: 2, inStock: true });
    });

    it('es todo o nada: una línea inválida no guarda ninguna', () => {
      const a = crear('B-INV-C');
      const antes = gestion().find((p) => p.id === a)!.stock;

      const resultado = pedir('PATCH', `/pharmacies/${PHARMACY_ID}/inventory`, {
        lines: [
          { productId: a, stock: 50, minStock: 1 },
          { productId: a, stock: -1, minStock: 1 },
        ],
      });

      expect(estado(resultado)).toBe(400);
      expect(gestion().find((p) => p.id === a)!.stock).toBe(antes);
    });

    it('una línea booleana dice sólo si hay o no hay, sin tocar las cantidades', () => {
      const a = crear('B-INV-BOOL-A');
      const cantidadAntes = gestion().find((p) => p.id === a)!.stock;

      pedir('PATCH', `/pharmacies/${PHARMACY_ID}/inventory`, { lines: [{ productId: a, inStock: false }] });

      const sinStock = gestion().find((p) => p.id === a)!;
      expect(sinStock.inStock).toBe(false);
      expect(sinStock.stock).toBe(cantidadAntes);
      expect(publico().find((p) => p.id === a)!.inStock).toBe(false);

      pedir('PATCH', `/pharmacies/${PHARMACY_ID}/inventory`, { lines: [{ productId: a, inStock: true }] });
      expect(gestion().find((p) => p.id === a)!.inStock).toBe(true);
    });

    it('«hay» sobre un producto con cero unidades le da existencias para que de verdad esté disponible', () => {
      const a = crear('B-INV-BOOL-B', { stock: 0 });
      expect(gestion().find((p) => p.id === a)!.inStock).toBe(false);

      pedir('PATCH', `/pharmacies/${PHARMACY_ID}/inventory`, { lines: [{ productId: a, inStock: true }] });

      const ahora = gestion().find((p) => p.id === a)!;
      expect(ahora.inStock).toBe(true);
      expect(ahora.stock).toBeGreaterThan(0);
    });

    it('mezclar cantidades y booleano en una misma línea es un 400: diría dos cosas a la vez', () => {
      const a = crear('B-INV-BOOL-C');

      const resultado = pedir('PATCH', `/pharmacies/${PHARMACY_ID}/inventory`, {
        lines: [{ productId: a, stock: 4, inStock: true }],
      });

      expect(estado(resultado)).toBe(400);
    });

    it('una línea que no dice qué cambiar es un 400, y un booleano que no lo es también', () => {
      const a = crear('B-INV-BOOL-D');

      expect(estado(pedir('PATCH', `/pharmacies/${PHARMACY_ID}/inventory`, { lines: [{ productId: a }] }))).toBe(400);
      expect(
        estado(pedir('PATCH', `/pharmacies/${PHARMACY_ID}/inventory`, { lines: [{ productId: a, inStock: 'quizás' }] })),
      ).toBe(400);
    });

    it('el booleano y las cantidades conviven en la misma petición, todo o nada', () => {
      const a = crear('B-INV-MIX-A');
      const b = crear('B-INV-MIX-B');

      const roto = pedir('PATCH', `/pharmacies/${PHARMACY_ID}/inventory`, {
        lines: [
          { productId: a, inStock: false },
          { productId: b, stock: -1 },
        ],
      });
      expect(estado(roto)).toBe(400);
      expect(gestion().find((p) => p.id === a)!.inStock).toBe(true);

      pedir('PATCH', `/pharmacies/${PHARMACY_ID}/inventory`, {
        lines: [
          { productId: a, inStock: false },
          { productId: b, stock: 7, minStock: 2 },
        ],
      });
      expect(gestion().find((p) => p.id === a)!.inStock).toBe(false);
      expect(gestion().find((p) => p.id === b)).toMatchObject({ stock: 7, minStock: 2, inStock: true });
    });

    it('rechaza un producto de otra farmacia', () => {
      const resultado = pedir('PATCH', `/pharmacies/${PHARMACY_ID}/inventory`, {
        lines: [{ productId: 'no-existe', stock: 1, minStock: 1 }],
      });

      expect(estado(resultado)).toBe(400);
    });
  });

  describe('categorías', () => {
    interface Category {
      id: string;
      name: string;
      productCount: number;
    }

    const listar = () =>
      cuerpoDe<{ items: Category[] }>(pedir('GET', `/pharmacies/${PHARMACY_ID}/categories`)).items;

    it('parte de las seis del mockup', () => {
      const nombres = listar().map((c) => c.name);

      for (const esperada of ['Medicamentos', 'Dermocosmética', 'Cuidado personal', 'Bebé y maternidad', 'Dispositivos', 'Bienestar']) {
        expect(nombres).toContain(esperada);
      }
    });

    it('crea, no repite (sin importar mayúsculas ni tildes) y valida el nombre', () => {
      expect(estado(pedir('POST', `/pharmacies/${PHARMACY_ID}/categories`, { name: 'Vitaminas B' }))).toBe(201);
      expect(estado(pedir('POST', `/pharmacies/${PHARMACY_ID}/categories`, { name: 'vitaminas b' }))).toBe(409);
      expect(estado(pedir('POST', `/pharmacies/${PHARMACY_ID}/categories`, { name: '   ' }))).toBe(400);
    });

    it('renombrar arrastra a los productos que la usan', () => {
      const creada = cuerpoDe<Category>(pedir('POST', `/pharmacies/${PHARMACY_ID}/categories`, { name: 'Ortopedia B' }));
      const id = crear('B-CAT-1', { category: 'Ortopedia B' });

      pedir('PATCH', `/pharmacies/${PHARMACY_ID}/categories/${creada.id}`, { name: 'Traumatología B' });

      expect(gestion().find((p) => p.id === id)!.category).toBe('Traumatología B');
      expect(listar().find((c) => c.id === creada.id)).toMatchObject({ name: 'Traumatología B', productCount: 1 });
    });

    it('eliminar una con productos es un 409; sin productos, se elimina', () => {
      const conProductos = cuerpoDe<Category>(pedir('POST', `/pharmacies/${PHARMACY_ID}/categories`, { name: 'Con uso B' }));
      crear('B-CAT-2', { category: 'Con uso B' });
      const vacia = cuerpoDe<Category>(pedir('POST', `/pharmacies/${PHARMACY_ID}/categories`, { name: 'Vacía B' }));

      expect(estado(pedir('DELETE', `/pharmacies/${PHARMACY_ID}/categories/${conProductos.id}`))).toBe(409);
      expect(estado(pedir('DELETE', `/pharmacies/${PHARMACY_ID}/categories/${vacia.id}`))).toBe(200);
      expect(listar().some((c) => c.id === vacia.id)).toBe(false);
    });
  });

  describe('resumen', () => {
    interface Summary {
      published: number;
      drafts: number;
      withdrawn: number;
      outOfStock: number;
      lowStock: number;
      inventoryValue: string;
      byCategory: { category: string; count: number }[];
      recentActivity: { text: string }[];
    }

    const resumen = () => cuerpoDe<Summary>(pedir('GET', `/pharmacy/pharmacies/${PHARMACY_ID}/summary`));

    it('los números cambian cuando la farmacia trabaja', () => {
      const antes = resumen();

      const id = crear('B-RES-1', { status: 'DRAFT' });
      expect(resumen().drafts).toBe(antes.drafts + 1);

      pedir('PATCH', `/pharmacies/${PHARMACY_ID}/products/${id}`, { status: 'PUBLISHED', stock: 3, minStock: 5, unitPrice: 10 });
      const conStockBajo = resumen();
      expect(conStockBajo.drafts).toBe(antes.drafts);
      expect(conStockBajo.published).toBe(antes.published + 1);
      expect(conStockBajo.lowStock).toBe(antes.lowStock + 1);
      expect(Number(conStockBajo.inventoryValue)).toBeCloseTo(Number(antes.inventoryValue) + 30, 2);

      pedir('DELETE', `/pharmacies/${PHARMACY_ID}/products/${id}`);
      expect(resumen().withdrawn).toBe(antes.withdrawn + 1);
    });

    it('la actividad reciente cuenta lo que se hizo, lo último primero', () => {
      crear('B-RES-2');

      expect(resumen().recentActivity[0]!.text).toContain('Producto B-RES-2');
    });

    it('una farmacia que no existe es un 404', () => {
      expect(estado(pedir('GET', '/pharmacy/pharmacies/no-existe/summary'))).toBe(404);
    });
  });
  describe('catálogo universal de medicamentos', () => {
    function buscar(parametros: Record<string, string>) {
      return cuerpoDe<{ items: { id: string; display: string; source: string; selectable: boolean; presentations: { code: string | null }[]; atc: string[]; medicationCode?: string }[]; truncated: boolean }>(
        pedir('GET', '/pharmacy/catalog-products', {}, new URLSearchParams(parametros)),
      );
    }

    function alta(cuerpo: Record<string, unknown>) {
      return pedir('POST', `/pharmacies/${PHARMACY_ID}/products`, cuerpo);
    }

    it('busca por principio activo y sólo trae registros de fuentes oficiales con su procedencia', () => {
      const { items } = buscar({ search: 'ibuprofeno', limit: '50' });
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((i) => ['cima', 'invima', 'anvisa', 'agemed'].includes(i.source))).toBe(true);
      expect(items.every((i) => i.atc.length > 0)).toBe(true);
    });

    it('busca sin importar tildes y acepta el ATC exacto', () => {
      const porAtc = buscar({ atc: 'N02BE01', limit: '50' });
      expect(porAtc.items.length).toBeGreaterThan(0);
      expect(porAtc.items.every((i) => i.atc.includes('N02BE01'))).toBe(true);
    });

    it('no expone el campo interno que une el catálogo con el vademécum del simulador', () => {
      const { items } = buscar({ search: 'paracetamol' });
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((i) => !('medicationCode' in i))).toBe(true);
    });

    it('el alta con catalogProductId deriva nombre, concentración y receta, y queda atada al vademécum por el ATC', () => {
      const elegido = buscar({ atc: 'M01AE01', limit: '50' }).items.find((i) => i.selectable && i.presentations.some((p) => p.code !== null))!;
      const presentacion = elegido.presentations.find((p) => p.code !== null)!.code!;
      const respuesta = alta({ productCode: 'CAT-IBU-1', catalogProductId: elegido.id, catalogPresentationCode: presentacion });
      expect(estado(respuesta)).toBe(201);

      const gestionados = cuerpoDe<{ items: { productCode: string; brandName: string | null; catalog: { catalogProductId: string; source: string } | null; medication: { code: string } | null }[] }>(
        pedir('GET', '/pharmacy/products', {}, new URLSearchParams({ pharmacyId: PHARMACY_ID, managed: 'true', search: 'CAT-IBU-1' })),
      );
      const creado = gestionados.items.find((p) => p.productCode === 'CAT-IBU-1')!;
      expect(creado.brandName).toBe(elegido.display);
      expect(creado.catalog?.catalogProductId).toBe(elegido.id);
      expect(creado.medication?.code).toBe('MED-IBUPROFENO');
    });

    // Los códigos son los de la API (`PharmacyProductsService.deriveFromCatalog`).
    it('mandar a la vez el id del catálogo y los datos del producto es un 400', () => {
      const elegido = buscar({ atc: 'N02BE01', limit: '5' }).items.find((i) => i.selectable)!;
      expect(estado(alta({ productCode: 'CAT-MIX-1', catalogProductId: elegido.id, brandName: 'Inventada' }))).toBe(400);
    });

    it('un id que no existe en el catálogo es un 404', () => {
      expect(estado(alta({ productCode: 'CAT-NO-1', catalogProductId: 'no-existe' }))).toBe(404);
    });

    it('el mismo producto y presentación dos veces es un 409', () => {
      const elegido = buscar({ atc: 'A10BA02', limit: '5' }).items.find((i) => i.selectable && i.presentations.some((p) => p.code !== null))!;
      const presentacion = elegido.presentations.find((p) => p.code !== null)!.code!;
      expect(estado(alta({ productCode: 'CAT-DUP-1', catalogProductId: elegido.id, catalogPresentationCode: presentacion }))).toBe(201);
      expect(estado(alta({ productCode: 'CAT-DUP-2', catalogProductId: elegido.id, catalogPresentationCode: presentacion }))).toBe(409);
    });

    it('un registro no vigente no se puede dar de alta (422, precondición)', () => {
      const revocado = buscar({ limit: '200', search: 'a' }).items.find((i) => !i.selectable);
      if (revocado === undefined) return; // el subconjunto sin ningún no vigente no ejercita esta regla
      expect(estado(alta({ productCode: 'CAT-REV-1', catalogProductId: revocado.id }))).toBe(422);
    });

    it('editar un producto del catálogo: lo oficial se rechaza y lo propio pasa', () => {
      const elegido = buscar({ atc: 'C09CA01', limit: '5' }).items.find((i) => i.selectable && i.presentations.some((p) => p.code !== null))!;
      const presentacion = elegido.presentations.find((p) => p.code !== null)!.code!;
      alta({ productCode: 'CAT-EDIT-1', catalogProductId: elegido.id, catalogPresentationCode: presentacion });
      const lista = cuerpoDe<{ items: { id: string; productCode: string }[] }>(
        pedir('GET', '/pharmacy/products', {}, new URLSearchParams({ pharmacyId: PHARMACY_ID, managed: 'true', search: 'CAT-EDIT-1' })),
      );
      const id = lista.items.find((p) => p.productCode === 'CAT-EDIT-1')!.id;

      expect(estado(pedir('PATCH', `/pharmacies/${PHARMACY_ID}/products/${id}`, { brandName: 'Otro' }, new URLSearchParams()))).toBe(400);
      expect(estado(pedir('PATCH', `/pharmacies/${PHARMACY_ID}/products/${id}`, { unitPrice: 33.5, description: 'Mi descripción' }, new URLSearchParams()))).toBe(200);
    });

    it('«no encuentro mi medicamento» registra una solicitud; sin nombre es un 400', () => {
      expect(estado(pedir('POST', `/pharmacies/${PHARMACY_ID}/catalog-requests`, { name: 'Medicamento Local 10 mg' }, new URLSearchParams()))).toBe(201);
      expect(estado(pedir('POST', `/pharmacies/${PHARMACY_ID}/catalog-requests`, { name: '' }, new URLSearchParams()))).toBe(400);
    });
  });
});

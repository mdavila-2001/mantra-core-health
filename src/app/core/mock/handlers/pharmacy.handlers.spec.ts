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

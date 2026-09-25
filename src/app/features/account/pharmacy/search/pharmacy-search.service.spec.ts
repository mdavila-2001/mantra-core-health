import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type {
  AvailabilityResult,
  AvailabilitySite,
  PharmacyProduct,
  PharmacyProductSearchPage,
  PharmacySite,
  PharmacySitePage,
} from '../../../../core/data-access/pharmacy/pharmacy.types';
import type { SearchOrigin } from '../../../nearby-places/search-origin-picker/search-origin-picker.types';
import {
  normalizeTerm,
  PharmacySearchService,
  sortByDistance,
  sortByPrice,
} from './pharmacy-search.service';
import type { ProductHit } from './pharmacy-search.types';

/**
 * Datos sintéticos declarados, fieles a los tipos de `pharmacy.types.ts`. Dos
 * productos en dos sedes con precios distintos a propósito: es la única forma
 * de que «más barato» signifique algo comprobable.
 */
const IDS = {
  paracetamol: 'p-0000-0000-0001',
  ibuprofeno: 'p-0000-0000-0002',
  sedeCentro: 's-0000-0000-0001',
  sedeSur: 's-0000-0000-0002',
  sedeSinCatalogo: 's-0000-0000-0003',
  farmaciaAndina: 'f-0000-0000-0010',
  farmaciaDelSur: 'f-0000-0000-0020',
} as const;

const CASA: SearchOrigin = { source: 'home', lat: -17.78, lng: -63.18 };

const PARACETAMOL: PharmacyProduct = {
  id: IDS.paracetamol,
  pharmacyId: IDS.farmaciaAndina,
  pharmacyName: 'Farmacia Andina',
  productCode: 'PAR-500-TAB',
  brandName: 'Paracetamol Andina',
  genericName: 'Paracetamol',
  strengthText: '500 mg',
  packageSizeText: 'Caja x 20',
  dosageForm: { code: 'TABLET', display: 'Comprimido' },
  medication: { code: 'MESH-PARA', display: 'Paracetamol' },
  requiresPrescription: false,
};

const IBUPROFENO: PharmacyProduct = {
  id: IDS.ibuprofeno,
  pharmacyId: IDS.farmaciaDelSur,
  pharmacyName: 'Farmacia del Sur',
  productCode: 'IBU-400-TAB',
  brandName: null,
  genericName: 'Ibuprofeno',
  strengthText: '400 mg',
  packageSizeText: null,
  dosageForm: null,
  medication: null,
  requiresPrescription: true,
};

const CATALOGO: PharmacyProductSearchPage = {
  items: [PARACETAMOL, IBUPROFENO],
  limit: 20,
  truncated: false,
};

const SIN_CATALOGO: PharmacyProductSearchPage = { items: [], limit: 20, truncated: false };

function precio(unitAmount: string): {
  readonly unitAmount: string;
  readonly patientAmount: string | null;
  readonly currency: { readonly code: string; readonly display: string };
  readonly priceListCode: string;
} {
  return {
    unitAmount,
    patientAmount: null,
    currency: { code: 'BOB', display: 'Boliviano' },
    priceListCode: 'PUBLICA',
  };
}

function sedeDisponible(
  siteId: string,
  nombre: string,
  distanceKm: number | null,
  productos: readonly { id: string; amount: string | null }[],
): AvailabilitySite {
  return {
    siteId,
    siteName: nombre,
    pharmacyId: IDS.farmaciaAndina,
    pharmacyName: 'Farmacia Andina',
    addressText: `Av. de prueba ${nombre}`,
    latitude: null,
    longitude: null,
    distanceKm,
    homeDeliveryAvailable: null,
    pickupAvailable: true,
    complete: true,
    availableCount: productos.length,
    missingProductIds: [],
    totalAmount: null,
    currency: { code: 'BOB', display: 'Boliviano' },
    products: productos.map((producto) => ({
      productId: producto.id,
      productCode: 'X',
      brandName: null,
      genericName: null,
      strengthText: null,
      packageSizeText: null,
      medication: null,
      availableQuantity: 5,
      price: producto.amount === null ? null : precio(producto.amount),
    })),
  };
}

function disponibilidad(items: readonly AvailabilitySite[]): AvailabilityResult {
  return { requestedProductIds: [IDS.paracetamol, IDS.ibuprofeno], items, count: items.length };
}

function sedeDelDirectorio(
  siteId: string,
  nombre: string,
  distanceKm: number | null,
  productCount: number,
): PharmacySite {
  return {
    siteId,
    siteName: nombre,
    pharmacyId: IDS.farmaciaAndina,
    pharmacyName: 'Farmacia Andina',
    addressText: `Av. de prueba ${nombre}`,
    latitude: null,
    longitude: null,
    distanceKm,
    homeDeliveryAvailable: null,
    pickupAvailable: true,
    productCount,
  };
}

function directorio(items: readonly PharmacySite[]): PharmacySitePage {
  return { items, count: items.length };
}

describe('PharmacySearchService', () => {
  let service: PharmacySearchService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PharmacySearchService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('modo Productos', () => {
    it('cruza el catálogo con la disponibilidad: dos productos en dos sedes son cuatro filas', () => {
      let filas: readonly ProductHit[] = [];
      service.searchProducts('paracetamol', CASA, 'price').subscribe((r) => (filas = r.items));

      http.expectOne((r) => r.url === '/pharmacy/products').flush(CATALOGO);
      http.expectOne((r) => r.url === '/pharmacy-inventory/availability').flush(
        disponibilidad([
          sedeDisponible(IDS.sedeCentro, 'Centro', 1.2, [
            { id: IDS.paracetamol, amount: '10.00' },
            { id: IDS.ibuprofeno, amount: '14.00' },
          ]),
          sedeDisponible(IDS.sedeSur, 'Sur', 3.4, [
            { id: IDS.paracetamol, amount: '8.00' },
            { id: IDS.ibuprofeno, amount: '12.00' },
          ]),
        ]),
      );

      expect(filas).toHaveLength(4);
      expect(filas.map((fila) => fila.id)).toContain(`${IDS.sedeSur}:${IDS.paracetamol}`);
      expect(filas.every((fila) => fila.unitAmount !== null)).toBe(true);
    });

    it('la fila toma del catálogo el nombre, la presentación y si exige receta', () => {
      let filas: readonly ProductHit[] = [];
      service.searchProducts('ibuprofeno', CASA, 'price').subscribe((r) => (filas = r.items));

      http.expectOne((r) => r.url === '/pharmacy/products').flush(CATALOGO);
      http
        .expectOne((r) => r.url === '/pharmacy-inventory/availability')
        .flush(
          disponibilidad([
            sedeDisponible(IDS.sedeCentro, 'Centro', 1.2, [
              { id: IDS.ibuprofeno, amount: '14.00' },
            ]),
          ]),
        );

      expect(filas).toHaveLength(1);
      // Sin marca publicada, el genérico; y la presentación es lo que hay.
      expect(filas[0].name).toBe('Ibuprofeno');
      expect(filas[0].presentation).toBe('400 mg');
      expect(filas[0].requiresPrescription).toBe(true);
    });

    it('un producto sin precio publicado sale sin precio, no con uno inventado', () => {
      let filas: readonly ProductHit[] = [];
      service.searchProducts('paracetamol', CASA, 'price').subscribe((r) => (filas = r.items));

      http.expectOne((r) => r.url === '/pharmacy/products').flush(CATALOGO);
      http
        .expectOne((r) => r.url === '/pharmacy-inventory/availability')
        .flush(
          disponibilidad([
            sedeDisponible(IDS.sedeCentro, 'Centro', 1.2, [
              { id: IDS.paracetamol, amount: null },
            ]),
          ]),
        );

      expect(filas[0].unitAmount).toBeNull();
      expect(filas[0].currency).toBeNull();
    });

    it('descarta la fila de un producto que el catálogo de la búsqueda no conoce', () => {
      let filas: readonly ProductHit[] = [];
      service.searchProducts('paracetamol', CASA, 'price').subscribe((r) => (filas = r.items));

      http
        .expectOne((r) => r.url === '/pharmacy/products')
        .flush({ items: [PARACETAMOL], limit: 20, truncated: false });
      http
        .expectOne((r) => r.url === '/pharmacy-inventory/availability')
        .flush(
          disponibilidad([
            sedeDisponible(IDS.sedeCentro, 'Centro', 1.2, [
              { id: IDS.paracetamol, amount: '10.00' },
              { id: IDS.ibuprofeno, amount: '14.00' },
            ]),
          ]),
        );

      // Sin la ficha del catálogo no se sabe si exige receta: no se muestra.
      expect(filas).toHaveLength(1);
      expect(filas[0].productId).toBe(IDS.paracetamol);
    });

    it('ordena por precio: el más barato primero', () => {
      let filas: readonly ProductHit[] = [];
      service.searchProducts('paracetamol', CASA, 'price').subscribe((r) => (filas = r.items));

      http
        .expectOne((r) => r.url === '/pharmacy/products')
        .flush({ items: [PARACETAMOL], limit: 20, truncated: false });
      http.expectOne((r) => r.url === '/pharmacy-inventory/availability').flush(
        disponibilidad([
          sedeDisponible(IDS.sedeCentro, 'Centro', 1.2, [
            { id: IDS.paracetamol, amount: '10.00' },
          ]),
          sedeDisponible(IDS.sedeSur, 'Sur', 3.4, [{ id: IDS.paracetamol, amount: '8.00' }]),
        ]),
      );

      expect(filas.map((fila) => fila.unitAmount)).toEqual(['8.00', '10.00']);
    });

    it('ordena por distancia cuando hay origen, y el origen viaja a la API', () => {
      let resultado: { items: readonly ProductHit[]; sinOrigen: boolean } | null = null;
      service.searchProducts('paracetamol', CASA, 'distance').subscribe((r) => (resultado = r));

      http
        .expectOne((r) => r.url === '/pharmacy/products')
        .flush({ items: [PARACETAMOL], limit: 20, truncated: false });
      const disponible = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
      expect(disponible.request.params.get('lat')).toBe('-17.78');
      expect(disponible.request.params.get('lng')).toBe('-63.18');
      disponible.flush(
        disponibilidad([
          sedeDisponible(IDS.sedeSur, 'Sur', 3.4, [{ id: IDS.paracetamol, amount: '8.00' }]),
          sedeDisponible(IDS.sedeCentro, 'Centro', 1.2, [
            { id: IDS.paracetamol, amount: '10.00' },
          ]),
        ]),
      );

      expect(resultado!.items.map((fila) => fila.distanceKm)).toEqual([1.2, 3.4]);
      expect(resultado!.sinOrigen).toBe(false);
    });

    it('sin origen y con orden por distancia no reordena nada y lo declara', () => {
      let resultado: { items: readonly ProductHit[]; sinOrigen: boolean } | null = null;
      service.searchProducts('paracetamol', null, 'distance').subscribe((r) => (resultado = r));

      http
        .expectOne((r) => r.url === '/pharmacy/products')
        .flush({ items: [PARACETAMOL], limit: 20, truncated: false });
      const disponible = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
      expect(disponible.request.params.has('lat')).toBe(false);
      disponible.flush(
        disponibilidad([
          sedeDisponible(IDS.sedeSur, 'Sur', null, [{ id: IDS.paracetamol, amount: '8.00' }]),
          sedeDisponible(IDS.sedeCentro, 'Centro', null, [
            { id: IDS.paracetamol, amount: '10.00' },
          ]),
        ]),
      );

      // El orden es el que llegó del backend, tal cual.
      expect(resultado!.items.map((fila) => fila.siteId)).toEqual([IDS.sedeSur, IDS.sedeCentro]);
      expect(resultado!.sinOrigen).toBe(true);
    });

    it('con menos de dos letras no consulta nada', () => {
      let resultado: { items: readonly ProductHit[]; sinOrigen: boolean } | null = null;
      service.searchProducts('p', CASA, 'price').subscribe((r) => (resultado = r));

      http.expectNone(() => true);
      expect(resultado!.items).toEqual([]);
    });

    it('un catálogo vacío no dispara la consulta de disponibilidad', () => {
      let filas: readonly ProductHit[] = [];
      service.searchProducts('xxxx', CASA, 'price').subscribe((r) => (filas = r.items));

      http.expectOne((r) => r.url === '/pharmacy/products').flush(SIN_CATALOGO);

      http.expectNone((r) => r.url === '/pharmacy-inventory/availability');
      expect(filas).toEqual([]);
    });
  });

  describe('modo Farmacias', () => {
    it('sin término lista el directorio y no consulta disponibilidad', () => {
      let sedes: readonly { siteId: string }[] = [];
      service.searchStores('', CASA, 'distance').subscribe((r) => (sedes = r.items));

      const req = http.expectOne((r) => r.url === '/pharmacy/sites');
      expect(req.request.params.has('search')).toBe(false);
      req.flush(
        directorio([
          sedeDelDirectorio(IDS.sedeSur, 'Sur', 3.4, 12),
          sedeDelDirectorio(IDS.sedeCentro, 'Centro', 1.2, 8),
        ]),
      );

      http.expectNone((r) => r.url === '/pharmacy-inventory/availability');
      expect(sedes.map((sede) => sede.siteId)).toEqual([IDS.sedeCentro, IDS.sedeSur]);
    });

    it('no lista las sedes sin nada publicado', () => {
      let sedes: readonly { siteId: string }[] = [];
      service.searchStores('', CASA, 'distance').subscribe((r) => (sedes = r.items));

      http
        .expectOne((r) => r.url === '/pharmacy/sites')
        .flush(
          directorio([
            sedeDelDirectorio(IDS.sedeCentro, 'Centro', 1.2, 8),
            sedeDelDirectorio(IDS.sedeSinCatalogo, 'Sin catálogo', 0.5, 0),
          ]),
        );

      expect(sedes.map((sede) => sede.siteId)).toEqual([IDS.sedeCentro]);
    });

    it('con término, cada sede que lo tiene trae su «desde», y es el más barato', () => {
      let sedes: readonly { siteId: string; fromAmount: string | null }[] = [];
      service.searchStores('paracetamol', CASA, 'price').subscribe((r) => (sedes = r.items));

      const directorioReq = http.expectOne((r) => r.url === '/pharmacy/sites');
      expect(directorioReq.request.params.get('search')).toBe('paracetamol');
      directorioReq.flush(
        directorio([
          sedeDelDirectorio(IDS.sedeCentro, 'Centro', 1.2, 8),
          sedeDelDirectorio(IDS.sedeSur, 'Sur', 3.4, 12),
        ]),
      );

      http.expectOne((r) => r.url === '/pharmacy/products').flush(CATALOGO);
      http.expectOne((r) => r.url === '/pharmacy-inventory/availability').flush(
        disponibilidad([
          sedeDisponible(IDS.sedeCentro, 'Centro', 1.2, [
            { id: IDS.paracetamol, amount: '10.00' },
            { id: IDS.ibuprofeno, amount: '6.00' },
          ]),
        ]),
      );

      expect(sedes).toHaveLength(2);
      // Ordenadas por precio: la que tiene «desde» va antes que la que no.
      expect(sedes[0].siteId).toBe(IDS.sedeCentro);
      expect(sedes[0].fromAmount).toBe('6.00');
      expect(sedes[1].fromAmount).toBeNull();
    });

    it('sin origen y con orden por distancia, el directorio no se reordena', () => {
      let resultado: { items: readonly { siteId: string }[]; sinOrigen: boolean } | null = null;
      service.searchStores('', null, 'distance').subscribe((r) => (resultado = r));

      http
        .expectOne((r) => r.url === '/pharmacy/sites')
        .flush(
          directorio([
            sedeDelDirectorio(IDS.sedeSur, 'Sur', null, 12),
            sedeDelDirectorio(IDS.sedeCentro, 'Centro', null, 8),
          ]),
        );

      expect(resultado!.items.map((sede) => sede.siteId)).toEqual([IDS.sedeSur, IDS.sedeCentro]);
      expect(resultado!.sinOrigen).toBe(true);
    });
  });

  describe('sortByPrice', () => {
    it('pone el más barato primero', () => {
      const filas = [{ unitAmount: '10.00' }, { unitAmount: '8.00' }, { unitAmount: '9.50' }];
      expect(sortByPrice(filas).map((f) => f.unitAmount)).toEqual(['8.00', '9.50', '10.00']);
    });

    it('manda las filas sin precio al final, nunca adelante', () => {
      const filas = [{ unitAmount: null }, { unitAmount: '10.00' }, { unitAmount: '8.00' }];
      expect(sortByPrice(filas).map((f) => f.unitAmount)).toEqual(['8.00', '10.00', null]);
    });

    it('no muta la lista que recibe', () => {
      const filas = [{ unitAmount: '10.00' }, { unitAmount: '8.00' }];
      sortByPrice(filas);
      expect(filas.map((f) => f.unitAmount)).toEqual(['10.00', '8.00']);
    });
  });

  describe('sortByDistance', () => {
    it('pone la más cerca primero', () => {
      const filas = [{ distanceKm: 3.4 }, { distanceKm: 1.2 }, { distanceKm: 2 }];
      expect(sortByDistance(filas).map((f) => f.distanceKm)).toEqual([1.2, 2, 3.4]);
    });

    it('manda las filas sin distancia al final', () => {
      const filas = [{ distanceKm: null }, { distanceKm: 3.4 }, { distanceKm: 1.2 }];
      expect(sortByDistance(filas).map((f) => f.distanceKm)).toEqual([1.2, 3.4, null]);
    });

    it('acepta el cero como distancia válida', () => {
      const filas = [{ distanceKm: 1.2 }, { distanceKm: 0 }];
      expect(sortByDistance(filas).map((f) => f.distanceKm)).toEqual([0, 1.2]);
    });
  });

  describe('normalizeTerm', () => {
    it('saca los acentos', () => {
      expect(normalizeTerm('Ibuproféno')).toBe('ibuprofeno');
    });

    it('baja a minúsculas', () => {
      expect(normalizeTerm('PARACETAMOL')).toBe('paracetamol');
    });

    it('recorta los espacios de los bordes', () => {
      expect(normalizeTerm('  paracetamol  ')).toBe('paracetamol');
    });
  });
});

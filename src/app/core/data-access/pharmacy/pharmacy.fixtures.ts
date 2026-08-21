import type {
  AvailabilityResult,
  AvailabilitySite,
  PharmacyProduct,
  PharmacyProductSearchPage,
} from './pharmacy.types';

/**
 * Datos de prueba del carril E3, **fieles al contrato E2 del backend**
 * (`read-responses.dto.ts` de `pharmacy` y `pharmacy_inventory`, leído el
 * 2026-08-19 del working tree del carril E2). Sólo los usan las pruebas: el
 * cliente y la pantalla hablan siempre con la API real.
 *
 * Si el DTO definitivo de E2 cambia, este archivo es el primero que tiene que
 * dejar de compilar: por eso cada constante está tipada con el tipo de vista y
 * no como `unknown` suelto.
 */

/** Ids estables para que las pruebas puedan referirse a filas concretas. */
export const FIXTURE_IDS = {
  conceptoAmoxicilina: '0b54b8a2-6a53-4e6e-9f2e-6a1f1a111111',
  conceptoIbuprofeno: '0b54b8a2-6a53-4e6e-9f2e-6a1f1a222222',
  productoAmoxicilina: '7d3e5f10-90ab-4cde-8f01-234567890aaa',
  productoIbuprofeno: '7d3e5f10-90ab-4cde-8f01-234567890bbb',
  sedeCentro: '4f9a2b30-1c2d-4e5f-8a9b-000000000001',
  sedeSur: '4f9a2b30-1c2d-4e5f-8a9b-000000000002',
  farmaciaAndina: '9e8d7c60-5b4a-4321-9876-000000000010',
  farmaciaDelSur: '9e8d7c60-5b4a-4321-9876-000000000020',
} as const;

const AMOXICILINA: PharmacyProduct = {
  id: FIXTURE_IDS.productoAmoxicilina,
  pharmacyId: FIXTURE_IDS.farmaciaAndina,
  pharmacyName: 'Farmacia Andina',
  productCode: 'AMX-500-CAP',
  brandName: 'Amoxil',
  genericName: 'Amoxicilina',
  strengthText: '500 mg',
  packageSizeText: 'Caja x 21 cápsulas',
  dosageForm: { code: 'CAPSULE', display: 'Cápsula' },
  medication: { code: 'MESH-AMOX', display: 'Amoxicilina' },
  requiresPrescription: true,
};

const IBUPROFENO: PharmacyProduct = {
  id: FIXTURE_IDS.productoIbuprofeno,
  pharmacyId: FIXTURE_IDS.farmaciaDelSur,
  pharmacyName: 'Farmacia del Sur',
  productCode: 'IBU-400-TAB',
  brandName: null,
  genericName: 'Ibuprofeno',
  strengthText: '400 mg',
  packageSizeText: 'Blíster x 10 comprimidos',
  dosageForm: { code: 'TABLET', display: 'Comprimido' },
  medication: { code: 'MESH-IBU', display: 'Ibuprofeno' },
  requiresPrescription: false,
};

/** La búsqueda de productos, por concepto del vademécum. */
export function productosDelConcepto(conceptId: string): PharmacyProductSearchPage {
  const porConcepto: Readonly<Record<string, PharmacyProduct>> = {
    [FIXTURE_IDS.conceptoAmoxicilina]: AMOXICILINA,
    [FIXTURE_IDS.conceptoIbuprofeno]: IBUPROFENO,
  };
  const producto = porConcepto[conceptId];
  return {
    items: producto === undefined ? [] : [producto],
    limit: 1,
    truncated: false,
  };
}

/** Sede que puede surtir TODO el pedido, con coordenadas y total. */
const SEDE_COMPLETA: AvailabilitySite = {
  siteId: FIXTURE_IDS.sedeCentro,
  siteName: 'Sucursal Centro',
  pharmacyId: FIXTURE_IDS.farmaciaAndina,
  pharmacyName: 'Farmacia Andina',
  addressText: 'Calle Libertad 245, entre Ballivián y Sucre',
  latitude: -17.7833,
  longitude: -63.1821,
  distanceKm: 1.2,
  homeDeliveryAvailable: true,
  pickupAvailable: true,
  complete: true,
  availableCount: 2,
  missingProductIds: [],
  totalAmount: '96.50',
  currency: { code: 'BOB', display: 'Boliviano' },
  products: [
    {
      productId: FIXTURE_IDS.productoAmoxicilina,
      productCode: AMOXICILINA.productCode,
      brandName: AMOXICILINA.brandName,
      genericName: AMOXICILINA.genericName,
      strengthText: AMOXICILINA.strengthText,
      packageSizeText: AMOXICILINA.packageSizeText,
      medication: AMOXICILINA.medication,
      availableQuantity: 14,
      price: {
        unitAmount: '68.00',
        patientAmount: '68.00',
        currency: { code: 'BOB', display: 'Boliviano' },
        priceListCode: 'PUBLICO-2026',
      },
    },
    {
      productId: FIXTURE_IDS.productoIbuprofeno,
      productCode: IBUPROFENO.productCode,
      brandName: IBUPROFENO.brandName,
      genericName: IBUPROFENO.genericName,
      strengthText: IBUPROFENO.strengthText,
      packageSizeText: IBUPROFENO.packageSizeText,
      medication: IBUPROFENO.medication,
      availableQuantity: 30,
      price: {
        unitAmount: '28.50',
        patientAmount: '28.50',
        currency: { code: 'BOB', display: 'Boliviano' },
        priceListCode: 'PUBLICO-2026',
      },
    },
  ],
};

/** Sede parcial: le falta la amoxicilina, no publica total ni coordenadas. */
const SEDE_PARCIAL: AvailabilitySite = {
  siteId: FIXTURE_IDS.sedeSur,
  siteName: 'Sucursal Plan Tres Mil',
  pharmacyId: FIXTURE_IDS.farmaciaDelSur,
  pharmacyName: 'Farmacia del Sur',
  addressText: 'Av. Paurito esq. calle 7',
  latitude: null,
  longitude: null,
  distanceKm: null,
  homeDeliveryAvailable: false,
  pickupAvailable: true,
  complete: false,
  availableCount: 1,
  missingProductIds: [FIXTURE_IDS.productoAmoxicilina],
  totalAmount: null,
  currency: null,
  products: [
    {
      productId: FIXTURE_IDS.productoIbuprofeno,
      productCode: IBUPROFENO.productCode,
      brandName: IBUPROFENO.brandName,
      genericName: IBUPROFENO.genericName,
      strengthText: IBUPROFENO.strengthText,
      packageSizeText: IBUPROFENO.packageSizeText,
      medication: IBUPROFENO.medication,
      availableQuantity: 4,
      price: null,
    },
  ],
};

/** La disponibilidad completa: el orden es el del contrato (completas primero). */
export const DISPONIBILIDAD_FIXTURE: AvailabilityResult = {
  requestedProductIds: [FIXTURE_IDS.productoAmoxicilina, FIXTURE_IDS.productoIbuprofeno],
  items: [SEDE_COMPLETA, SEDE_PARCIAL],
  count: 2,
};

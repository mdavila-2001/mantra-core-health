import { isMockReply, type MockRequest, type MockRouter } from '../mock-router';
import { productos } from './pharmacy.handlers';

/* ============================================================================
    `GET /pharmacy-inventory/availability/medications`: la disponibilidad por
    medicamento de una receta, en toda la red, con la forma de
    `MedicationAvailabilityResponseDto` de la API.

    La maqueta por producto (`pharmacy.handlers.ts`) ya cruza por medicamento:
    traduce cada id a su concepto y elige en cada farmacia un producto suyo de
    ese concepto. Esta ruta le pasa los medicamentos tal cual y renombra la
    respuesta; la cuenta no se repite.
   ============================================================================ */

interface SiteByProduct {
  readonly missingProductIds: readonly string[];
  readonly products: readonly { readonly productId: string }[];
  readonly [key: string]: unknown;
}

interface ResultByProduct {
  readonly items: readonly SiteByProduct[];
}

/** El medicamento al que responde un producto de la maqueta. */
function conceptOf(productId: string): string {
  return productos.get(productId)?.medicationConceptId ?? productId;
}

export function registerPharmacyMedicationAvailability(router: MockRouter): void {
  router.get('/pharmacy-inventory/availability/medications', (request: MockRequest) => {
    const conceptIds = (request.query.get('medications') ?? '')
      .split(',')
      .filter((id) => id !== '');
    const byProduct = router.match('GET', '/pharmacy-inventory/availability');
    if (byProduct === null) {
      return {
        requestedMedicationConceptIds: conceptIds,
        unpublishedMedicationConceptIds: [],
        items: [],
        count: 0,
      };
    }
    const query = new URLSearchParams(request.query);
    query.delete('medications');
    query.set('products', conceptIds.join(','));
    const answer = byProduct.handler({ ...request, query });
    if (isMockReply(answer)) {
      return answer;
    }
    const items = (answer as ResultByProduct).items
      .map(({ missingProductIds, products, ...site }) => ({
        ...site,
        missingMedicationConceptIds: missingProductIds,
        products: products.map((product) => ({
          ...product,
          medicationConceptId: conceptOf(product.productId),
        })),
      }))
      .filter((site) => site.products.length > 0);
    const published = new Set(
      [...productos.todos()]
        .map((product) => product.medicationConceptId)
        .filter((id) => id !== null),
    );
    return {
      requestedMedicationConceptIds: conceptIds,
      unpublishedMedicationConceptIds: conceptIds.filter((id) => !published.has(id)),
      items,
      count: items.length,
    };
  });
}

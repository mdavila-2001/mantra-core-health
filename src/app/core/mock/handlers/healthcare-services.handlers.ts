import type {
  HealthcareServiceOffer,
  NewHealthcareServiceOffer,
  HealthcareServiceOfferPatch,
  ReferenceUnit,
} from '../../data-access/healthcare-services/healthcare-services.types';
import { PRACTICE_CM_NORTE, SITES_BY_PRACTICE, initialHealthcareServiceOffers } from '../fixtures/healthcare-services';
import { conflict, notFound, reply, type MockReply, type MockRouter } from '../mock-router';
import { Coleccion, cuerpo, nuevoId, texto, uuid } from '../mock-store';
import { procedimientoPorConceptId, servicios } from './practice.handlers';

/* ============================================================================
    Catálogo de procedimientos por sede (CM-06) en la maqueta.

    Las reglas del contrato §1, para que la pantalla no se acostumbre a un
    servidor más permisivo que el real:
    - un procedimiento por sede y concepto: repetirlo es 409;
    - `visibleInSearch` es verdadero sólo con precio propio y activo;
    - el precio y la moneda salen del ítem de `billing.service_catalog` al que
      apunta `serviceCatalogId`; la referencia, del nomenclador;
    - `overMargin` es siempre `null` (A-1/A-2): el aviso no se calcula acá.
   ========================================================================== */

export const offers = new Coleccion<HealthcareServiceOffer>(initialHealthcareServiceOffers());
// Sobrevive a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. Sin esto, lo
// publicado en pantalla desaparece al recargar y se ve igual que un guardado fallido.
offers.persistirEn('mock.practice.healthcare-services');

// Los ítems de catálogo de los precios de ejemplo: así el precio sale de
// `billing.service_catalog` como en la API, y corregirlo allí se refleja acá.
for (const offer of initialHealthcareServiceOffers()) {
  if (offer.serviceCatalogId !== null && offer.price !== null && !servicios.has(offer.serviceCatalogId)) {
    servicios.agregar({
      id: offer.serviceCatalogId,
      practiceId: PRACTICE_CM_NORTE,
      code: `SEED-${offer.serviceCatalogId.slice(0, 8)}`,
      name: offer.serviceDisplay,
      defaultPrice: offer.price.toFixed(2),
      currencyConceptId: offer.currencyConceptId ?? uuid('concept-currency-bob'),
      currencyCode: 'BOB',
      isActive: true,
    } as never);
  }
}

/**
 * Las respuestas de error del contrato §1 armadas acá, con su código y estado
 * explícitos: los ayudantes del enrutador cambiaron de estado entre ramas
 * (`preconditionFailed` fue 412 y hoy es 422) y este doble no puede depender de eso.
 */
function badRequest(message: string, violation: string): MockReply {
  return reply(400, {
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    message,
    error: 'Bad Request',
    details: { violations: [violation] },
  });
}

function unprocessable(message: string): MockReply {
  return reply(422, {
    statusCode: 422,
    code: 'PRECONDITION_FAILED',
    message,
    error: 'Unprocessable Entity',
    details: {},
  });
}

/** La unidad del nomenclador, o `null` si trae una que el contrato no admite. */
function unitOf(raw: string | null | undefined): ReferenceUnit | null {
  return raw === 'UMA' || raw === 'USD' ? raw : null;
}

/** Recalcula lo derivado: precio, moneda, referencia y visibilidad. */
function withDerived(
  base: Pick<
    HealthcareServiceOffer,
    'id' | 'practiceSiteId' | 'serviceConceptId' | 'serviceDisplay' | 'active' | 'referencePrice' | 'referenceUnit'
  >,
  serviceCatalogId: string | null,
): HealthcareServiceOffer {
  const priced = serviceCatalogId === null ? undefined : servicios.get(serviceCatalogId);
  const reference = procedimientoPorConceptId(base.serviceConceptId);
  const price = priced === undefined ? null : Number(priced.defaultPrice);
  return {
    ...base,
    serviceCatalogId,
    price,
    currencyConceptId: priced?.currencyConceptId ?? null,
    // Los procedimientos de ejemplo del contrato no están en el nomenclador de la
    // maqueta: conservan la referencia con la que nacieron.
    referencePrice: reference?.referencePrice == null ? base.referencePrice : Number(reference.referencePrice),
    referenceUnit: reference === undefined ? base.referenceUnit : unitOf(reference.priceUnit),
    overMargin: null,
    visibleInSearch: base.active && serviceCatalogId !== null,
  };
}

export function registerHealthcareServices(router: MockRouter): void {
  router.get('/practices/:practiceId/sites', ({ params }) => {
    const sites = SITES_BY_PRACTICE[params['practiceId']!];
    return sites === undefined ? notFound('Práctica no encontrada') : sites;
  });

  router.get('/practices/:practiceId/healthcare-services', ({ params, query }) => {
    const practiceId = params['practiceId']!;
    const siteId = texto(query, 'practiceSiteId');
    if (SITES_BY_PRACTICE[practiceId] === undefined) return notFound('Práctica no encontrada');
    const inPractice = new Set((SITES_BY_PRACTICE[practiceId] ?? []).map((s) => s.id));
    return {
      items: offers
        .todos()
        .filter((o) => inPractice.has(o.practiceSiteId))
        .filter((o) => siteId === null || o.practiceSiteId === siteId)
        .map((o) => withDerived(o, o.serviceCatalogId)),
    };
  });

  router.post('/practices/:practiceId/healthcare-services', (request) => {
    const practiceId = request.params['practiceId']!;
    const body = cuerpo<NewHealthcareServiceOffer>(request);
    const sites = SITES_BY_PRACTICE[practiceId];
    if (sites === undefined) return notFound('Práctica no encontrada');
    if (body.practiceSiteId === undefined || !sites.some((s) => s.id === body.practiceSiteId)) {
      return badRequest(
        'La sede no pertenece a esta organización.',
        'practiceSiteId Elija una sede de la organización.',
      );
    }
    const reference = body.serviceConceptId === undefined ? undefined : procedimientoPorConceptId(body.serviceConceptId);
    const known = reference !== undefined || offers.todos().some((o) => o.serviceConceptId === body.serviceConceptId);
    if (body.serviceConceptId === undefined || !known) {
      // 422 y no 400: el contrato §1 responde así al concepto fuera del nomenclador.
      return unprocessable('El procedimiento no pertenece al nomenclador de procedimientos.');
    }
    const duplicated = offers
      .todos()
      .some((o) => o.practiceSiteId === body.practiceSiteId && o.serviceConceptId === body.serviceConceptId);
    if (duplicated) return conflict('Este procedimiento ya está publicado en esta sede');

    const display =
      reference?.display ??
      offers.todos().find((o) => o.serviceConceptId === body.serviceConceptId)?.serviceDisplay ??
      'Procedimiento';
    const created = withDerived(
      {
        id: nuevoId('healthcare-service'),
        practiceSiteId: body.practiceSiteId,
        serviceConceptId: body.serviceConceptId,
        serviceDisplay: display,
        active: true,
        referencePrice: null,
        referenceUnit: null,
      },
      body.serviceCatalogId ?? null,
    );
    offers.agregar(created);
    return { status: 201, body: created };
  });

  router.patch('/practices/:practiceId/healthcare-services/:id', (request) => {
    const current = offers.get(request.params['id']!);
    if (current === undefined) return notFound('Procedimiento no encontrado');
    const patch = cuerpo<HealthcareServiceOfferPatch>(request);
    const updated = withDerived(
      { ...current, active: patch.active ?? current.active },
      patch.serviceCatalogId ?? current.serviceCatalogId,
    );
    offers.actualizar(current.id, updated);
    return updated;
  });
}

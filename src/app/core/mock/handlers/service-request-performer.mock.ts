import type {
  ServiceRequestPerformerFields,
  ServiceRequestPerformerInput,
} from '../../data-access/diagnostics/service-request-performer.types';
import { sampleSiteName, type ProcedureOrder } from '../fixtures/procedure-orders';

export { seededProcedureOrdersOf } from '../fixtures/procedure-orders';

/* ============================================================================
    El ejecutor de la orden en el doble (CONTRATO §3): lo que `POST
    /clinical/service-requests` guarda y lo que `GET
    /diagnostic-results/me/orders` devuelve.
    ========================================================================== */

/**
 * De todo lo que trae el cuerpo del alta, sólo los tres campos del ejecutor.
 *
 * `performerTenantId` queda afuera a propósito: la recomendación no le da al
 * centro acceso a la orden (CONTRATO §3).
 */
export function pickPerformerFields(
  body: ServiceRequestPerformerInput & Readonly<Record<string, unknown>>,
): ServiceRequestPerformerInput {
  const { performerSelectionConceptId, performerPractitionerProfileId, suggestedPracticeSiteId } = body;
  return {
    ...(typeof performerSelectionConceptId === 'string' ? { performerSelectionConceptId } : {}),
    ...(typeof performerPractitionerProfileId === 'string' ? { performerPractitionerProfileId } : {}),
    ...(typeof suggestedPracticeSiteId === 'string' ? { suggestedPracticeSiteId } : {}),
  };
}

/**
 * Los campos del ejecutor de una orden, como vuelven en la lista del paciente.
 *
 * Una orden sin modo no devuelve nada (ni `null` inventado). Con sede
 * sugerida suma su nombre —`null` si no se conoce—, para que el paciente no
 * vea nunca un uuid.
 */
export function performerFieldsOfOrder(order: ProcedureOrder): ServiceRequestPerformerFields {
  if (order.performerSelectionConceptId === undefined) return {};
  return {
    performerSelectionConceptId: order.performerSelectionConceptId,
    ...(order.performerPractitionerProfileId === undefined
      ? {}
      : { performerPractitionerProfileId: order.performerPractitionerProfileId }),
    ...(order.suggestedPracticeSiteId === undefined
      ? {}
      : {
          suggestedPracticeSiteId: order.suggestedPracticeSiteId,
          suggestedPracticeSiteName: sampleSiteName(order.suggestedPracticeSiteId),
        }),
  };
}

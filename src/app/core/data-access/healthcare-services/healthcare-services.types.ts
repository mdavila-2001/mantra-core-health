/** Tipos de la vista para el catálogo de procedimientos por sede (CM-06). Contrato §1. */

/** La unidad en que el nomenclador expresa su precio de referencia. */
export type ReferenceUnit = 'UMA' | 'USD';

/**
 * Un procedimiento que una sede publica, tal como lo devuelve
 * `GET /practices/:practiceId/healthcare-services`.
 *
 * `price` sale de `billing.service_catalog` (un ítem de catálogo por sede, A-13);
 * `overMargin` es siempre `null` hoy (A-1/A-2): el front no calcula el aviso.
 */
export interface HealthcareServiceOffer {
  readonly id: string;
  readonly practiceSiteId: string;
  readonly serviceConceptId: string;
  readonly serviceDisplay: string;
  readonly serviceCatalogId: string | null;
  readonly price: number | null;
  readonly currencyConceptId: string | null;
  readonly referencePrice: number | null;
  readonly referenceUnit: ReferenceUnit | null;
  readonly overMargin: boolean | null;
  readonly visibleInSearch: boolean;
  readonly active: boolean;
}

/** Cuerpo de `POST /practices/:practiceId/healthcare-services`. */
export interface NewHealthcareServiceOffer {
  readonly practiceSiteId: string;
  readonly serviceConceptId: string;
  /**
   * El ítem de `billing.service_catalog` que fija el precio propio. Se omite
   * cuando todavía no hay precio: la sede lo publica igual, pero no aparece en
   * las búsquedas del paciente (`visibleInSearch: false`).
   */
  readonly serviceCatalogId?: string;
  readonly specialtyConceptId?: string;
  readonly appointmentRequired?: boolean;
  readonly referralRequired?: boolean;
}

/** Cuerpo de `PATCH …/healthcare-services/:id`: sólo viaja lo que cambia. */
export interface HealthcareServiceOfferPatch {
  readonly serviceCatalogId?: string;
  readonly active?: boolean;
}

/** Una sede de la práctica, de `GET /practices/:practiceId/sites`. */
export interface PracticeSiteOption {
  readonly id: string;
  readonly name: string;
  readonly code?: string;
  readonly addressText?: string | null;
}

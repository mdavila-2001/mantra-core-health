import type {
  HealthcareServiceOffer,
  PracticeSiteOption,
} from '../../data-access/healthcare-services/healthcare-services.types';
import { uuid } from '../mock-store';
import { PRACTICE_CONSULTORIO, PRACTICE_OLIVOS, PRACTICE_SANLUCAS, SITIO_CONSULTORIO, SITIO_OLIVOS, SITIO_SANLUCAS } from './agenda';

/* ============================================================================
    Datos de ejemplo del catálogo de procedimientos por sede (CM-06).

    Los ids de los centros médicos de ejemplo son los del contrato congelado
    («Datos de la maqueta»): todos los carriles del front los comparten para
    que sus pantallas se hablen entre sí. Las prácticas de siempre también
    tienen sede, así que la pantalla funciona sin esperar a las de ejemplo.
   ========================================================================== */

export const PRACTICE_CM_NORTE = uuid('practice-cm-norte');
export const PRACTICE_CM_SUR = uuid('practice-cm-sur');
export const SITE_CM_NORTE_1 = uuid('site-cm-norte-1');
export const SITE_CM_SUR_1 = uuid('site-cm-sur-1');
export const PROCEDURE_UPPER_ENDOSCOPY = uuid('proc-endoscopia-alta');
export const PROCEDURE_COLONOSCOPY = uuid('proc-colonoscopia');

/** Las sedes de cada práctica, tal como las lista `GET /practices/:practiceId/sites`. */
export const SITES_BY_PRACTICE: Readonly<Record<string, readonly PracticeSiteOption[]>> = {
  [PRACTICE_CM_NORTE]: [
    {
      id: SITE_CM_NORTE_1,
      name: 'Centro Médico Norte · Sede principal',
      code: 'CMN-1',
      addressText: 'Av. Alemana, 4.º anillo, Santa Cruz de la Sierra',
    },
  ],
  [PRACTICE_CM_SUR]: [
    {
      id: SITE_CM_SUR_1,
      name: 'Centro Médico Sur · Sede principal',
      code: 'CMS-1',
      addressText: 'Av. Cristo Redentor, 3.er anillo, Santa Cruz de la Sierra',
    },
  ],
  [PRACTICE_OLIVOS]: [SITIO_OLIVOS],
  [PRACTICE_SANLUCAS]: [SITIO_SANLUCAS],
  [PRACTICE_CONSULTORIO]: [SITIO_CONSULTORIO],
};

/** Lo que el Centro Médico Norte ya publica al abrir la maqueta. */
export function initialHealthcareServiceOffers(): HealthcareServiceOffer[] {
  return [
    {
      id: uuid('offer-cm-norte-endoscopia'),
      practiceSiteId: SITE_CM_NORTE_1,
      serviceConceptId: PROCEDURE_UPPER_ENDOSCOPY,
      serviceDisplay: 'Endoscopía digestiva alta',
      serviceCatalogId: uuid('catalog-cm-norte-endoscopia'),
      price: 350,
      currencyConceptId: uuid('concept-currency-bob'),
      referencePrice: 20,
      referenceUnit: 'UMA',
      overMargin: null,
      visibleInSearch: true,
      active: true,
    },
    {
      id: uuid('offer-cm-norte-colonoscopia'),
      practiceSiteId: SITE_CM_NORTE_1,
      serviceConceptId: PROCEDURE_COLONOSCOPY,
      serviceDisplay: 'Colonoscopía',
      serviceCatalogId: null,
      price: null,
      currencyConceptId: null,
      referencePrice: 25,
      referenceUnit: 'UMA',
      overMargin: null,
      visibleInSearch: false,
      active: true,
    },
  ];
}

import type { MedicalCenterOffer } from '../../data-access/medical-centers/medical-centers.types';
import { uuid } from '../mock-store';
import { CURRENCY_PLAN_INSURANCE, ESTUDIO } from './concepts';
import { MEDICAL } from './people';

/* ============================================================================
    Centros médicos de ejemplo (CM-09).

    Los ids son los del contrato (`CONTRATO.md` «Datos de la maqueta»), para que
    las pantallas de los demás carriles hablen de los mismos centros y
    procedimientos: `uuid('<semilla>')` da siempre el mismo uuid.

    - `practice-cm-norte` ofrece los dos procedimientos.
    - `practice-cm-sur` no ofrece `proc-colonoscopia`: es el parcial.
    - El electrocardiograma es el procedimiento que la maqueta ya tiene en las
      órdenes del paciente de ejemplo; ambos centros lo ofrecen para que la
      búsqueda tenga algo que mostrar sin esperar las órdenes de CM-08.
    - La médica de ejemplo trabaja en el centro **sur**, que no es el primero de
      la lista: que su centro aparezca atrás es la prueba visible de que el
      vínculo no mejora la posición.
    ========================================================================== */

export const PROCEDURE_ENDOSCOPY = uuid('proc-endoscopia-alta');
export const PROCEDURE_COLONOSCOPY = uuid('proc-colonoscopia');
export const PROCEDURE_ECG = ESTUDIO['STUDY-ECG']!;

const BOLIVIANO_CONCEPT_ID = CURRENCY_PLAN_INSURANCE['BOB']!;

/** Una sede publicada: dónde está, qué ofrece y qué médicos de ejemplo trabajan ahí. */
export interface MedicalCenterSite {
  readonly practiceId: string;
  readonly practiceSiteId: string;
  readonly name: string;
  readonly addressText: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly offers: readonly MedicalCenterOffer[];
  /** Perfiles profesionales afiliados y activos en esta sede. */
  readonly practitionerProfileIds: readonly string[];
}

function offer(
  procedureConceptId: string,
  procedureDisplay: string,
  price: number,
  referencePrice: number | null,
  referenceUnit: 'UMA' | 'USD' | null,
): MedicalCenterOffer {
  return {
    procedureConceptId,
    procedureDisplay,
    price,
    currencyConceptId: BOLIVIANO_CONCEPT_ID,
    referencePrice,
    referenceUnit,
    // La API todavía no calcula el sobreprecio (A-1/A-2).
    overMargin: null,
  };
}

export const MEDICAL_CENTER_SITES: readonly MedicalCenterSite[] = [
  {
    practiceId: uuid('practice-cm-norte'),
    practiceSiteId: uuid('site-cm-norte-1'),
    name: 'Clínica Norte',
    addressText: 'Av. Banzer, 4to anillo, Santa Cruz de la Sierra',
    latitude: -17.7381,
    longitude: -63.1659,
    offers: [
      offer(PROCEDURE_ENDOSCOPY, 'Endoscopia digestiva alta', 650, 380, 'UMA'),
      offer(PROCEDURE_COLONOSCOPY, 'Colonoscopia', 900, 520, 'UMA'),
      offer(PROCEDURE_ECG, 'Electrocardiograma', 120, null, null),
    ],
    practitionerProfileIds: [],
  },
  {
    practiceId: uuid('practice-cm-sur'),
    practiceSiteId: uuid('site-cm-sur-1'),
    name: 'Centro Médico Sur',
    addressText: 'Av. Santos Dumont, 2do anillo, Santa Cruz de la Sierra',
    latitude: -17.8021,
    longitude: -63.1778,
    offers: [
      offer(PROCEDURE_ENDOSCOPY, 'Endoscopia digestiva alta', 580, 380, 'UMA'),
      offer(PROCEDURE_ECG, 'Electrocardiograma', 100, 25, 'USD'),
    ],
    practitionerProfileIds: [MEDICAL.id],
  },
];

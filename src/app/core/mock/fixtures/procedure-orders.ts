import type { ServiceRequestPerformerInput } from '../../data-access/diagnostics/service-request-performer.types';
import { ORDER_CATEGORY, PRIORITY, STATUS } from './concepts';
import type { SimulatedOrder } from './clinic';
import { PERFORMER_MODE } from './performer-concepts';
import { MEDICAL, PACIENTE } from './people';
import { iso, uuid } from '../mock-store';

/* ============================================================================
    Órdenes de procedimiento de la paciente de ejemplo (centros médicos).

    Viven aparte de `orderList` a propósito: esa colección es la base de la que
    leen las pantallas de laboratorio, imagen y seguros, y sumarle filas movería
    sus conteos. Sólo `GET /diagnostic-results/me/orders` las agrega a lo que ve
    la paciente; las que se piden por `POST /clinical/service-requests` sí van a
    `orderList`, como cualquier otra.

    Los ids de procedimiento y de sede son los de «Datos de la maqueta» del
    contrato, así que la orden, el centro y la búsqueda hablan de lo mismo.
    ========================================================================== */

/** Una orden con el ejecutor que eligió el médico (CONTRATO §3). */
export type ProcedureOrder = SimulatedOrder & ServiceRequestPerformerInput;

/** Los nombres de las sedes de ejemplo, que la API resolvería desde `practice`. */
const SITE_NAME: ReadonlyMap<string, string> = new Map([
  [uuid('site-cm-norte-1'), 'Centro Médico Norte — Sede Central'],
  [uuid('site-cm-sur-1'), 'Centro Médico Sur — Sede Central'],
]);

/** El nombre de una sede de ejemplo, o `null` si no se conoce (nunca el uuid). */
export function sampleSiteName(siteId: string): string | null {
  return SITE_NAME.get(siteId) ?? null;
}

const SAMPLE_PROCEDURE_ORDERS: readonly ProcedureOrder[] = [
  {
    id: uuid('order-proc-endoscopia-alta'),
    patientProfileId: PACIENTE.id,
    codeConceptId: uuid('proc-endoscopia-alta'),
    categoryConceptId: ORDER_CATEGORY['SRQ-PROCEDURE']!,
    priorityConceptId: PRIORITY['PRI-ROUTINE']!,
    statusConceptId: STATUS['ST-PENDING']!,
    requesterProfileId: MEDICAL.id,
    reasonText: 'Dolor epigástrico persistente',
    createdAt: iso(-4),
    // El médico sugiere un centro: es una recomendación, no un candado.
    performerSelectionConceptId: PERFORMER_MODE['SR_PERF_ORGANIZATION']!,
    suggestedPracticeSiteId: uuid('site-cm-sur-1'),
  },
  {
    id: uuid('order-proc-colonoscopia'),
    patientProfileId: PACIENTE.id,
    codeConceptId: uuid('proc-colonoscopia'),
    categoryConceptId: ORDER_CATEGORY['SRQ-PROCEDURE']!,
    priorityConceptId: PRIORITY['PRI-ROUTINE']!,
    statusConceptId: STATUS['ST-PENDING']!,
    requesterProfileId: MEDICAL.id,
    reasonText: 'Control por antecedente familiar',
    createdAt: iso(-9),
    // Sin recomendación: elige la paciente.
    performerSelectionConceptId: PERFORMER_MODE['SR_PERF_PATIENT_CHOICE']!,
  },
];

/** Las órdenes de procedimiento sembradas de una persona. */
export function seededProcedureOrdersOf(patientProfileId: string): readonly ProcedureOrder[] {
  return SAMPLE_PROCEDURE_ORDERS.filter((o) => o.patientProfileId === patientProfileId);
}

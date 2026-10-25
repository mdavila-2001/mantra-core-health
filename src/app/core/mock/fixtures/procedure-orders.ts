import { CATEGORIA_ORDEN, ESTADO, PERFORMER_MODE, PRIORIDAD } from './conceptos';
import type { OrdenSimulada } from './clinica';
import { MEDICA, PACIENTE } from './personas';
import { iso, uuid } from '../mock-store';

/* ============================================================================
    Órdenes de procedimiento de la paciente de ejemplo (centros médicos, CM-10).

    Viven aparte de `ordenes` a propósito: esa colección es la base de la que
    leen las pantallas de laboratorio, imagen y seguros, y sumarle filas movería
    sus conteos. Sólo `GET /diagnostic-results/me/orders` las agrega a lo que ve
    la paciente; las que se piden por `POST /clinical/service-requests` sí van a
    `ordenes`, como cualquier otra.

    Los ids de procedimiento y de sede son los de «Datos de la maqueta» del
    contrato, así que la orden, el centro y la búsqueda hablan de lo mismo.
    ========================================================================== */

/** Los nombres de las sedes de ejemplo, que la API resolvería desde `practice`. */
const SITE_NAME: ReadonlyMap<string, string> = new Map([
  [uuid('site-cm-norte-1'), 'Centro Médico Norte — Sede Central'],
  [uuid('site-cm-sur-1'), 'Centro Médico Sur — Sede Central'],
]);

/** El nombre de una sede de ejemplo, o `null` si no se conoce (nunca el uuid). */
export function sampleSiteName(siteId: string): string | null {
  return SITE_NAME.get(siteId) ?? null;
}

const SAMPLE_PROCEDURE_ORDERS: readonly OrdenSimulada[] = [
  {
    id: uuid('order-proc-endoscopia-alta'),
    patientProfileId: PACIENTE.id,
    codeConceptId: uuid('proc-endoscopia-alta'),
    categoryConceptId: CATEGORIA_ORDEN['SRQ-PROCEDURE']!,
    priorityConceptId: PRIORIDAD['PRI-ROUTINE']!,
    statusConceptId: ESTADO['ST-PENDING']!,
    requesterProfileId: MEDICA.id,
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
    categoryConceptId: CATEGORIA_ORDEN['SRQ-PROCEDURE']!,
    priorityConceptId: PRIORIDAD['PRI-ROUTINE']!,
    statusConceptId: ESTADO['ST-PENDING']!,
    requesterProfileId: MEDICA.id,
    reasonText: 'Control por antecedente familiar',
    createdAt: iso(-9),
    // Sin recomendación: elige la paciente.
    performerSelectionConceptId: PERFORMER_MODE['SR_PERF_PATIENT_CHOICE']!,
  },
];

/** Las órdenes de procedimiento sembradas de una persona, de la más nueva a la más vieja. */
export function seededProcedureOrdersOf(patientProfileId: string): readonly OrdenSimulada[] {
  return SAMPLE_PROCEDURE_ORDERS.filter((o) => o.patientProfileId === patientProfileId);
}

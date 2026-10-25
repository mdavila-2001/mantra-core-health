import { CATEGORIA_ORDEN, ESTADO, MODO_DEL_EJECUTOR, PRIORIDAD } from './conceptos';
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
const NOMBRE_DE_SEDE: ReadonlyMap<string, string> = new Map([
  [uuid('site-cm-norte-1'), 'Centro Médico Norte — Sede Central'],
  [uuid('site-cm-sur-1'), 'Centro Médico Sur — Sede Central'],
]);

/** El nombre de una sede de ejemplo, o `null` si no se conoce (nunca el uuid). */
export function nombreDeSedeDeEjemplo(siteId: string): string | null {
  return NOMBRE_DE_SEDE.get(siteId) ?? null;
}

const PROCEDIMIENTOS_DE_EJEMPLO: readonly OrdenSimulada[] = [
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
    performerSelectionConceptId: MODO_DEL_EJECUTOR['SR_PERF_ORGANIZATION']!,
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
    performerSelectionConceptId: MODO_DEL_EJECUTOR['SR_PERF_PATIENT_CHOICE']!,
  },
];

/** Las órdenes de procedimiento sembradas de una persona, de la más nueva a la más vieja. */
export function ordenesDeProcedimientoDe(patientProfileId: string): readonly OrdenSimulada[] {
  return PROCEDIMIENTOS_DE_EJEMPLO.filter((o) => o.patientProfileId === patientProfileId);
}

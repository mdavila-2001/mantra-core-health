/* ============================================================================
    The concepts each read of the patient's history needs translated
    (`medical-record.ts`).
    ========================================================================== */

import type { ClinicalSummary, MedicationRequest } from '../../../core/data-access/clinical/clinical.types';
import type { PatientOrder } from '../../../core/data-access/diagnostics/diagnostics.types';
import type { Booking } from '../../../core/data-access/scheduling/scheduling.types';

/**
 * Los conceptos que traen las órdenes del portal.
 *
 * Van en una lectura aparte porque las órdenes llegan después, al primer
 * despliegue: pedirlos con el resumen sería pedir la traducción de algo que
 * todavía no se leyó.
 */
export function conceptosDeLasOrdenes(ordenes: readonly PatientOrder[]): readonly string[] {
  const ids = ordenes.flatMap((orden) => [
    orden.codeConceptId,
    orden.categoryConceptId,
    orden.statusConceptId,
  ]);
  return [...new Set(ids.filter((id): id is string => id !== undefined))];
}

/**
 * Los conceptos que traen las citas: el estado de la reconsulta.
 *
 * Es uno solo por cita, pero se pide igual con los de las órdenes en la misma
 * lectura: dos peticiones al catálogo para un despliegue serían una de más.
 */
export function conceptosDeLasCitas(citas: readonly Booking[]): readonly string[] {
  return [...new Set(citas.map((cita) => cita.statusConceptId))];
}

/** Los conceptos que hay que traducir para pintar la historia. */
export function conceptosDe(resumen: ClinicalSummary): readonly string[] {
  const ids = [
    ...resumen.conditions.flatMap((fila) => [
      fila.codeConceptId,
      fila.clinicalStatusConceptId,
      // C6: el bloque de un diagnóstico se decide por estos dos códigos. Sin
      // pedirlos, `diagnosisStateOf` no tendría con qué ramificar y todo caería
      // en «en estudio».
      fila.verificationStatusConceptId,
      fila.clinicalCourseConceptId,
    ]),
    ...resumen.allergies.flatMap((fila) => [fila.substanceConceptId, fila.criticalityConceptId]),
    ...resumen.medicationRequests.flatMap((fila: MedicationRequest) => [
      fila.medicationConceptId,
      fila.statusConceptId,
    ]),
    ...resumen.observations.flatMap((fila) => [
      fila.codeConceptId,
      fila.quantityUnitConceptId,
      fila.valueConceptId,
    ]),
  ];
  return [...new Set(ids.filter((id): id is string => id !== undefined))];
}

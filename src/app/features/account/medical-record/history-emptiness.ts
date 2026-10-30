import type { ClinicalSummary } from '../../../core/data-access/clinical/clinical.types';

/**
 * La historia no tiene nada que mostrar.
 *
 * Se mira bloque por bloque y no `encounters` solo: una persona puede tener
 * alergias registradas antes de su primera consulta, y decirle que su historia
 * está vacía sería falso.
 *
 * **Las condiciones cuentan (C6).** Con la pestaña «Diagnósticos», un archivo con
 * diagnósticos y nada más tiene bloques que leer.
 *
 * **Los servicios recibidos también cuentan.** Un niño que solo recibió vacunas,
 * o quien solo tuvo una intervención, tiene una pestaña que leer; decirle que su
 * historia está vacía es falso por la misma razón. No viajan en el resumen: quien
 * llama los pregunta solo cuando lo demás está vacío.
 *
 * @param summary - El resumen clínico.
 * @param hasReceivedServices - Si el paciente tiene al menos un servicio recibido.
 */
export function isHistoryEmpty(summary: ClinicalSummary, hasReceivedServices: boolean): boolean {
  return (
    !hasReceivedServices &&
    summary.encounters.length === 0 &&
    summary.conditions.length === 0 &&
    summary.allergies.length === 0 &&
    summary.medicationRequests.length === 0 &&
    summary.observations.length === 0
  );
}

/** Si el resumen tiene algo más que servicios recibidos, sin preguntar por ellos. */
export function summaryHasContent(summary: ClinicalSummary): boolean {
  return !isHistoryEmpty(summary, false);
}

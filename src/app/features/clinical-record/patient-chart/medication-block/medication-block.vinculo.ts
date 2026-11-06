import type { MedicationRequest } from '../../../../core/data-access/clinical/clinical.types';
import type { DiagnosisOption, PrescriptionInChart } from './medication-block';

/**
 * Lo que la lista de recetas muestra como su vínculo: el diagnóstico (con el
 * nombre que ya tiene en la lista de diagnósticos) o el motivo escrito a mano.
 *
 * Un `indicationConditionId` que no está entre los diagnósticos a la vista —
 * quedó fuera del tope de la lectura— se dice así, en vez de callarlo: decir
 * «sin vínculo» sería falso.
 */
export function vinculoDeReceta(
  receta: Pick<MedicationRequest, 'indicationConditionId' | 'indicationText'>,
  diagnosticos: readonly DiagnosisOption[],
): Pick<PrescriptionInChart, 'vinculo' | 'vinculoEsDiagnostico' | 'indicationConditionId'> {
  if (receta.indicationConditionId !== undefined) {
    const dx = diagnosticos.find((d) => d.id === receta.indicationConditionId);
    return {
      vinculo: dx?.etiqueta ?? 'Diagnóstico de la historia',
      vinculoEsDiagnostico: true,
      indicationConditionId: receta.indicationConditionId,
    };
  }
  const motivo = receta.indicationText?.trim() ?? '';
  return motivo === ''
    ? { vinculo: null, vinculoEsDiagnostico: false, indicationConditionId: null }
    : { vinculo: motivo, vinculoEsDiagnostico: false, indicationConditionId: null };
}

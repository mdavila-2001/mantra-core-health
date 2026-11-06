/* ============================================================================
    The rows of the diagnosis table (C3): a condition and what the screen
    already resolved about it. Apart from the component so it stays small.
    ========================================================================== */

import type { Condition } from '../../../../core/data-access/clinical/clinical.types';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import {
  CODIGO_ACTIVA,
  CODIGO_CONFIRMADO,
  CODIGO_DESCARTADO,
  DIAGNOSIS_STATE_LABELS,
  diagnosisStateOf,
  type DiagnosisState,
} from '../../../../shared/clinical/diagnosis-state';
import type { Tone } from '../../../../shared/components/tone/tone.types';
import { diagnosticoParaReceta, type DiagnosisOption } from '../medication-block/medication-block';

/**
 * Una fila de la tabla: la condición y lo que la pantalla ya resolvió de ella.
 *
 * El estado sale de `diagnosisStateOf` sobre **códigos** de catálogo, nunca de
 * etiquetas: la etiqueta es presentación y puede cambiar sin aviso.
 */
export interface FilaDeDiagnostico {
  readonly condition: Condition;
  readonly nombre: string;
  readonly estado: DiagnosisState;
  readonly etiquetaDeEstado: string;
  readonly tono: Tone;
  /** «Informe · Cuadro compatible», o «—» mientras no se decidió. */
  readonly evidencia: string;
  /** Sólo un presuntivo se confirma o se rechaza. */
  readonly enEstudio: boolean;
  /** The row as a link option (`diagnosticoParaReceta`), for the verify dialog. */
  readonly opcion: DiagnosisOption;
}

/** Mismo reparto de color que la línea de tiempo de la consulta. */
const TONO_DEL_ESTADO: Readonly<Record<DiagnosisState, Tone>> = Object.freeze({
  IN_STUDY: 'warning',
  ACTIVE: 'success',
  HISTORIC: 'info',
  REFUTED: 'info',
});

const SIN_ETIQUETA = 'Diagnóstico sin etiqueta en el catálogo';

const LARGO_DEL_MOTIVO = 60;

/**
 * What backed the decision, in two words, and the trimmed reason. A ruled-out
 * one that resolved a differential also says which one replaced it
 * (`replacedByConditionId`, patch v4291).
 */
function evidenciaDe(condicion: Condition, nombreDe: (conditionId: string) => string | undefined): string {
  const decision = condicion.verification;
  if (decision === undefined || decision === null) return '—';
  const tipo =
    decision.basedOn === null
      ? null
      : decision.basedOn.kind === 'NOTE'
        ? 'Nota'
        : decision.basedOn.diagnosticReportId === undefined
          ? 'Orden'
          : 'Informe';
  const motivo =
    decision.reasonText === null
      ? null
      : decision.reasonText.length > LARGO_DEL_MOTIVO
        ? `${decision.reasonText.slice(0, LARGO_DEL_MOTIVO - 1)}…`
        : decision.reasonText;
  const reemplazo =
    condicion.replacedByConditionId === undefined
      ? null
      : `Reemplazado por ${nombreDe(condicion.replacedByConditionId) ?? 'otro diagnóstico de la historia'}`;
  return [tipo, motivo, reemplazo].filter((parte): parte is string => parte !== null).join(' · ') || '—';
}

/** Las condiciones como filas, de la más nueva a la más vieja. */
export function filasDe(conditions: readonly Condition[], etiquetas: ConceptLabels): FilaDeDiagnostico[] {
  const codigo = (conceptId: string | undefined) =>
    conceptId === undefined ? undefined : etiquetas.get(conceptId)?.code;
  const nombreDe = (conditionId: string) => {
    const otra = conditions.find((c) => c.id === conditionId);
    return otra === undefined ? undefined : (etiquetas.get(otra.codeConceptId)?.display ?? SIN_ETIQUETA);
  };
  return [...conditions]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((condition) => {
      const estado = diagnosisStateOf(
        {
          ...condition,
          verificationStatusConceptId: codigo(condition.verificationStatusConceptId),
          clinicalStatusConceptId: codigo(condition.clinicalStatusConceptId),
        },
        { confirmed: CODIGO_CONFIRMADO, refuted: CODIGO_DESCARTADO, active: CODIGO_ACTIVA },
      );
      return {
        condition,
        nombre: etiquetas.get(condition.codeConceptId)?.display ?? SIN_ETIQUETA,
        estado,
        etiquetaDeEstado: DIAGNOSIS_STATE_LABELS[estado],
        tono: TONO_DEL_ESTADO[estado],
        evidencia: evidenciaDe(condition, nombreDe),
        enEstudio: estado === 'IN_STUDY',
        opcion: diagnosticoParaReceta(condition, etiquetas.get(condition.codeConceptId)?.display ?? SIN_ETIQUETA, codigo),
      };
    });
}

/** Los conceptos que la tabla traduce: el diagnóstico y sus dos estados. */
export function conceptosDe(conditions: readonly Condition[]): string[] {
  return conditions.flatMap((condition) =>
    [
      condition.codeConceptId,
      condition.verificationStatusConceptId,
      condition.clinicalStatusConceptId,
    ].filter((id): id is string => id !== undefined),
  );
}

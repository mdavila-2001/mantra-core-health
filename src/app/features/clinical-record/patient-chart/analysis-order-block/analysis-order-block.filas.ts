/* ============================================================================
    The analysis block's history rows: each order translated to the row the
    chart shows, crossed with its reports (`analysis-order-block.ts`).
    ========================================================================== */

import type {
  DiagnosticOrder,
  DiagnosticReport,
  PatientDiagnostics,
} from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { DiagnosisOption } from '../medication-block/medication-block';
import { duplicadoDe, type EstudioEnFicha } from './analysis-order-block.helpers';

/** The history's orders, already translated (see `AnalysisOrderBlock.estudios`). */
export function filasDelCircuito(
  circuito: PatientDiagnostics,
  etiquetaDe: (conceptId: string | undefined) => string,
  diagnosticos: readonly DiagnosisOption[],
): readonly EstudioEnFicha[] {
  const conResultado = new Set(
    circuito.reports
      .filter((informe) => estaLiberado(informe))
      .map((informe) => informe.serviceRequestId)
      .filter((id): id is string => id !== undefined),
  );

  // Sólo hace falta para el texto «Satisfecha por el informe del {fecha}»:
  // el informe previo del paciente casi siempre está en esta misma lectura.
  const informesPorId = new Map(circuito.reports.map((informe) => [informe.id, informe]));

  return circuito.orders.map((orden) => aFila(orden, conResultado, informesPorId, etiquetaDe, diagnosticos));
}

/** The reports hanging from no order of this history (see `AnalysisOrderBlock.informesSueltos`). */
export function informesSueltosDe(circuito: PatientDiagnostics): readonly DiagnosticReport[] {
  const conOrden = new Set(circuito.orders.map((orden) => orden.id));
  return circuito.reports.filter(
    (informe) =>
      informe.serviceRequestId === undefined || !conOrden.has(informe.serviceRequestId),
  );
}

/**
 * Un informe cuenta como resultado sólo si tiene versión **liberada**.
 *
 * `currentVersionId` dice que hay algo redactado; `currentReleasedVersionId`
 * dice que alguien lo validó y lo liberó. Tratar el primero como resultado
 * mostraría un borrador como diagnóstico.
 */
function estaLiberado(informe: DiagnosticReport): boolean {
  return informe.currentReleasedVersionId !== undefined;
}

/** Una orden traducida a la fila que la ficha muestra. */
function aFila(
  orden: DiagnosticOrder,
  conResultado: ReadonlySet<string>,
  informesPorId: ReadonlyMap<string, DiagnosticReport>,
  etiquetaDe: (conceptId: string | undefined) => string,
  diagnosticos: readonly DiagnosisOption[],
): EstudioEnFicha {
  const duplicado = duplicadoDe(orden);

  return {
    id: orden.id,
    estudio: etiquetaDe(orden.codeConceptId),
    categoria: etiquetaDe(orden.categoryConceptId),
    estado: etiquetaDe(orden.statusConceptId),
    pedidoEl: orden.createdAt,
    conResultado: conResultado.has(orden.id),
    duplicado,
    informePrevioDel:
      duplicado === 'reused' && orden.previousDiagnosticReportId !== undefined
        ? (informesPorId.get(orden.previousDiagnosticReportId)?.createdAt ?? null)
        : null,
    justificacion: orden.duplicateOverrideReason ?? null,
    collectionPoint: orden.suggestedCareSpace ? `${orden.suggestedCareSpace.code} · ${orden.suggestedCareSpace.name}` : null,
    ...(orden.encounterId === undefined ? {} : { encounterId: orden.encounterId }),
    ...diagnosticoDe(orden.reasonConditionId, diagnosticos),
  };
}

/** «Para: Hipotiroidismo»; an id outside the list is said, not kept quiet. */
function diagnosticoDe(
  reasonConditionId: string | undefined,
  diagnosticos: readonly DiagnosisOption[],
): { paraDiagnostico?: string } {
  if (reasonConditionId === undefined) return {};
  const dx = diagnosticos.find((d) => d.id === reasonConditionId);
  return { paraDiagnostico: dx?.etiqueta ?? 'Diagnóstico de la historia' };
}

import type { ChartNotesPage } from '../../../../core/data-access/chart-notes/chart-notes.types';
import type { PatientDiagnostics } from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';

/**
 * «Informe · Hemograma completo · 12 sept 2026».
 *
 * Sin una opción vacía propia: `app-select` ya dibuja su `placeholder` como
 * la opción nula, y sumarle otra mostraba «Sin evidencia» dos veces.
 */
export function opcionesDeEvidencia(
  circuito: PatientDiagnostics | null,
  notas: ChartNotesPage | null,
  etiquetas: ConceptLabels,
): readonly SelectOption<string | null>[] {
  const nombre = (conceptId: string) => etiquetas.get(conceptId)?.display ?? 'Estudio';
  const fecha = (instante: Date) =>
    instante.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  return [
    ...(circuito?.reports ?? []).map((informe) => ({
      value: `report:${informe.id}`,
      label: `Informe · ${nombre(informe.codeConceptId)} · ${fecha(informe.createdAt)}`,
    })),
    ...(circuito?.orders ?? []).map((orden) => ({
      value: `order:${orden.id}`,
      label: `Orden · ${nombre(orden.codeConceptId)} · ${fecha(orden.createdAt)}`,
    })),
    ...(notas?.items ?? []).map((nota) => ({
      value: `note:${nota.noteId}`,
      // «Nota #a1b2»: cuatro caracteres distinguen dos notas del mismo día sin
      // mostrar el identificador entero.
      label: `Nota #${nota.noteId.replace(/-/g, '').slice(-4)} · ${fecha(nota.signedAt ?? nota.createdAt)}`,
    })),
  ];
}

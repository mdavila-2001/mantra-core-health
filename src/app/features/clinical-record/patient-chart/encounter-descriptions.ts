import type { DiagnosticOrder } from '../../../core/data-access/diagnostics/diagnostics.types';
import type { DentalCatalog, DentalProcedure } from '../../../core/data-access/procedures/procedures.types';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';

/** Los procedimientos odontológicos de un encuentro, en palabras. */
export function describirDentales(
  dentales: readonly DentalProcedure[] | null,
  catalogo: DentalCatalog | null,
): string {
  if (dentales === null) {
    return 'No se pudo leer el histórico odontológico';
  }
  if (dentales.length === 0) {
    return 'Sin procedimientos odontológicos en este encuentro';
  }
  const nombres = new Map(
    [
      ...(catalogo?.procedureCodes ?? []),
      ...(catalogo?.teeth ?? []),
      ...(catalogo?.quadrants ?? []),
    ].map((entrada) => [entrada.conceptId, entrada.display]),
  );
  return dentales
    .map((d) => {
      const nombre = nombres.get(d.procedureCodeConceptId) ?? 'Procedimiento odontológico';
      const sitios = d.sites
        .map((sitio) => nombres.get(sitio.bodySiteConceptId) ?? sitio.description)
        .filter((sitio): sitio is string => sitio !== undefined && sitio !== '');
      return sitios.length === 0 ? nombre : `${nombre} (${sitios.join(', ')})`;
    })
    .join(', ');
}

/** Los estudios de laboratorio e imagen pedidos en un encuentro, en palabras. */
export function describirEstudios(
  estudios: readonly DiagnosticOrder[] | null,
  etiquetas: ConceptLabels,
): string {
  if (estudios === null) {
    return 'No se pudieron leer los estudios';
  }
  if (estudios.length === 0) {
    return 'Sin estudios pedidos en este encuentro';
  }
  return estudios
    .map((o) => {
      const nombre = etiquetas.get(o.codeConceptId)?.display ?? 'Estudio';
      const estado = etiquetas.get(o.statusConceptId)?.display;
      return estado === undefined ? nombre : `${nombre} (${estado})`;
    })
    .join(', ');
}

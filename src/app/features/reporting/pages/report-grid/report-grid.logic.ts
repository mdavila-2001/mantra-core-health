import { VERTICALES } from '@core/data-access/reporting/reporting-labels';
import type { ReporteCatalogo, VerticalReporte } from '@core/data-access/reporting/reporting.types';

export type VerticalFilter = VerticalReporte | 'all';

/** Minúsculas y sin tildes: «analitica» encuentra «Analítica». */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function matchesQuery(report: ReporteCatalogo, query: string): boolean {
  const needle = normalizeText(query);
  if (needle === '') {
    return true;
  }
  const haystack = normalizeText(`${report.nombre} ${report.descripcion} ${report.responsable}`);
  return needle.split(/\s+/).every((word) => haystack.includes(word));
}

export function filterReports(
  reports: readonly ReporteCatalogo[],
  vertical: VerticalFilter,
  query: string,
): readonly ReporteCatalogo[] {
  return reports.filter((r) => (vertical === 'all' || r.vertical === vertical) && matchesQuery(r, query));
}

/** Por vertical (en el orden del portal) y luego por nombre: el mismo reporte siempre cae en el mismo lugar. */
export function sortReports(reports: readonly ReporteCatalogo[]): readonly ReporteCatalogo[] {
  return [...reports].sort(
    (a, b) =>
      VERTICALES.indexOf(a.vertical) - VERTICALES.indexOf(b.vertical) ||
      a.nombre.localeCompare(b.nombre, 'es'),
  );
}

export interface VerticalCount {
  readonly vertical: VerticalReporte;
  readonly count: number;
}

/**
 * Cuántos reportes tiene cada vertical entre los que cumplen la búsqueda. Solo salen las verticales
 * que el catálogo trae: un chip con cero que nunca podrá tener nada sería ruido.
 */
export function countByVertical(reports: readonly ReporteCatalogo[], query: string): readonly VerticalCount[] {
  return VERTICALES.filter((v) => reports.some((r) => r.vertical === v)).map((vertical) => ({
    vertical,
    count: reports.filter((r) => r.vertical === vertical && matchesQuery(r, query)).length,
  }));
}

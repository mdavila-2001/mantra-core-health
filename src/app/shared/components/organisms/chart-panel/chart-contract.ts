import type { ChartSpec, DatosGrafico } from '@core/data-access/reporting/reporting.types';

/**
 * El contrato de todo gráfico del portal (ADR-0017):
 * 1 título · 2 gráfico · 3 leyenda · 4 tooltip · 5 filtro por clic ·
 * 6 cómo se calcula · 7 velas. Los puntos 5–7 pueden faltar **solo** con motivo
 * escrito. Devuelve las violaciones; vacío = cumple.
 */
export function violacionesDelContrato(spec: ChartSpec): string[] {
  const v: string[] = [];
  if (spec.titulo.trim() === '') v.push('1) falta el título');
  if (spec.resumenAccesible.trim() === '') v.push('falta el resumen accesible');
  if (spec.filtro === null && !spec.filtroMotivo?.trim()) v.push('5) sin filtro y sin motivo');
  if (spec.info === null && !spec.infoMotivo?.trim()) v.push('6) sin información de cálculo y sin motivo');
  if (spec.velas === null && !spec.velasMotivo?.trim()) v.push('7) sin velas y sin motivo');
  if (spec.velas !== null && spec.velas.velas.length === 0) v.push('7) velas vacías');
  if (spec.info !== null && (spec.info.formula.trim() === '' || spec.info.fuente.trim() === '')) {
    v.push('6) la información no trae fórmula o fuente');
  }
  if (!tieneDatos(spec.datos)) {
    if (!spec.sinDatoMotivo?.trim()) v.push('sin datos y sin motivo de «Sin dato»');
  }
  return v;
}

export function tieneDatos(datos: DatosGrafico): boolean {
  switch (datos.tipo) {
    case 'cartesiano':
      return datos.series.some((s) => s.valores.some((x) => x !== null));
    case 'partes':
      return datos.partes.some((p) => p.valor !== null);
    case 'mapa-calor':
      return datos.celdas.some((c) => c[2] !== null);
    case 'medidor':
      return datos.valor !== null;
    case 'cascada':
      return datos.pasos.length > 0;
  }
}

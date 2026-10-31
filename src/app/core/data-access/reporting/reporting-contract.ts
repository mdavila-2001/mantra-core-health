import type { ChartSpec, DatosGrafico } from './reporting.types';

/**
 * El contrato de todo gráfico del portal (ADR-0017):
 * 1 título · 2 gráfico · 3 leyenda · 4 tooltip · 5 filtro por clic ·
 * 6 cómo se calcula · 7 velas. Los puntos 5–7 pueden faltar **solo** con motivo
 * escrito. Devuelve las violaciones; vacío = cumple.
 */
export function getContractViolations(spec: ChartSpec): string[] {
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
  v.push(...violacionesDePaleta(spec));
  if (!hasData(spec.datos)) {
    if (!spec.sinDatoMotivo?.trim()) v.push('sin datos y sin motivo de «Sin dato»');
  }
  return v;
}

/**
 * Un gráfico usa UNA familia de color. `estado` (2xx/4xx/5xx) exige que CADA serie diga su rol; un `rol`
 * en un gráfico que no es de estado, o un histograma con los bordes mal contados, no se dibuja.
 */
function violacionesDePaleta(spec: ChartSpec): string[] {
  const d = spec.datos;
  const v: string[] = [];
  if (d.tipo === 'cartesiano') {
    const sinRol = d.series.filter((s) => s.rol === undefined).map((s) => s.nombre);
    const conRol = d.series.filter((s) => s.rol !== undefined).map((s) => s.nombre);
    if (d.paleta === 'estado' && sinRol.length > 0) {
      v.push(`paleta de estado: falta el rol de ${sinRol.join(', ')}`);
    }
    if (d.paleta !== 'estado' && conRol.length > 0) {
      v.push(`el rol de ${conRol.join(', ')} sólo vale con paleta de estado (no se mezclan familias de color)`);
    }
    if (d.enfasis !== undefined && !d.categorias.includes(d.enfasis) && !d.series.some((s) => s.nombre === d.enfasis)) {
      v.push(`el énfasis «${d.enfasis}» no es una categoría ni una serie`);
    }
  }
  if (d.tipo === 'histograma' && d.bordes.length !== d.conteos.length + 1) {
    v.push('histograma: debe haber un borde más que cubos');
  }
  return v;
}

export function hasData(datos: DatosGrafico): boolean {
  switch (datos.tipo) {
    case 'cartesiano':
      return datos.series.some((s) => s.valores.some((x) => x !== null));
    case 'partes':
      return datos.partes.some((p) => p.valor !== null);
    case 'mapa-calor':
      return datos.celdas.some((c) => c[2] !== null);
    case 'medidor':
      return datos.valor !== null;
    case 'histograma':
      return datos.conteos.some((x) => x !== null);
    case 'cascada':
      return datos.pasos.length > 0;
  }
}

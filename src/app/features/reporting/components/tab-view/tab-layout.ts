import type { ChartSpec } from '@core/data-access/reporting/reporting.types';

/**
 * Los gráficos de media columna se acomodan de a dos (la cuadrícula rellena los huecos
 * con los siguientes). Si en una sección sobra uno, queda una tarjeta con la mitad de la
 * fila vacía —lo que el cliente prohíbe (CLAUDE.md, regla 6)—: el último que sobra pasa a
 * ancho completo. Solo se estira lo que se lee bien ancho (barras, líneas, cascada, mapa de
 * calor, embudo); una dona o un medidor a todo el ancho quedan perdidos y se dejan como están.
 */
export function orphanCharts(charts: readonly ChartSpec[]): ReadonlySet<string> {
  const halves = charts.filter((c) => c.ancho !== 'completo');
  if (halves.length % 2 === 0) {
    return new Set();
  }
  const stretchable = [...halves].reverse().find((c) => {
    const d = c.datos;
    return d.tipo === 'partes' ? d.forma === 'embudo' : d.tipo !== 'medidor';
  });
  return stretchable === undefined ? new Set() : new Set([stretchable.id]);
}

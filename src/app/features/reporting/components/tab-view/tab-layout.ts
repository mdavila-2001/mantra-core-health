import type { ChartSpec } from '@core/data-access/reporting/reporting.types';

/**
 * Los gráficos de media columna se acomodan de a dos (la cuadrícula rellena los huecos
 * con los siguientes). Si en una sección sobra uno, queda una tarjeta con la mitad de la
 * fila vacía —lo que el cliente prohíbe (CLAUDE.md, regla 6)—: el último que sobra pasa a
 * ancho completo. Se prefiere estirar lo que se lee bien ancho (barras, líneas, cascada, mapa de
 * calor, embudo); una dona o un medidor solo se estiran si no queda otra, porque una ficha con
 * la mitad de la fila vacía es peor que un medidor centrado en una tarjeta ancha.
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
  const last = halves[halves.length - 1];
  const chosen = stretchable ?? last;
  return chosen === undefined ? new Set() : new Set([chosen.id]);
}

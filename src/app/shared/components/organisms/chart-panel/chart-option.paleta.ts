import type { DatosGrafico, RolSerie } from '@core/data-access/reporting/reporting.types';
import type { ChartTheme } from './chart-theme';

type Cartesiano = Extract<DatosGrafico, { tipo: 'cartesiano' }>;

/** Qué pasos de la rampa ordinal (4) se usan según cuántas series hay: se salta el más claro mientras se pueda (2,1:1 sobre la superficie). */
const PASOS_ORDINAL: Readonly<Record<number, readonly number[]>> = {
  1: [1],
  2: [1, 3],
  3: [1, 2, 3],
  4: [0, 1, 2, 3],
};

/**
 * Un gráfico usa UNA sola familia de color (dataviz `color-formula.md`):
 * - `categorica` (por defecto): identidad, en el orden fijo de `--chart-1..8`.
 * - `ordinal`: el orden de las series ES el dato (p50 < p95 < p99): una rampa de un matiz.
 * - `estado`: la serie SIGNIFICA bueno/aviso/error (2xx/4xx/5xx): `--st-*`, nunca la posición.
 * `enfasis` no recolorea: la serie nombrada lleva el acento y las demás se atenúan.
 */
export function coloresDeSeries(d: Cartesiano, tema: ChartTheme): string[] {
  const n = d.series.length;
  const paleta = d.paleta ?? 'categorica';
  if (paleta === 'estado' && tema.estado !== undefined) {
    const estado = tema.estado;
    return d.series.map((s) => colorDeRol(s.rol, estado, tema));
  }
  if (paleta === 'ordinal' && tema.ordinal !== undefined && tema.ordinal.length >= 4) {
    const pasos = PASOS_ORDINAL[Math.min(4, Math.max(1, n))] ?? [1];
    const rampa = tema.ordinal;
    return d.series.map((_, i) => rampa[pasos[Math.min(i, pasos.length - 1)] ?? 1] ?? tema.serie[0] ?? 'currentColor');
  }
  if (d.enfasis !== undefined && n > 1) {
    const atenuado = tema.atenuado ?? tema.textoSuave;
    return d.series.map((s) => (s.nombre === d.enfasis ? (tema.serie[0] ?? atenuado) : atenuado));
  }
  return d.series.map((_, i) => tema.serie[i] ?? tema.serie[i % tema.serie.length] ?? 'currentColor');
}

function colorDeRol(rol: RolSerie | undefined, estado: NonNullable<ChartTheme['estado']>, tema: ChartTheme): string {
  switch (rol) {
    case 'exito':
      return estado.exito;
    case 'aviso':
      return estado.aviso;
    case 'error':
      return estado.error;
    default:
      return tema.textoSuave;
  }
}

/** Color de una barra de la categoría `nombre` cuando hay UNA serie y `enfasis` nombra una categoría. */
export function colorDeCategoria(d: Cartesiano, tema: ChartTheme, base: string, nombre: string): string {
  if (d.enfasis === undefined || d.series.length !== 1 || !d.categorias.includes(d.enfasis)) {
    return base;
  }
  return nombre === d.enfasis ? (tema.serie[0] ?? base) : (tema.atenuado ?? tema.textoSuave);
}

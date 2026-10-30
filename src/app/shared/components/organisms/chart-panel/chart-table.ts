import { formatearValor, NO_DATA } from '@core/data-access/reporting/reporting-format';
import type { ChartSpec } from '@core/data-access/reporting/reporting.types';
import type { ModoGrafico } from './chart-option.builder';

/**
 * La tabla de respaldo de un gráfico (skill `dataviz`: «a table view exists»).
 * Es OBLIGATORIA: tres colores de la paleta quedan bajo 3:1 de contraste sobre
 * la superficie clara y la regla de relevo exige la tabla. De ella sale también
 * el CSV, para que lo exportado y lo visto no puedan discrepar.
 */
export interface ChartTableData {
  readonly columnas: readonly string[];
  /** Texto ya formateado, para mostrar. */
  readonly filas: readonly (readonly string[])[];
  /** Valores crudos (`null` = sin dato), para el CSV. */
  readonly crudo: readonly (readonly (string | number | null)[])[];
}

export function buildChartTable(spec: ChartSpec, modo: ModoGrafico): ChartTableData {
  const f = (v: number | null) => (v === null ? NO_DATA : formatearValor(v, spec.unidad));
  if (modo === 'velas' && spec.velas !== null) {
    const columnas = ['Fecha', 'Apertura', 'Cierre', 'Mínimo', 'Máximo'];
    const crudo = spec.velas.velas.map((v) => [v.fecha, v.apertura, v.cierre, v.minimo, v.maximo]);
    return { columnas, crudo, filas: crudo.map((r) => [String(r[0]), f(r[1] as number), f(r[2] as number), f(r[3] as number), f(r[4] as number)]) };
  }
  const d = spec.datos;
  switch (d.tipo) {
    case 'cartesiano': {
      const columnas = ['Categoría', ...d.series.map((s) => s.nombre)];
      const crudo = d.categorias.map((c, i) => [c, ...d.series.map((s) => s.valores[i] ?? null)]);
      return { columnas, crudo, filas: crudo.map((r) => r.map((v, i) => (i === 0 ? String(v) : f(v as number | null)))) };
    }
    case 'partes': {
      const crudo = d.partes.map((p) => [p.nombre, p.valor]);
      return { columnas: ['Elemento', 'Valor'], crudo, filas: crudo.map((r) => [String(r[0]), f(r[1] as number | null)]) };
    }
    case 'mapa-calor': {
      const columnas = ['', ...d.columnas];
      const crudo = d.filas.map((fila, y) => [
        fila,
        ...d.columnas.map((_, x) => d.celdas.find((c) => c[0] === x && c[1] === y)?.[2] ?? null),
      ]);
      return { columnas, crudo, filas: crudo.map((r) => r.map((v, i) => (i === 0 ? String(v) : f(v as number | null)))) };
    }
    case 'medidor': {
      const crudo = [[d.nombre, d.valor, d.objetivo ?? null]];
      return { columnas: ['Indicador', 'Valor', 'Objetivo'], crudo, filas: crudo.map((r) => [String(r[0]), f(r[1] as number | null), r[2] === null ? '—' : f(r[2] as number)]) };
    }
    case 'cascada': {
      const crudo = d.pasos.map((p) => [p.nombre, p.valor, p.total === true ? 'Total' : p.valor < 0 ? 'Disminución' : 'Aumento']);
      return { columnas: ['Paso', 'Valor', 'Tipo'], crudo, filas: crudo.map((r) => [String(r[0]), f(r[1] as number), String(r[2])]) };
    }
  }
}

/** Celda de CSV segura: comillas dobles y neutralización de fórmulas (=, +, -, @). */
export function celdaCsv(valor: string | number | null): string {
  if (valor === null) {
    return '';
  }
  let t = String(valor);
  if (typeof valor === 'string' && /^[=+\-@\t\r]/.test(t)) {
    t = `'${t}`;
  }
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function tableToCsv(tabla: ChartTableData): string {
  const lineas = [tabla.columnas.map(celdaCsv).join(','), ...tabla.crudo.map((r) => r.map(celdaCsv).join(','))];
  return `\uFEFF${lineas.join('\r\n')}\r\n`;
}

import type { ContextoReporte, PestanaReporte } from '../../../data-access/reporting/reporting.types';
import { componerBase, FUENTES_REALES, VERTICAL_NAME, ORDEN, type FuentesResumen } from './resumen.base';
import { construirAlertas } from './resumen.alertas';
import { computeConcentration } from './resumen.concentracion';
import { construirGraficos } from './resumen.graficos';
import { construirKpis } from './resumen.kpis';

/**
 * Pestaña «Resumen ejecutivo» — datos de EJEMPLO.
 *
 * No inventa dinero: compone el ingreso de las tres pestañas de vertical, de modo
 * que el total coincide con ellas por construcción. Si a una le falta el dato, el
 * compuesto es «sin dato» con su motivo y no una suma parcial.
 */
export function construirResumen(ctx: ContextoReporte): PestanaReporte {
  return buildSummaryWith(ctx, FUENTES_REALES);
}

/** Igual que `construirResumen`, pero con las verticales inyectadas (las pruebas simulan verticales vacías). */
export function buildSummaryWith(ctx: ContextoReporte, fuentes: FuentesResumen): PestanaReporte {
  const base = componerBase(ctx, fuentes);
  const faltantes = ORDEN.filter((c) => base.lecturas[c].ingreso === null).map((c) => VERTICAL_NAME[c]);
  return {
    pestana: 'resumen',
    generadoEn: '2026-10-30T09:00:00-04:00',
    origen: 'ejemplo',
    kpis: construirKpis(base),
    graficos: construirGraficos(base),
    tablas: [construirAlertas(base, computeConcentration(base)?.pct ?? null)],
    avisos: [
      'Datos de EJEMPLO',
      ...(faltantes.length === 0
        ? []
        : [`Falta el ingreso de ${faltantes.join(', ')}: el total y lo que depende de él no se calculan.`]),
    ],
    secciones: [
      { titulo: 'Ingreso', descripcion: 'Cuánto se ganó y cómo cambió.', graficos: ['ingreso-vertical-tiempo', 'cascada-ingreso', 'avance-meta', 'mrr-total'] },
      { titulo: 'Composición', descripcion: 'De dónde viene el ingreso.', graficos: ['mix-ingresos', 'calor-vertical-mes', 'embudo-global'] },
      { titulo: 'Riesgo y concentración', descripcion: 'Cuánto depende el ingreso de pocos clientes.', graficos: ['top10-clientes'] },
      { titulo: 'Alertas', descripcion: 'Indicadores fuera de umbral.', tablas: ['alertas'] },
    ],
  };
}

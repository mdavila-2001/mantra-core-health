import type { ContextoReporte, PestanaReporte } from '../../../data-access/reporting/reporting.types';
import { componerBase, FUENTES_REALES, VERTICAL_NAME, ORDEN, type FuentesResumen } from './resumen.base';
import { construirAlertas } from './resumen.alertas';
import { computeConcentration } from './resumen.concentracion';
import { construirGraficos } from './resumen.graficos';
import { construirKpis } from './resumen.kpis';
import { construirEconomiaUnitaria, construirGlosario, construirMapaMonetizacion, lecturaRapida } from './resumen.monetizacion';

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
    tablas: [
      construirMapaMonetizacion(base),
      construirEconomiaUnitaria(base),
      construirAlertas(base, computeConcentration(base)?.pct ?? null),
      construirGlosario(base),
    ],
    avisos: [
      'Datos de EJEMPLO',
      ...(faltantes.length === 0
        ? []
        : [`Falta el ingreso de ${faltantes.join(', ')}: el total y lo que depende de él no se calculan.`]),
    ],
    // Cada sección responde una pregunta que se hace quien necesita entender el negocio, en el orden en que se hace.
    secciones: [
      {
        titulo: '¿Cuánto entró y cómo viene cambiando?',
        descripcion: lecturaRapida(base),
        graficos: ['ingreso-vertical-tiempo', 'avance-meta', 'cascada-ingreso', 'mrr-total'],
      },
      {
        titulo: '¿De dónde sale el ingreso y por qué se paga?',
        descripcion: 'Alovida tiene tres fuentes de ingreso. La tabla dice quién paga cada una y por qué; los gráficos, cuánto aporta cada una mes a mes.',
        tablas: ['mapa-monetizacion'],
        graficos: ['mix-ingresos', 'calor-vertical-mes'],
      },
      {
        titulo: '¿Es un ingreso sano?',
        descripcion: 'Un ingreso grande no basta: importa si las cuentas se quedan, si cada una rinde y si no depende de unos pocos clientes.',
        tablas: ['economia-unitaria'],
        graficos: ['embudo-global', 'top10-clientes'],
      },
      { titulo: '¿Qué miro hoy?', descripcion: 'Cada indicador frente a su umbral; arriba, los más graves.', tablas: ['alertas'] },
      { titulo: 'Glosario en palabras simples', descripcion: 'Los términos de este tablero, sin jerga y con su fórmula.', tablas: ['glosario-monetizacion'] },
    ],
  };
}

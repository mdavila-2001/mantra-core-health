import {
  formatearValor,
  formatearVariacion,
  NO_DATA,
} from '@core/data-access/reporting/reporting-format';
import { ETIQUETA_DIMENSION } from '@core/data-access/reporting/reporting-labels';
import type {
  ContextoReporte,
  KpiSpec,
  PestanaReporte,
} from '@core/data-access/reporting/reporting.types';

import { ETIQUETA_COMPARACION, ETIQUETA_PERIODO } from '../state/report-context.store';
import type { RespuestaMedida, VariacionRespuesta } from './assistant.types';

/**
 * Convierte un KPI que YA devolvió el reporte en la respuesta del asistente.
 *
 * Regla de la que cuelga todo: el asistente no escribe cifras. El valor sale
 * del mismo `KpiSpec` que pinta la pestaña, con el mismo `formatearValor`, así
 * que el número del chat y el de la tarjeta no pueden diferir.
 */
export function construirRespuesta(
  kpi: KpiSpec,
  pestana: PestanaReporte,
  contexto: ContextoReporte,
): RespuestaMedida {
  const missing = kpi.valor === null || Number.isNaN(kpi.valor);
  return {
    titulo: kpi.titulo,
    ambito: contexto.alcance === 'organizacion' ? 'de su organización' : 'de toda la plataforma',
    periodo: ETIQUETA_PERIODO[contexto.periodo],
    filtros: contexto.filtros.map((f) => `${ETIQUETA_DIMENSION[f.dimension]}: ${f.valor}`),
    valorTexto: missing ? NO_DATA : formatearValor(kpi.valor, kpi.unidad),
    sinDato: missing,
    motivoSinDato: missing ? (kpi.motivoSinDato ?? 'El reporte no indica el motivo.') : null,
    variacion: missing ? null : buildVariation(kpi, contexto),
    definicion: kpi.info?.definicion ?? `Este reporte no publica la definición: ${kpi.infoMotivo ?? 'sin motivo registrado'}.`,
    formula: kpi.info?.formula ?? null,
    fuente: kpi.info?.fuente ?? 'No indicada',
    frescura: kpi.info?.frescura ?? 'No indicada',
    generadoEn: readableDate(pestana.generadoEn),
    esEjemplo: pestana.origen === 'ejemplo',
    ruta: `/reports/commercial/${pestana.pestana}`,
  };
}

function buildVariation(kpi: KpiSpec, contexto: ContextoReporte): VariacionRespuesta | null {
  if (contexto.comparar === 'ninguna') {
    return null;
  }
  const comparacion = ETIQUETA_COMPARACION[contexto.comparar].toLowerCase();
  const pct = kpi.variacionPct;
  if (pct === null || Number.isNaN(pct)) {
    return { texto: formatearVariacion(null), descripcion: `No se puede comparar ${comparacion}`, favorable: null };
  }
  if (pct === 0) {
    return { texto: formatearVariacion(0), descripcion: `sin cambio ${comparacion}`, favorable: null };
  }
  const sube = pct > 0;
  const favorable = kpi.subirEsMalo === true ? !sube : sube;
  return {
    texto: formatearVariacion(pct),
    descripcion: `${sube ? 'subió' : 'bajó'} ${comparacion} (${favorable ? 'favorable' : 'desfavorable'})`,
    favorable,
  };
}

function readableDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

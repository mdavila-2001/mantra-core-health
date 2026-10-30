import { describe, expect, it } from 'vitest';

import type { ContextoReporte, KpiSpec } from '@core/data-access/reporting/reporting.types';
import { construirAdquisicion } from './adquisicion.dataset';
import { construirCobros } from './cobros.dataset';
import { construirComisiones } from './comisiones.dataset';
import { construirPublicidad } from './publicidad.dataset';
import { construirResumen } from './resumen.dataset';

const CTX: ContextoReporte = { periodo: '30d', comparar: 'ninguna', moneda: 'BOB', alcance: 'plataforma', filtros: [] };
const BOB = { tipo: 'moneda', moneda: 'BOB' };
const NUMERO = { tipo: 'numero' };

function kpi(kpis: readonly KpiSpec[], id: string): KpiSpec {
  const k = kpis.find((x) => x.id === id);
  expect(k, `falta el KPI ${id}`).toBeDefined();
  return k as KpiSpec;
}

/**
 * Regresión: el «N de M» de la tarjeta usaba la unidad del KPI para los dos lados, así que un
 * CPM salía «Bs 102.774,68 de Bs 4.774.172,55» (impresiones como bolivianos) y un ROAS «304.199 de 52.423»
 * (importes sin moneda). Cada KPI cuyos lados no sean de la unidad por omisión la declara.
 */
describe('unidades del numerador y denominador de los KPI', () => {
  it('un costo por unidad: el numerador es dinero y el denominador es un conteo', () => {
    const pub = construirPublicidad(CTX).kpis;
    for (const id of ['cpm', 'cpa']) {
      const k = kpi(pub, id);
      expect(k.unidadNumerador, id).toEqual(BOB);
      expect(k.unidadDenominador, id).toEqual(NUMERO);
    }
    const cac = kpi(construirAdquisicion(CTX).kpis, 'cac');
    expect(cac.unidadNumerador).toEqual(BOB);
    expect(cac.unidadDenominador).toEqual(NUMERO);
  });

  it('una tasa o razón de importes lleva moneda en los dos lados', () => {
    const casos: [readonly KpiSpec[], string][] = [
      [construirPublicidad(CTX).kpis, 'roas'],
      [construirResumen(CTX).kpis, 'mix-ingreso'],
      [construirResumen(CTX).kpis, 'concentracion-top10'],
      [construirComisiones(CTX).kpis, 'take-rate'],
      [construirComisiones(CTX).kpis, 'conciliado-pct'],
      [construirCobros(CTX).kpis, 'reembolsos-pct'],
      [construirCobros(CTX).kpis, 'costo-gateway-pct'],
      [construirCobros(CTX).kpis, 'disputas-pct'],
      [construirAdquisicion(CTX).kpis, 'payback-cac-meses'],
      [construirAdquisicion(CTX).kpis, 'costo-promociones-pct'],
    ];
    for (const [kpis, id] of casos) {
      const k = kpi(kpis, id);
      expect(k.unidadNumerador, `${id} numerador`).toEqual(BOB);
      expect(k.unidadDenominador, `${id} denominador`).toEqual(BOB);
    }
  });

  it('las tasas de conteos no declaran unidad: se leen como números', () => {
    const k = kpi(construirCobros(CTX).kpis, 'tasa-exito-pago');
    expect(k.unidadNumerador).toBeUndefined();
    expect(k.unidadDenominador).toBeUndefined();
  });

  it('el resumen conserva las unidades al reutilizar KPI de otras pestañas (take rate y ROAS)', () => {
    const res = construirResumen(CTX).kpis;
    for (const id of ['take-rate', 'roas']) {
      const k = kpi(res, id);
      expect(k.unidadNumerador, id).toEqual(BOB);
      expect(k.unidadDenominador, id).toEqual(BOB);
    }
  });
});

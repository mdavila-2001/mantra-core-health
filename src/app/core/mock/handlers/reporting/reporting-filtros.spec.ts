import { describe, expect, it } from 'vitest';

import type { ContextoReporte, VerticalReporte } from '@core/data-access/reporting/reporting.types';
import { construirAdquisicion } from './adquisicion.dataset';
import { construirCalidad } from './calidad.dataset';
import { construirCobros } from './cobros.dataset';
import { construirComisiones } from './comisiones.dataset';
import { construirPublicidad } from './publicidad.dataset';
import { construirResumen } from './resumen.dataset';
import { construirSuscripciones } from './suscripciones.dataset';

const CTX: ContextoReporte = { periodo: '30d', comparar: 'ninguna', moneda: 'BOB', alcance: 'plataforma', filtros: [] };

const PESTANAS = {
  resumen: construirResumen,
  suscripciones: construirSuscripciones,
  publicidad: construirPublicidad,
  comisiones: construirComisiones,
  cobros: construirCobros,
  adquisicion: construirAdquisicion,
  calidad: construirCalidad,
} as const satisfies Record<VerticalReporte, (ctx: ContextoReporte) => unknown>;

const FECHA = /^\d{4}-\d{2}(-\d{2})?$/;

describe('filtro por clic de los gráficos', () => {
  for (const [nombre, construir] of Object.entries(PESTANAS)) {
    describe(nombre, () => {
      const graficos = construir(CTX).graficos;

      it('un eje de fechas nunca filtra por categoría: la dimensión son las series', () => {
        // Regresión: «Ingreso por plan» filtraba «plan = 2026-10-01» al hacer clic en una barra.
        for (const g of graficos) {
          const d = g.datos;
          if (g.filtro === null || d.tipo !== 'cartesiano' || !d.categorias.every((c) => FECHA.test(c))) {
            continue;
          }
          expect(g.filtro.valorDe, `${g.id} tiene un eje de fechas y filtra por «${g.filtro.dimension}»`).toBe('serie');
          expect(d.series.length, `${g.id} filtra por serie pero tiene una sola`).toBeGreaterThan(1);
        }
      });

      it('un filtro por serie solo existe en gráficos cartesianos', () => {
        for (const g of graficos) {
          if (g.filtro?.valorDe === 'serie') {
            expect(g.datos.tipo, g.id).toBe('cartesiano');
          }
        }
      });
    });
  }
});

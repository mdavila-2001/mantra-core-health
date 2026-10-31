import { describe, expect, it } from 'vitest';

import type { ObsSummary, ObsTimeseries } from '@core/data-access/observability/observability.types';
import { estadoDeTasa5xx, kpisResumen, motivoLegible, specHistogramaLatencia, specLatenciaTiempo, specSolicitudes } from './obs-mappers';

const SOBRE = {
  window: { from: '2026-10-31T10:00:00.000Z', to: '2026-10-31T13:00:00.000Z', interval: 'hour' as const, timezone: 'UTC' },
  freshness: { lastFlushAt: '2026-10-31T12:59:00.000Z', lagSeconds: 20, droppedFlushes: 0 },
  notMeasured: [],
  generatedAt: '2026-10-31T13:00:00.000Z',
};

function resumen(parcial: Partial<ObsSummary['kpis']> = {}): ObsSummary {
  return {
    ...SOBRE,
    kpis: {
      requests: { value: 200 },
      errorRate5xx: { value: 0.06 },
      errorRate4xx: { value: 0.1 },
      latencyMs: {
        p50: { value: 18 },
        p95: { value: 10000, atLeast: true },
        p99: { value: 10000, atLeast: true },
        avg: 40,
        max: 900,
        method: 'histogram-estimate',
        approximate: true,
      },
      errorGroups: { value: { new: 2, open: 3, regressed: 1 } },
      slowSql: { value: { count: 4, topHash: 'abc' } },
      workers: { value: null, reason: 'WORKERS_NOT_REPORTING' },
      dependencies: { value: null, reason: 'DEPENDENCIES_NOT_PROBED' },
      slo: { value: null, reason: 'SLO_NOT_COMPUTED' },
      ...parcial,
    },
    statusClasses: null,
    latencyBuckets: null,
  };
}

const serie = (key: string, puntos: [string, number | null][]) => ({ key, points: puntos.map(([bucket, value]) => ({ bucket, value })) });

describe('estadoDeTasa5xx', () => {
  it('crítico desde 5 %, atención desde 1 %, bien debajo, y sin dato no inventa estado', () => {
    expect(estadoDeTasa5xx(0.05)).toBe('critico');
    expect(estadoDeTasa5xx(0.01)).toBe('aviso');
    expect(estadoDeTasa5xx(0.0099)).toBe('bueno');
    expect(estadoDeTasa5xx(0)).toBe('bueno');
    expect(estadoDeTasa5xx(null)).toBeUndefined();
  });
});

describe('kpisResumen', () => {
  it('la tasa de 5xx es la cifra héroe, en %, con su estado', () => {
    const k = kpisResumen(resumen()).find((x) => x.id === 'error-rate-5xx');
    expect(k).toMatchObject({ valor: 6, variante: 'hero', estado: 'critico', subirEsMalo: true });
  });

  it('un percentil que cayó en el último corte es «≥ 10 s» (cota), no «10 s»', () => {
    const k = kpisResumen(resumen()).find((x) => x.id === 'latency-p95');
    expect(k?.prefijo).toBe('≥ ');
    expect(k?.valor).toBe(10000);
  });

  it('sin peticiones, las tasas son null con su motivo (no 0 %)', () => {
    const k = kpisResumen(resumen({ errorRate5xx: { value: null, reason: 'NO_REQUESTS_IN_WINDOW' }, errorRate4xx: { value: null, reason: 'NO_REQUESTS_IN_WINDOW' } }));
    const t = k.find((x) => x.id === 'error-rate-5xx');
    expect(t?.valor).toBeNull();
    expect(t?.motivoSinDato).toContain('no es 0 %');
    expect(t?.estado).toBeUndefined();
  });

  it('si ninguna instancia reportó, la latencia es null con motivo y no hay percentiles', () => {
    const s = resumen({
      requests: { value: null, reason: 'NO_INSTANCE_REPORTED_IN_WINDOW' },
      latencyMs: { value: null, reason: 'NO_INSTANCE_REPORTED_IN_WINDOW', method: 'histogram-estimate', approximate: true },
    });
    const p95 = kpisResumen(s).find((x) => x.id === 'latency-p95');
    expect(p95?.valor).toBeNull();
    expect(p95?.motivoSinDato).toContain('Ninguna instancia');
  });

  it('cero grupos abiertos es 0, no «sin dato»', () => {
    const k = kpisResumen(resumen({ errorGroups: { value: { new: 0, open: 0, regressed: 0 } } })).find((x) => x.id === 'error-groups');
    expect(k?.valor).toBe(0);
  });
});

describe('motivoLegible', () => {
  it('traduce los códigos conocidos y deja pasar los desconocidos tal cual', () => {
    expect(motivoLegible('SIN_MUESTRAS')).toContain('Sin peticiones');
    expect(motivoLegible('OTRO_CODIGO')).toBe('OTRO_CODIGO');
    expect(motivoLegible(undefined)).toBeUndefined();
  });
});

describe('specSolicitudes', () => {
  const ts: ObsTimeseries = {
    ...SOBRE,
    metric: 'requests',
    groupBy: 'status_class',
    minSample: 5,
    note: '',
    series: [
      serie('2xx', [['2026-10-31T10:00:00.000Z', 90], ['2026-10-31T12:00:00.000Z', 40]]),
      serie('3xx', [['2026-10-31T10:00:00.000Z', 5]]),
      serie('4xx', [['2026-10-31T10:00:00.000Z', 3], ['2026-10-31T12:00:00.000Z', 1]]),
      serie('5xx', [['2026-10-31T12:00:00.000Z', 2]]),
    ],
  };

  it('apila por resultado con paleta de estado: 2xx+3xx éxito, 4xx aviso, 5xx error', () => {
    const spec = specSolicitudes(ts, 'UTC');
    expect(spec.datos).toMatchObject({ tipo: 'cartesiano', paleta: 'estado' });
    const d = spec.datos as Extract<typeof spec.datos, { tipo: 'cartesiano' }>;
    expect(d.series.map((s) => s.rol)).toEqual(['exito', 'aviso', 'error']);
    expect(d.series[0]?.valores[0]).toBe(95);
  });

  it('un intervalo con filas pero sin 5xx tiene 0; un intervalo sin NINGUNA fila es sin dato (null)', () => {
    const d = specSolicitudes(ts, 'UTC').datos as Extract<ReturnType<typeof specSolicitudes>['datos'], { tipo: 'cartesiano' }>;
    // categorías: 10:00, 11:00, 12:00
    expect(d.categorias).toHaveLength(3);
    expect(d.series[2]?.valores).toEqual([0, null, 2]);
    expect(d.series[0]?.valores[1]).toBeNull();
  });

  it('cumple el contrato del panel (título, resumen, motivos)', () => {
    const spec = specSolicitudes(ts, 'UTC');
    expect(spec.titulo).not.toBe('');
    expect(spec.resumenAccesible).toContain('2 con error del servidor');
    expect(spec.filtro).toBeNull();
    expect(spec.filtroMotivo).toBeTruthy();
  });
});

describe('specHistogramaLatencia', () => {
  it('resta los cortes acumulados para dibujar cubos contiguos', () => {
    const spec = specHistogramaLatencia([
      { leMs: 5, count: 10 },
      { leMs: 10, count: 25 },
      { leMs: 25, count: 30 },
      { leMs: null, count: 33 },
    ]);
    expect(spec.datos).toMatchObject({ tipo: 'histograma', bordes: [0, 5, 10, 25, null], conteos: [10, 15, 5, 3], cerrado: 'derecha' });
  });

  it('sin histograma (nadie reportó) el spec queda sin datos y dice por qué', () => {
    const spec = specHistogramaLatencia(null);
    expect(spec.datos).toMatchObject({ tipo: 'histograma', conteos: [] });
    expect(spec.sinDatoMotivo).toBeTruthy();
  });
});

describe('specLatenciaTiempo', () => {
  const p = (key: string, valores: [string, number | null][]): ObsTimeseries => ({
    ...SOBRE,
    metric: 'latency_p95',
    groupBy: 'none',
    minSample: 5,
    note: '',
    series: [serie(key, valores)],
  });

  it('p95 y p99 con rampa ordinal y la referencia dibujada; un cubo sin muestra es null', () => {
    const spec = specLatenciaTiempo(
      p('latency_p95', [['2026-10-31T10:00:00.000Z', 120], ['2026-10-31T11:00:00.000Z', null]]),
      p('latency_p99', [['2026-10-31T10:00:00.000Z', 300]]),
      'UTC',
      2000,
    );
    const d = spec.datos as Extract<typeof spec.datos, { tipo: 'cartesiano' }>;
    expect(d.paleta).toBe('ordinal');
    expect(d.objetivo?.valor).toBe(2000);
    expect(d.series[0]?.valores.slice(0, 2)).toEqual([120, null]);
    expect(d.series.map((s) => s.nombre)).toEqual(['p95', 'p99']);
  });
});

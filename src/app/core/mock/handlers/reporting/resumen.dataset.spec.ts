import { getContractViolations } from '@core/data-access/reporting/reporting-contract';
import type {
  ComparacionReporte,
  ContextoReporte,
  KpiSpec,
  Moneda,
  PeriodoReporte,
  PestanaReporte,
  AlcanceReporte,
  VerticalReporte,
} from '@core/data-access/reporting/reporting.types';
import {
  convertir,
  daysInPeriod,
  factorContexto,
  redondear,
  suma,
} from './reporting-dataset.util';
import { construirResumen, construirResumenCon } from './resumen.dataset';
import type { FuentesResumen } from './resumen.base';

const PERIODOS: PeriodoReporte[] = ['7d', '30d', '90d', 'ytd', '12m'];
const COMPARAR: ComparacionReporte[] = ['ninguna', 'periodo-anterior', 'mismo-periodo-ano-anterior'];
const MONEDAS: Moneda[] = ['BOB', 'USD'];
const ALCANCES: AlcanceReporte[] = ['plataforma', 'organizacion'];

function contextos(): ContextoReporte[] {
  const out: ContextoReporte[] = [];
  for (const periodo of PERIODOS)
    for (const comparar of COMPARAR)
      for (const moneda of MONEDAS)
        for (const alcance of ALCANCES) out.push({ periodo, comparar, moneda, alcance, filtros: [] });
  return out;
}

const CTX: ContextoReporte = { periodo: '30d', comparar: 'periodo-anterior', moneda: 'BOB', alcance: 'plataforma', filtros: [] };

/* ---- verticales simuladas (DOBLES: cumplen sólo el contrato que el Resumen lee) ---- */

function kpiDinero(id: string, valor: number | null, ctx: ContextoReporte, moneda: Moneda = ctx.moneda): KpiSpec {
  return {
    id,
    titulo: id,
    valor,
    unidad: { tipo: 'moneda', moneda },
    variacionPct: valor !== null && ctx.comparar !== 'ninguna' ? 8.5 : null,
    motivoSinDato: valor === null ? 'sin fuente' : undefined,
    info: null,
    infoMotivo: 'doble de prueba',
  };
}

function kpiNum(id: string, valor: number | null, unidad: KpiSpec['unidad']): KpiSpec {
  return { id, titulo: id, valor, unidad, variacionPct: null, info: null, infoMotivo: 'doble de prueba' };
}

function vertical(
  pestana: VerticalReporte,
  baseBob: number,
  extra: (ctx: ContextoReporte) => KpiSpec[],
  moneda?: Moneda,
): (ctx: ContextoReporte) => PestanaReporte {
  return (ctx) => {
    const ingreso = redondear(convertir(baseBob * factorContexto(ctx) * (daysInPeriod(ctx.periodo) / 30), ctx.moneda));
    return {
      pestana,
      generadoEn: 'x',
      origen: 'ejemplo',
      kpis: [kpiDinero('ingreso-periodo', ingreso, ctx, moneda), ...extra(ctx)],
      graficos: [],
      tablas: [],
    };
  };
}

function vacia(pestana: VerticalReporte): (ctx: ContextoReporte) => PestanaReporte {
  return () => ({ pestana, generadoEn: 'x', origen: 'ejemplo', kpis: [], graficos: [], tablas: [] });
}

const SUSC = vertical('suscripciones', 210_000.37, (ctx) => [
  kpiDinero('mrr', redondear(convertir(190_000 * factorContexto(ctx), ctx.moneda)), ctx),
  kpiNum('suscriptores-activos', Math.round(1200 * factorContexto(ctx)), { tipo: 'numero' }),
  kpiNum('churn-cuentas', 6.2, { tipo: 'porcentaje' }),
]);
const PUB = vertical('publicidad', 95_000.11, (ctx) => [
  kpiNum('anunciantes-activos', Math.round(140 * factorContexto(ctx)), { tipo: 'numero' }),
  kpiNum('roas', 3.4, { tipo: 'razon', sufijo: '×' }),
]);
const COM = vertical('comisiones', 61_500.49, (ctx) => [
  kpiNum('take-rate', 4.1, { tipo: 'porcentaje' }),
  kpiDinero('comision-pendiente', redondear(convertir(18_000 * factorContexto(ctx), ctx.moneda)), ctx),
]);

const COMPLETAS: FuentesResumen = { suscripciones: SUSC, publicidad: PUB, comisiones: COM };

function numerosNoFinitos(valor: unknown, ruta = '$'): string[] {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? [] : [`${ruta}=${valor}`];
  }
  if (Array.isArray(valor)) {
    return valor.flatMap((v, i) => numerosNoFinitos(v, `${ruta}[${i}]`));
  }
  if (valor !== null && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([k, v]) => numerosNoFinitos(v, `${ruta}.${k}`));
  }
  return [];
}

function kpi(p: PestanaReporte, id: string): KpiSpec {
  const k = p.kpis.find((x) => x.id === id);
  if (k === undefined) throw new Error(`falta el KPI ${id}`);
  return k;
}

function grafico(p: PestanaReporte, id: string) {
  const g = p.graficos.find((x) => x.id === id);
  if (g === undefined) throw new Error(`falta el gráfico ${id}`);
  return g;
}

const CANONICOS = ['ingreso-total', 'mix-ingreso', 'mrr', 'clientes-activos', 'concentracion-top10'];

/** Contrato común a TODAS las variantes: simuladas completas, con huecos y reales. */
function contratoEstandar(nombre: string, construir: (ctx: ContextoReporte) => PestanaReporte): void {
  describe(`${nombre}: contrato estándar`, () => {
    it('cumple el contrato de gráfico en periodo × comparar × moneda × alcance', () => {
      for (const ctx of contextos()) {
        const p = construir(ctx);
        expect(p.pestana).toBe('resumen');
        expect(p.origen).toBe('ejemplo');
        for (const g of p.graficos) {
          expect(getContractViolations(g), `${g.id} en ${JSON.stringify(ctx)}`).toEqual([]);
        }
      }
    });

    it('trae ≥ 8 KPI, ≥ 8 gráficos de ≥ 5 formas, ids únicos y los ids canónicos', () => {
      const p = construir(CTX);
      expect(p.kpis.length).toBeGreaterThanOrEqual(8);
      expect(p.graficos.length).toBeGreaterThanOrEqual(8);
      const formas = new Set(p.graficos.map((g) => (g.datos.tipo === 'partes' ? g.datos.forma : g.datos.tipo)));
      expect(formas.size).toBeGreaterThanOrEqual(5);
      for (const lista of [p.kpis, p.graficos, p.tablas]) {
        const ids = lista.map((x) => x.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
      for (const id of CANONICOS) expect(p.kpis.map((k) => k.id)).toContain(id);
      expect(p.avisos).toContain('Datos de EJEMPLO');
    });

    it('es determinista y no produce NaN ni infinitos', () => {
      for (const ctx of contextos()) {
        const a = construir(ctx);
        expect(construir(ctx)).toEqual(a);
        expect(numerosNoFinitos(a)).toEqual([]);
      }
    });

    it('null ≠ 0: un KPI sin valor explica por qué, y uno con valor no trae motivo', () => {
      for (const ctx of contextos()) {
        for (const k of construir(ctx).kpis) {
          if (k.valor === null) {
            expect(k.motivoSinDato?.trim(), `${k.id}`).toBeTruthy();
          }
        }
      }
    });

    it('declara las cuatro secciones y todo lo que referencian existe', () => {
      const p = construir(CTX);
      expect(p.secciones?.map((s) => s.titulo)).toEqual(['Ingreso', 'Composición', 'Riesgo y concentración', 'Alertas']);
      const graficos = new Set(p.graficos.map((g) => g.id));
      const tablas = new Set(p.tablas.map((t) => t.id));
      for (const s of p.secciones ?? []) {
        for (const id of s.graficos ?? []) expect(graficos.has(id), id).toBe(true);
        for (const id of s.tablas ?? []) expect(tablas.has(id), id).toBe(true);
      }
    });

    it('la tabla de alertas escribe la severidad en texto', () => {
      const alertas = construir(CTX).tablas.find((t) => t.id === 'alertas')!;
      expect(alertas.filas.length).toBeGreaterThan(0);
      for (const f of alertas.filas) {
        expect(['Crítica', 'Atención', 'Normal', 'Sin evaluar']).toContain(f['severidad']);
      }
    });
  });
}

contratoEstandar('con verticales simuladas completas', (ctx) => construirResumenCon(ctx, COMPLETAS));
contratoEstandar('con las tres verticales vacías (simuladas)', (ctx) =>
  construirResumenCon(ctx, { suscripciones: vacia('suscripciones'), publicidad: vacia('publicidad'), comisiones: vacia('comisiones') }),
);
contratoEstandar('con las verticales reales', construirResumen);

describe('Resumen: composición de las tres verticales', () => {
  it('ingreso-total es la suma exacta de los ingreso-periodo de las tres verticales', () => {
    for (const ctx of contextos()) {
      const p = construirResumenCon(ctx, COMPLETAS);
      const partes = [SUSC(ctx), PUB(ctx), COM(ctx)].map((v) => kpi(v, 'ingreso-periodo').valor as number);
      expect(kpi(p, 'ingreso-total').valor, JSON.stringify(ctx)).toBe(redondear(suma(partes)));
      expect(kpi(p, 'ingreso-suscripciones').valor).toBe(partes[0]);
      expect(kpi(p, 'ingreso-publicidad').valor).toBe(partes[1]);
      expect(kpi(p, 'ingreso-comisiones').valor).toBe(partes[2]);
    }
  });

  it('la serie apilada, la dona y el mapa de calor concuerdan con el total', () => {
    const p = construirResumenCon(CTX, COMPLETAS);
    const total = kpi(p, 'ingreso-total').valor as number;
    const serie = grafico(p, 'ingreso-vertical-tiempo').datos;
    expect(serie.tipo).toBe('cartesiano');
    if (serie.tipo === 'cartesiano') {
      const todo = suma(serie.series.flatMap((s) => s.valores));
      expect(todo).toBeCloseTo(total, 1);
    }
    const dona = grafico(p, 'mix-ingresos').datos;
    if (dona.tipo === 'partes') expect(suma(dona.partes.map((x) => x.valor))).toBeCloseTo(total, 1);
  });

  it('el MRR del gráfico cierra en el MRR del KPI y las velas existen', () => {
    const p = construirResumenCon(CTX, COMPLETAS);
    const g = grafico(p, 'mrr-total');
    const mrr = kpi(p, 'mrr').valor as number;
    if (g.datos.tipo === 'cartesiano') {
      const valores = g.datos.series[0]!.valores;
      expect(valores[valores.length - 1]).toBe(mrr);
    }
    expect(g.velas?.velas.length).toBeGreaterThan(0);
  });

  it('la cascada suma: anterior + variaciones = actual, y el actual es el total', () => {
    const p = construirResumenCon(CTX, COMPLETAS);
    const g = grafico(p, 'cascada-ingreso');
    expect(g.datos.tipo).toBe('cascada');
    if (g.datos.tipo === 'cascada') {
      const [ini, ...resto] = g.datos.pasos;
      const fin = resto[resto.length - 1]!;
      const deltas = resto.slice(0, -1).map((x) => x.valor);
      expect(ini!.valor + suma(deltas)).toBeCloseTo(fin.valor, 2);
      expect(fin.valor).toBe(kpi(p, 'ingreso-total').valor);
    }
  });

  it('sin comparar no hay cascada, y lo dice', () => {
    const p = construirResumenCon({ ...CTX, comparar: 'ninguna' }, COMPLETAS);
    const g = grafico(p, 'cascada-ingreso');
    expect(g.datos.tipo === 'cascada' && g.datos.pasos.length).toBe(0);
    expect(g.sinDatoMotivo).toMatch(/comparar/i);
    expect(kpi(p, 'ingreso-total').variacionPct).toBeNull();
  });

  it('los 10 mayores no superan el total y su porcentaje sale de numerador ÷ denominador', () => {
    const p = construirResumenCon(CTX, COMPLETAS);
    const k = kpi(p, 'concentracion-top10');
    expect(k.numerador!).toBeLessThan(k.denominador!);
    expect(k.valor).toBe(redondear((k.numerador! / k.denominador!) * 100, 1));
    expect(k.subirEsMalo).toBe(true);
  });

  it('un filtro mueve los números de verdad', () => {
    const sin = construirResumenCon(CTX, COMPLETAS);
    const con = construirResumenCon({ ...CTX, filtros: [{ dimension: 'organizacion', valor: 'Clínica Mirador' }] }, COMPLETAS);
    expect(kpi(con, 'ingreso-total').valor).not.toBe(kpi(sin, 'ingreso-total').valor);
    expect(kpi(con, 'concentracion-top10').numerador).not.toBe(kpi(sin, 'concentracion-top10').numerador);
  });

  it('cambiar de moneda cambia el importe y la unidad, no mezcla BOB con USD', () => {
    const bob = kpi(construirResumenCon(CTX, COMPLETAS), 'ingreso-total');
    const usd = kpi(construirResumenCon({ ...CTX, moneda: 'USD' }, COMPLETAS), 'ingreso-total');
    expect(bob.unidad).toEqual({ tipo: 'moneda', moneda: 'BOB' });
    expect(usd.unidad).toEqual({ tipo: 'moneda', moneda: 'USD' });
    expect(usd.valor!).toBeLessThan(bob.valor!);
  });
});

describe('Resumen: una vertical sin dato no se esconde detrás de una suma parcial', () => {
  const sinPublicidad: FuentesResumen = { suscripciones: SUSC, publicidad: vacia('publicidad'), comisiones: COM };

  it('el total y lo que depende de él son null con motivo, no una suma de dos', () => {
    const p = construirResumenCon(CTX, sinPublicidad);
    for (const id of ['ingreso-total', 'ingreso-publicidad', 'mix-ingreso', 'concentracion-top10']) {
      const k = kpi(p, id);
      expect(k.valor, id).toBeNull();
      expect(k.motivoSinDato, id).toMatch(/Falta el ingreso de Publicidad/);
    }
    expect(p.avisos?.join(' ')).toMatch(/Publicidad/);
  });

  it('las verticales que sí tienen dato conservan su KPI', () => {
    const p = construirResumenCon(CTX, sinPublicidad);
    expect(kpi(p, 'ingreso-suscripciones').valor).not.toBeNull();
    expect(kpi(p, 'ingreso-comisiones').valor).not.toBeNull();
    expect(kpi(p, 'mrr').valor).not.toBeNull();
  });

  it('los gráficos del total quedan sin dato con motivo y sin ceros', () => {
    const p = construirResumenCon(CTX, sinPublicidad);
    const cascada = grafico(p, 'cascada-ingreso');
    expect(cascada.datos.tipo === 'cascada' && cascada.datos.pasos.length).toBe(0);
    const medidor = grafico(p, 'avance-meta').datos;
    expect(medidor.tipo === 'medidor' && medidor.valor).toBeNull();
    const top = grafico(p, 'top10-clientes');
    expect(top.sinDatoMotivo).toMatch(/Publicidad/);
    for (const g of p.graficos) expect(getContractViolations(g), g.id).toEqual([]);
  });

  it('con las tres vacías, el MRR, los clientes y las alertas dicen «sin dato» o «sin evaluar»', () => {
    const p = construirResumenCon(CTX, { suscripciones: vacia('suscripciones'), publicidad: vacia('publicidad'), comisiones: vacia('comisiones') });
    for (const id of ['ingreso-total', 'mrr', 'clientes-activos', 'take-rate', 'comision-pendiente']) {
      expect(kpi(p, id).valor, id).toBeNull();
    }
    const alertas = p.tablas.find((t) => t.id === 'alertas')!;
    expect(alertas.filas.every((f) => f['severidad'] === 'Sin evaluar')).toBe(true);
    expect(alertas.filas.every((f) => f['valor'] === null)).toBe(true);
  });

  it('un ingreso en otra moneda no se suma: el total es null y el motivo lo dice', () => {
    const enUsd: FuentesResumen = { suscripciones: SUSC, publicidad: vertical('publicidad', 95_000, () => [], 'USD'), comisiones: COM };
    const p = construirResumenCon({ ...CTX, moneda: 'BOB' }, enUsd);
    expect(kpi(p, 'ingreso-total').valor).toBeNull();
    expect(kpi(p, 'ingreso-total').motivoSinDato).toMatch(/no viene en BOB/);
  });
});

describe('Resumen: contra las verticales reales', () => {
  it('el total es la suma de las tres cuando existen; si alguna falta, es null con motivo', () => {
    for (const ctx of [CTX, { ...CTX, moneda: 'USD' as const }, { ...CTX, periodo: '12m' as const }]) {
      const p = construirResumen(ctx);
      const reales = [kpi(p, 'ingreso-suscripciones'), kpi(p, 'ingreso-publicidad'), kpi(p, 'ingreso-comisiones')];
      const total = kpi(p, 'ingreso-total');
      if (reales.every((k) => k.valor !== null)) {
        expect(total.valor).toBe(redondear(suma(reales.map((k) => k.valor))));
      } else {
        expect(total.valor).toBeNull();
        expect(total.motivoSinDato).toBeTruthy();
      }
    }
  });
});

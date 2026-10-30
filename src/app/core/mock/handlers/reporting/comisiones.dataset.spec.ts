import { getContractViolations } from '@core/data-access/reporting/reporting-contract';
import { formatearValor } from '../../../data-access/reporting/reporting-format';
import type {
  ChartSpec,
  ComparacionReporte,
  ContextoReporte,
  FiltroActivo,
  KpiSpec,
  Moneda,
  PeriodoReporte,
  PestanaReporte,
} from '../../../data-access/reporting/reporting.types';
import { AVISO_TASAS } from './comisiones.info';
import { construirComisiones } from './comisiones.dataset';
import { huecosDelContrato } from './reporting-dataset.util';

const PERIODOS: readonly PeriodoReporte[] = ['7d', '30d', '90d', 'ytd', '12m'];
const COMPARACIONES: readonly ComparacionReporte[] = ['ninguna', 'periodo-anterior', 'mismo-periodo-ano-anterior'];
const MONEDAS: readonly Moneda[] = ['BOB', 'USD'];
const ALCANCES = ['plataforma', 'organizacion'] as const;

function ctx(parcial: Partial<ContextoReporte> = {}): ContextoReporte {
  return { periodo: '30d', comparar: 'periodo-anterior', moneda: 'BOB', alcance: 'plataforma', filtros: [], ...parcial };
}

function todosLosContextos(): ContextoReporte[] {
  const out: ContextoReporte[] = [];
  for (const periodo of PERIODOS) {
    for (const comparar of COMPARACIONES) {
      for (const moneda of MONEDAS) {
        for (const alcance of ALCANCES) {
          out.push(ctx({ periodo, comparar, moneda, alcance }));
        }
      }
    }
  }
  return out;
}

const actor = (nombre: string): FiltroActivo => ({ dimension: 'actor', valor: nombre });
const kpi = (p: PestanaReporte, id: string): KpiSpec => {
  const k = p.kpis.find((x) => x.id === id);
  if (k === undefined) throw new Error(`falta el KPI ${id}`);
  return k;
};
const grafico = (p: PestanaReporte, id: string): ChartSpec => {
  const g = p.graficos.find((x) => x.id === id);
  if (g === undefined) throw new Error(`falta el gráfico ${id}`);
  return g;
};
const cents = (n: number | null | undefined): number => Math.round((n ?? Number.NaN) * 100);

function valores(g: ChartSpec, serie: number): (number | null)[] {
  if (g.datos.tipo !== 'cartesiano') throw new Error('se esperaba un gráfico cartesiano');
  return [...(g.datos.series[serie]?.valores ?? [])];
}

function categorias(g: ChartSpec): readonly string[] {
  if (g.datos.tipo !== 'cartesiano') throw new Error('se esperaba un gráfico cartesiano');
  return g.datos.categorias;
}

function numerosDe(valor: unknown, ruta: string, hallazgos: string[]): void {
  if (typeof valor === 'number' && !Number.isFinite(valor)) hallazgos.push(`${ruta} = ${valor}`);
  else if (Array.isArray(valor)) valor.forEach((v, i) => numerosDe(v, `${ruta}[${i}]`, hallazgos));
  else if (valor !== null && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) numerosDe(v, `${ruta}.${k}`, hallazgos);
  }
}

describe('comisiones.dataset', () => {
  describe('contrato', () => {
    it('cumple el contrato de gráfico en todas las combinaciones de periodo × comparar × moneda × alcance', () => {
      for (const c of todosLosContextos()) {
        const p = construirComisiones(c);
        for (const g of p.graficos) {
          expect(getContractViolations(g), `${g.id} ${JSON.stringify(c)}`).toEqual([]);
          expect(huecosDelContrato(g), `${g.id}`).toEqual([]);
        }
      }
    });

    it('cumple el contrato con el filtro de actor elegido (también el que no tiene esquema)', () => {
      for (const nombre of ['Visitador médico', 'Corredor de seguros', 'Referidor', 'Organización afiliada', 'Plataforma']) {
        for (const periodo of PERIODOS) {
          const p = construirComisiones(ctx({ periodo, filtros: [actor(nombre)] }));
          for (const g of p.graficos) {
            expect(getContractViolations(g), `${g.id} ${nombre} ${periodo}`).toEqual([]);
          }
        }
      }
    });

    it('trae ≥ 7 KPI, ≥ 8 gráficos y ≥ 5 formas distintas', () => {
      const p = construirComisiones(ctx());
      expect(p.pestana).toBe('comisiones');
      expect(p.origen).toBe('ejemplo');
      expect(p.kpis.length).toBeGreaterThanOrEqual(7);
      expect(p.graficos.length).toBeGreaterThanOrEqual(8);
      const formas = new Set(
        p.graficos.map((g) => {
          const d = g.datos;
          if (d.tipo === 'cartesiano') {
            return `${d.horizontal === true ? 'h' : 'v'}-${d.series.map((s) => s.forma + (s.apilar ?? '')).join('+')}`;
          }
          return d.tipo === 'partes' ? `partes-${d.forma}` : d.tipo;
        }),
      );
      const tipos = new Set(p.graficos.map((g) => (g.datos.tipo === 'partes' ? g.datos.forma : g.datos.tipo)));
      expect(tipos.size).toBeGreaterThanOrEqual(5);
      expect(formas.size).toBeGreaterThanOrEqual(5);
    });

    it('declara en los avisos que las tasas son de EJEMPLO', () => {
      const p = construirComisiones(ctx());
      expect(p.avisos).toContain(AVISO_TASAS);
      expect(AVISO_TASAS).toBe('Tasas de comisión de EJEMPLO; no son parámetros de negocio.');
      for (const g of p.graficos) {
        expect(g.info?.salvedades?.join(' ') ?? '', g.id).toContain('EJEMPLO');
      }
    });

    it('trae los ids canónicos, ids únicos y secciones que apuntan a ids reales', () => {
      for (const c of todosLosContextos()) {
        const p = construirComisiones(c);
        for (const id of ['ingreso-periodo', 'comision-devengada', 'comision-liquidada', 'comision-pendiente', 'take-rate']) {
          expect(p.kpis.some((k) => k.id === id), id).toBe(true);
        }
        const ids = [...p.kpis.map((k) => k.id), ...p.graficos.map((g) => g.id), ...p.tablas.map((t) => t.id)];
        expect(new Set(ids).size).toBe(ids.length);
        expect(p.secciones?.map((s) => s.titulo)).toEqual([
          'Resultado de la plataforma',
          'Por actor',
          'Pagos y antigüedad',
          'Conciliación',
        ]);
        const graficos = new Set(p.graficos.map((g) => g.id));
        const tablas = new Set(p.tablas.map((t) => t.id));
        const usados = p.secciones?.flatMap((s) => s.graficos ?? []) ?? [];
        for (const id of usados) expect(graficos.has(id), id).toBe(true);
        for (const id of p.secciones?.flatMap((s) => s.tablas ?? []) ?? []) expect(tablas.has(id), id).toBe(true);
        expect(new Set(usados)).toEqual(graficos);
      }
    });

    it('las velas existen sólo en series de saldo o razón, y el saldo por pagar sube = malo', () => {
      const p = construirComisiones(ctx());
      expect(grafico(p, 'take-rate-tiempo').velas?.velas.length).toBeGreaterThan(0);
      const saldo = grafico(p, 'saldo-por-pagar').velas;
      expect(saldo?.subirEsMalo).toBe(true);
      for (const v of [...(saldo?.velas ?? []), ...(grafico(p, 'take-rate-tiempo').velas?.velas ?? [])]) {
        expect(v.maximo).toBeGreaterThanOrEqual(Math.max(v.apertura, v.cierre));
        expect(v.minimo).toBeLessThanOrEqual(Math.min(v.apertura, v.cierre));
      }
      expect(grafico(p, 'comision-por-actor').velas).toBeNull();
    });

    it('los gráficos categóricos filtran por la dimensión esperada', () => {
      const p = construirComisiones(ctx());
      expect(grafico(p, 'comision-por-actor').filtro?.dimension).toBe('actor');
      expect(grafico(p, 'productividad-actor').filtro?.dimension).toBe('actor');
      expect(grafico(p, 'liquidado-actor-mes').filtro?.dimension).toBe('actor');
      expect(grafico(p, 'estado-payouts').filtro?.dimension).toBe('estado');
    });
  });

  describe('determinismo y filtros', () => {
    it('la misma consulta devuelve exactamente lo mismo', () => {
      for (const c of [ctx(), ctx({ periodo: '12m', moneda: 'USD', alcance: 'organizacion' }), ctx({ filtros: [actor('Referidor')] })]) {
        expect(construirComisiones(c)).toEqual(construirComisiones(c));
      }
    });

    it('el filtro de actor cambia los valores de verdad', () => {
      const base = construirComisiones(ctx());
      const filtrado = construirComisiones(ctx({ filtros: [actor('Referidor')] }));
      expect(kpi(filtrado, 'comision-devengada').valor).not.toBe(kpi(base, 'comision-devengada').valor);
      expect(kpi(filtrado, 'ingreso-periodo').valor).not.toBe(kpi(base, 'ingreso-periodo').valor);
      expect(kpi(filtrado, 'take-rate').valor).not.toBe(kpi(base, 'take-rate').valor);
      expect(grafico(filtrado, 'estado-payouts')).not.toEqual(grafico(base, 'estado-payouts'));
    });

    it('con un actor elegido, los KPI son los de ese actor y su gráfico por actor sigue completo', () => {
      const base = construirComisiones(ctx());
      const p = construirComisiones(ctx({ filtros: [actor('Corredor de seguros')] }));
      const g = grafico(p, 'comision-por-actor');
      expect(categorias(g)).toEqual(categorias(grafico(base, 'comision-por-actor')));
      const i = categorias(g).indexOf('Corredor de seguros');
      expect(cents(kpi(p, 'comision-liquidada').valor)).toBe(cents(valores(g, 0)[i]));
      expect(cents(kpi(p, 'comision-pendiente').valor)).toBe(cents(valores(g, 1)[i]));
    });

    it('otros filtros (estado, organización) también mueven los números', () => {
      const base = kpi(construirComisiones(ctx()), 'comision-devengada').valor;
      for (const f of [{ dimension: 'estado', valor: 'Fallidos' }, { dimension: 'organizacion', valor: 'Clínica Andina' }] as const) {
        const v = kpi(construirComisiones(ctx({ filtros: [f] })), 'comision-devengada').valor;
        expect(v).not.toBeNull();
        expect(v).not.toBe(base);
      }
    });

    it('el alcance de organización muestra menos que el de plataforma', () => {
      const plat = kpi(construirComisiones(ctx()), 'comision-devengada').valor!;
      const org = kpi(construirComisiones(ctx({ alcance: 'organizacion' })), 'comision-devengada').valor!;
      expect(org).toBeLessThan(plat);
    });
  });

  describe('valores sanos', () => {
    it('no deja NaN ni infinitos en ningún contexto', () => {
      for (const c of [...todosLosContextos(), ctx({ filtros: [actor('Visitador médico')] }), ctx({ filtros: [actor('Plataforma')] })]) {
        const hallazgos: string[] = [];
        numerosDe(construirComisiones(c), 'pestana', hallazgos);
        expect(hallazgos, JSON.stringify(c)).toEqual([]);
      }
    });

    it('null ≠ 0: el Visitador médico sin esquema sale sin dato, nunca como cero', () => {
      const p = construirComisiones(ctx());
      const g = grafico(p, 'comision-por-actor');
      const i = categorias(g).indexOf('Visitador médico');
      expect(valores(g, 0)[i]).toBeNull();
      expect(valores(g, 1)[i]).toBeNull();
      const fila = p.tablas.find((t) => t.id === 'ranking-actores')!.filas.find((f) => f['actor'] === 'Visitador médico')!;
      expect(fila['devengada']).toBeNull();
      expect(fila['liquidada']).toBeNull();
      expect(fila['pendiente']).toBeNull();
      expect(String(fila['esquema'])).toContain('Sin definir');
      const mapa = grafico(p, 'liquidado-actor-mes').datos;
      if (mapa.tipo !== 'mapa-calor') throw new Error('mapa de calor');
      const filaV = mapa.filas.indexOf('Visitador médico');
      expect(mapa.celdas.filter((c) => c[1] === filaV).every((c) => c[2] === null)).toBe(true);
    });

    it('elegir al actor sin esquema deja los KPI en null con el motivo de negocio, no en 0', () => {
      for (const periodo of PERIODOS) {
        const p = construirComisiones(ctx({ periodo, filtros: [actor('Visitador médico')] }));
        for (const id of ['ingreso-periodo', 'comision-devengada', 'comision-liquidada', 'comision-pendiente', 'take-rate']) {
          const k = kpi(p, id);
          expect(k.valor, id).toBeNull();
          expect(k.motivoSinDato, id).toContain('Esquema de comisión sin definir (decisión de negocio pendiente)');
          expect(k.variacionPct, id).toBeNull();
        }
        // La conciliación no depende del esquema de comisión: sigue con dato.
        expect(kpi(p, 'conciliado-pct').valor).not.toBeNull();
        expect(grafico(p, 'cascada-resultado').sinDatoMotivo).toBeTruthy();
      }
    });

    it('los KPI de dinero llevan la moneda del contexto y el importe formateado la muestra', () => {
      for (const moneda of MONEDAS) {
        const p = construirComisiones(ctx({ moneda }));
        for (const id of ['ingreso-periodo', 'comision-devengada', 'comision-liquidada', 'comision-pendiente', 'comision-retenida']) {
          const k = kpi(p, id);
          expect(k.unidad).toEqual({ tipo: 'moneda', moneda });
          expect(formatearValor(k.valor, k.unidad)).toMatch(moneda === 'BOB' ? /Bs|BOB/ : /US\$|USD/);
        }
      }
    });

    it('la comparación «ninguna» no inventa variación; con comparación, la calcula', () => {
      expect(construirComisiones(ctx({ comparar: 'ninguna' })).kpis.every((k) => k.variacionPct === null)).toBe(true);
      expect(kpi(construirComisiones(ctx()), 'comision-devengada').variacionPct).not.toBeNull();
    });

    it('take rate lleva numerador y denominador coherentes', () => {
      const k = kpi(construirComisiones(ctx()), 'take-rate');
      expect(k.numerador).toBeGreaterThan(0);
      expect(k.denominador).toBeGreaterThan(k.numerador!);
      expect(k.valor).toBeCloseTo((k.numerador! / k.denominador!) * 100, 1);
    });
  });

  describe('invariantes contables', () => {
    it('devengada = liquidada + pendiente, exacto, en todos los contextos', () => {
      for (const c of [...todosLosContextos(), ...['Corredor de seguros', 'Referidor', 'Organización afiliada', 'Plataforma'].map((n) => ctx({ filtros: [actor(n)] }))]) {
        const p = construirComisiones(c);
        const dev = cents(kpi(p, 'comision-devengada').valor);
        expect(dev, JSON.stringify(c)).toBe(cents(kpi(p, 'comision-liquidada').valor) + cents(kpi(p, 'comision-pendiente').valor));
      }
    });

    it('la suma por actor es el total, y lo retenido sale de lo pendiente', () => {
      for (const c of todosLosContextos()) {
        const p = construirComisiones(c);
        const g = grafico(p, 'comision-por-actor');
        const nombres = categorias(g);
        const liq = valores(g, 0);
        const pen = valores(g, 1);
        let sumaLiq = 0;
        let sumaPen = 0;
        nombres.forEach((n, i) => {
          if (n === 'Plataforma' || liq[i] === null) return; // la Plataforma retiene al cobrar; el Visitador no tiene esquema
          sumaLiq += cents(liq[i]);
          sumaPen += cents(pen[i]);
        });
        expect(sumaLiq, JSON.stringify(c)).toBe(cents(kpi(p, 'comision-liquidada').valor));
        expect(sumaPen, JSON.stringify(c)).toBe(cents(kpi(p, 'comision-pendiente').valor));
        expect(sumaLiq + sumaPen).toBe(cents(kpi(p, 'comision-devengada').valor));

        const ret = valores(grafico(p, 'retenciones-contracargos'), 0);
        let sumaRet = 0;
        nombres.forEach((n, i) => {
          if (n === 'Plataforma' || ret[i] === null) return;
          sumaRet += cents(ret[i]);
          expect(cents(ret[i])).toBeLessThanOrEqual(cents(pen[i]));
        });
        expect(sumaRet).toBe(cents(kpi(p, 'comision-retenida').valor));
        expect(sumaRet).toBeLessThanOrEqual(cents(kpi(p, 'comision-pendiente').valor));
      }
    });

    it('el aging suma exactamente lo pendiente', () => {
      for (const c of [...todosLosContextos(), ctx({ filtros: [actor('Referidor')] }), ctx({ filtros: [actor('Plataforma')] })]) {
        const p = construirComisiones(c);
        const suma = valores(grafico(p, 'aging-pendiente'), 0).reduce<number>((a, v) => a + cents(v), 0);
        expect(suma, JSON.stringify(c)).toBe(cents(kpi(p, 'comision-pendiente').valor));
      }
    });

    it('el mapa de calor suma, por actor, lo liquidado', () => {
      for (const c of todosLosContextos()) {
        const p = construirComisiones(c);
        const d = grafico(p, 'liquidado-actor-mes').datos;
        if (d.tipo !== 'mapa-calor') throw new Error('mapa de calor');
        const g = grafico(p, 'comision-por-actor');
        const liq = valores(g, 0);
        d.filas.forEach((fila, i) => {
          const celdas = d.celdas.filter((x) => x[1] === i);
          expect(celdas.length).toBe(d.columnas.length);
          if (liq[categorias(g).indexOf(fila)] === null) return;
          expect(celdas.reduce((a, x) => a + cents(x[2]), 0), `${fila} ${JSON.stringify(c)}`).toBe(cents(liq[categorias(g).indexOf(fila)]));
        });
      }
    });

    it('la cascada cierra: fees − gateway − comisiones = ingreso neto, que es el KPI', () => {
      for (const c of [...todosLosContextos(), ctx({ filtros: [actor('Corredor de seguros')] }), ctx({ filtros: [actor('Plataforma')] })]) {
        const p = construirComisiones(c);
        const d = grafico(p, 'cascada-resultado').datos;
        if (d.tipo !== 'cascada') throw new Error('cascada');
        const [fees, gateway, comisiones, neto] = d.pasos;
        expect(cents(fees!.valor) + cents(gateway!.valor) + cents(comisiones!.valor), JSON.stringify(c)).toBe(cents(neto!.valor));
        expect(cents(neto!.valor)).toBe(cents(kpi(p, 'ingreso-periodo').valor));
        expect(fees!.total).toBe(true);
        expect(neto!.total).toBe(true);
        expect(cents(-comisiones!.valor) === cents(kpi(p, 'comision-devengada').valor) || c.filtros.some((f) => f.valor === 'Plataforma')).toBe(true);
      }
    });

    it('los payouts: la dona suma los payouts y los fallidos de la tabla no superan lo pendiente', () => {
      for (const c of [...todosLosContextos(), ctx({ filtros: [actor('Organización afiliada')] })]) {
        const p = construirComisiones(c);
        const d = grafico(p, 'estado-payouts').datos;
        if (d.tipo !== 'partes') throw new Error('dona');
        const [emitidos, proceso, fallidos] = d.partes.map((x) => x.valor!);
        expect(Number.isInteger(emitidos! + proceso! + fallidos!)).toBe(true);
        const k = kpi(p, 'payouts-fallidos-pct');
        expect(k.numerador).toBe(fallidos);
        expect(k.denominador).toBe(emitidos! + proceso! + fallidos!);

        const tabla = p.tablas.find((t) => t.id === 'payouts-fallidos')!;
        expect(tabla.filas.length).toBe(Math.min(fallidos!, 10));
        for (const f of tabla.filas) {
          expect(f['motivo']).toBeTruthy();
          expect(f['monto']).not.toBeNull();
        }
      }
    });

    it('la conciliación cuadra: barras de descuadres suman el KPI y el porcentaje sale de num/den', () => {
      for (const c of todosLosContextos()) {
        const p = construirComisiones(c);
        const barras = valores(grafico(p, 'descuadres-por-tipo'), 0).reduce<number>((a, v) => a + (v ?? 0), 0);
        expect(barras).toBe(kpi(p, 'descuadres-abiertos').valor);
        const k = kpi(p, 'conciliado-pct');
        expect(k.valor).toBeCloseTo((k.numerador! / k.denominador!) * 100, 1);
        const m = grafico(p, 'conciliacion-pct').datos;
        if (m.tipo !== 'medidor') throw new Error('medidor');
        expect(m.valor).toBe(k.valor);
      }
    });

    it('el saldo por pagar termina exactamente en la comisión pendiente', () => {
      for (const c of todosLosContextos()) {
        const p = construirComisiones(c);
        const g = grafico(p, 'saldo-por-pagar');
        const ultimo = valores(g, 0).at(-1);
        expect(cents(ultimo), JSON.stringify(c)).toBe(cents(kpi(p, 'comision-pendiente').valor));
        expect(cents(g.velas?.velas.at(-1)?.cierre)).toBe(cents(kpi(p, 'comision-pendiente').valor));
      }
    });

    it('el ranking se ordena por devengada y deja al actor sin esquema al final', () => {
      const t = construirComisiones(ctx()).tablas.find((x) => x.id === 'ranking-actores')!;
      expect(t.filas.length).toBe(5);
      expect(t.filas.at(-1)?.['actor']).toBe('Visitador médico');
      expect(t.filas.map((f) => f['actor'])).toContain('Plataforma');
    });
  });
});

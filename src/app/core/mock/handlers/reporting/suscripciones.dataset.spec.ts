import type {
  ChartSpec,
  ComparacionReporte,
  ContextoReporte,
  KpiSpec,
  Moneda,
  PeriodoReporte,
  AlcanceReporte,
  PestanaReporte,
} from '@core/data-access/reporting/reporting.types';
import { getContractViolations } from '@core/data-access/reporting/reporting-contract';

import { BOB_PER_USD } from './reporting-dataset.util';
import { construirSuscripciones } from './suscripciones.dataset';

const PERIODOS: PeriodoReporte[] = ['7d', '30d', '90d', 'ytd', '12m'];
const COMPARACIONES: ComparacionReporte[] = ['ninguna', 'periodo-anterior', 'mismo-periodo-ano-anterior'];
const MONEDAS: Moneda[] = ['BOB', 'USD'];
const ALCANCES: AlcanceReporte[] = ['plataforma', 'organizacion'];

function contextos(): ContextoReporte[] {
  return PERIODOS.flatMap((periodo) =>
    COMPARACIONES.flatMap((comparar) =>
      MONEDAS.flatMap((moneda) => ALCANCES.map((alcance) => ({ periodo, comparar, moneda, alcance, filtros: [] }))),
    ),
  );
}

const BASE: ContextoReporte = { periodo: '30d', comparar: 'periodo-anterior', moneda: 'BOB', alcance: 'plataforma', filtros: [] };
const kpiById = (p: PestanaReporte, id: string): KpiSpec => p.kpis.find((k) => k.id === id)!;
const chartById = (p: PestanaReporte, id: string): ChartSpec => p.graficos.find((g) => g.id === id)!;
const sumaNum = (v: readonly (number | null)[]) => v.reduce<number>((a, x) => a + (x ?? 0), 0);

function numerosNoFinitos(valor: unknown, ruta = ''): string[] {
  if (typeof valor === 'number') return Number.isFinite(valor) ? [] : [ruta];
  if (Array.isArray(valor)) return valor.flatMap((v, i) => numerosNoFinitos(v, `${ruta}[${i}]`));
  if (valor !== null && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([k, v]) => numerosNoFinitos(v, `${ruta}.${k}`));
  }
  return [];
}

function forma(g: ChartSpec): string {
  const d = g.datos;
  if (d.tipo === 'partes') return d.forma;
  if (d.tipo === 'cartesiano') return d.horizontal === true ? 'barra-horizontal' : d.series.some((s) => s.forma === 'barra') ? 'barra' : 'linea';
  return d.tipo;
}

describe('dataset de suscripciones (ejemplo)', { timeout: 30_000 }, () => {
  it('cumple el contrato de calidad en todas las combinaciones de contexto', () => {
    const violaciones: string[] = [];
    for (const ctx of contextos()) {
      for (const g of construirSuscripciones(ctx).graficos) {
        for (const v of getContractViolations(g)) violaciones.push(`${g.id} con ${JSON.stringify(ctx)}: ${v}`);
      }
    }
    expect(violaciones).toEqual([]);
  });

  it('trae el mínimo pedido: KPI, gráficos de varias formas, velas, tabla, secciones y aviso de ejemplo', () => {
    const p = construirSuscripciones(BASE);
    expect(p.origen).toBe('ejemplo');
    expect(p.kpis.length).toBeGreaterThanOrEqual(7);
    expect(p.graficos.length).toBeGreaterThanOrEqual(8);
    expect(new Set(p.graficos.map(forma)).size).toBeGreaterThanOrEqual(5);
    expect(p.graficos.filter((g) => g.velas !== null).length).toBeGreaterThanOrEqual(3);
    expect(chartById(p, 'churn-cuentas-velas').velas?.subirEsMalo).toBe(true);
    expect(p.tablas.length).toBeGreaterThanOrEqual(1);
    expect(p.avisos?.join(' ')).toContain('EJEMPLO');
    for (const g of p.graficos) {
      expect(g.info?.salvedades?.join(' ') ?? g.infoMotivo, g.id).toContain('EJEMPLO');
    }
    const ids = new Set(p.graficos.map((g) => g.id));
    for (const s of p.secciones ?? []) {
      for (const id of s.graficos ?? []) expect(ids.has(id), `sección ${s.titulo}: ${id}`).toBe(true);
      for (const id of s.tablas ?? []) expect(p.tablas.some((t) => t.id === id), id).toBe(true);
    }
  });

  it('los ids son únicos y están los KPI canónicos', () => {
    for (const ctx of contextos()) {
      const p = construirSuscripciones(ctx);
      for (const lista of [p.kpis.map((k) => k.id), p.graficos.map((g) => g.id), p.tablas.map((t) => t.id)]) {
        expect(new Set(lista).size).toBe(lista.length);
      }
      for (const id of ['mrr', 'arr', 'suscriptores-activos', 'churn-cuentas', 'arpu', 'ingreso-periodo']) {
        expect(p.kpis.some((k) => k.id === id), id).toBe(true);
      }
      const churn = kpiById(p, 'churn-cuentas');
      expect(churn.subirEsMalo).toBe(true);
      expect(churn.unidad.tipo).toBe('porcentaje');
      expect(churn.numerador).toBeDefined();
      expect(churn.denominador).toBeDefined();
    }
  });

  it('las mismas entradas dan exactamente el mismo resultado', () => {
    for (const ctx of contextos()) {
      expect(JSON.stringify(construirSuscripciones(ctx))).toBe(JSON.stringify(construirSuscripciones({ ...ctx })));
    }
  });

  it('un filtro de plan cambia los valores de verdad', () => {
    const unfiltered = construirSuscripciones(BASE);
    const filtered = construirSuscripciones({ ...BASE, filtros: [{ dimension: 'plan', valor: 'Profesional' }] });
    expect(kpiById(filtered, 'mrr').valor).not.toBe(kpiById(unfiltered, 'mrr').valor);
    expect(kpiById(filtered, 'suscriptores-activos').valor).not.toBe(kpiById(unfiltered, 'suscriptores-activos').valor);
    expect(JSON.stringify(chartById(filtered, 'mrr-evolucion').datos)).not.toBe(JSON.stringify(chartById(unfiltered, 'mrr-evolucion').datos));
    expect(JSON.stringify(chartById(filtered, 'cuentas-ciudad').datos)).not.toBe(JSON.stringify(chartById(unfiltered, 'cuentas-ciudad').datos));
    // Los cortes por plan siguen mostrando los tres planes, para poder compararlos.
    const mix = chartById(filtered, 'mix-plan').datos;
    expect(mix.tipo === 'partes' && mix.partes.length).toBe(3);
    expect(filtered.tablas.find((t) => t.id === 'candidatas-subir-plan')!.filas.every((f) => f['plan'] === 'Profesional')).toBe(true);
  });

  it('cada filtro por clic mueve algún número', () => {
    const unfiltered = construirSuscripciones(BASE);
    const casos: [string, string][] = [['plan', 'Clínica'], ['especialidad', 'Pediatría'], ['ciudad', 'La Paz']];
    for (const [dimension, valor] of casos) {
      const filtered = construirSuscripciones({ ...BASE, filtros: [{ dimension: dimension as 'plan', valor }] });
      expect(kpiById(filtered, 'mrr').valor, dimension).not.toBe(kpiById(unfiltered, 'mrr').valor);
    }
    for (const g of unfiltered.graficos.filter((x) => x.filtro !== null)) {
      expect(['plan', 'especialidad', 'ciudad']).toContain(g.filtro!.dimension);
    }
  });

  it('el dólar es el boliviano dividido entre el tipo de cambio de ejemplo', () => {
    for (const periodo of PERIODOS) {
      const bob = construirSuscripciones({ ...BASE, periodo });
      const usd = construirSuscripciones({ ...BASE, periodo, moneda: 'USD' });
      for (const id of ['mrr', 'arr', 'arpu', 'ingreso-periodo', 'saldo-mora']) {
        const b = kpiById(bob, id).valor!;
        // Cada tramo se redondea a centavos en su moneda: el error admitido es de centavos, no de porcentaje.
        const esperado = b / BOB_PER_USD;
        expect(Math.abs(kpiById(usd, id).valor! - esperado), `${id} ${periodo}`).toBeLessThan(Math.max(0.25, esperado * 0.0005));
      }
      expect(kpiById(usd, 'suscriptores-activos').valor).toBe(kpiById(bob, 'suscriptores-activos').valor);
      const mrrB = chartById(bob, 'mrr-evolucion').datos;
      const mrrU = chartById(usd, 'mrr-evolucion').datos;
      if (mrrB.tipo === 'cartesiano' && mrrU.tipo === 'cartesiano') {
        mrrB.series[0]!.valores.forEach((v, i) => {
          expect(Math.abs(mrrU.series[0]!.valores[i]! - v! / BOB_PER_USD)).toBeLessThan(0.01);
        });
      }
    }
  });

  it('no hay NaN ni Infinity en ningún contexto', () => {
    for (const ctx of contextos()) {
      expect(numerosNoFinitos(construirSuscripciones(ctx)), JSON.stringify(ctx)).toEqual([]);
    }
  });

  it('null no se convierte en 0: sin dato siempre trae motivo y no cambia con la moneda', () => {
    const contextsWithFilter = [
      ...contextos(),
      ...PERIODOS.map((periodo): ContextoReporte => ({ ...BASE, periodo, alcance: 'organizacion', filtros: [{ dimension: 'especialidad', valor: 'Cardiología' }] })),
    ];
    for (const ctx of contextsWithFilter) {
      const p = construirSuscripciones(ctx);
      for (const k of p.kpis) {
        if (k.valor === null) {
          expect(k.motivoSinDato?.trim(), `${k.id} sin motivo`).toBeTruthy();
          expect(k.variacionPct).toBeNull();
        } else {
          expect(k.motivoSinDato, `${k.id} tiene valor y motivo`).toBeUndefined();
        }
        if (ctx.comparar === 'ninguna') expect(k.variacionPct).toBeNull();
      }
      const otra = construirSuscripciones({ ...ctx, moneda: ctx.moneda === 'BOB' ? 'USD' : 'BOB' });
      p.kpis.forEach((k, i) => expect(k.valor === null).toBe(otra.kpis[i]!.valor === null));
    }
  });

  it('hay un caso honesto de «Sin dato»: conversión con muestra menor a 10', () => {
    const p = construirSuscripciones({ ...BASE, periodo: '7d', alcance: 'organizacion' });
    const conversion = kpiById(p, 'conversion-prueba-pago');
    expect(conversion.valor).toBeNull();
    expect(conversion.motivoSinDato).toContain('10');
    expect(kpiById(construirSuscripciones(BASE), 'conversion-prueba-pago').valor).not.toBeNull();
  });

  it('los meses futuros de cada cohorte son null, no 0', () => {
    for (const ctx of contextos()) {
      const d = chartById(construirSuscripciones(ctx), 'retencion-cohortes').datos;
      if (d.tipo !== 'mapa-calor') throw new Error('la retención debe ser un mapa de calor');
      expect(d.celdas.length).toBe(d.filas.length * d.columnas.length);
      for (const [col, fila, valor] of d.celdas) {
        const edad = d.filas.length - 1 - fila;
        if (col > edad) expect(valor, `${d.filas[fila]} mes ${col}`).toBeNull();
        else if (valor !== null) {
          expect(valor).toBeGreaterThan(0);
          expect(valor).toBeLessThanOrEqual(100);
        }
      }
    }
    // Sin filtros y a escala de plataforma sí hay datos reales en la diagonal observada.
    const real = chartById(construirSuscripciones(BASE), 'retencion-cohortes').datos;
    expect(real.tipo === 'mapa-calor' && real.celdas.some((c) => c[2] === 100)).toBe(true);
  });

  it('el ingreso del periodo es la suma de la serie de ingresos por plan', () => {
    for (const ctx of [...contextos(), { ...BASE, filtros: [{ dimension: 'ciudad' as const, valor: 'Sucre' }] }]) {
      const p = construirSuscripciones(ctx);
      const d = chartById(p, 'ingreso-plan').datos;
      if (d.tipo !== 'cartesiano') throw new Error('el ingreso debe ser cartesiano');
      const total = d.series.reduce((a, s) => a + sumaNum(s.valores), 0);
      expect(Math.abs(total - kpiById(p, 'ingreso-periodo').valor!), JSON.stringify(ctx)).toBeLessThan(0.01);
    }
  });

  it('la cascada del MRR cierra: inicial + nuevas + expansión − contracción − bajas = final', () => {
    for (const ctx of contextos()) {
      const d = chartById(construirSuscripciones(ctx), 'cascada-mrr').datos;
      if (d.tipo !== 'cascada') throw new Error('debe ser cascada');
      const [ini, ...resto] = d.pasos;
      const final = resto.pop()!;
      expect(ini!.total && final.total).toBe(true);
      expect(Math.abs(ini!.valor + sumaNum(resto.map((r) => r.valor)) - final.valor), JSON.stringify(ctx)).toBeLessThan(0.05);
      expect(resto.find((r) => r.nombre === 'Cuentas nuevas')!.valor).toBeGreaterThanOrEqual(0);
    }
  });

  it('altas, bajas y churn son coherentes entre tarjetas y gráficos', () => {
    for (const ctx of contextos()) {
      const p = construirSuscripciones(ctx);
      const d = chartById(p, 'movimiento-cuentas').datos;
      if (d.tipo !== 'cartesiano') throw new Error('debe ser cartesiano');
      const altas = sumaNum(d.series[0]!.valores);
      const bajas = -sumaNum(d.series[1]!.valores);
      expect(altas - bajas).toBe(kpiById(p, 'altas-netas').valor);
      expect(bajas).toBe(kpiById(p, 'churn-cuentas').numerador);
      const mrrChart = chartById(p, 'mrr-evolucion').datos;
      if (mrrChart.tipo === 'cartesiano') {
        expect(mrrChart.series[0]!.valores.at(-1)).toBeCloseTo(kpiById(p, 'mrr').valor!, 2);
      }
    }
  });

  it('un periodo corto da menos puntos que uno largo', () => {
    const largo = chartById(construirSuscripciones({ ...BASE, periodo: '90d' }), 'mrr-evolucion');
    const corto = chartById(construirSuscripciones({ ...BASE, periodo: '7d' }), 'mrr-evolucion');
    expect(corto.datos.tipo === 'cartesiano' && largo.datos.tipo === 'cartesiano' && corto.datos.categorias.length < largo.datos.categorias.length).toBe(true);
    expect(corto.velas!.velas.length).toBeLessThan(largo.velas!.velas.length);
  });

  it('con alcance de organización los números son menores que los de la plataforma', () => {
    const plataforma = construirSuscripciones(BASE);
    const orgScoped = construirSuscripciones({ ...BASE, alcance: 'organizacion' });
    expect(kpiById(orgScoped, 'mrr').valor!).toBeLessThan(kpiById(plataforma, 'mrr').valor!);
  });
});

describe('la tabla «Resumen por plan» cuadra con las tarjetas de la misma pestaña', () => {
  for (const ctx of contextos().slice(0, 12)) {
    it(`${ctx.periodo} · ${ctx.comparar} · ${ctx.moneda} · ${ctx.alcance}: el total de MRR es EXACTAMENTE el de la tarjeta MRR y las filas lo suman`, () => {
      const pestana = construirSuscripciones(ctx);
      const tarjeta = pestana.kpis.find((k) => k.id === 'mrr')?.valor;
      const tabla = pestana.tablas.find((t) => t.id === 'resumen-planes');
      const total = tabla?.filas.find((f) => f['plan'] === 'Total')?.['mrr'];
      expect(typeof tarjeta).toBe('number');
      expect(typeof total).toBe('number');
      expect(total).toBe(tarjeta);
      const filas = (tabla?.filas ?? []).filter((f) => f['plan'] !== 'Total');
      expect(Math.round(sumaNum(filas.map((f) => f['mrr'] as number)) * 100)).toBe(Math.round((total as number) * 100));
    });
  }
});

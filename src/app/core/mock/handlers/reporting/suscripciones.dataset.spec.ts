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
import { violacionesDelContrato } from '@shared/components/organisms/chart-panel/chart-contract';

import { BOB_POR_USD } from './reporting-dataset.util';
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
const kpiDe = (p: PestanaReporte, id: string): KpiSpec => p.kpis.find((k) => k.id === id)!;
const graficoDe = (p: PestanaReporte, id: string): ChartSpec => p.graficos.find((g) => g.id === id)!;
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
        for (const v of violacionesDelContrato(g)) violaciones.push(`${g.id} con ${JSON.stringify(ctx)}: ${v}`);
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
    expect(graficoDe(p, 'churn-cuentas-velas').velas?.subirEsMalo).toBe(true);
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
      const churn = kpiDe(p, 'churn-cuentas');
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
    const sin = construirSuscripciones(BASE);
    const con = construirSuscripciones({ ...BASE, filtros: [{ dimension: 'plan', valor: 'Profesional' }] });
    expect(kpiDe(con, 'mrr').valor).not.toBe(kpiDe(sin, 'mrr').valor);
    expect(kpiDe(con, 'suscriptores-activos').valor).not.toBe(kpiDe(sin, 'suscriptores-activos').valor);
    expect(JSON.stringify(graficoDe(con, 'mrr-evolucion').datos)).not.toBe(JSON.stringify(graficoDe(sin, 'mrr-evolucion').datos));
    expect(JSON.stringify(graficoDe(con, 'cuentas-ciudad').datos)).not.toBe(JSON.stringify(graficoDe(sin, 'cuentas-ciudad').datos));
    // Los cortes por plan siguen mostrando los tres planes, para poder compararlos.
    const mix = graficoDe(con, 'mix-plan').datos;
    expect(mix.tipo === 'partes' && mix.partes.length).toBe(3);
    expect(con.tablas.find((t) => t.id === 'candidatas-subir-plan')!.filas.every((f) => f['plan'] === 'Profesional')).toBe(true);
  });

  it('cada filtro por clic mueve algún número', () => {
    const sin = construirSuscripciones(BASE);
    const casos: [string, string][] = [['plan', 'Clínica'], ['especialidad', 'Pediatría'], ['ciudad', 'La Paz']];
    for (const [dimension, valor] of casos) {
      const con = construirSuscripciones({ ...BASE, filtros: [{ dimension: dimension as 'plan', valor }] });
      expect(kpiDe(con, 'mrr').valor, dimension).not.toBe(kpiDe(sin, 'mrr').valor);
    }
    for (const g of sin.graficos.filter((x) => x.filtro !== null)) {
      expect(['plan', 'especialidad', 'ciudad']).toContain(g.filtro!.dimension);
    }
  });

  it('el dólar es el boliviano dividido entre el tipo de cambio de ejemplo', () => {
    for (const periodo of PERIODOS) {
      const bob = construirSuscripciones({ ...BASE, periodo });
      const usd = construirSuscripciones({ ...BASE, periodo, moneda: 'USD' });
      for (const id of ['mrr', 'arr', 'arpu', 'ingreso-periodo', 'saldo-mora']) {
        const b = kpiDe(bob, id).valor!;
        // Cada tramo se redondea a centavos en su moneda: el error admitido es de centavos, no de porcentaje.
        const esperado = b / BOB_POR_USD;
        expect(Math.abs(kpiDe(usd, id).valor! - esperado), `${id} ${periodo}`).toBeLessThan(Math.max(0.25, esperado * 0.0005));
      }
      expect(kpiDe(usd, 'suscriptores-activos').valor).toBe(kpiDe(bob, 'suscriptores-activos').valor);
      const mrrB = graficoDe(bob, 'mrr-evolucion').datos;
      const mrrU = graficoDe(usd, 'mrr-evolucion').datos;
      if (mrrB.tipo === 'cartesiano' && mrrU.tipo === 'cartesiano') {
        mrrB.series[0]!.valores.forEach((v, i) => {
          expect(Math.abs(mrrU.series[0]!.valores[i]! - v! / BOB_POR_USD)).toBeLessThan(0.01);
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
    const contextosConFiltro = [
      ...contextos(),
      ...PERIODOS.map((periodo): ContextoReporte => ({ ...BASE, periodo, alcance: 'organizacion', filtros: [{ dimension: 'especialidad', valor: 'Cardiología' }] })),
    ];
    for (const ctx of contextosConFiltro) {
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
    const conversion = kpiDe(p, 'conversion-prueba-pago');
    expect(conversion.valor).toBeNull();
    expect(conversion.motivoSinDato).toContain('10');
    expect(kpiDe(construirSuscripciones(BASE), 'conversion-prueba-pago').valor).not.toBeNull();
  });

  it('los meses futuros de cada cohorte son null, no 0', () => {
    for (const ctx of contextos()) {
      const d = graficoDe(construirSuscripciones(ctx), 'retencion-cohortes').datos;
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
    const real = graficoDe(construirSuscripciones(BASE), 'retencion-cohortes').datos;
    expect(real.tipo === 'mapa-calor' && real.celdas.some((c) => c[2] === 100)).toBe(true);
  });

  it('el ingreso del periodo es la suma de la serie de ingresos por plan', () => {
    for (const ctx of [...contextos(), { ...BASE, filtros: [{ dimension: 'ciudad' as const, valor: 'Sucre' }] }]) {
      const p = construirSuscripciones(ctx);
      const d = graficoDe(p, 'ingreso-plan').datos;
      if (d.tipo !== 'cartesiano') throw new Error('el ingreso debe ser cartesiano');
      const total = d.series.reduce((a, s) => a + sumaNum(s.valores), 0);
      expect(Math.abs(total - kpiDe(p, 'ingreso-periodo').valor!), JSON.stringify(ctx)).toBeLessThan(0.01);
    }
  });

  it('la cascada del MRR cierra: inicial + nuevas + expansión − contracción − bajas = final', () => {
    for (const ctx of contextos()) {
      const d = graficoDe(construirSuscripciones(ctx), 'cascada-mrr').datos;
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
      const d = graficoDe(p, 'movimiento-cuentas').datos;
      if (d.tipo !== 'cartesiano') throw new Error('debe ser cartesiano');
      const altas = sumaNum(d.series[0]!.valores);
      const bajas = -sumaNum(d.series[1]!.valores);
      expect(altas - bajas).toBe(kpiDe(p, 'altas-netas').valor);
      expect(bajas).toBe(kpiDe(p, 'churn-cuentas').numerador);
      const mrrChart = graficoDe(p, 'mrr-evolucion').datos;
      if (mrrChart.tipo === 'cartesiano') {
        expect(mrrChart.series[0]!.valores.at(-1)).toBeCloseTo(kpiDe(p, 'mrr').valor!, 2);
      }
    }
  });

  it('un periodo corto da menos puntos que uno largo', () => {
    const largo = graficoDe(construirSuscripciones({ ...BASE, periodo: '90d' }), 'mrr-evolucion');
    const corto = graficoDe(construirSuscripciones({ ...BASE, periodo: '7d' }), 'mrr-evolucion');
    expect(corto.datos.tipo === 'cartesiano' && largo.datos.tipo === 'cartesiano' && corto.datos.categorias.length < largo.datos.categorias.length).toBe(true);
    expect(corto.velas!.velas.length).toBeLessThan(largo.velas!.velas.length);
  });

  it('con alcance de organización los números son menores que los de la plataforma', () => {
    const plataforma = construirSuscripciones(BASE);
    const organizacion = construirSuscripciones({ ...BASE, alcance: 'organizacion' });
    expect(kpiDe(organizacion, 'mrr').valor!).toBeLessThan(kpiDe(plataforma, 'mrr').valor!);
  });
});

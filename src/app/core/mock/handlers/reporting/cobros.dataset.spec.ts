import type {
  AlcanceReporte,
  ComparacionReporte,
  ContextoReporte,
  DatosGrafico,
  FiltroActivo,
  KpiSpec,
  Moneda,
  PeriodoReporte,
} from '../../../data-access/reporting/reporting.types';
import { getContractViolations } from '@core/data-access/reporting/reporting-contract';
import { construirCobros } from './cobros.dataset';
import { BOB_PER_USD } from './reporting-dataset.util';

const PERIODOS: PeriodoReporte[] = ['7d', '30d', '90d', 'ytd', '12m'];
const COMPARACIONES: ComparacionReporte[] = ['ninguna', 'periodo-anterior', 'mismo-periodo-ano-anterior'];
const MONEDAS: Moneda[] = ['BOB', 'USD'];
const ALCANCES: AlcanceReporte[] = ['plataforma', 'organizacion'];

function ctx(parcial: Partial<ContextoReporte> = {}): ContextoReporte {
  return { periodo: '30d', comparar: 'periodo-anterior', moneda: 'BOB', alcance: 'plataforma', filtros: [], ...parcial };
}

function todasLasCombinaciones(): ContextoReporte[] {
  const lista: ContextoReporte[] = [];
  for (const periodo of PERIODOS)
    for (const comparar of COMPARACIONES)
      for (const moneda of MONEDAS)
        for (const alcance of ALCANCES) lista.push(ctx({ periodo, comparar, moneda, alcance }));
  return lista;
}

const kpi = (c: ContextoReporte, id: string): KpiSpec => {
  const k = construirCobros(c).kpis.find((x) => x.id === id);
  if (k === undefined) throw new Error(`falta el KPI ${id}`);
  return k;
};

function numerosDe(datos: DatosGrafico): (number | null)[] {
  switch (datos.tipo) {
    case 'cartesiano': return datos.series.flatMap((s) => [...s.valores]);
    case 'partes': return datos.partes.map((p) => p.valor);
    case 'mapa-calor': return datos.celdas.map((c) => c[2]);
    case 'medidor': return [datos.valor];
    case 'cascada': return datos.pasos.map((p) => p.valor);
  }
}

describe('pestaña Cobros y caja (datos de ejemplo)', () => {
  it('cumple el contrato de gráfico en todas las combinaciones de contexto', () => {
    for (const c of todasLasCombinaciones()) {
      for (const g of construirCobros(c).graficos) {
        expect(getContractViolations(g), `${g.id} con ${JSON.stringify(c)}`).toEqual([]);
      }
    }
  });

  it('declara la forma mínima: ≥7 KPI, ≥8 gráficos de ≥5 formas, 2 tablas y 4 secciones', () => {
    const p = construirCobros(ctx());
    expect(p.kpis.length).toBeGreaterThanOrEqual(7);
    expect(p.graficos.length).toBeGreaterThanOrEqual(8);
    const formas = new Set(
      p.graficos.map((g) =>
        g.datos.tipo === 'cartesiano'
          ? `${g.datos.horizontal === true ? 'h-' : ''}${g.datos.series.some((s) => s.apilar) ? 'apilada' : g.datos.series[0]!.forma}`
          : g.datos.tipo === 'partes' ? g.datos.forma : g.datos.tipo,
      ),
    );
    expect(formas.size).toBeGreaterThanOrEqual(5);
    expect(p.tablas.map((t) => t.id)).toEqual(['transacciones-atipicas', 'excepciones-conciliacion']);
    expect(p.secciones?.map((s) => s.titulo)).toEqual([
      'Cobros', 'Calidad del cobro', 'Liquidación y costo', 'Facturación y conciliación',
    ]);
    expect(p.avisos?.[0]).toContain('EJEMPLO');
    expect(p.origen).toBe('ejemplo');
  });

  it('las secciones solo nombran gráficos y tablas que existen', () => {
    const p = construirCobros(ctx());
    for (const s of p.secciones ?? []) {
      for (const id of s.graficos ?? []) expect(p.graficos.map((g) => g.id)).toContain(id);
      for (const id of s.tablas ?? []) expect(p.tablas.map((t) => t.id)).toContain(id);
    }
    const enSecciones = (p.secciones ?? []).flatMap((s) => s.graficos ?? []);
    expect(new Set(enSecciones).size).toBe(p.graficos.length);
  });

  it('los ids de KPI, gráficos y tablas son únicos y los KPI canónicos existen', () => {
    for (const c of todasLasCombinaciones()) {
      const p = construirCobros(c);
      for (const lista of [p.kpis.map((k) => k.id), p.graficos.map((g) => g.id), p.tablas.map((t) => t.id)]) {
        expect(new Set(lista).size).toBe(lista.length);
      }
      for (const id of ['tasa-exito-pago', 'volumen-cobrado', 'reembolsos-pct', 'rezago-liquidacion-dias', 'costo-gateway-pct']) {
        expect(p.kpis.map((k) => k.id)).toContain(id);
      }
    }
  });

  it('es determinista: la misma consulta da los mismos números', () => {
    const c = ctx({ periodo: '90d', filtros: [{ dimension: 'metodo-pago', valor: 'QR' }] });
    expect(JSON.stringify(construirCobros(c))).toBe(JSON.stringify(construirCobros(c)));
  });

  it('no produce NaN ni infinitos en KPI, gráficos ni velas', () => {
    for (const c of todasLasCombinaciones()) {
      const p = construirCobros(c);
      const numeros = [
        ...p.kpis.flatMap((k) => [k.valor, k.variacionPct, k.numerador ?? null, k.denominador ?? null, ...(k.tendencia ?? [])]),
        ...p.graficos.flatMap((g) => [
          ...numerosDe(g.datos),
          ...(g.velas?.velas.flatMap((v) => [v.apertura, v.cierre, v.minimo, v.maximo]) ?? []),
        ]),
      ];
      for (const n of numeros) {
        if (n !== null) expect(Number.isFinite(n)).toBe(true);
      }
    }
  });

  it('el filtro por método de pago cambia los valores de verdad', () => {
    const sin = construirCobros(ctx());
    for (const valor of ['Tarjeta', 'QR', 'Transferencia', 'Efectivo en caja']) {
      const con = construirCobros(ctx({ filtros: [{ dimension: 'metodo-pago', valor }] }));
      expect(kpi(ctx({ filtros: [{ dimension: 'metodo-pago', valor }] }), 'volumen-cobrado').valor).not.toBe(
        sin.kpis.find((k) => k.id === 'volumen-cobrado')!.valor,
      );
      expect(con.kpis.find((k) => k.id === 'tasa-exito-pago')!.valor).not.toBe(
        sin.kpis.find((k) => k.id === 'tasa-exito-pago')!.valor,
      );
    }
    // El costo del gateway de un método es el de ese método: efectivo no paga comisión.
    expect(kpi(ctx({ filtros: [{ dimension: 'metodo-pago', valor: 'Efectivo en caja' }] }), 'costo-gateway-pct').valor).toBe(0);
    const tarjeta = kpi(ctx({ filtros: [{ dimension: 'metodo-pago', valor: 'Tarjeta' }] }), 'costo-gateway-pct').valor!;
    const qr = kpi(ctx({ filtros: [{ dimension: 'metodo-pago', valor: 'QR' }] }), 'costo-gateway-pct').valor!;
    expect(tarjeta).toBeGreaterThan(qr);
  });

  it('los demás filtros y el alcance cambian los volúmenes', () => {
    const base = kpi(ctx(), 'volumen-cobrado').valor!;
    const filtros: FiltroActivo[] = [{ dimension: 'estado', valor: 'Emitida' }];
    expect(kpi(ctx({ filtros }), 'volumen-cobrado').valor).not.toBe(base);
    expect(kpi(ctx({ alcance: 'organizacion' }), 'volumen-cobrado').valor!).toBeLessThan(base);
  });

  it('la moneda convierte importes pero no las razones', () => {
    const bob = kpi(ctx(), 'volumen-cobrado').valor!;
    const usd = kpi(ctx({ moneda: 'USD' }), 'volumen-cobrado');
    expect(usd.unidad).toEqual({ tipo: 'moneda', moneda: 'USD' });
    expect(usd.valor!).toBeCloseTo(bob / BOB_PER_USD, 0);
    expect(kpi(ctx({ moneda: 'USD' }), 'tasa-exito-pago').valor).toBe(kpi(ctx(), 'tasa-exito-pago').valor);
    expect(kpi(ctx({ moneda: 'USD' }), 'costo-gateway-pct').valor).toBeCloseTo(kpi(ctx(), 'costo-gateway-pct').valor!, 1);
  });

  it('sin comparación no hay variación; con comparación sí', () => {
    for (const c of todasLasCombinaciones()) {
      const sinComparar = c.comparar === 'ninguna';
      for (const k of construirCobros(c).kpis) {
        if (sinComparar) expect(k.variacionPct, k.id).toBeNull();
      }
    }
    expect(kpi(ctx(), 'volumen-cobrado').variacionPct).not.toBeNull();
    expect(kpi(ctx(), 'tasa-exito-pago').variacionPct).not.toBeNull();
  });

  it('cada tasa es su numerador entre su denominador', () => {
    for (const c of todasLasCombinaciones()) {
      for (const k of construirCobros(c).kpis) {
        if (k.unidad.tipo !== 'porcentaje') continue;
        if (k.valor === null) {
          expect(k.motivoSinDato, k.id).toBeTruthy();
          continue;
        }
        expect(k.numerador, k.id).toBeDefined();
        expect(k.denominador, k.id).toBeGreaterThan(0);
        expect(k.valor, `${k.id} ${JSON.stringify(c)}`).toBeCloseTo((k.numerador! / k.denominador!) * 100, 1);
      }
    }
  });

  it('el embudo no sube nunca de una etapa a la siguiente', () => {
    for (const c of todasLasCombinaciones()) {
      const g = construirCobros(c).graficos.find((x) => x.id === 'embudo-pago')!;
      expect(g.datos.tipo).toBe('partes');
      if (g.datos.tipo !== 'partes') continue;
      const v = g.datos.partes.map((p) => p.valor!);
      expect(g.datos.partes.map((p) => p.nombre)).toEqual(['Intentos de pago', 'Autorizados', 'Capturados', 'Liquidados']);
      for (let i = 1; i < v.length; i++) expect(v[i]!, JSON.stringify(c)).toBeLessThanOrEqual(v[i - 1]!);
      // La tasa de éxito del KPI sale de las mismas cifras del embudo.
      const k = kpi(c, 'tasa-exito-pago');
      expect(k.numerador).toBe(v[2]);
      expect(k.denominador).toBe(v[0]);
    }
  });

  it('el histograma de rezago suma lo liquidado y el KPI es su promedio', () => {
    const p = construirCobros(ctx({ periodo: '90d' }));
    const embudo = p.graficos.find((g) => g.id === 'embudo-pago')!;
    const hist = p.graficos.find((g) => g.id === 'rezago-liquidacion')!;
    if (embudo.datos.tipo !== 'partes' || hist.datos.tipo !== 'cartesiano') throw new Error('forma inesperada');
    const barras = hist.datos.series[0]!.valores as number[];
    expect(hist.datos.categorias).toHaveLength(5);
    expect(barras.reduce((a, b) => a + b, 0)).toBe(embudo.datos.partes[3]!.valor);
    const dias = [0, 1, 2, 4, 7];
    const promedio = barras.reduce((a, v, i) => a + v * dias[i]!, 0) / barras.reduce((a, b) => a + b, 0);
    expect(kpi(ctx({ periodo: '90d' }), 'rezago-liquidacion-dias').valor).toBeCloseTo(promedio, 1);
  });

  it('las velas solo van en razones y suben mal cuando subir es malo', () => {
    const p = construirCobros(ctx());
    const conVelas = p.graficos.filter((g) => g.velas !== null).map((g) => g.id).sort();
    expect(conVelas).toEqual(['costo-gateway', 'reembolsos-disputas', 'tasa-exito-pago']);
    expect(p.graficos.find((g) => g.id === 'tasa-exito-pago')!.velas!.subirEsMalo).toBeUndefined();
    expect(p.graficos.find((g) => g.id === 'costo-gateway')!.velas!.subirEsMalo).toBe(true);
    expect(p.graficos.find((g) => g.id === 'reembolsos-disputas')!.velas!.subirEsMalo).toBe(true);
  });

  it('«Sin dato» honesto: la facturación SIAT de un periodo sin emisión conectada es null con motivo, no 0', () => {
    for (const periodo of ['ytd', '12m'] as PeriodoReporte[]) {
      const p = construirCobros(ctx({ periodo }));
      const k = p.kpis.find((x) => x.id === 'facturas-emitidas-pct')!;
      expect(k.valor).toBeNull();
      expect(k.numerador).toBeNull();
      expect(k.motivoSinDato).toContain('SIAT');
      const g = p.graficos.find((x) => x.id === 'facturacion-siat')!;
      expect(numerosDe(g.datos).every((n) => n === null)).toBe(true);
      expect(g.sinDatoMotivo).toBeTruthy();
      expect(p.avisos!.length).toBeGreaterThan(1);
    }
    for (const periodo of ['7d', '30d', '90d'] as PeriodoReporte[]) {
      const k = kpi(ctx({ periodo }), 'facturas-emitidas-pct');
      expect(k.valor).not.toBeNull();
      expect(k.valor!).toBeGreaterThan(80);
    }
  });

  it('con un método filtrado, los métodos excluidos de la facturación son null y no cero', () => {
    const g = construirCobros(ctx({ filtros: [{ dimension: 'metodo-pago', valor: 'QR' }] })).graficos.find((x) => x.id === 'facturacion-siat')!;
    if (g.datos.tipo !== 'cartesiano') throw new Error('forma inesperada');
    const porNombre = new Map(g.datos.series.map((s) => [s.nombre, s.valores]));
    expect(porNombre.get('Tarjeta')!.every((v) => v === null)).toBe(true);
    expect(porNombre.get('QR')!.every((v) => typeof v === 'number')).toBe(true);
  });

  it('las tablas no llevan datos del pagador ni números de cuenta o tarjeta', () => {
    for (const c of todasLasCombinaciones()) {
      for (const t of construirCobros(c).tablas) {
        for (const fila of t.filas) {
          for (const [clave, valor] of Object.entries(fila)) {
            if (clave === 'operacion') expect(valor).toMatch(/^TX-••\d{4}$/);
            if (clave === 'excepcion') expect(valor).toMatch(/^EX-••\d{4}$/);
            expect(String(valor)).not.toMatch(/\d{6,}/);
            expect(String(valor)).not.toMatch(/@/);
          }
        }
      }
    }
  });

  it('la tabla de atípicas respeta el método filtrado', () => {
    const t = construirCobros(ctx({ filtros: [{ dimension: 'metodo-pago', valor: 'QR' }] })).tablas.find((x) => x.id === 'transacciones-atipicas')!;
    expect(t.filas.length).toBeGreaterThan(0);
    expect(t.filas.every((f) => f['metodo'] === 'QR')).toBe(true);
  });
});

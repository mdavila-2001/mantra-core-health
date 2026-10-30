import { getContractViolations } from '@core/data-access/reporting/reporting-contract';
import type {
  AlcanceReporte,
  ChartSpec,
  ComparacionReporte,
  ContextoReporte,
  Moneda,
  PeriodoReporte,
  PestanaReporte,
} from '../../../data-access/reporting/reporting.types';
import { construirAdquisicion } from './adquisicion.dataset';
import { CANAL_ORGANICO, ORGANIC_REASON, repartir } from './adquisicion.modelo';

const PERIODOS: readonly PeriodoReporte[] = ['7d', '30d', '90d', 'ytd', '12m'];
const COMPARACIONES: readonly ComparacionReporte[] = ['ninguna', 'periodo-anterior', 'mismo-periodo-ano-anterior'];
const MONEDAS: readonly Moneda[] = ['BOB', 'USD'];
const ALCANCES: readonly AlcanceReporte[] = ['plataforma', 'organizacion'];

const BASE: ContextoReporte = { periodo: '30d', comparar: 'periodo-anterior', moneda: 'BOB', alcance: 'plataforma', filtros: [] };

function allContexts(): ContextoReporte[] {
  return PERIODOS.flatMap((periodo) =>
    COMPARACIONES.flatMap((comparar) =>
      MONEDAS.flatMap((moneda) => ALCANCES.map((alcance) => ({ periodo, comparar, moneda, alcance, filtros: [] }))),
    ),
  );
}

const kpiById = (p: PestanaReporte, id: string) => p.kpis.find((k) => k.id === id)!;
const chartById = (p: PestanaReporte, id: string): ChartSpec => p.graficos.find((g) => g.id === id)!;

function numerosNoFinitos(valor: unknown, ruta = ''): string[] {
  if (typeof valor === 'number') return Number.isFinite(valor) ? [] : [ruta];
  if (Array.isArray(valor)) return valor.flatMap((v, i) => numerosNoFinitos(v, `${ruta}[${i}]`));
  if (valor !== null && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([k, v]) => numerosNoFinitos(v, `${ruta}.${k}`));
  }
  return [];
}

function shapeOf(g: ChartSpec): string {
  const d = g.datos;
  switch (d.tipo) {
    case 'partes':
      return d.forma;
    case 'cartesiano':
      return d.series[0]?.forma === 'barra' ? 'barra' : 'linea';
    default:
      return d.tipo;
  }
}

describe('construirAdquisicion (datos de EJEMPLO)', () => {
  it('cumple el contrato de gráfico en toda combinación de periodo × comparar × moneda × alcance', () => {
    for (const ctx of allContexts()) {
      const p = construirAdquisicion(ctx);
      for (const g of p.graficos) {
        expect(getContractViolations(g), `${g.id} con ${JSON.stringify(ctx)}`).toEqual([]);
      }
    }
  });

  it('trae al menos 7 KPI, 8 gráficos y 5 formas distintas, y las dos tablas', () => {
    const p = construirAdquisicion(BASE);
    expect(p.pestana).toBe('adquisicion');
    expect(p.origen).toBe('ejemplo');
    expect(p.kpis.length).toBeGreaterThanOrEqual(7);
    expect(p.graficos.length).toBeGreaterThanOrEqual(8);
    const formas = new Set(p.graficos.map(shapeOf));
    if (p.graficos.some((g) => g.velas !== null)) formas.add('velas');
    expect(formas.size).toBeGreaterThanOrEqual(5);
    expect(p.tablas.map((t) => t.id)).toEqual(['adq-tabla-campanas', 'adq-tabla-cuentas-riesgo']);
  });

  it('no repite ids de KPI, gráficos ni tablas, y las secciones solo nombran ids que existen', () => {
    const p = construirAdquisicion(BASE);
    const ids = [...p.kpis.map((k) => k.id), ...p.graficos.map((g) => g.id), ...p.tablas.map((t) => t.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(p.secciones?.map((s) => s.titulo)).toEqual(['Embudo', 'Canales y costo', 'Promociones y referidos', 'Salud de cuentas']);
    const referenciados = (p.secciones ?? []).flatMap((s) => [...(s.graficos ?? []), ...(s.tablas ?? [])]);
    for (const id of referenciados) expect(ids).toContain(id);
    // Todo gráfico y toda tabla cae en alguna sección.
    for (const id of [...p.graficos.map((g) => g.id), ...p.tablas.map((t) => t.id)]) expect(referenciados).toContain(id);
  });

  it('es determinista: la misma consulta da exactamente lo mismo', () => {
    const ctx: ContextoReporte = { ...BASE, filtros: [{ dimension: 'canal', valor: 'Redes sociales' }] };
    expect(JSON.stringify(construirAdquisicion(ctx))).toBe(JSON.stringify(construirAdquisicion(ctx)));
  });

  it('un filtro por canal cambia los números de verdad', () => {
    const unfiltered = construirAdquisicion(BASE);
    const filtered = construirAdquisicion({ ...BASE, filtros: [{ dimension: 'canal', valor: 'Redes sociales' }] });
    expect(kpiById(filtered, 'leads').valor).not.toBe(kpiById(unfiltered, 'leads').valor);
    expect(JSON.stringify(chartById(filtered, 'adq-rendimiento-canal').datos)).not.toBe(JSON.stringify(chartById(unfiltered, 'adq-rendimiento-canal').datos));
    expect(JSON.stringify(chartById(filtered, 'adq-cac-canal').datos)).not.toBe(JSON.stringify(chartById(unfiltered, 'adq-cac-canal').datos));
  });

  it('un filtro por estado y uno por plan también mueven números', () => {
    const unfiltered = construirAdquisicion(BASE);
    const statusFiltered = construirAdquisicion({ ...BASE, filtros: [{ dimension: 'estado', valor: 'Activa' }] });
    const plan = construirAdquisicion({ ...BASE, filtros: [{ dimension: 'plan', valor: 'Premium' }] });
    expect(kpiById(statusFiltered, 'descuento-otorgado').valor).not.toBe(kpiById(unfiltered, 'descuento-otorgado').valor);
    expect(JSON.stringify(chartById(plan, 'adq-salud-cuentas').datos)).not.toBe(JSON.stringify(chartById(unfiltered, 'adq-salud-cuentas').datos));
    // La tabla de cuentas en riesgo se acota al plan elegido.
    const filas = plan.tablas.find((t) => t.id === 'adq-tabla-cuentas-riesgo')!.filas;
    expect(filas.length).toBeGreaterThan(0);
    expect(filas.every((f) => f['plan'] === 'Premium')).toBe(true);
  });

  it('no produce NaN ni infinitos en ningún contexto', () => {
    const extra: ContextoReporte[] = [
      { ...BASE, periodo: '7d', alcance: 'organizacion', filtros: [{ dimension: 'canal', valor: 'Referidos' }, { dimension: 'estado', valor: 'x' }] },
      { ...BASE, filtros: [{ dimension: 'canal', valor: CANAL_ORGANICO }] },
    ];
    for (const ctx of [...allContexts(), ...extra]) {
      expect(numerosNoFinitos(construirAdquisicion(ctx)), JSON.stringify(ctx)).toEqual([]);
    }
  });

  it('expone los KPI canónicos con la forma que otras pantallas esperan', () => {
    const p = construirAdquisicion(BASE);
    for (const id of ['leads', 'cac', 'conversion-lead-activacion', 'registros', 'payback-cac-meses']) {
      expect(p.kpis.some((k) => k.id === id), id).toBe(true);
    }
    const cac = kpiById(p, 'cac');
    expect(cac.unidad).toEqual({ tipo: 'moneda', moneda: 'BOB' });
    expect(cac.subirEsMalo).toBe(true);
    expect(cac.numerador).not.toBeNull();
    expect(cac.denominador).not.toBeNull();
    const conv = kpiById(p, 'conversion-lead-activacion');
    expect(conv.unidad).toEqual({ tipo: 'porcentaje' });
    expect(conv.numerador).not.toBeNull();
    expect(conv.denominador).not.toBeNull();
    expect(kpiById(construirAdquisicion({ ...BASE, moneda: 'USD' }), 'cac').unidad).toEqual({ tipo: 'moneda', moneda: 'USD' });
  });

  it('CAC = inversión ÷ clientes nuevos, y la conversión = cuentas activas ÷ leads', () => {
    for (const ctx of allContexts().filter((c) => c.comparar === 'ninguna')) {
      const p = construirAdquisicion(ctx);
      const cac = kpiById(p, 'cac');
      expect(cac.valor, JSON.stringify(ctx)).not.toBeNull();
      expect(Math.abs(cac.valor! - cac.numerador! / cac.denominador!)).toBeLessThan(0.02);
      const conv = kpiById(p, 'conversion-lead-activacion');
      expect(Math.abs(conv.valor! - (conv.numerador! / conv.denominador!) * 100)).toBeLessThan(0.06);
      expect(conv.denominador).toBe(kpiById(p, 'leads').valor);
      expect(cac.denominador).toBe(kpiById(p, 'clientes-nuevos').valor);
    }
  });

  it('el embudo es monótono y concuerda con los KPI', () => {
    for (const ctx of allContexts()) {
      const p = construirAdquisicion(ctx);
      const d = chartById(p, 'adq-embudo').datos;
      if (d.tipo !== 'partes') throw new Error('el embudo debe ser de partes');
      const v = d.partes.map((x) => x.valor!);
      expect(d.partes.map((x) => x.nombre)).toEqual(['Lead', 'Registro', 'Identidad verificada', 'Cuenta activa', 'Pagante']);
      for (let i = 1; i < v.length; i++) expect(v[i], `${JSON.stringify(ctx)} etapa ${i}`).toBeLessThanOrEqual(v[i - 1]!);
      expect(v[0]).toBe(kpiById(p, 'leads').valor);
      expect(v[1]).toBe(kpiById(p, 'registros').valor);
      expect(v[4]).toBe(kpiById(p, 'clientes-nuevos').valor);
    }
  });

  it('la tabla de campañas suma lo mismo que los KPI y los canales', () => {
    const p = construirAdquisicion(BASE);
    const filas = p.tablas[0]!.filas;
    const suma = (clave: string) => filas.reduce((a, f) => a + (f[clave] as number), 0);
    expect(suma('leads')).toBe(kpiById(p, 'leads').valor);
    expect(suma('registros')).toBe(kpiById(p, 'registros').valor);
    expect(suma('clientes')).toBe(kpiById(p, 'clientes-nuevos').valor);
    const canal = chartById(p, 'adq-rendimiento-canal').datos;
    if (canal.tipo !== 'cartesiano') throw new Error('rendimiento cartesiano');
    expect(canal.categorias).toHaveLength(6);
  });

  it('null ≠ 0: el canal orgánico no tiene CAC y lo dice; ningún KPI sin valor calla su motivo', () => {
    const p = construirAdquisicion(BASE);
    const cacCanal = chartById(p, 'adq-cac-canal').datos;
    if (cacCanal.tipo !== 'cartesiano') throw new Error('cac por canal cartesiano');
    const i = cacCanal.categorias.indexOf(CANAL_ORGANICO);
    expect(cacCanal.series[0]!.valores[i]).toBeNull();
    expect(cacCanal.series[0]!.valores.filter((x) => x !== null).every((x) => x! > 0)).toBe(true);
    const fila = p.tablas[0]!.filas.find((f) => f['canal'] === CANAL_ORGANICO)!;
    expect(fila['inversion']).toBeNull();
    expect(fila['cac']).toBeNull();

    const org = construirAdquisicion({ ...BASE, filtros: [{ dimension: 'canal', valor: CANAL_ORGANICO }] });
    for (const id of ['cac', 'payback-cac-meses', 'inversion-adquisicion']) {
      expect(kpiById(org, id).valor, id).toBeNull();
      expect(kpiById(org, id).motivoSinDato, id).toBe(ORGANIC_REASON);
    }
    expect(chartById(org, 'adq-cac-tiempo').velas).toBeNull();
    expect(chartById(org, 'adq-payback').datos).toMatchObject({ tipo: 'medidor', valor: null });

    for (const ctx of allContexts()) {
      for (const k of construirAdquisicion(ctx).kpis) {
        if (k.valor === null) expect(k.motivoSinDato?.trim(), `${k.id} ${JSON.stringify(ctx)}`).toBeTruthy();
      }
    }
  });

  it('el mapa de salud oculta con null las celdas chicas y nunca publica un 0', () => {
    const plataforma = chartById(construirAdquisicion(BASE), 'adq-salud-cuentas').datos;
    const org = chartById(construirAdquisicion({ ...BASE, alcance: 'organizacion' }), 'adq-salud-cuentas').datos;
    if (plataforma.tipo !== 'mapa-calor' || org.tipo !== 'mapa-calor') throw new Error('mapa de calor');
    expect(plataforma.celdas).toHaveLength(16);
    expect(org.celdas.some((c) => c[2] === null)).toBe(true);
    for (const c of [...plataforma.celdas, ...org.celdas]) expect(c[2] === 0).toBe(false);
  });

  it('las cohortes dejan en null las semanas que todavía no ocurrieron y nunca retroceden', () => {
    const d = chartById(construirAdquisicion(BASE), 'adq-cohortes').datos;
    if (d.tipo !== 'mapa-calor') throw new Error('mapa de calor');
    const ultima = d.filas.length - 1;
    expect(d.celdas.find((c) => c[0] === 5 && c[1] === ultima)![2]).toBeNull();
    expect(d.celdas.find((c) => c[0] === 0 && c[1] === ultima)![2]).not.toBeNull();
    for (let fila = 0; fila < d.filas.length; fila++) {
      const v = d.celdas.filter((c) => c[1] === fila).sort((a, b) => a[0] - b[0]).map((c) => c[2]).filter((x): x is number => x !== null);
      for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThanOrEqual(v[i - 1]!);
    }
  });

  it('el CAC trae velas con subirEsMalo y los filtros por clic apuntan a la dimensión correcta', () => {
    const p = construirAdquisicion(BASE);
    const cac = chartById(p, 'adq-cac-tiempo');
    expect(cac.velas?.subirEsMalo).toBe(true);
    expect(cac.velas!.velas.length).toBeGreaterThanOrEqual(2);
    for (const v of cac.velas!.velas) {
      expect(v.maximo).toBeGreaterThanOrEqual(Math.max(v.apertura, v.cierre));
      expect(v.minimo).toBeLessThanOrEqual(Math.min(v.apertura, v.cierre));
    }
    const dim = (id: string) => chartById(p, id).filtro?.dimension;
    expect(dim('adq-rendimiento-canal')).toBe('canal');
    expect(dim('adq-cac-canal')).toBe('canal');
    expect(dim('adq-cupones-canjes')).toBe('estado');
    expect(dim('adq-cupones-descuento')).toBe('estado');
    expect(dim('adq-salud-cuentas')).toBe('plan');
  });

  it('la cascada de referidos cierra: cada total es el escalón anterior menos su pérdida', () => {
    const d = chartById(construirAdquisicion(BASE), 'adq-referidos').datos;
    if (d.tipo !== 'cascada') throw new Error('cascada');
    const p = d.pasos;
    expect(p[0]!.valor + p[1]!.valor).toBe(p[2]!.valor);
    expect(p[2]!.valor + p[3]!.valor).toBe(p[4]!.valor);
    expect(p[4]!.valor + p[5]!.valor).toBe(p[6]!.valor);
  });
});

describe('repartir', () => {
  it('reparte el total exacto, respeta los topes y no inventa unidades', () => {
    expect(repartir(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(repartir(10, [5, 1], [2, 100])).toEqual([2, 8]);
    expect(repartir(0, [1, 2])).toEqual([0, 0]);
    expect(repartir(7, [0, 0, 0], [3, 3, 3]).reduce((a, b) => a + b, 0)).toBe(7);
  });
});

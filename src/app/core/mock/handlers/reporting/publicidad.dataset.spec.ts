import { violacionesDelContrato } from '../../../../shared/components/organisms/chart-panel/chart-contract';
import type {
  ChartSpec,
  ComparacionReporte,
  ContextoReporte,
  FiltroActivo,
  KpiSpec,
  Moneda,
  PeriodoReporte,
  PestanaReporte,
  AlcanceReporte,
} from '../../../data-access/reporting/reporting.types';
import { CAMPANAS } from './publicidad.catalogo';
import { construirPublicidad } from './publicidad.dataset';
import { huecosDelContrato } from './reporting-dataset.util';

const PERIODOS: PeriodoReporte[] = ['7d', '30d', '90d', 'ytd', '12m'];
const COMPARAR: ComparacionReporte[] = ['ninguna', 'periodo-anterior', 'mismo-periodo-ano-anterior'];
const MONEDAS: Moneda[] = ['BOB', 'USD'];
const ALCANCES: AlcanceReporte[] = ['plataforma', 'organizacion'];

function ctx(parcial: Partial<ContextoReporte> = {}): ContextoReporte {
  return { periodo: '30d', comparar: 'periodo-anterior', moneda: 'BOB', alcance: 'plataforma', filtros: [], ...parcial };
}

function todosLosContextos(): ContextoReporte[] {
  return PERIODOS.flatMap((periodo) =>
    COMPARAR.flatMap((comparar) =>
      MONEDAS.flatMap((moneda) => ALCANCES.map((alcance) => ctx({ periodo, comparar, moneda, alcance }))),
    ),
  );
}

/** Recorre todo número del objeto: ningún NaN ni infinito. */
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

function grafico(p: PestanaReporte, id: string): ChartSpec {
  const g = p.graficos.find((x) => x.id === id);
  if (g === undefined) throw new Error(`falta el gráfico ${id}`);
  return g;
}

function sumaSerie(g: ChartSpec, indice = 0): number {
  if (g.datos.tipo !== 'cartesiano') throw new Error('no es cartesiano');
  return g.datos.series[indice]!.valores.reduce<number>((a, v) => a + (v ?? 0), 0);
}

function sumaApilada(g: ChartSpec): number {
  if (g.datos.tipo !== 'cartesiano') throw new Error('no es cartesiano');
  return g.datos.series.reduce((acc, s) => acc + s.valores.reduce<number>((a, v) => a + (v ?? 0), 0), 0);
}

function cerca(a: number, b: number, tolerancia = 1e-6): void {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(Math.max(1, Math.abs(b)) * tolerancia);
}

describe('Pestaña publicidad (datos de EJEMPLO)', () => {
  it('cumple el contrato de calidad en todas las combinaciones de periodo, comparación, moneda y alcance', () => {
    for (const c of todosLosContextos()) {
      const p = construirPublicidad(c);
      const etiqueta = JSON.stringify(c);
      expect(p.pestana).toBe('publicidad');
      expect(p.origen).toBe('ejemplo');
      for (const g of p.graficos) {
        expect(violacionesDelContrato(g), `${etiqueta} ${g.id}`).toEqual([]);
        expect(huecosDelContrato(g), `${etiqueta} ${g.id}`).toEqual([]);
      }
      for (const k of p.kpis) {
        expect(k.info !== null || !!k.infoMotivo, `${etiqueta} ${k.id}`).toBe(true);
        if (k.valor === null) expect(k.motivoSinDato, `${etiqueta} ${k.id}`).toBeTruthy();
      }
      expect(numerosNoFinitos(p), etiqueta).toEqual([]);
    }
  });

  it('declara el aviso obligatorio y las cinco secciones, cubriendo cada gráfico y tabla', () => {
    const p = construirPublicidad(ctx());
    expect(p.avisos).toContain('Módulo en diseño: se modela como Meta Ads Manager; las métricas y la entrega son de EJEMPLO.');
    expect(p.secciones?.map((s) => s.titulo)).toEqual([
      'Resultados',
      'Entrega y alcance',
      'Rendimiento por ubicación y horario',
      'Campañas',
      'Moderación',
    ]);
    const enSecciones = (p.secciones ?? []).flatMap((s) => [...(s.graficos ?? []), ...(s.tablas ?? [])]).sort();
    const reales = [...p.graficos.map((g) => g.id), ...p.tablas.map((t) => t.id)].sort();
    expect(enSecciones).toEqual(reales);
  });

  it('trae al menos 8 KPI con los ids canónicos, 9 gráficos de 5 formas y velas de CPM y ROAS', () => {
    const p = construirPublicidad(ctx());
    expect(p.kpis.length).toBeGreaterThanOrEqual(8);
    const ids = p.kpis.map((k) => k.id);
    for (const id of ['ingreso-periodo', 'impresiones', 'alcance', 'ctr', 'cpm', 'cpa', 'roas', 'anunciantes-activos']) {
      expect(ids).toContain(id);
    }
    expect(p.graficos.length).toBeGreaterThanOrEqual(9);
    const formas = new Set(p.graficos.map((g) => (g.datos.tipo === 'partes' ? g.datos.forma : g.datos.tipo)));
    expect(formas.size).toBeGreaterThanOrEqual(5);
    expect(grafico(p, 'pub-gasto-diario').velas?.subirEsMalo).toBe(true);
    expect(grafico(p, 'pub-valor-atribuido').velas?.subirEsMalo).not.toBe(true);
    expect(p.tablas.map((t) => t.titulo)).toEqual(
      expect.arrayContaining(['Campañas', 'Anuncios con peor costo por resultado']),
    );
  });

  it('usa ids únicos de KPI, gráfico y tabla', () => {
    for (const c of [ctx(), ctx({ periodo: '7d', alcance: 'organizacion' })]) {
      const p = construirPublicidad(c);
      for (const lista of [p.kpis.map((k) => k.id), p.graficos.map((g) => g.id), p.tablas.map((t) => t.id)]) {
        expect(new Set(lista).size).toBe(lista.length);
      }
    }
  });

  it('es determinista: la misma consulta da los mismos números', () => {
    const c = ctx({ periodo: '90d', moneda: 'USD', filtros: [{ dimension: 'anunciante', valor: 'Clínica Altiplano Salud' }] });
    expect(JSON.stringify(construirPublicidad(c))).toBe(JSON.stringify(construirPublicidad(c)));
  });

  it('sin comparativo, ninguna variación se inventa', () => {
    const p = construirPublicidad(ctx({ comparar: 'ninguna' }));
    expect(p.kpis.every((k) => k.variacionPct === null)).toBe(true);
    const q = construirPublicidad(ctx({ comparar: 'periodo-anterior' }));
    expect(q.kpis.some((k) => k.variacionPct !== null)).toBe(true);
  });

  it('un filtro por campaña cambia los números de verdad (y el gráfico filtrado conserva todas sus barras)', () => {
    const base = construirPublicidad(ctx());
    const filtro: FiltroActivo = { dimension: 'campana', valor: 'Chequeo ejecutivo' };
    const filtrado = construirPublicidad(ctx({ filtros: [filtro] }));
    expect(kpi(filtrado, 'ingreso-periodo').valor).not.toBe(kpi(base, 'ingreso-periodo').valor);
    expect(kpi(filtrado, 'ingreso-periodo').valor!).toBeLessThan(kpi(base, 'ingreso-periodo').valor!);
    expect(kpi(filtrado, 'impresiones').valor).not.toBe(kpi(base, 'impresiones').valor);
    expect(grafico(filtrado, 'pub-por-campana').datos).toEqual(grafico(base, 'pub-por-campana').datos);
    const filas = filtrado.tablas.find((t) => t.id === 'pub-tabla-campanas')!.filas;
    expect(filas.map((f) => f['campana'])).toEqual(['Chequeo ejecutivo']);
    // La campaña elegida cuadra con su barra en el gráfico sin filtrar.
    const por = grafico(base, 'pub-por-campana');
    if (por.datos.tipo !== 'cartesiano') throw new Error('forma inesperada');
    const barra = por.datos.series[0]!.valores[por.datos.categorias.indexOf('Chequeo ejecutivo')]!;
    cerca(kpi(filtrado, 'ingreso-periodo').valor!, barra);
  });

  it('los demás filtros también mueven los números: anunciante, estado, ubicación, ciudad y otros', () => {
    const base = kpi(construirPublicidad(ctx()), 'ingreso-periodo').valor;
    const filtros: FiltroActivo[] = [
      { dimension: 'anunciante', valor: 'Seguros Cóndor Salud' },
      { dimension: 'estado', valor: 'Pausada' },
      { dimension: 'canal', valor: 'Banner en la app' },
      { dimension: 'ciudad', valor: 'Sucre' },
      { dimension: 'plan', valor: 'cualquiera' },
    ];
    for (const f of filtros) {
      const v = kpi(construirPublicidad(ctx({ filtros: [f] })), 'ingreso-periodo').valor;
      expect(v, f.dimension).not.toBe(base);
    }
  });

  it('el gasto cuadra en todas partes: tarjeta, serie diaria, campañas, anunciantes y ubicaciones', () => {
    for (const c of [ctx(), ctx({ periodo: '7d', moneda: 'USD' }), ctx({ periodo: '12m', alcance: 'organizacion' })]) {
      const p = construirPublicidad(c);
      const ingreso = kpi(p, 'ingreso-periodo').valor!;
      cerca(sumaApilada(grafico(p, 'pub-gasto-diario')), ingreso);
      cerca(sumaSerie(grafico(p, 'pub-por-campana')), ingreso);
      cerca(sumaSerie(grafico(p, 'pub-por-anunciante')), ingreso);
      const dona = grafico(p, 'pub-ubicacion').datos;
      if (dona.tipo !== 'partes') throw new Error('forma inesperada');
      cerca(dona.partes.reduce((a, x) => a + (x.valor ?? 0), 0), ingreso);
    }
  });

  it('el embudo y las tarjetas hablan de lo mismo', () => {
    const p = construirPublicidad(ctx());
    const embudo = grafico(p, 'pub-embudo').datos;
    if (embudo.tipo !== 'partes') throw new Error('forma inesperada');
    const [imp, clics, leads, citas] = embudo.partes.map((x) => x.valor!);
    cerca(imp!, kpi(p, 'impresiones').valor!);
    cerca(citas!, kpi(p, 'resultados').valor!);
    cerca((clics! / imp!) * 100, kpi(p, 'ctr').valor!);
    expect(leads!).toBeGreaterThan(citas!);
    expect(clics!).toBeGreaterThan(leads!);
  });

  it('cuenta 12 campañas en sus estados y la tabla las lista todas', () => {
    const p = construirPublicidad(ctx());
    const estado = grafico(p, 'pub-estado-campanas');
    if (estado.datos.tipo !== 'cartesiano') throw new Error('forma inesperada');
    expect(estado.datos.series[0]!.valores.reduce<number>((a, v) => a + (v ?? 0), 0)).toBe(CAMPANAS.length);
    expect(estado.datos.categorias).toEqual(
      expect.arrayContaining(['Activa', 'En revisión', 'Rechazada', 'En fase de aprendizaje', 'Aprendizaje limitada', 'Pausada']),
    );
    expect(p.tablas.find((t) => t.id === 'pub-tabla-campanas')!.filas.length).toBe(CAMPANAS.length);
  });

  it('«Sin dato» no es cero: campañas sin entrega o sin conversiones quedan en null', () => {
    const p = construirPublicidad(ctx());
    const filas = p.tablas.find((t) => t.id === 'pub-tabla-campanas')!.filas;
    const rechazada = filas.find((f) => f['campana'] === 'Telemedicina desde casa')!;
    const revision = filas.find((f) => f['campana'] === 'Plan familiar Illimani')!;
    const alcance = filas.find((f) => f['campana'] === 'Vacunación y bienestar familiar')!;
    const leads = filas.find((f) => f['campana'] === 'Laboratorio en casa')!;
    for (const fila of [rechazada, revision]) {
      expect(fila['impresiones']).toBeNull();
      expect(fila['roas']).toBeNull();
      expect(fila['costoResultado']).toBeNull();
      expect(fila['ctr']).toBeNull();
    }
    expect(alcance['roas']).toBeNull();
    expect(alcance['resultados']).not.toBeNull();
    expect(leads['roas']).toBeNull();
    expect(filas.find((f) => f['campana'] === 'Chequeo ejecutivo')!['roas']).not.toBeNull();
  });

  it('una selección sin entrega muestra «Sin dato» con su motivo, no ceros ni infinitos', () => {
    for (const valor of ['Rechazada', 'En revisión']) {
      const c = ctx({ filtros: [{ dimension: 'estado', valor }] });
      const p = construirPublicidad(c);
      for (const id of ['ctr', 'cpm', 'cpa', 'roas', 'frecuencia', 'resultados']) {
        const k = kpi(p, id);
        expect(k.valor, id).toBeNull();
        expect(k.motivoSinDato, id).toBeTruthy();
      }
      expect(kpi(p, 'ingreso-periodo').valor).toBe(0);
      const pacing = grafico(p, 'pub-pacing').datos;
      if (pacing.tipo !== 'medidor') throw new Error('forma inesperada');
      expect(pacing.valor).toBeNull();
      expect(grafico(p, 'pub-gasto-diario').velas).toBeNull();
      expect(grafico(p, 'pub-gasto-diario').velasMotivo).toBeTruthy();
      for (const g of p.graficos) {
        expect(violacionesDelContrato(g), `${valor} ${g.id}`).toEqual([]);
      }
      expect(numerosNoFinitos(p)).toEqual([]);
    }
  });

  it('el mapa de calor deja «Sin dato» donde no hay muestra, sin llenarlo de ceros', () => {
    const p = construirPublicidad(ctx({ periodo: '7d', alcance: 'organizacion' }));
    const mapa = grafico(p, 'pub-ctr-hora').datos;
    if (mapa.tipo !== 'mapa-calor') throw new Error('forma inesperada');
    expect(mapa.celdas.length).toBe(7 * 24);
    expect(mapa.celdas.some((c) => c[2] === null)).toBe(true);
    expect(mapa.celdas.some((c) => c[2] !== null && c[2] > 0)).toBe(true);
    expect(mapa.celdas.every((c) => c[2] === null || c[2] > 0)).toBe(true);
  });

  it('en moneda USD los importes se convierten y las razones no cambian', () => {
    const bob = construirPublicidad(ctx({ moneda: 'BOB' }));
    const usd = construirPublicidad(ctx({ moneda: 'USD' }));
    expect(kpi(usd, 'ingreso-periodo').unidad).toEqual({ tipo: 'moneda', moneda: 'USD' });
    cerca(kpi(usd, 'ingreso-periodo').valor! * 6.96, kpi(bob, 'ingreso-periodo').valor!);
    cerca(kpi(usd, 'roas').valor!, kpi(bob, 'roas').valor!);
    cerca(kpi(usd, 'ctr').valor!, kpi(bob, 'ctr').valor!);
  });

  it('el alcance de organización es una fracción de la plataforma', () => {
    const plataforma = kpi(construirPublicidad(ctx()), 'ingreso-periodo').valor!;
    const organizacion = kpi(construirPublicidad(ctx({ alcance: 'organizacion' })), 'ingreso-periodo').valor!;
    expect(organizacion).toBeLessThan(plataforma);
    expect(organizacion).toBeGreaterThan(0);
  });

  it('la moderación suma lo mismo en el gráfico y en la tabla', () => {
    const p = construirPublicidad(ctx());
    const cascada = grafico(p, 'pub-moderacion').datos;
    if (cascada.tipo !== 'cascada') throw new Error('forma inesperada');
    const total = p.tablas.find((t) => t.id === 'pub-tabla-moderacion')!.filas.at(-1)!;
    expect(String(total['motivo'])).toBe('Total');
    expect(String(total['rechazados'])).toBe(new Intl.NumberFormat('es-BO').format(cascada.pasos[0]!.valor));
    const [rechazados, corregidos, ganadas, siguen] = cascada.pasos.map((x) => x.valor);
    expect(rechazados! + corregidos! + ganadas!).toBe(siguen);
    expect(siguen!).toBeGreaterThanOrEqual(0);
  });

  it('la tabla de peores anuncios solo trae costos comparables y los ordena de peor a mejor', () => {
    const p = construirPublicidad(ctx());
    const t = p.tablas.find((x) => x.id === 'pub-tabla-anuncios')!;
    expect(t.filas.length).toBeGreaterThan(0);
    expect(t.filas.length).toBeLessThanOrEqual(8);
    const deltas = t.filas.map((f) => Number(String(f['contraCampana']).replace('−', '-').replace('+', '').replace(',', '.').replace(' %', '')));
    expect(deltas).toEqual([...deltas].sort((a, b) => b - a));
    expect(t.info?.salvedades?.join(' ')).toContain('al menos 5 resultados');
  });
});

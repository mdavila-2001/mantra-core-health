import type {
  ChartSpec,
  ComparacionReporte,
  ContextoReporte,
  FiltroActivo,
  InfoCalculo,
  KpiSpec,
  Moneda,
  PeriodoReporte,
  PestanaReporte,
  AlcanceReporte,
} from '../../../data-access/reporting/reporting.types';
import { violacionesDelContrato } from '@shared/components/organisms/chart-panel/chart-contract';
import { PESTANAS_CATALOGADAS, leerPestanas, type PestanasLeidas } from './calidad.catalogo';
import { construirCalidad, construirCalidadDesde } from './calidad.dataset';

const PERIODOS: readonly PeriodoReporte[] = ['7d', '30d', '90d', 'ytd', '12m'];
const COMPARACIONES: readonly ComparacionReporte[] = ['ninguna', 'periodo-anterior', 'mismo-periodo-ano-anterior'];
const MONEDAS: readonly Moneda[] = ['BOB', 'USD'];
const ALCANCES: readonly AlcanceReporte[] = ['plataforma', 'organizacion'];

const ctx = (parcial: Partial<ContextoReporte> = {}): ContextoReporte => ({
  periodo: '30d',
  comparar: 'periodo-anterior',
  moneda: 'BOB',
  alcance: 'plataforma',
  filtros: [],
  ...parcial,
});

const contextos = (): ContextoReporte[] =>
  PERIODOS.flatMap((periodo) =>
    COMPARACIONES.flatMap((comparar) =>
      MONEDAS.flatMap((moneda) => ALCANCES.map((alcance) => ctx({ periodo, comparar, moneda, alcance }))),
    ),
  );

/* ---- indicadores de prueba: lo que "publicarían" las otras pestañas ------------ */

const infoOk = (): InfoCalculo => ({
  definicion: 'Definición de prueba',
  formula: 'a ÷ b',
  numerador: 'a',
  denominador: 'b',
  fuente: 'payments.subscriptions',
  frescura: 'Cada 15 minutos',
});

/** Un indicador que no es tasa: no declara numerador ni denominador, y no debe. */
const infoSinTasa = (): InfoCalculo => ({
  definicion: 'Definición de prueba',
  formula: 'Σ importes',
  fuente: 'ads.ad_accounts',
  frescura: 'Cada hora',
});

/** Una tasa a medias: dice el numerador pero no el denominador. */
const infoSinDenominador = (): InfoCalculo => ({
  definicion: 'Definición de prueba',
  formula: 'a ÷ b',
  numerador: 'a',
  fuente: 'payments.payment_transactions',
  frescura: 'Cada 15 minutos',
});

const kpiPrueba = (id: string, extra: Partial<KpiSpec> = {}): KpiSpec => ({
  id,
  titulo: `Indicador ${id}`,
  valor: 10,
  unidad: { tipo: 'numero' },
  variacionPct: null,
  info: infoOk(),
  ...extra,
});

const graficoPrueba = (id: string, info: InfoCalculo | null = infoOk()): ChartSpec => ({
  id,
  titulo: `Gráfico ${id}`,
  unidad: { tipo: 'numero' },
  datos: { tipo: 'partes', forma: 'dona', partes: [{ nombre: 'A', valor: 1 }] },
  resumenAccesible: 'Resumen de prueba',
  filtro: null,
  filtroMotivo: 'prueba',
  info,
  infoMotivo: info === null ? 'prueba' : undefined,
  velas: null,
  velasMotivo: 'prueba',
});

const pestanaPrueba = (
  pestana: PestanaReporte['pestana'],
  kpis: KpiSpec[],
  graficos: ChartSpec[] = [],
): PestanaReporte => ({ pestana, generadoEn: 'x', origen: 'ejemplo', kpis, graficos, tablas: [] });

const FIXTURE: PestanasLeidas = {
  suscripciones: pestanaPrueba('suscripciones', [kpiPrueba('mrr'), kpiPrueba('churn', { unidad: { tipo: 'porcentaje' } })], [graficoPrueba('mrr-evolucion')]),
  publicidad: pestanaPrueba('publicidad', [kpiPrueba('entregas-push'), kpiPrueba('gasto', { info: infoSinTasa() })], [graficoPrueba('gasto-por-campana')]),
  comisiones: pestanaPrueba('comisiones', [
    kpiPrueba('comision-por-actor'),
    // Sin información de cálculo: ni fórmula ni fuente.
    { ...kpiPrueba('take-rate', { unidad: { tipo: 'porcentaje' } }), info: null, infoMotivo: 'prueba' },
  ]),
  cobros: pestanaPrueba('cobros', [kpiPrueba('tasa-exito', { unidad: { tipo: 'porcentaje' }, info: infoSinDenominador() })]),
  // Sin indicadores a propósito: su columna de reglas debe quedar vacía, no en 0.
  adquisicion: pestanaPrueba('adquisicion', []),
};

const VACIAS: PestanasLeidas = {
  suscripciones: pestanaPrueba('suscripciones', []),
  publicidad: pestanaPrueba('publicidad', []),
  comisiones: pestanaPrueba('comisiones', []),
  cobros: pestanaPrueba('cobros', []),
  adquisicion: pestanaPrueba('adquisicion', []),
};

const kpiDe = (p: PestanaReporte, id: string): KpiSpec => {
  const k = p.kpis.find((x) => x.id === id);
  if (k === undefined) throw new Error(`falta el KPI ${id}`);
  return k;
};

const filasCatalogo = (p: PestanaReporte) => p.tablas.find((t) => t.id === 'calidad-catalogo-indicadores')!.filas;

function recorrerNumeros(valor: unknown, ruta: string, malos: string[]): void {
  if (typeof valor === 'number' && !Number.isFinite(valor)) malos.push(ruta);
  else if (Array.isArray(valor)) valor.forEach((v, i) => recorrerNumeros(v, `${ruta}[${i}]`, malos));
  else if (valor !== null && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) recorrerNumeros(v, `${ruta}.${k}`, malos);
  }
}

describe('Pestaña «Calidad del dato y definiciones» (EJEMPLO)', () => {
  describe('contrato con los constructores reales de las otras pestañas', () => {
    it('cumple el contrato de calidad en todas las combinaciones de contexto', () => {
      for (const c of contextos()) {
        const tab = construirCalidad(c);
        expect(tab.pestana).toBe('calidad');
        expect(tab.origen).toBe('ejemplo');
        for (const g of tab.graficos) {
          expect(violacionesDelContrato(g), `${g.id} con ${JSON.stringify(c)}`).toEqual([]);
        }
      }
    });

    it('trae al menos 6 KPI, 6 gráficos de 4 formas distintas, 2 tablas y tres secciones', () => {
      const tab = construirCalidad(ctx());
      expect(tab.kpis.length).toBeGreaterThanOrEqual(6);
      expect(tab.graficos.length).toBeGreaterThanOrEqual(6);
      const formas = new Set(
        tab.graficos.map((g) =>
          g.datos.tipo === 'partes' ? g.datos.forma : g.datos.tipo === 'cartesiano' ? `cartesiano-${g.datos.horizontal === true ? 'h' : 'v'}-${g.datos.series[0]!.forma}` : g.datos.tipo,
        ),
      );
      expect(formas.size).toBeGreaterThanOrEqual(4);
      expect(tab.tablas.map((t) => t.id)).toEqual(['calidad-catalogo-indicadores', 'calidad-reglas']);
      expect(tab.secciones?.map((s) => s.titulo)).toEqual(['Definiciones', 'Estado de las fuentes', 'Frescura y reglas']);
    });

    it('las secciones solo apuntan a gráficos y tablas que existen', () => {
      const tab = construirCalidad(ctx());
      const graficos = new Set(tab.graficos.map((g) => g.id));
      const tablas = new Set(tab.tablas.map((t) => t.id));
      for (const s of tab.secciones ?? []) {
        s.graficos?.forEach((id) => expect(graficos.has(id), id).toBe(true));
        s.tablas?.forEach((id) => expect(tablas.has(id), id).toBe(true));
      }
    });

    it('los ids de KPI, gráficos y tablas son únicos', () => {
      const tab = construirCalidad(ctx());
      for (const ids of [tab.kpis.map((k) => k.id), tab.graficos.map((g) => g.id), tab.tablas.map((t) => t.id)]) {
        expect(new Set(ids).size).toBe(ids.length);
      }
    });

    it('es determinista: la misma consulta da exactamente lo mismo', () => {
      const c = ctx({ periodo: '90d', moneda: 'USD', alcance: 'organizacion' });
      expect(JSON.stringify(construirCalidad(c))).toBe(JSON.stringify(construirCalidad(c)));
    });

    it('no produce NaN ni infinitos', () => {
      for (const c of contextos()) {
        const malos: string[] = [];
        recorrerNumeros(construirCalidad(c), 'calidad', malos);
        expect(malos).toEqual([]);
      }
    });

    it('el código completo «pestaña.id» no se repite (un mismo id entre pestañas es legítimo)', () => {
      const leidas = leerPestanas();
      for (const p of PESTANAS_CATALOGADAS) {
        expect(leidas[p], `la pestaña ${p} no se pudo leer`).not.toBeNull();
      }
      const kpis = PESTANAS_CATALOGADAS.flatMap((p) => leidas[p]!.kpis.map((k) => `${p}.${k.id}`));
      const graficos = PESTANAS_CATALOGADAS.flatMap((p) => leidas[p]!.graficos.map((g) => `${p}.${g.id}`));
      expect(kpis.filter((id, i) => kpis.indexOf(id) !== i), 'KPI repetidos').toEqual([]);
      expect(graficos.filter((id, i) => graficos.indexOf(id) !== i), 'gráficos repetidos').toEqual([]);
    });

    it('el total del catálogo es la suma de KPI y gráficos de las pestañas', () => {
      const leidas = leerPestanas();
      const kpis = PESTANAS_CATALOGADAS.reduce((a, p) => a + leidas[p]!.kpis.length, 0);
      const graficos = PESTANAS_CATALOGADAS.reduce((a, p) => a + leidas[p]!.graficos.length, 0);
      const tab = construirCalidad(ctx());
      const filas = filasCatalogo(tab);
      expect(filas.length).toBe(kpis + graficos);
      expect(filas.filter((f) => f['tipo'] === 'KPI').length).toBe(kpis);
      expect(kpiDe(tab, 'indicadores-catalogados').valor).toBe(kpis + graficos);
    });
  });

  describe('con indicadores de prueba (incluye uno sin definición y una tasa sin denominador)', () => {
    const tab = construirCalidadDesde(ctx(), FIXTURE);
    const filas = filasCatalogo(tab);

    it('el catálogo suma exactamente los KPI y gráficos de las pestañas, sin repetir códigos', () => {
      const kpis = PESTANAS_CATALOGADAS.reduce((a, p) => a + FIXTURE[p]!.kpis.length, 0);
      const graficos = PESTANAS_CATALOGADAS.reduce((a, p) => a + FIXTURE[p]!.graficos.length, 0);
      expect(filas.length).toBe(kpis + graficos);
      const claves = filas.map((f) => `${f['tipo']}/${f['id']}`);
      expect(new Set(claves).size).toBe(claves.length);
      expect(kpiDe(tab, 'indicadores-catalogados').valor).toBe(filas.length);
    });

    it('está ordenado por pestaña y los KPI van antes que los gráficos de su pestaña', () => {
      const orden = filas.map((f) => String(f['pestana']));
      const vistas: string[] = [];
      for (const p of orden) if (vistas[vistas.length - 1] !== p) vistas.push(p);
      expect(vistas).toEqual(['Suscripciones', 'Publicidad', 'Comisiones', 'Cobros']);
      const susc = filas.filter((f) => f['pestana'] === 'Suscripciones').map((f) => f['tipo']);
      expect(susc).toEqual(['KPI', 'KPI', 'Gráfico']);
    });

    it('un indicador sin fórmula ni fuente nunca figura como «Fuente localizada»', () => {
      const sinBase = filas.filter((f) => f['formula'] === null || f['fuente'] === null);
      expect(sinBase.length).toBeGreaterThan(0);
      for (const f of sinBase) {
        expect(f['estado'], String(f['id'])).not.toBe('Fuente localizada');
      }
      const takeRate = filas.find((f) => f['id'] === 'take-rate')!;
      expect(takeRate['estado']).toBe('No existe');
      expect(String(takeRate['definicion'])).toContain('Falta:');
    });

    it('una tasa sin denominador declarado queda con la celda vacía (null), no con un texto inventado', () => {
      const tasa = filas.find((f) => f['id'] === 'tasa-exito')!;
      expect(tasa['denominador']).toBeNull();
      expect(String(tasa['definicion'])).toContain('denominador');
      // un indicador que no es tasa dice «No aplica», que es distinto de «no lo declaró»
      expect(filas.find((f) => f['id'] === 'gasto')!['denominador']).toBe('No aplica');
    });

    it('las decisiones pendientes se reconocen por el mapa de suposiciones', () => {
      expect(filas.find((f) => f['id'] === 'comision-por-actor')!['estado']).toBe('Decisión pendiente');
      expect(filas.find((f) => f['id'] === 'entregas-push')!['estado']).toBe('Decisión pendiente');
      expect(filas.find((f) => f['id'] === 'mrr')!['estado']).toBe('Fuente localizada');
    });

    it('los porcentajes del encabezado salen del recuento del catálogo', () => {
      const completas = filas.filter((f) => f['definicion'] === 'Completa').length;
      const k = kpiDe(tab, 'definicion-completa-pct');
      expect(k.numerador).toBe(completas);
      expect(k.denominador).toBe(filas.length);
      expect(k.valor).toBeCloseTo((completas / filas.length) * 100, 1);
      const localizadas = filas.filter((f) => f['estado'] === 'Fuente localizada').length;
      expect(kpiDe(tab, 'fuente-localizada-pct').numerador).toBe(localizadas);
    });

    it('la pestaña sin indicadores deja su columna de reglas vacía, no en cero', () => {
      const mapa = tab.graficos.find((g) => g.id === 'calidad-mapa-reglas')!;
      if (mapa.datos.tipo !== 'mapa-calor') throw new Error('se esperaba un mapa de calor');
      const col = mapa.datos.columnas.indexOf('Adquisición');
      const deAdquisicion = mapa.datos.celdas.filter((c) => c[0] === col);
      expect(deAdquisicion.length).toBeGreaterThan(0);
      expect(deAdquisicion.every((c) => c[2] === null)).toBe(true);
      // y alguna celda de otra pestaña sí tiene dato
      expect(mapa.datos.celdas.some((c) => c[0] !== col && c[2] !== null)).toBe(true);
    });

    it('las reglas fallan donde los datos lo dicen: tasa sin denominador y cuadre con el mayor', () => {
      const reglas = tab.tablas.find((t) => t.id === 'calidad-reglas')!.filas;
      const resultado = (nombre: string) => reglas.find((r) => r['regla'] === nombre)!['resultado'];
      expect(resultado('Tasas con numerador y denominador')).toBe('Falla');
      expect(resultado('Cuadre con el mayor')).toBe('Falla');
      expect(resultado('Identificadores sin duplicados')).toBe('Pasa');
      expect(kpiDe(tab, 'reglas-en-falla').valor).toBe(reglas.filter((r) => r['resultado'] === 'Falla').length);
    });

    it('los gráficos cumplen el contrato también con datos', () => {
      for (const g of tab.graficos) expect(violacionesDelContrato(g), g.id).toEqual([]);
    });
  });

  describe('filtro por clic en «estado»', () => {
    const sin = construirCalidadDesde(ctx(), FIXTURE);
    const filtro: FiltroActivo = { dimension: 'estado', valor: 'Decisión pendiente' };
    const con = construirCalidadDesde(ctx({ filtros: [filtro] }), FIXTURE);

    it('cambia de verdad los números, la tabla y las reglas', () => {
      const pendientes = filasCatalogo(sin).filter((f) => f['estado'] === 'Decisión pendiente').length;
      expect(pendientes).toBeGreaterThan(0);
      expect(kpiDe(con, 'indicadores-catalogados').valor).toBe(pendientes);
      expect(kpiDe(con, 'indicadores-catalogados').valor).not.toBe(kpiDe(sin, 'indicadores-catalogados').valor);
      expect(filasCatalogo(con).every((f) => f['estado'] === 'Decisión pendiente')).toBe(true);
      expect(JSON.stringify(con.graficos.find((g) => g.id === 'calidad-mapa-reglas'))).not.toBe(
        JSON.stringify(sin.graficos.find((g) => g.id === 'calidad-mapa-reglas')),
      );
    });

    it('los gráficos que originan el filtro siguen mostrando el catálogo entero', () => {
      for (const id of ['calidad-estado-fuente', 'calidad-estado-pestana']) {
        expect(JSON.stringify(con.graficos.find((g) => g.id === id)!.datos)).toBe(
          JSON.stringify(sin.graficos.find((g) => g.id === id)!.datos),
        );
      }
    });

    it('acepta también el código del estado y se hace el sordo ante un valor desconocido', () => {
      const porCodigo = construirCalidadDesde(ctx({ filtros: [{ dimension: 'estado', valor: 'decision-pendiente' }] }), FIXTURE);
      expect(kpiDe(porCodigo, 'indicadores-catalogados').valor).toBe(kpiDe(con, 'indicadores-catalogados').valor);
      const raro = construirCalidadDesde(ctx({ filtros: [{ dimension: 'estado', valor: 'Suscripciones' }] }), FIXTURE);
      expect(kpiDe(raro, 'indicadores-catalogados').valor).toBe(kpiDe(sin, 'indicadores-catalogados').valor);
    });
  });

  describe('«Sin dato» (null ≠ 0)', () => {
    it('sin indicadores la antigüedad media es null con su motivo, no 0', () => {
      const tab = construirCalidadDesde(ctx(), VACIAS);
      const antig = kpiDe(tab, 'antiguedad-media-datos');
      expect(antig.valor).toBeNull();
      expect(antig.motivoSinDato).toBeTruthy();
      for (const id of ['definicion-completa-pct', 'fuente-localizada-pct', 'reglas-en-falla']) {
        const k = kpiDe(tab, id);
        expect(k.valor, id).toBeNull();
        expect(k.motivoSinDato, id).toBeTruthy();
      }
      // el recuento sí es un cero verdadero: hay cero indicadores
      expect(kpiDe(tab, 'indicadores-catalogados').valor).toBe(0);
    });

    it('sin indicadores ningún gráfico inventa un cero y todos explican por qué no hay dato', () => {
      const tab = construirCalidadDesde(ctx(), VACIAS);
      for (const g of tab.graficos) {
        expect(violacionesDelContrato(g), g.id).toEqual([]);
        expect(g.sinDatoMotivo, g.id).toBeTruthy();
      }
      const medidor = tab.graficos.find((g) => g.id === 'calidad-cobertura-definicion')!;
      if (medidor.datos.tipo !== 'medidor') throw new Error('se esperaba un medidor');
      expect(medidor.datos.valor).toBeNull();
      expect(tab.avisos?.some((a) => a.includes('catálogo está vacío'))).toBe(true);
    });

    it('si una pestaña no se puede leer se avisa y las demás se catalogan', () => {
      const tab = construirCalidadDesde(ctx(), { ...FIXTURE, publicidad: null });
      expect(tab.avisos?.some((a) => a.includes('Publicidad'))).toBe(true);
      expect(filasCatalogo(tab).every((f) => f['pestana'] !== 'Publicidad')).toBe(true);
      expect(filasCatalogo(tab).length).toBeGreaterThan(0);
    });
  });
});

import type { ContextoReporte, DimensionFiltro, FiltroActivo } from '../../../data-access/reporting/reporting.types';
import {
  ANUNCIANTES,
  CAMPANAS,
  CIUDADES,
  DIAS_ENTREGA,
  ESTADOS,
  UBICACIONES,
  type Anunciante,
  type Campana,
  type Ciudad,
  type EstadoEntrega,
  type Ubicacion,
} from './publicidad.catalogo';
import {
  filterFactor,
  periodDates,
  granularidad,
  hashTexto,
  serie,
  suma,
} from './reporting-dataset.util';

/* ============================================================================
    Publicidad — modelo de cálculo (EJEMPLO).

    Un solo origen de verdad: se reparte el gasto entre las campañas y de ahí
    salen impresiones, clics, clientes potenciales, citas y valor. Las tarjetas,
    los gráficos y las tablas leen de este modelo, así que NO pueden discrepar.
    Las series diarias dan forma en el tiempo, pero su suma (o su media, en las
    razones) es la del total.

    Un filtro por clic recorta de verdad: campaña, anunciante, estado, ubicación
    y ciudad recortan el reparto; cualquier otro filtro escala el volumen.
    Un gráfico no se filtra a sí mismo (`ignorar`): conserva todas sus barras
    para que se vea cuál está elegida.
    ========================================================================== */

export const CPM_BASE_BOB = 21;
export const CTR_BASE = 0.019;
export const LEAD_BASE = 0.115;
export const LEAD_FORMULARIO = 0.16;
export const CITA_BASE = 0.36;
const GASTO_DIARIO_BASE_BOB = 3200;
const PUBLICO_BASE = 420_000;

export interface FilaCampana {
  readonly indice: number;
  readonly campana: Campana;
  readonly anunciante: Anunciante;
  readonly entrega: boolean;
  readonly gasto: number;
  readonly presupuesto: number | null;
  readonly impresiones: number | null;
  readonly alcance: number | null;
  readonly clics: number | null;
  readonly leads: number | null;
  readonly citas: number | null;
  readonly valor: number | null;
  readonly resultados: number | null;
  readonly tipoResultado: string;
}

export interface Modelo {
  readonly dias: number;
  readonly fechas: readonly string[];
  readonly gran: 'dia' | 'semana' | 'mes';
  readonly filas: readonly FilaCampana[];
  readonly ubicacion: Ubicacion | null;
  readonly ciudad: Ciudad | null;
  /** Escala del alcance (organización y filtros no reconocidos). */
  readonly factorGeneral: number;
  /** Parte del reparto de campañas que sobrevive al recorte (por gasto). */
  readonly fraccionCampanas: number;
  readonly gastoDia: readonly number[];
  readonly gasto: number;
  readonly impresiones: number;
  readonly clics: number;
  readonly alcance: number;
  readonly leads: number | null;
  readonly citas: number | null;
  readonly valor: number | null;
  /** Gasto de las campañas con objetivo «Citas agendadas» (base de CPA y ROAS). */
  readonly gastoCitas: number;
  readonly sinEntrega: boolean;
  /** Series de razón por día; `null` si no hay entrega. */
  readonly cpmDia: readonly number[] | null;
  readonly ctrDia: readonly number[] | null;
  readonly cpaDia: readonly number[] | null;
  readonly roasDia: readonly number[] | null;
  readonly valorDia: readonly number[] | null;
  readonly gastoCitasDia: readonly number[] | null;
}

export function razon(numerador: number | null, denominador: number | null): number | null {
  if (numerador === null || denominador === null || denominador <= 0) {
    return null;
  }
  return numerador / denominador;
}

function normalizar(valores: readonly number[]): number[] {
  const media = suma(valores) / Math.max(1, valores.length);
  return valores.map((v) => (media > 0 ? v / media : 1));
}

function filtroDe(filtros: readonly FiltroActivo[], dimension: DimensionFiltro): string | undefined {
  return [...filtros].reverse().find((f) => f.dimension === dimension)?.valor;
}

function sumaNullable(valores: readonly (number | null)[]): number | null {
  const reales = valores.filter((v): v is number => v !== null);
  return reales.length === 0 ? null : suma(reales);
}

export function calcularModelo(ctx: ContextoReporte, ignorar?: DimensionFiltro): Modelo {
  const filtros = ctx.filtros.filter((f) => f.dimension !== ignorar);
  const vCampana = filtroDe(filtros, 'campana');
  const vAnunciante = filtroDe(filtros, 'anunciante');
  const vEstado = filtroDe(filtros, 'estado');
  const vCanal = filtroDe(filtros, 'canal');
  const vCiudad = filtroDe(filtros, 'ciudad');

  const idxCampana = vCampana === undefined ? -1 : CAMPANAS.findIndex((c) => c.nombre === vCampana);
  const idxAnunciante = vAnunciante === undefined ? -1 : ANUNCIANTES.findIndex((a) => a.nombre === vAnunciante);
  const estado = ESTADOS.find((e) => e === vEstado) as EstadoEntrega | undefined;
  const ubicacion = UBICACIONES.find((u) => u.nombre === vCanal) ?? null;
  const ciudad = CIUDADES.find((c) => c.nombre === vCiudad) ?? null;

  // Filtros que no recortan el reparto de campañas: escalan el volumen.
  const reconocido = (f: FiltroActivo): boolean =>
    (f.dimension === 'campana' && idxCampana >= 0) ||
    (f.dimension === 'anunciante' && idxAnunciante >= 0) ||
    (f.dimension === 'estado' && estado !== undefined) ||
    (f.dimension === 'canal' && ubicacion !== null) ||
    (f.dimension === 'ciudad' && ciudad !== null);
  let factorGeneral = ctx.alcance === 'organizacion' ? 0.22 : 1;
  for (const f of filtros) {
    if (!reconocido(f)) {
      factorGeneral *= filterFactor(f);
    }
  }

  const fechas = periodDates(ctx.periodo);
  const dias = fechas.length;
  const gran = granularidad(ctx.periodo);

  const pesos = CAMPANAS.map((c) => c.peso * DIAS_ENTREGA[c.estado]);
  const pesoTotal = suma(pesos);
  const retenida = (c: Campana, i: number): boolean =>
    (idxCampana < 0 || i === idxCampana) &&
    (idxAnunciante < 0 || c.anunciante === idxAnunciante) &&
    (estado === undefined || c.estado === estado);
  const fraccionCampanas = suma(pesos.filter((_, i) => retenida(CAMPANAS[i]!, i))) / pesoTotal;
  const fCanal = ubicacion?.parte ?? 1;
  const fCiudad = ciudad?.parte ?? 1;
  const escalaGasto = factorGeneral * fCanal * fCiudad;

  const crudo = serie(hashTexto('pub:gasto'), dias, GASTO_DIARIO_BASE_BOB, 14, 5);
  const gastoBase = suma(crudo);
  const publico = PUBLICO_BASE * dias ** 0.45 * factorGeneral * fCiudad * Math.sqrt(Math.max(fraccionCampanas * fCanal, 1e-9));
  const sesgoUbic = { cpm: ubicacion?.sesgoCpm ?? 1, ctr: ubicacion?.sesgoCtr ?? 1, lead: ubicacion?.sesgoLead ?? 1 };

  const filas: FilaCampana[] = [];
  CAMPANAS.forEach((c, i) => {
    if (!retenida(c, i)) {
      return;
    }
    const gasto = gastoBase * escalaGasto * (pesos[i]! / pesoTotal);
    const entrega = gasto > 0;
    const anunciante = ANUNCIANTES[c.anunciante]!;
    const sinDatos = {
      presupuesto: null, impresiones: null, alcance: null, clics: null, leads: null, citas: null, valor: null, resultados: null,
    };
    const tipoResultado = c.objetivo === 'Alcance' ? 'Personas alcanzadas' : c.objetivo;
    if (!entrega) {
      filas.push({ indice: i, campana: c, anunciante, entrega, gasto: 0, tipoResultado, ...sinDatos });
      return;
    }
    const impresiones = (gasto / (CPM_BASE_BOB * c.sesgoCpm * sesgoUbic.cpm)) * 1000;
    const clics = impresiones * CTR_BASE * c.sesgoCtr * sesgoUbic.ctr;
    const tasaLead = (c.objetivo === 'Clientes potenciales' ? LEAD_FORMULARIO : LEAD_BASE) * c.sesgoLead * sesgoUbic.lead;
    const leads = c.objetivo === 'Alcance' ? null : clics * tasaLead;
    const citas = c.objetivo === 'Citas agendadas' && leads !== null ? leads * CITA_BASE * c.sesgoCita : null;
    const alcance = publico * (1 - Math.exp(-impresiones / publico));
    const resultados = c.objetivo === 'Alcance' ? alcance : c.objetivo === 'Citas agendadas' ? citas : leads;
    filas.push({
      indice: i,
      campana: c,
      anunciante,
      entrega,
      gasto,
      presupuesto: c.pacing === null ? null : gasto / c.pacing,
      impresiones,
      alcance,
      clics,
      leads,
      citas,
      valor: citas === null ? null : citas * c.valorCitaBob,
      resultados,
      tipoResultado,
    });
  });

  const gasto = suma(filas.map((f) => f.gasto));
  const impresiones = suma(filas.map((f) => f.impresiones));
  const clics = suma(filas.map((f) => f.clics));
  const leads = sumaNullable(filas.map((f) => f.leads));
  const citas = sumaNullable(filas.map((f) => f.citas));
  const valor = sumaNullable(filas.map((f) => f.valor));
  const gastoCitas = suma(filas.filter((f) => f.citas !== null).map((f) => f.gasto));
  const alcance = impresiones > 0 ? publico * (1 - Math.exp(-impresiones / publico)) : 0;
  const sinEntrega = gasto <= 0;

  const gastoDia = crudo.map((g) => g * escalaGasto * fraccionCampanas);
  let cpmDia: number[] | null = null;
  let ctrDia: number[] | null = null;
  let cpaDia: number[] | null = null;
  let roasDia: number[] | null = null;
  let valorDia: number[] | null = null;
  let gastoCitasDia: number[] | null = null;
  if (!sinEntrega) {
    const cpm = (gasto / impresiones) * 1000;
    cpmDia = normalizar(serie(hashTexto('pub:cpm'), dias, 1, -6, 3)).map((s) => cpm * s);
    ctrDia = normalizar(serie(hashTexto('pub:ctr'), dias, 1, 8, 3)).map((s) => (clics / impresiones) * 100 * s);
    if (citas !== null && valor !== null && gastoCitas > 0 && citas > 0) {
      const fraccionCitas = gastoCitas / gasto;
      gastoCitasDia = gastoDia.map((g) => g * fraccionCitas);
      const forma = normalizar(serie(hashTexto('pub:roas'), dias, 1, 4, 5));
      const pesosValor = gastoCitasDia.map((g, i) => g * forma[i]!);
      const totalPesos = suma(pesosValor);
      valorDia = pesosValor.map((p) => (valor * p) / totalPesos);
      roasDia = valorDia.map((v, i) => v / gastoCitasDia![i]!);
      const formaCpa = normalizar(serie(hashTexto('pub:cpa'), dias, 1, -4, 5));
      cpaDia = formaCpa.map((s) => (gastoCitas / citas) * s);
    }
  }

  return {
    dias, fechas, gran, filas, ubicacion, ciudad, factorGeneral, fraccionCampanas,
    gastoDia, gasto, impresiones, clics, alcance, leads, citas, valor, gastoCitas, sinEntrega,
    cpmDia, ctrDia, cpaDia, roasDia, valorDia, gastoCitasDia,
  };
}

/** Anunciantes con gasto, en el orden del catálogo. */
export function anunciantesConGasto(m: Modelo): { nombre: string; gasto: number }[] {
  return ANUNCIANTES.map((a, i) => ({
    nombre: a.nombre,
    gasto: suma(m.filas.filter((f) => f.campana.anunciante === i).map((f) => f.gasto)),
  })).filter((a) => a.gasto > 0);
}

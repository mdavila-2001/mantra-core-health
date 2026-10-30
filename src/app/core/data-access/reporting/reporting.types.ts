/* ============================================================================
    Contrato del portal de reportería (MAQUETA).

    Lo que viaja entre la pantalla y el servidor. En la rama de maqueta lo sirve
    `core/mock/handlers/reporting.handlers.ts` con datos de EJEMPLO; cuando
    exista `POST /reporting/query` (hitos H0–H2 del plan) se cambia el manejador
    por la API real y estos tipos son el contrato a cumplir.

    Reglas que el tipo hace imposibles de olvidar:
      · `null` ≠ `0`: un valor sin dato es `null` y se dice «Sin dato».
      · Todo importe lleva su moneda; no se suman monedas distintas.
      · Todo gráfico declara, por escrito, por qué NO tiene filtro, información
        o velas cuando no los tiene.
    ========================================================================== */

export type Moneda = 'BOB' | 'USD';

export type UnidadValor =
  | { readonly tipo: 'moneda'; readonly moneda: Moneda }
  | { readonly tipo: 'numero' }
  | { readonly tipo: 'porcentaje' }
  | { readonly tipo: 'razon'; readonly sufijo: string };

/** Cuánto se parece este número a uno real. En la maqueta siempre `ejemplo`. */
export type OrigenDato = 'ejemplo' | 'api';

/* ---- información de «cómo se calcula» --------------------------------------- */

export interface InfoCalculo {
  readonly definicion: string;
  readonly formula: string;
  readonly numerador?: string;
  readonly denominador?: string;
  readonly fuente: string;
  readonly frescura: string;
  readonly salvedades?: readonly string[];
}

/* ---- filtro por clic --------------------------------------------------------- */

/** Dimensiones por las que un clic en un gráfico puede filtrar el resto. */
export type DimensionFiltro =
  | 'plan'
  | 'especialidad'
  | 'ciudad'
  | 'organizacion'
  | 'campana'
  | 'anunciante'
  | 'actor'
  | 'canal'
  | 'metodo-pago'
  | 'estado'
  | 'mes';

export interface FiltroActivo {
  readonly dimension: DimensionFiltro;
  readonly valor: string;
}

export interface ConfigFiltro {
  readonly dimension: DimensionFiltro;
}

/* ---- velas -------------------------------------------------------------------- */

export interface Vela {
  readonly fecha: string;
  readonly apertura: number;
  readonly cierre: number;
  readonly minimo: number;
  readonly maximo: number;
}

export interface ConfigVelas {
  /** Qué representa cada vela, p. ej. «MRR diario: apertura, máximo, mínimo y cierre del día». */
  readonly explicacion: string;
  readonly velas: readonly Vela[];
  /** Cuando subir es malo (churn, mora): el color de la vela se invierte, el relleno no. */
  readonly subirEsMalo?: boolean;
}

/* ---- datos ---------------------------------------------------------------------- */

export type FormaSerie = 'linea' | 'barra' | 'area';

export interface SerieCartesiana {
  readonly nombre: string;
  readonly valores: readonly (number | null)[];
  readonly forma: FormaSerie;
  /** Series con el mismo grupo se apilan. */
  readonly apilar?: string;
  readonly unidad?: UnidadValor;
}

/* Sin eje doble: dos magnitudes de escala distinta son DOS gráficos (skill dataviz, regla 1). */
export type DatosGrafico =
  | {
      readonly tipo: 'cartesiano';
      readonly categorias: readonly string[];
      readonly series: readonly SerieCartesiana[];
      readonly horizontal?: boolean;
    }
  | {
      readonly tipo: 'partes';
      readonly forma: 'dona' | 'embudo';
      readonly partes: readonly { readonly nombre: string; readonly valor: number | null }[];
    }
  | {
      readonly tipo: 'mapa-calor';
      readonly filas: readonly string[];
      readonly columnas: readonly string[];
      /** `[columna, fila, valor]`; `null` = sin dato (no es cero). */
      readonly celdas: readonly (readonly [number, number, number | null])[];
      readonly nombreValor: string;
    }
  | {
      readonly tipo: 'medidor';
      readonly nombre: string;
      readonly valor: number | null;
      readonly minimo: number;
      readonly maximo: number;
      readonly objetivo?: number;
    }
  | {
      readonly tipo: 'cascada';
      readonly pasos: readonly {
        readonly nombre: string;
        readonly valor: number;
        readonly total?: boolean;
      }[];
    };

export interface ChartSpec {
  readonly id: string;
  /** 1) Título. Obligatorio. */
  readonly titulo: string;
  readonly subtitulo?: string;
  readonly unidad: UnidadValor;
  /** 2) Gráfico. */
  readonly datos: DatosGrafico;
  /** Frase para lector de pantalla: qué muestra y cuál es la conclusión. */
  readonly resumenAccesible: string;
  /** 5) Filtro por clic, o `null` + motivo. */
  readonly filtro: ConfigFiltro | null;
  readonly filtroMotivo?: string;
  /** 6) Cómo se calcula, o `null` + motivo. */
  readonly info: InfoCalculo | null;
  readonly infoMotivo?: string;
  /** 7) Versión en velas, o `null` + motivo. */
  readonly velas: ConfigVelas | null;
  readonly velasMotivo?: string;
  /** Alto del lienzo en px (por defecto 300). */
  readonly alto?: number;
  /** `completo` ocupa todo el ancho de la cuadrícula; por defecto, media columna. */
  readonly ancho?: 'completo' | 'medio';
  /** Texto de «sin dato» cuando ninguna serie trae valores. */
  readonly sinDatoMotivo?: string;
}

/* ---- KPI (tarjeta) -------------------------------------------------------------- */

export interface KpiSpec {
  readonly id: string;
  readonly titulo: string;
  /** `null` = sin dato; nunca se dibuja como 0. */
  readonly valor: number | null;
  readonly unidad: UnidadValor;
  /** Variación contra el periodo de comparación, en %; `null` si no se puede calcular. */
  readonly variacionPct: number | null;
  /** Cuando subir es malo (churn, mora). */
  readonly subirEsMalo?: boolean;
  readonly numerador?: number | null;
  readonly denominador?: number | null;
  readonly motivoSinDato?: string;
  readonly info: InfoCalculo | null;
  readonly infoMotivo?: string;
  /** Mini-serie para la línea de tendencia. */
  readonly tendencia?: readonly (number | null)[];
}

/* ---- catálogo de reportes (el grid) ---------------------------------------------- */

export type VerticalReporte =
  | 'resumen'
  | 'suscripciones'
  | 'publicidad'
  | 'comisiones'
  | 'cobros'
  | 'adquisicion'
  | 'calidad';

export interface ReporteCatalogo {
  readonly id: string;
  readonly nombre: string;
  readonly vertical: VerticalReporte;
  readonly descripcion: string;
  readonly responsable: string;
  readonly certificado: boolean;
  /** Frescura en minutos desde la última carga. */
  readonly frescuraMin: number;
  readonly ruta: string;
  /** Módulo aún no cerrado (publicidad se modela como Meta Ads). */
  readonly enDiseno?: boolean;
}

/* ---- contexto de consulta ---------------------------------------------------------- */

export type AlcanceReporte = 'plataforma' | 'organizacion';
export type ComparacionReporte = 'ninguna' | 'periodo-anterior' | 'mismo-periodo-ano-anterior';
export type PeriodoReporte = '7d' | '30d' | '90d' | 'ytd' | '12m';

export interface ContextoReporte {
  readonly periodo: PeriodoReporte;
  readonly comparar: ComparacionReporte;
  readonly moneda: Moneda;
  readonly alcance: AlcanceReporte;
  readonly filtros: readonly FiltroActivo[];
}

/** Lo que devuelve una pestaña del dashboard comercial. */
export interface PestanaReporte {
  readonly pestana: VerticalReporte;
  readonly generadoEn: string;
  readonly origen: OrigenDato;
  readonly kpis: readonly KpiSpec[];
  readonly graficos: readonly ChartSpec[];
  /** Tablas de detalle (ranking, aging…) con el mismo rigor de null ≠ 0. */
  readonly tablas: readonly TablaReporte[];
  readonly avisos?: readonly string[];
  /** Orden y títulos de las secciones; si falta, KPIs → gráficos → tablas. */
  readonly secciones?: readonly { readonly titulo: string; readonly descripcion?: string; readonly graficos?: readonly string[]; readonly tablas?: readonly string[] }[];
}

export interface TablaReporte {
  readonly id: string;
  readonly titulo: string;
  readonly columnas: readonly { readonly clave: string; readonly etiqueta: string; readonly alinear?: 'der' }[];
  readonly filas: readonly Readonly<Record<string, string | number | null>>[];
  readonly info: InfoCalculo | null;
  readonly infoMotivo?: string;
}

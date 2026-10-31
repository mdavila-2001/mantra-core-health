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
  | { readonly tipo: 'razon'; readonly sufijo: string }
  /** Milisegundos: se lee «850 ms», «1,2 s» o «2,5 min» según su tamaño. */
  | { readonly tipo: 'duracion' };

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
  | 'mes'
  // Observabilidad del sistema: se filtra por la operación, la parte de la app o el código de error.
  | 'endpoint'
  | 'pantalla'
  | 'funcionalidad'
  | 'dominio'
  | 'codigo'
  | 'metodo'
  | 'modulo'
  | 'hora';

export interface FiltroActivo {
  readonly dimension: DimensionFiltro;
  readonly valor: string;
}

export interface ConfigFiltro {
  readonly dimension: DimensionFiltro;
  /**
   * Qué valor de la dimensión representa un clic. Por omisión, la categoría del eje (la barra
   * «Pro» filtra el plan Pro). Cuando el eje es el tiempo y la dimensión son las SERIES (ingreso
   * por día apilado por plan), el clic debe filtrar por la serie: filtrar «plan = 2026-10-01»
   * no significa nada.
   */
  readonly valorDe?: 'categoria' | 'serie';
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

/** Qué significa el color de una serie: identidad (categórica), orden (ordinal) o estado (bueno/aviso/error). */
export type PaletaGrafico = 'categorica' | 'ordinal' | 'estado';
export type RolSerie = 'exito' | 'aviso' | 'error';

export interface SerieCartesiana {
  readonly nombre: string;
  readonly valores: readonly (number | null)[];
  readonly forma: FormaSerie;
  /** Series con el mismo grupo se apilan. */
  readonly apilar?: string;
  readonly unidad?: UnidadValor;
  /** Obligatorio cuando el gráfico declara `paleta: 'estado'`: el color lo da el significado, no la posición. */
  readonly rol?: RolSerie;
}

/** Línea de objetivo (umbral de un SLO): sólida, en color de aviso, con su rótulo. */
export interface ObjetivoGrafico {
  readonly valor: number;
  readonly etiqueta: string;
}

/** Un hecho puntual sobre el eje del tiempo (despliegue, incidente). `en` es una de las categorías. */
export interface AnotacionGrafico {
  readonly en: string;
  readonly etiqueta: string;
}

/* Sin eje doble: dos magnitudes de escala distinta son DOS gráficos (skill dataviz, regla 1). */
export type DatosGrafico =
  | {
      readonly tipo: 'cartesiano';
      readonly categorias: readonly string[];
      readonly series: readonly SerieCartesiana[];
      readonly horizontal?: boolean;
      /** Por defecto `categorica`. `estado` exige un `rol` en cada serie; `ordinal` pinta p50 < p95 < p99 con una rampa. */
      readonly paleta?: PaletaGrafico;
      /** Nombre de la categoría o serie destacada: lleva el acento y las demás se atenúan (nunca se recolorean). */
      readonly enfasis?: string;
      readonly objetivo?: ObjetivoGrafico;
      readonly anotaciones?: readonly AnotacionGrafico[];
    }
  | {
      /**
       * Distribución de una magnitud en cubos contiguos: `bordes` tiene un elemento más que `conteos`
       * (el cubo i es `[bordes[i], bordes[i+1])`). `null` = sin dato (no es cero). El último borde puede ser
       * `null` = «sin tope» (el cubo «≥ último corte»).
       */
      readonly tipo: 'histograma';
      readonly bordes: readonly (number | null)[];
      readonly conteos: readonly (number | null)[];
      /** Unidad de los bordes (p. ej. duración en ms); la del conteo es `spec.unidad`. */
      readonly unidadBorde: UnidadValor;
      readonly nombreValor: string;
      /**
       * De qué lado se cierra cada cubo. `izquierda` (por omisión): `[a, b)`. `derecha`: `(a, b]`, que es lo que
       * publican los histogramas acumulados «menos o igual a» (`le`): leer `≥ a` ahí contaría mal el límite.
       */
      readonly cerrado?: 'izquierda' | 'derecha';
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
  /**
   * Unidad de cada lado del «N de M». Sin ella se asume la del KPI si es un importe y «número»
   * si no; pero una tasa de importes (ROAS, take rate) o un costo por unidad (CPM = Bs ÷ impresiones)
   * necesitan decir qué es cada lado, o se leen impresiones como bolivianos.
   */
  readonly unidadNumerador?: UnidadValor;
  readonly unidadDenominador?: UnidadValor;
  readonly motivoSinDato?: string;
  readonly info: InfoCalculo | null;
  readonly infoMotivo?: string;
  /** Mini-serie para la línea de tendencia. */
  readonly tendencia?: readonly (number | null)[];
  /** Veredicto del indicador. Siempre se dice con icono y palabra; el color sólo refuerza. */
  readonly estado?: EstadoKpi;
  /** Texto antes de la cifra cuando es una cota («≥ » en un percentil que cayó en el último corte del histograma). */
  readonly prefijo?: string;
  /** `hero`: la cifra grande de la vista (una sola por pantalla). */
  readonly variante?: 'normal' | 'hero';
}

export type EstadoKpi = 'bueno' | 'aviso' | 'serio' | 'critico';

/* ---- catálogo de reportes (el grid) ---------------------------------------------- */

export type VerticalReporte =
  | 'resumen'
  | 'suscripciones'
  | 'publicidad'
  | 'comisiones'
  | 'cobros'
  | 'adquisicion'
  | 'calidad';

/** Dónde se agrupa un reporte en el grid: una vertical del dashboard comercial o «existentes» (pantallas que ya tiene la aplicación). */
export type CategoriaReporte = VerticalReporte | 'existentes';

export interface ReporteCatalogo {
  readonly id: string;
  readonly nombre: string;
  readonly vertical: CategoriaReporte;
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
  readonly columnas: readonly {
    readonly clave: string;
    readonly etiqueta: string;
    readonly alinear?: 'der';
    /** Si viene, los valores numéricos de la columna se formatean con ella y se ordenan como número. */
    readonly unidad?: UnidadValor;
  }[];
  readonly filas: readonly Readonly<Record<string, string | number | null>>[];
  readonly info: InfoCalculo | null;
  readonly infoMotivo?: string;
}

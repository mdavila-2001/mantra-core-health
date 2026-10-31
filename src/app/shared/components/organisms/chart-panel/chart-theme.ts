/* ============================================================================
    Tema de los gráficos: lee en ejecución los tokens del sistema de diseño.
    Ningún color se escribe a mano (regla 95.1.5): ECharts no entiende `var()`,
    así que se resuelven con `getComputedStyle` y el panel reconstruye las
    opciones cuando cambia el tema.
    ========================================================================== */

export interface ChartTheme {
  readonly serie: readonly string[];
  readonly texto: string;
  readonly textoSuave: string;
  readonly linea: string;
  readonly rejilla: string;
  readonly fondoTooltip: string;
  readonly bordeTooltip: string;
  readonly bueno: string;
  readonly malo: string;
  /** Aviso (`--st-warning-fg`): línea de objetivo y 4xx. Opcional para no romper a quien arma el tema a mano. */
  readonly aviso?: string;
  /** Rellenos de estado para series que SIGNIFICAN bueno/aviso/error (`--st-*-fg`: contraste ≥ 3:1 con la superficie en ambos temas). */
  readonly estado?: { readonly exito: string; readonly aviso: string; readonly error: string };
  /** Tinta de lo que se atenúa (`--text-muted`): lo que no es el énfasis. */
  readonly atenuado?: string;
  readonly superficie: string;
  readonly rampa: readonly string[];
  /**
   * Ordinal de 4 pasos (`--chart-ord-1..4` = `--chart-seq-2..5`): etapas de embudo,
   * cubos de latencia, niveles. Opcional para no romper a quien arma el tema a mano.
   */
  readonly ordinal?: readonly string[];
  /** Divergente de 5 puntos, del polo frío al cálido, con el neutro al medio. */
  readonly divergente?: readonly string[];
  /** Familia tipográfica real de la página: ECharts mide el texto con ella para ubicar leyendas y ejes. */
  readonly fuente: string;
}

/** Paleta categórica en orden FIJO (validada, ADR-0017); cambia por tema en `styles.css`. */
export const SERIE_TOKENS = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--chart-6',
  '--chart-7',
  '--chart-8',
] as const;

export const RAMPA_TOKENS = [
  '--chart-seq-1',
  '--chart-seq-2',
  '--chart-seq-3',
  '--chart-seq-4',
  '--chart-seq-5',
] as const;

/** Ordinal validado con `--ordinal` en claro y oscuro (scripts/check-chart-palette.mjs). */
export const ORDINAL_TOKENS = [
  '--chart-ord-1',
  '--chart-ord-2',
  '--chart-ord-3',
  '--chart-ord-4',
] as const;

/** Divergente: polo frío → neutro (`--bg-surface-alt`) → polo cálido. */
export const DIVERGENTE_TOKENS = [
  '--chart-div-neg',
  '--chart-div-neg-soft',
  '--chart-div-mid',
  '--chart-div-pos-soft',
  '--chart-div-pos',
] as const;

function leer(estilo: CSSStyleDeclaration, token: string, respaldo: string): string {
  const v = estilo.getPropertyValue(token).trim();
  return v === '' ? respaldo : v;
}

export function leerTemaGraficos(): ChartTheme {
  const estilo = getComputedStyle(document.documentElement);
  return {
    serie: SERIE_TOKENS.map((t) => leer(estilo, t, 'currentColor')),
    texto: leer(estilo, '--text-primary', 'currentColor'),
    textoSuave: leer(estilo, '--text-secondary', 'currentColor'),
    linea: leer(estilo, '--border-strong', 'currentColor'),
    rejilla: leer(estilo, '--border-default', 'currentColor'),
    fondoTooltip: leer(estilo, '--bg-surface', 'Canvas'),
    bordeTooltip: leer(estilo, '--border-strong', 'currentColor'),
    bueno: leer(estilo, '--st-success-fg', 'currentColor'),
    malo: leer(estilo, '--st-error-fg', 'currentColor'),
    aviso: leer(estilo, '--st-warning-fg', 'currentColor'),
    estado: {
      exito: leer(estilo, '--st-success-fg', 'currentColor'),
      aviso: leer(estilo, '--st-warning-fg', 'currentColor'),
      error: leer(estilo, '--st-error-fg', 'currentColor'),
    },
    atenuado: leer(estilo, '--text-muted', 'currentColor'),
    superficie: leer(estilo, '--bg-surface', 'Canvas'),
    rampa: RAMPA_TOKENS.map((t) => leer(estilo, t, 'currentColor')),
    ordinal: ORDINAL_TOKENS.map((t) => leer(estilo, t, 'currentColor')),
    divergente: DIVERGENTE_TOKENS.map((t) => leer(estilo, t, 'currentColor')),
    fuente: getComputedStyle(document.body).fontFamily || 'sans-serif',
  };
}

import type { ChartSpec, SerieCartesiana, UnidadValor } from '@core/data-access/reporting/reporting.types';
import type { ChartTheme } from './chart-theme';

/* ============================================================================
    Traduce un `ChartSpec` a las opciones de Apache ECharts, cumpliendo el
    contrato: leyenda y tooltip SIEMPRE presentes, `null` como «Sin dato», y el
    elemento elegido por un filtro resaltado.
    ========================================================================== */

export type ModoGrafico = 'normal' | 'velas';

export interface OpcionesBuild {
  readonly spec: ChartSpec;
  readonly tema: ChartTheme;
  readonly modo: ModoGrafico;
  /** Valor del elemento filtrado (nombre de categoría/parte), si lo hay. */
  readonly seleccion: string | null;
  /**
   * Ancho real del lienzo en px, leído en el momento de dibujar. ECharts NO reemplaza una función con la de un
   * `media` (las fusiona), así que lo que depende del ancho y es una función —como el `formatter` de un rótulo—
   * tiene que preguntarlo aquí. Sin él se asume un lienzo ancho.
   */
  readonly anchoLienzo?: () => number;
}

/** Hasta este ancho (px) un lienzo se trata como el de un teléfono. */
export const LIENZO_ANGOSTO = 520;

export function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function prefersMoreContrast(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(prefers-contrast: more)').matches || window.matchMedia('(forced-colors: active)').matches)
  );
}

export function base(tema: ChartTheme): Record<string, unknown> {
  return {
    backgroundColor: 'transparent',
    color: tema.serie,
    textStyle: { color: tema.texto, fontFamily: tema.fuente },
    // Los patrones de relleno son para quien pide más contraste (ADR-0017): por defecto
    // ensucian marcas pequeñas y las etiquetas; la leyenda, el tooltip y la tabla ya llevan la identidad.
    aria: { enabled: true, decal: { show: prefersMoreContrast() } },
    animation: !(typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches),
  };
}

export function leyenda(tema: ChartTheme, nombres?: readonly string[]): Record<string, unknown> {
  return {
    show: true,
    type: 'plain',
    bottom: 0,
    left: 'center',
    width: '92%',
    itemGap: 14,
    textStyle: { color: tema.texto, fontSize: 12 },
    ...(nombres === undefined ? {} : { data: nombres }),
  };
}

export function tooltipBase(tema: ChartTheme): Record<string, unknown> {
  return {
    confine: true,
    appendToBody: false,
    backgroundColor: tema.fondoTooltip,
    borderColor: tema.bordeTooltip,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: tema.texto, fontSize: 12 },
    extraCssText: 'box-shadow: var(--shadow-md);',
  };
}

export interface ParamEje {
  readonly marker?: string;
  readonly seriesName?: string;
  readonly axisValueLabel?: string;
  readonly name?: string;
  readonly value?: unknown;
  readonly data?: unknown;
}

const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null);

export function readValue(p: ParamEje): number | null {
  if (Array.isArray(p.value)) {
    return num(p.value[p.value.length - 1]);
  }
  if (p.data !== null && typeof p.data === 'object' && 'value' in (p.data as object)) {
    return num((p.data as { value: unknown }).value);
  }
  return num(p.value);
}

export function unitOf(serie: SerieCartesiana | undefined, general: UnidadValor): UnidadValor {
  return serie?.unidad ?? general;
}

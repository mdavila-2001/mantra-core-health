/* ============================================================================
    Cómo se lee un valor contra su rango de referencia.

    Lo usan el panel (para marcar la fila) y las alertas (para avisar). Está en
    un solo lugar para que «fuera de rango» signifique lo mismo en los dos.

    La regla: la **interpretación del laboratorio manda**. El rango que llega
    acá es el impreso, y el laboratorio puede haber usado otro por edad, sexo o
    método. Sólo cuando no hay interpretación se compara el número.
    ========================================================================== */

import type { InterpretacionDeValor, RangoDeReferencia, ValorDeResultado } from './red-clinica.types';

/** Dónde cae el valor. `sin-referencia` = no hay con qué compararlo. */
export type LecturaDeValor =
  | 'normal'
  | 'bajo'
  | 'alto'
  | 'critico-bajo'
  | 'critico-alto'
  | 'critico'
  | 'anormal'
  | 'sin-referencia';

/** Lo que se lee en pantalla junto al valor: el color nunca va solo. */
export const TEXTO_DE_LECTURA: Readonly<Record<LecturaDeValor, string>> = {
  normal: 'Dentro del rango',
  bajo: 'Bajo',
  alto: 'Alto',
  'critico-bajo': 'Crítico bajo',
  'critico-alto': 'Crítico alto',
  critico: 'Crítico',
  anormal: 'Anormal',
  'sin-referencia': 'Sin rango de referencia',
};

/** El símbolo que acompaña al texto, para leer la tabla de un vistazo. */
export const SIMBOLO_DE_LECTURA: Readonly<Record<LecturaDeValor, string>> = {
  normal: '',
  bajo: '↓',
  alto: '↑',
  'critico-bajo': '↓↓',
  'critico-alto': '↑↑',
  critico: '!!',
  anormal: '!',
  'sin-referencia': '',
};

function numero(valor: number | string): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  // Sólo un número entero escrito como número: «12,5» o «12.5». «<5» o
  // «Positivo» no se comparan — se respetan como texto.
  const limpio = valor.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return null;
  return Number(limpio);
}

function desdeInterpretacion(interpretacion: InterpretacionDeValor): LecturaDeValor {
  return interpretacion;
}

/**
 * Lee un valor. Interpretación del laboratorio primero; si no hay, compara el
 * número con los límites numéricos del rango.
 */
export function leerValor(valor: ValorDeResultado): LecturaDeValor {
  if (valor.interpretacion !== undefined) return desdeInterpretacion(valor.interpretacion);
  const n = numero(valor.valor);
  const rango = valor.rango;
  if (n === null || rango === undefined) return 'sin-referencia';
  if (rango.bajo === undefined && rango.alto === undefined) return 'sin-referencia';
  if (rango.bajo !== undefined && n < rango.bajo) return 'bajo';
  if (rango.alto !== undefined && n > rango.alto) return 'alto';
  return 'normal';
}

/** `true` si el valor está fuera de rango o el laboratorio lo marcó anormal. */
export function estaFueraDeRango(valor: ValorDeResultado): boolean {
  const lectura = leerValor(valor);
  return lectura !== 'normal' && lectura !== 'sin-referencia';
}

/** `true` si el valor es crítico (sólo por interpretación del laboratorio). */
export function esCritico(valor: ValorDeResultado): boolean {
  const lectura = leerValor(valor);
  return lectura === 'critico-bajo' || lectura === 'critico-alto' || lectura === 'critico';
}

/** El rango como se imprime: «70 – 110», «≥ 40», «≤ 200», o su texto. */
export function textoDelRango(rango: RangoDeReferencia | undefined, unidad?: string): string {
  if (rango === undefined) return '—';
  const sufijo = unidad ? ` ${unidad}` : '';
  if (rango.bajo !== undefined && rango.alto !== undefined) {
    return `${formatear(rango.bajo)} – ${formatear(rango.alto)}${sufijo}`;
  }
  if (rango.bajo !== undefined) return `≥ ${formatear(rango.bajo)}${sufijo}`;
  if (rango.alto !== undefined) return `≤ ${formatear(rango.alto)}${sufijo}`;
  return rango.texto ?? '—';
}

function formatear(n: number): string {
  return n.toLocaleString('es-BO', { maximumFractionDigits: 3 });
}

/** El valor como se lee: número con coma decimal local, o el texto tal cual. */
export function textoDelValor(valor: ValorDeResultado): string {
  const base = typeof valor.valor === 'number' ? formatear(valor.valor) : valor.valor;
  return valor.unidad ? `${base} ${valor.unidad}` : base;
}

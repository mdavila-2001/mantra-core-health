/* ============================================================================
    How a value reads against its reference range.

    Used by the panel (to mark the row) and the alerts (to warn). It lives in
    one place so that «fuera de rango» means the same in both.

    The rule: the **lab's interpretation rules**. The range arriving here is
    the printed one, and the lab may have used another by age, sex or method.
    Only when there is no interpretation is the number compared.
    ========================================================================== */

import type { InterpretacionDeValor, RangoDeReferencia, ValorDeResultado } from './red-clinica.types';

/** Where the value falls. `sin-referencia` = nothing to compare it with. */
export type LecturaDeValor =
  | 'normal'
  | 'bajo'
  | 'alto'
  | 'critico-bajo'
  | 'critico-alto'
  | 'critico'
  | 'anormal'
  | 'sin-referencia';

/** What reads on screen next to the value: color never goes alone. */
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

/** The symbol next to the text, to read the table at a glance. */
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
  // Only a whole number written as a number: «12,5» or «12.5». «<5» or
  // «Positivo» are not compared — they are respected as text.
  const limpio = valor.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return null;
  return Number(limpio);
}

function desdeInterpretacion(interpretacion: InterpretacionDeValor): LecturaDeValor {
  return interpretacion;
}

/**
 * Reads a value. The lab's interpretation first; if none, compares the
 * number with the range's numeric limits.
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

/** `true` if the value is out of range or the lab marked it abnormal. */
export function estaFueraDeRango(valor: ValorDeResultado): boolean {
  const lectura = leerValor(valor);
  return lectura !== 'normal' && lectura !== 'sin-referencia';
}

/** `true` if the value is critical (only by the lab's interpretation). */
export function esCritico(valor: ValorDeResultado): boolean {
  const lectura = leerValor(valor);
  return lectura === 'critico-bajo' || lectura === 'critico-alto' || lectura === 'critico';
}

/** The range as printed: «70 – 110», «≥ 40», «≤ 200», or its text. */
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

/** The value as it reads: number with the local decimal comma, or the text as is. */
export function textoDelValor(valor: ValorDeResultado): string {
  const base = typeof valor.valor === 'number' ? formatear(valor.valor) : valor.valor;
  return valor.unidad ? `${base} ${valor.unidad}` : base;
}

import type { BadgeVariant } from '../../components/atoms/badge/badge.types';

/**
 * **Cómo se dice un vencimiento**, compartido por las fichas que muestran
 * documentos legales con fecha de caducidad.
 *
 * ## Por qué existe una segunda copia de esta regla, y cuándo se consolida
 *
 * La misma regla —las cinco frases, los cuatro tonos y el umbral de aviso—
 * vive **privada** dentro del componente de organización médica
 * (`features/admin/medical-organization`). Sacarla de ahí y reapuntar a ese
 * componente tiene dos costos que hoy no se pueden pagar: hay una rama abierta
 * modificando ese archivo, y su prueba asevera contra esos métodos privados,
 * así que moverlos rompe diez aserciones ajenas.
 *
 * Se duplica una sola vez y con fecha: **2026-09-10**. Cuando esa rama cierre,
 * el componente de organización médica pasa a consumir estas funciones y su
 * prueba se reapunta; entonces la copia privada desaparece y esta queda como
 * única fuente. Por eso lo de acá es idéntico palabra por palabra a lo de allá:
 * la consolidación tiene que ser un borrado, no una negociación.
 */

/** Días de aviso previo al vencimiento de un documento legal. */
export const AVISO_DE_VENCIMIENTO_DIAS = 30;

/**
 * Cuántos días faltan, en palabras.
 *
 * En palabras y no en la cifra cruda porque «-14» obliga a interpretar un
 * signo, y el aviso lo lee alguien que necesita saber si tiene que actuar hoy.
 */
export function vencimientoEnPalabras(dias: number | null): string {
  if (dias === null) return 'sin vencimiento declarado';
  if (dias < 0) return `vencido hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`;
  if (dias === 0) return 'vence hoy';
  return `vence en ${dias} día${dias === 1 ? '' : 's'}`;
}

/** La severidad con la que se pinta ese plazo. */
export function varianteDeVencimiento(dias: number | null): BadgeVariant {
  if (dias === null) return 'info';
  if (dias < 0) return 'error';
  if (dias <= AVISO_DE_VENCIMIENTO_DIAS) return 'warning';
  return 'success';
}

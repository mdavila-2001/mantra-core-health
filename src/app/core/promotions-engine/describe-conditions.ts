import { formatMoney } from './describe-mechanic';
import type { CampaignConditions } from './promotion-mechanics.types';

/** Lunes primero, que es como se lee la semana; el índice es el de `Date.getDay()`. */
const WEEKDAY_NAMES: readonly { readonly day: number; readonly name: string }[] = [
  { day: 1, name: 'lunes' },
  { day: 2, name: 'martes' },
  { day: 3, name: 'miércoles' },
  { day: 4, name: 'jueves' },
  { day: 5, name: 'viernes' },
  { day: 6, name: 'sábados' },
  { day: 0, name: 'domingos' },
];

/**
 * Las condiciones de una campaña, una oración cada una, para quien la lee.
 *
 * **Qué no se dice, a propósito:**
 * - **El código del cupón.** La ficha de una campaña es pública y se comparte
 *   por enlace: poner el código ahí lo regalaría. Se dice que hace falta un
 *   cupón, no cuál.
 * - **El presupuesto.** Es un dato interno de quien promociona.
 */
export function describeConditions(
  conditions: CampaignConditions,
  context: { readonly currency: string },
): readonly string[] {
  const lines: string[] = [];

  const days = WEEKDAY_NAMES.filter(({ day }) => conditions.weekdays.includes(day)).map(({ name }) => name);
  if (days.length > 0) {
    lines.push(`Vale ${days.length === 7 ? 'todos los días' : `los ${joinNames(days)}`}.`);
  }
  if (conditions.fromTime !== null && conditions.toTime !== null) {
    lines.push(`En el horario de ${conditions.fromTime} a ${conditions.toTime}.`);
  }
  if (conditions.couponCode !== null) {
    lines.push('Se necesita un cupón para usarla.');
  }
  if (conditions.maxDiscount !== null) {
    lines.push(`Descuento máximo de ${formatMoney(conditions.maxDiscount, context.currency)} por pedido.`);
  }
  if (conditions.perPersonLimit !== null) {
    lines.push(
      conditions.perPersonLimit === 1
        ? 'Se puede usar una vez por persona.'
        : `Se puede usar hasta ${conditions.perPersonLimit} veces por persona.`,
    );
  }
  if (conditions.availableUnits !== null) {
    lines.push(`Hasta agotar stock: ${conditions.availableUnits} unidades disponibles.`);
  }
  if (!conditions.stackable) {
    lines.push('No se suma con otras campañas.');
  }
  return lines;
}

/** «lunes», «lunes y martes», «lunes, martes y viernes». */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

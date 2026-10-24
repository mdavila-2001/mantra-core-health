import { toCents } from './promotion-money';
import type { Nudge } from './promotion-mechanics.types';

/** Cuántos avisos se muestran a la vez: más es ruido y tapa el pedido. */
export const MAX_VISIBLE_NUDGES = 2;

/**
 * Los avisos más cercanos de alcanzar: primero los de unidades que faltan
 * (agregar una caja es lo más fácil) y, dentro de cada tipo, el que menos falta.
 *
 * El motor devuelve un aviso por **cada** campaña con un umbral sin alcanzar, y
 * una farmacia con diez campañas diría diez cosas a la vez. Se muestran las
 * pocas que de verdad están a mano.
 */
export function nearestNudges(nudges: readonly Nudge[], limit = MAX_VISIBLE_NUDGES): readonly Nudge[] {
  const units = nudges
    .filter((nudge): nudge is Extract<Nudge, { kind: 'ADD_UNITS' }> => nudge.kind === 'ADD_UNITS')
    .sort((a, b) => a.missingUnits - b.missingUnits);
  const spend = nudges
    .filter((nudge): nudge is Extract<Nudge, { kind: 'SPEND_MORE' }> => nudge.kind === 'SPEND_MORE')
    .sort((a, b) => (toCents(a.missingAmount) ?? 0) - (toCents(b.missingAmount) ?? 0));
  return [...units, ...spend].slice(0, limit);
}

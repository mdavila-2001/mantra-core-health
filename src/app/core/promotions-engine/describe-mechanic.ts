import { isValidPercent, toCents } from './promotion-money';
import type { Mechanic, Nudge } from './promotion-mechanics.types';

/**
 * De dónde sale lo que el motor no sabe: cómo se llama un ítem y cómo se
 * escribe la moneda. El motor razona con ids; la prosa los necesita legibles.
 */
export interface DescribeContext {
  /** El nombre con que se lee un ítem; `null` si no se conoce. */
  readonly labelOf: (itemId: string) => string | null;
  /** «Bs», «USD»… tal como se pinta. */
  readonly currency: string;
}

/** Cómo se dice una mecánica: la etiqueta corta y la oración completa. */
export interface MechanicDescription {
  /** Cabe en un `app-badge`: «2x1», «20 % menos». */
  readonly badge: string;
  /** Una oración para la ficha, en voseo, como el resto del producto. */
  readonly sentence: string;
}

/** Cuando un ítem no tiene nombre conocido, se dice sin inventarle uno. */
const UNKNOWN_ITEM = 'el producto elegido';

/**
 * La única fuente de prosa de las mecánicas: el panel, la ficha pública, el
 * pedido y «Mis promociones» llaman acá, así que una campaña se lee igual en
 * todos lados.
 */
export function describeMechanic(mechanic: Mechanic, context: DescribeContext): MechanicDescription {
  const money = (amount: string): string => formatMoney(amount, context.currency);
  const label = (itemId: string): string => context.labelOf(itemId) ?? UNKNOWN_ITEM;

  switch (mechanic.kind) {
    case 'PERCENT_OFF':
      return {
        badge: `${mechanic.percent} % menos`,
        sentence: `${mechanic.percent} % de descuento en cada producto de la campaña.`,
      };
    case 'CLEARANCE':
      return {
        badge: `${mechanic.percent} % menos`,
        sentence: `Vencimiento cercano: ${mechanic.percent} % menos en estas unidades.`,
      };
    case 'CAMPAIGN_PRICE':
      return {
        badge: 'Precio especial',
        sentence: 'Cada producto tiene su precio de campaña, al lado del precio normal.',
      };
    case 'AMOUNT_OFF_PER_UNIT':
      return {
        badge: `${money(mechanic.amount)} menos`,
        sentence: `${money(mechanic.amount)} menos en cada unidad.`,
      };
    case 'BUY_X_PAY_Y':
      return {
        badge: `${mechanic.take}x${mechanic.pay}`,
        sentence: `Llevá ${mechanic.take} y pagá ${mechanic.pay}.`,
      };
    case 'NTH_UNIT_PERCENT':
      return {
        badge: capitalized(`${ordinal(mechanic.nth)} al ${mechanic.percent} %`),
        sentence: `La ${ordinal(mechanic.nth)} unidad con ${mechanic.percent} % de descuento.`,
      };
    case 'VOLUME_TIERS':
      return {
        badge: 'Más unidades, más descuento',
        sentence: `Cuantas más unidades llevás, más descuento: ${mechanic.tiers
          .map((tier) => `desde ${tier.minQuantity} unidades, ${tier.percent} %`)
          .join('; ')}.`,
      };
    case 'ORDER_PERCENT_OVER':
      return {
        badge: `${mechanic.percent} % desde ${money(mechanic.minSpend)}`,
        sentence: `${mechanic.percent} % de descuento en tu compra desde ${money(mechanic.minSpend)}.`,
      };
    case 'ORDER_AMOUNT_OVER':
      return {
        badge: `${money(mechanic.amount)} menos desde ${money(mechanic.minSpend)}`,
        sentence: `${money(mechanic.amount)} menos en tu compra desde ${money(mechanic.minSpend)}.`,
      };
    case 'SPEND_TIERS':
      return {
        badge: 'Más gastás, más ahorrás',
        sentence: `Cuanto más compres, más ahorrás: ${mechanic.tiers
          .map((tier) => `desde ${money(tier.minSpend)}, ${tier.percent} %`)
          .join('; ')}.`,
      };
    case 'BUNDLE_PRICE':
      return {
        badge: 'Combo',
        sentence: `Combo a ${money(mechanic.bundlePrice)}: los productos de esta campaña, juntos.`,
      };
    case 'GIFT_WITH_PURCHASE':
      return {
        badge: 'De regalo',
        sentence: `Comprando ${label(mechanic.triggerItemId)}, ${label(mechanic.rewardItemId)} de regalo.`,
      };
    case 'BUY_A_GET_B_PERCENT':
      return {
        badge: `${label(mechanic.rewardItemId)} al ${mechanic.percent} %`,
        sentence: `Comprando ${label(mechanic.triggerItemId)}, ${label(mechanic.rewardItemId)} con ${mechanic.percent} % de descuento.`,
      };
    case 'POINTS_MULTIPLIER':
      return {
        badge: `Puntos ×${mechanic.multiplier}`,
        sentence: `Sumás ${mechanic.multiplier} veces más puntos en esta compra.`,
      };
  }
}

/**
 * ¿Se puede decir esta mecánica sin escribir un disparate? Con un campo a medias
 * (`NaN % menos`, «Combo a Bs : …») la vista previa tiene que callar y pedir lo
 * que falta, no inventar una frase.
 *
 * Sólo mira que lo escrito se **lea**: si el combo cuesta más que la suma de sus
 * productos es un error, pero la oración sigue siendo una oración, y de eso se
 * ocupa `validateDraft()`.
 */
export function isDescribable(mechanic: Mechanic): boolean {
  const isAmount = (amount: string): boolean => (toCents(amount) ?? 0) > 0;
  const isCount = (count: number, minimum: number): boolean => Number.isInteger(count) && count >= minimum;

  switch (mechanic.kind) {
    case 'PERCENT_OFF':
    case 'CLEARANCE':
      return isValidPercent(mechanic.percent);
    case 'AMOUNT_OFF_PER_UNIT':
      return isAmount(mechanic.amount);
    case 'CAMPAIGN_PRICE':
      return true;
    case 'BUY_X_PAY_Y':
      return isCount(mechanic.take, 2) && isCount(mechanic.pay, 1) && mechanic.pay < mechanic.take;
    case 'NTH_UNIT_PERCENT':
      return isCount(mechanic.nth, 2) && isValidPercent(mechanic.percent);
    case 'VOLUME_TIERS':
      return (
        mechanic.tiers.length > 0 &&
        mechanic.tiers.every((tier) => isCount(tier.minQuantity, 2) && isValidPercent(tier.percent))
      );
    case 'ORDER_PERCENT_OVER':
      return isAmount(mechanic.minSpend) && isValidPercent(mechanic.percent);
    case 'ORDER_AMOUNT_OVER':
      return isAmount(mechanic.minSpend) && isAmount(mechanic.amount);
    case 'SPEND_TIERS':
      return (
        mechanic.tiers.length > 0 &&
        mechanic.tiers.every((tier) => isAmount(tier.minSpend) && isValidPercent(tier.percent))
      );
    case 'BUNDLE_PRICE':
      return isAmount(mechanic.bundlePrice);
    case 'GIFT_WITH_PURCHASE':
      return mechanic.triggerItemId !== '' && mechanic.rewardItemId !== '';
    case 'BUY_A_GET_B_PERCENT':
      return mechanic.triggerItemId !== '' && mechanic.rewardItemId !== '' && isValidPercent(mechanic.percent);
    case 'POINTS_MULTIPLIER':
      return isCount(mechanic.multiplier, 2);
  }
}

/** El aviso de lo que le falta al pedido, en una oración accionable. */
export function describeNudge(nudge: Nudge, context: DescribeContext): string {
  const money = (amount: string): string => formatMoney(amount, context.currency);
  const reward = nudge.reward;

  if (nudge.kind === 'SPEND_MORE') {
    return `Te faltan ${money(nudge.missingAmount)} para ${spendReward(reward, money)}.`;
  }
  const units = `${nudge.missingUnits} ${nudge.missingUnits === 1 ? 'unidad' : 'unidades'}`;
  switch (reward.kind) {
    case 'BUY_X_PAY_Y':
      return `Agregá ${units} más y llevás ${reward.take} pagando ${reward.pay}.`;
    case 'NTH_UNIT_PERCENT':
      return `Agregá ${units} más y la ${ordinal(reward.nth)} unidad sale con ${reward.percent} % de descuento.`;
    default:
      return `Agregá ${units} más y mejorás tu descuento por cantidad.`;
  }
}

function spendReward(reward: Mechanic, money: (amount: string) => string): string {
  switch (reward.kind) {
    case 'ORDER_PERCENT_OVER':
      return `el ${reward.percent} % de descuento`;
    case 'ORDER_AMOUNT_OVER':
      return `que te descontemos ${money(reward.amount)}`;
    default:
      return 'el siguiente descuento';
  }
}

/**
 * Un importe con su moneda, sin los decimales que sobran: «Bs 10», «Bs 10.50».
 * Un `.00` en una oración de cartel es ruido.
 */
export function formatMoney(amount: string, currency: string): string {
  const cents = toCents(amount);
  const text = cents === null ? amount : cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  return `${currency} ${text}`;
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** «2.ª» se lee «segunda»; del 4 en adelante, «4.ª». */
function ordinal(position: number): string {
  const words: Readonly<Record<number, string>> = { 2: 'segunda', 3: 'tercera' };
  return words[position] ?? `${position}.ª`;
}

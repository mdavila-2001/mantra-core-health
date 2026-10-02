import type { DraftFailure } from './promotion-mechanics.types';

/**
 * Qué decirle a quien arma la campaña por cada fallo. Una causa, una oración, y
 * dice qué hacer: el formulario muestra todas juntas.
 *
 * Es la única fuente de estos textos, igual que `describeMechanic()` lo es de
 * los que lee el paciente.
 */
const FAILURE_TEXT: Readonly<Record<DraftFailure, string>> = {
  MISSING_TITLE: 'Poné un título: es lo primero que va a leer la gente.',
  MISSING_DATES: 'Elegí desde qué día y hasta qué día vale la campaña.',
  DATES_INVERTED: 'La fecha de fin no puede ser anterior a la de inicio.',
  NO_ITEMS: 'Elegí sobre qué productos vale la campaña.',
  MIXED_CURRENCIES: 'Todos los productos de una campaña tienen que estar en la misma moneda.',
  LIST_PRICE_INVALID: 'Escribí el precio normal de cada producto, con números y como máximo dos decimales.',
  AMOUNT_EXCEEDS_PRICE: 'El monto que se descuenta tiene que ser menor que el precio de cada producto.',
  PERCENT_OUT_OF_RANGE: 'El porcentaje tiene que ser un número entero entre 1 % y 99 %.',
  AMOUNT_INVALID: 'El monto tiene que ser mayor que cero, con como máximo dos decimales.',
  PRICE_NOT_A_DISCOUNT: 'Cada precio de campaña tiene que ser menor que el precio normal del producto.',
  BUY_QUANTITIES_INVALID:
    'En «llevá X, pagá Y», pagás al menos una unidad y menos de las que llevás (hasta 20 unidades).',
  NTH_INVALID: 'La unidad con descuento tiene que ser la segunda o una posterior (hasta la 20.ª).',
  TIERS_EMPTY: 'Agregá al menos un tramo.',
  TIERS_NOT_INCREASING:
    'Cada tramo tiene que pedir más que el anterior y descontar más: si no, comprar menos conviene más.',
  MIN_SPEND_INVALID: 'El mínimo tiene que ser mayor que cero (y desde 2 unidades, en los tramos por cantidad).',
  BUNDLE_NEEDS_TWO_ITEMS: 'Un combo necesita al menos dos productos.',
  BUNDLE_PRICE_NOT_A_DISCOUNT: 'El precio del combo tiene que ser menor que la suma de sus productos.',
  TRIGGER_REWARD_MISSING: 'Elegí el producto que se compra y el que se bonifica.',
  TRIGGER_EQUALS_REWARD: 'El producto que se compra y el que se bonifica tienen que ser distintos.',
  MULTIPLIER_INVALID: 'El multiplicador de puntos tiene que ser un entero entre 2 y 10.',
  CAP_INVALID: 'El tope y el presupuesto tienen que ser mayores que cero.',
  LIMIT_INVALID: 'Los límites de uso tienen que ser números enteros de 1 en adelante.',
  COUPON_INVALID: 'El código del cupón lleva de 3 a 24 letras, números o guiones, sin espacios.',
  TIME_WINDOW_INVALID: 'La franja horaria necesita hora de inicio y de fin, con el inicio antes del fin.',
};

export function describeDraftFailure(failure: DraftFailure): string {
  return FAILURE_TEXT[failure];
}

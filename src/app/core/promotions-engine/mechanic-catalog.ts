import type { MechanicFamily, MechanicKind } from './promotion-mechanics.types';

/**
 * Cuánto de la mecánica soporta hoy el backend de promociones (módulo 51):
 *
 * - `MODELED`: el modelo tiene las columnas **y** la API la calcula.
 * - `PENDING_API`: el modelo tiene las columnas, pero la API no lee lo que hace
 *   falta (hoy `discount_rules.target_filter_json` se persiste y nadie lo lee,
 *   así que ninguna mecánica por producto está soportada todavía).
 * - `PENDING_MODEL`: falta una columna o una definición de semántica.
 *
 * No se muestra al usuario —toda la pantalla ya dice que es una demostración—;
 * existe para que el día que llegue el backend nadie tenga que redescubrir qué
 * falta (ver el README del carril).
 */
export type ModelSupport = 'MODELED' | 'PENDING_API' | 'PENDING_MODEL';

/** Lo que el formulario necesita para ofrecer una mecánica. */
export interface MechanicInfo {
  readonly kind: MechanicKind;
  readonly family: MechanicFamily;
  readonly label: string;
  /** Una línea que dice para qué sirve. */
  readonly help: string;
  /** Cómo la lee el paciente, para elegir sin abrir el formulario. */
  readonly example: string;
  readonly modelSupport: ModelSupport;
}

/** Las familias, en el orden en que el formulario las ofrece. */
export const MECHANIC_FAMILIES: readonly { readonly family: MechanicFamily; readonly label: string }[] = [
  { family: 'PRICE', label: 'Precio' },
  { family: 'QUANTITY', label: 'Cantidad' },
  { family: 'ORDER_TOTAL', label: 'Total de la compra' },
  { family: 'COMBO', label: 'Combos y regalos' },
  { family: 'LOYALTY', label: 'Fidelización' },
];

export const MECHANIC_CATALOG: readonly MechanicInfo[] = [
  {
    kind: 'PERCENT_OFF',
    family: 'PRICE',
    label: 'Porcentaje de descuento',
    help: 'El mismo porcentaje para todos los productos que elijas.',
    example: '20 % menos',
    modelSupport: 'PENDING_API',
  },
  {
    kind: 'CAMPAIGN_PRICE',
    family: 'PRICE',
    label: 'Precio de campaña por producto',
    help: 'Vos fijás el precio de cada producto durante la campaña.',
    example: 'Antes 45 · ahora 38',
    modelSupport: 'PENDING_API',
  },
  {
    kind: 'AMOUNT_OFF_PER_UNIT',
    family: 'PRICE',
    label: 'Monto fijo por unidad',
    help: 'Una cantidad de plata menos en cada unidad.',
    example: 'Bs 10 menos en cada unidad',
    modelSupport: 'PENDING_API',
  },
  {
    kind: 'CLEARANCE',
    family: 'PRICE',
    label: 'Vencimiento cercano',
    help: 'Rebajá las unidades que están por vencer. Cada lote lo controlás vos en el mostrador.',
    example: '35 % menos en unidades por vencer',
    modelSupport: 'PENDING_API',
  },
  {
    kind: 'BUY_X_PAY_Y',
    family: 'QUANTITY',
    label: 'Llevá X, pagá Y',
    help: 'Quien lleva X unidades paga solo Y. Cuenta lotes enteros.',
    example: '2x1 · 3x2 · 4x3',
    modelSupport: 'PENDING_API',
  },
  {
    kind: 'NTH_UNIT_PERCENT',
    family: 'QUANTITY',
    label: 'La segunda unidad con descuento',
    help: 'Una unidad de cada grupo sale con descuento: la segunda, la tercera…',
    example: 'La segunda unidad al 50 %',
    modelSupport: 'PENDING_MODEL',
  },
  {
    kind: 'VOLUME_TIERS',
    family: 'QUANTITY',
    label: 'Descuento escalonado por cantidad',
    help: 'Cuantas más unidades lleva, mayor el descuento.',
    example: '2 unidades: 10 % · 3 o más: 15 %',
    modelSupport: 'PENDING_MODEL',
  },
  {
    kind: 'ORDER_PERCENT_OVER',
    family: 'ORDER_TOTAL',
    label: 'Porcentaje por compra mínima',
    help: 'Un porcentaje sobre toda la compra cuando supera un monto.',
    example: '10 % si tu compra llega a Bs 200',
    modelSupport: 'MODELED',
  },
  {
    kind: 'ORDER_AMOUNT_OVER',
    family: 'ORDER_TOTAL',
    label: 'Monto fijo por compra mínima',
    help: 'Una cantidad de plata menos cuando la compra supera un monto.',
    example: 'Bs 30 menos desde Bs 250',
    modelSupport: 'MODELED',
  },
  {
    kind: 'SPEND_TIERS',
    family: 'ORDER_TOTAL',
    label: 'Descuento escalonado por monto',
    help: 'Cuanto más compra, mayor el porcentaje.',
    example: 'Desde Bs 100: 5 % · desde Bs 200: 10 %',
    modelSupport: 'MODELED',
  },
  {
    kind: 'BUNDLE_PRICE',
    family: 'COMBO',
    label: 'Combo a precio conjunto',
    help: 'Varios productos, una unidad de cada uno, a un precio único.',
    example: 'Combo A + B a Bs 60',
    modelSupport: 'PENDING_MODEL',
  },
  {
    kind: 'GIFT_WITH_PURCHASE',
    family: 'COMBO',
    label: 'Regalo con la compra',
    help: 'Comprando un producto, otro va de regalo.',
    example: 'Comprando A, B de regalo',
    modelSupport: 'PENDING_MODEL',
  },
  {
    kind: 'BUY_A_GET_B_PERCENT',
    family: 'COMBO',
    label: 'Comprando uno, descuento en otro',
    help: 'Comprando un producto, otro sale con descuento.',
    example: 'Comprando A, B al 30 %',
    modelSupport: 'PENDING_MODEL',
  },
  {
    kind: 'POINTS_MULTIPLIER',
    family: 'LOYALTY',
    label: 'Puntos multiplicados',
    help: 'La compra suma más puntos a la billetera de quien compra.',
    example: 'Puntos ×2',
    modelSupport: 'PENDING_API',
  },
];

/** Las mecánicas de una familia, en el orden del catálogo. */
export function mechanicsOf(family: MechanicFamily): readonly MechanicInfo[] {
  return MECHANIC_CATALOG.filter((info) => info.family === family);
}

/** La ficha de una mecánica. Existe una por cada `MechanicKind`; un test lo exige. */
export function infoOf(kind: MechanicKind): MechanicInfo {
  const info = MECHANIC_CATALOG.find((candidate) => candidate.kind === kind);
  if (info === undefined) {
    throw new Error(`Falta la ficha de la mecánica ${kind} en MECHANIC_CATALOG.`);
  }
  return info;
}

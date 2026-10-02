/* ============================================================================
    Las campañas de demostración del carril FAR-I7.

    Definen la FORMA de cada campaña —título, texto, ventana de vigencia y
    mecánica—, no sus productos: esos se materializan contra el catálogo real de
    la farmacia que la pantalla ya tiene a mano. Una campaña sembrada que
    anunciara productos inventados sería justo lo que la tanda prohíbe.

    Hay una por cada familia de mecánica del motor, para que la ficha, «dónde
    comprar» y el pedido se puedan recorrer con todas las formas de promocionar.
    ========================================================================== */

import { fromCents, toCents } from '../../promotions-engine/promotion-money';
import type { CampaignConditions, Mechanic } from '../../promotions-engine/promotion-mechanics.types';
import type { ProductoDeCatalogo } from './pharmacy-campaigns.client';

/** Un día en milisegundos, para escribir las ventanas en días legibles. */
export const UN_DIA = 24 * 60 * 60 * 1000;

/** La plantilla de una campaña sembrada, sin productos todavía. */
export interface PlantillaDeCampana {
  /** Parte estable del id: la URL de una campaña sembrada no cambia. */
  readonly slug: string;
  readonly titulo: string;
  readonly descripcion: string;
  /** Días respecto de hoy: negativo es pasado. */
  readonly desdeEnDias: number;
  readonly hastaEnDias: number;
  /**
   * Qué porción del catálogo toma, en el orden en que llega. `cuantos: 0` es una
   * campaña sobre el total del pedido, que no apunta a productos.
   */
  readonly productos: { readonly desde: number; readonly cuantos: number };
  /**
   * La mecánica, resuelta contra los productos elegidos. Devuelve `null` si el
   * catálogo no alcanza para armarla (un combo de dos con un solo producto):
   * mejor que no exista a que exista incompleta.
   */
  readonly mecanica: (elegidos: readonly ProductoDeCatalogo[]) => Mechanic | null;
  readonly condiciones?: Partial<CampaignConditions>;
}

/** Los primeros `n` productos, o `null` si el catálogo no tiene tantos. */
function primeros(elegidos: readonly ProductoDeCatalogo[], n: number): readonly ProductoDeCatalogo[] | null {
  return elegidos.length >= n ? elegidos.slice(0, n) : null;
}

/** Un combo al 90 % de la suma de sus productos: siempre menor que la suma. */
function precioDelCombo(productos: readonly ProductoDeCatalogo[]): string | null {
  const precios = productos.map((producto) => toCents(producto.precio));
  if (precios.some((precio) => precio === null)) {
    return null;
  }
  const suma = precios.reduce<number>((total, precio) => total + (precio ?? 0), 0);
  return suma > 0 ? fromCents(Math.floor((suma * 90) / 100)) : null;
}

/**
 * Las once campañas del paquete: tres originales (una corriente, la del
 * registro del cliente «por fecha de caducidad» y una vencida) y ocho que
 * recorren el resto de las familias.
 *
 * La vencida está a propósito: sin ella el estado «esta promoción terminó» no
 * se puede recorrer, y es la mitad del punto 5 del carril.
 *
 * Las ocho nuevas **no son de precio por unidad** (no producen
 * `precioPromocional`): así no mueven la regla «gana el precio más bajo» que
 * fijan las pruebas del cliente, y se ven en el pedido sólo a través del motor.
 */
export const CAMPANAS_SEMBRADAS: readonly PlantillaDeCampana[] = [
  {
    slug: 'cuidado-diario',
    titulo: 'Cuidado diario con 20 % menos',
    descripcion:
      'Los productos de uso continuo de esta farmacia, con 20 % de descuento durante todo el mes.',
    desdeEnDias: -10,
    hastaEnDias: 20,
    productos: { desde: 0, cuantos: 3 },
    mecanica: () => ({ kind: 'PERCENT_OFF', percent: 20 }),
  },
  {
    slug: 'proximos-a-vencer',
    titulo: 'Últimas unidades — vencimiento cercano',
    descripcion:
      'Unidades con fecha de caducidad próxima, a 35 % menos. La farmacia eligió cuáles: el vencimiento de cada lote lo controla ella en el mostrador.',
    desdeEnDias: -2,
    hastaEnDias: 5,
    productos: { desde: 0, cuantos: 2 },
    mecanica: () => ({ kind: 'CLEARANCE', percent: 35 }),
  },
  {
    slug: 'invierno-pasado',
    titulo: 'Campaña de invierno',
    descripcion: 'Descuentos de la temporada pasada.',
    desdeEnDias: -60,
    hastaEnDias: -15,
    productos: { desde: 0, cuantos: 2 },
    mecanica: () => ({ kind: 'PERCENT_OFF', percent: 15 }),
  },
  {
    slug: 'dos-por-uno',
    titulo: 'Llevá 2 y pagá 1',
    descripcion: 'Quien lleva dos unidades de este producto paga una. Cuenta de a dos: con cuatro, pagás dos.',
    desdeEnDias: -5,
    hastaEnDias: 15,
    productos: { desde: 0, cuantos: 1 },
    mecanica: () => ({ kind: 'BUY_X_PAY_Y', take: 2, pay: 1 }),
  },
  {
    slug: 'segunda-unidad',
    titulo: 'La segunda unidad al 50 %',
    descripcion: 'Llevás dos y la segunda sale a mitad de precio.',
    desdeEnDias: -6,
    hastaEnDias: 12,
    productos: { desde: 1, cuantos: 1 },
    mecanica: () => ({ kind: 'NTH_UNIT_PERCENT', nth: 2, percent: 50 }),
  },
  {
    slug: 'mas-unidades',
    titulo: 'Cuantas más unidades, más descuento',
    descripcion: 'Desde 2 unidades, 10 % menos; desde 3, 15 % menos. Vale sobre todas las unidades.',
    desdeEnDias: -7,
    hastaEnDias: 25,
    productos: { desde: 0, cuantos: 2 },
    mecanica: () => ({
      kind: 'VOLUME_TIERS',
      tiers: [
        { minQuantity: 2, percent: 10 },
        { minQuantity: 3, percent: 15 },
      ],
    }),
  },
  {
    slug: 'compra-minima',
    titulo: '10 % menos desde Bs 100 de compra',
    descripcion: 'Sobre el total de tu pedido, sin elegir productos.',
    desdeEnDias: -8,
    hastaEnDias: 30,
    productos: { desde: 0, cuantos: 0 },
    mecanica: () => ({ kind: 'ORDER_PERCENT_OVER', minSpend: '100.00', percent: 10 }),
  },
  {
    slug: 'ahorro-por-monto',
    titulo: 'Más comprás, más ahorrás',
    descripcion: 'Desde Bs 100, 5 % menos; desde Bs 200, 10 % menos, con un tope de Bs 50 por pedido.',
    desdeEnDias: -9,
    hastaEnDias: 30,
    productos: { desde: 0, cuantos: 0 },
    mecanica: () => ({
      kind: 'SPEND_TIERS',
      tiers: [
        { minSpend: '100.00', percent: 5 },
        { minSpend: '200.00', percent: 10 },
      ],
    }),
    condiciones: { maxDiscount: '50.00' },
  },
  {
    slug: 'combo-cuidado',
    titulo: 'Combo de cuidado a precio especial',
    descripcion: 'Dos productos juntos por menos de lo que cuestan por separado.',
    desdeEnDias: -3,
    hastaEnDias: 14,
    productos: { desde: 0, cuantos: 2 },
    mecanica: (elegidos) => {
      const combo = primeros(elegidos, 2);
      const precio = combo === null ? null : precioDelCombo(combo);
      return precio === null ? null : { kind: 'BUNDLE_PRICE', bundlePrice: precio };
    },
  },
  {
    slug: 'regalo-con-compra',
    titulo: 'Comprando uno, el otro de regalo',
    descripcion: 'Por cada unidad del primer producto, una del segundo va de regalo.',
    desdeEnDias: -4,
    hastaEnDias: 10,
    productos: { desde: 0, cuantos: 2 },
    mecanica: (elegidos) => {
      const par = primeros(elegidos, 2);
      return par === null
        ? null
        : { kind: 'GIFT_WITH_PURCHASE', triggerItemId: par[0].productId, rewardItemId: par[1].productId };
    },
  },
  {
    slug: 'puntos-dobles',
    titulo: 'Puntos dobles en tu compra',
    descripcion: 'Todo lo que comprás en esta farmacia suma el doble de puntos a tu billetera.',
    desdeEnDias: -5,
    hastaEnDias: 20,
    productos: { desde: 0, cuantos: 0 },
    mecanica: () => ({ kind: 'POINTS_MULTIPLIER', multiplier: 2 }),
  },
];

/**
 * El id de una campaña sembrada.
 *
 * Lleva el prefijo de la farmacia para que dos farmacias sembradas no compartan
 * URL, y es determinista para que el enlace de una campaña sembrada siga
 * abriendo después de recargar. El fragmento del identificador no se pinta
 * nunca: vive en la URL, no en la pantalla.
 */
export function idSembrado(slug: string, pharmacyId: string): string {
  return `demo-${slug}-${pharmacyId.slice(0, 8)}`;
}

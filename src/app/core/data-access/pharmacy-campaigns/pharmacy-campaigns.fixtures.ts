/* ============================================================================
    Las campañas de demostración del carril FAR-I7.

    Definen la FORMA de cada campaña —título, texto, ventana de vigencia y
    descuento—, no sus productos: esos se materializan contra el catálogo real
    de la farmacia que la pantalla ya tiene a mano. Una campaña sembrada que
    anunciara productos inventados sería justo lo que la tanda prohíbe.
    ========================================================================== */

import { TipoDeDescuento } from './pharmacy-campaigns.types';

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
  readonly tipoDeDescuento: TipoDeDescuento;
  readonly porcentaje: number;
  /** Cuántos productos del catálogo tomar, en el orden en que llegan. */
  readonly cuantosProductos: number;
}

/**
 * Las tres campañas del paquete: una corriente, la del registro del cliente
 * («por fecha de caducidad») y una vencida.
 *
 * La vencida está a propósito: sin ella el estado «esta promoción terminó» no
 * se puede recorrer, y es la mitad del punto 5 del carril.
 */
export const CAMPANAS_SEMBRADAS: readonly PlantillaDeCampana[] = [
  {
    slug: 'cuidado-diario',
    titulo: 'Cuidado diario con 20 % menos',
    descripcion:
      'Los productos de uso continuo de esta farmacia, con 20 % de descuento durante todo el mes.',
    desdeEnDias: -10,
    hastaEnDias: 20,
    tipoDeDescuento: 'PORCENTAJE',
    porcentaje: 20,
    cuantosProductos: 3,
  },
  {
    slug: 'proximos-a-vencer',
    titulo: 'Últimas unidades — vencimiento cercano',
    descripcion:
      'Unidades con fecha de caducidad próxima, a 35 % menos. La farmacia eligió cuáles: el vencimiento de cada lote lo controla ella en el mostrador.',
    desdeEnDias: -2,
    hastaEnDias: 5,
    tipoDeDescuento: 'PORCENTAJE',
    porcentaje: 35,
    cuantosProductos: 2,
  },
  {
    slug: 'invierno-pasado',
    titulo: 'Campaña de invierno',
    descripcion: 'Descuentos de la temporada pasada.',
    desdeEnDias: -60,
    hastaEnDias: -15,
    tipoDeDescuento: 'PORCENTAJE',
    porcentaje: 15,
    cuantosProductos: 2,
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

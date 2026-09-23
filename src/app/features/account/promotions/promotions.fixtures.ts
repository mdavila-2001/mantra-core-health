/* ============================================================================
    Las promociones recibidas de ejemplo (T-E7 · pantalla K, cara paciente).

    Ningún backend publica «las promociones que le llegaron a una persona»:
    `promotions` y `marketing` sólo tienen escrituras (ver el README de
    `core/data-access/pharmacy-campaigns`). Por eso la lista es de
    demostración, con chip DEMO en pantalla y bajo `environment.campaignsDemo`.

    Lo que **no** se inventa acá:
    - Título, descuento y ventana salen de las plantillas sembradas del carril
      FAR-I7 (`CAMPANAS_SEMBRADAS`), y el id del CTA se arma con `idSembrado`
      para respetar la forma de URL del detalle público.

    Lo que **no** funciona todavía: el detalle público sólo resuelve campañas
    sembradas en la sesión (hoy lo hace «dónde comprar», contra el catálogo de
    una farmacia real) y `FARMACIA_DE_EJEMPLO` no es una de ellas. Así que el
    CTA navega a `/promotions/:campaignId` y ahí se ve «no encontrado». Queda
    pendiente hasta que exista una lectura de campañas; no se siembra nada
    desde acá para disimularlo.
    - Precios: la tarjeta dice el porcentaje de la plantilla. Los importes de
      una campaña salen del catálogo real de la farmacia, no de este archivo.
    - Condición de salud: ninguna. La segmentación por diagnóstico está
      decidida en contra hasta que exista consentimiento (mismo README), así
      que el único motivo que se modela es el lote próximo a vencer.
    ========================================================================== */

import {
  CAMPANAS_SEMBRADAS,
  UN_DIA,
  idSembrado,
  type PlantillaDeCampana,
} from '../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.fixtures';

/** En qué quedó la promoción para quien la recibió. */
export type EstadoDePromocionRecibida = 'nueva' | 'vista' | 'vencida';

/** Por qué la farmacia la mandó, cuando lo dice. */
export type MotivoDePromocion = 'lote-proximo-a-vencer';

/** Una promoción tal como la recibe el paciente. */
export interface PromocionRecibida {
  /** Id de la tarjeta; no se pinta. */
  readonly id: string;
  /** Id de la campaña que abre `/promotions/:campaignId`. */
  readonly campaignId: string;
  readonly farmacia: string;
  readonly titulo: string;
  readonly motivo: MotivoDePromocion | null;
  readonly medicamento: string;
  /** Porcentaje de descuento de la campaña, entero. */
  readonly porcentaje: number;
  readonly desde: Date;
  readonly hasta: Date;
  /**
   * Por cuánto multiplica los puntos, o `null` si no suma extra. Texto exacto,
   * como toda cifra de puntos; el rótulo lo arma `etiquetaDeMultiplicador`.
   */
  readonly factorDePuntos: string | null;
  readonly estado: EstadoDePromocionRecibida;
}

/**
 * La farmacia de ejemplo. El nombre es el mismo de la compra simulada de
 * «Mis puntos» (`loyalty.fixtures.ts`), para que la demostración cuente una
 * sola historia.
 */
export const FARMACIA_DE_EJEMPLO = {
  id: 'c3a7f0d2-5e1b-4c8a-9d6f-000000000001',
  nombre: 'Farmacia Central',
} as const;

/** La plantilla sembrada por su slug; si falta, el fixture está roto. */
function plantilla(slug: string): PlantillaDeCampana {
  const encontrada = CAMPANAS_SEMBRADAS.find((candidata) => candidata.slug === slug);
  if (encontrada === undefined) {
    throw new Error(`No hay campaña sembrada con slug «${slug}».`);
  }
  return encontrada;
}

/** Lo que cada tarjeta agrega a su plantilla. */
interface Recepcion {
  readonly slug: string;
  readonly medicamento: string;
  readonly motivo: MotivoDePromocion | null;
  readonly factorDePuntos: string | null;
  readonly estado: EstadoDePromocionRecibida;
}

/**
 * Las tres recepciones: una nueva con puntos x2, una vista por lote próximo a
 * vencer y una vencida. Medicamentos de venta libre a propósito: el nombre del
 * medicamento tampoco debe insinuar un diagnóstico.
 */
const RECEPCIONES: readonly Recepcion[] = [
  {
    slug: 'cuidado-diario',
    medicamento: 'Paracetamol 500 mg',
    motivo: null,
    factorDePuntos: '2',
    estado: 'nueva',
  },
  {
    slug: 'proximos-a-vencer',
    medicamento: 'Ibuprofeno 400 mg',
    motivo: 'lote-proximo-a-vencer',
    factorDePuntos: null,
    estado: 'vista',
  },
  {
    slug: 'invierno-pasado',
    medicamento: 'Loratadina 10 mg',
    motivo: null,
    factorDePuntos: null,
    estado: 'vencida',
  },
];

/** Las promociones recibidas de ejemplo, en el orden en que se muestran. */
export function promocionesRecibidasDeEjemplo(
  ahora: Date = new Date(),
): readonly PromocionRecibida[] {
  const instante = ahora.getTime();
  return RECEPCIONES.map((recepcion) => {
    const base = plantilla(recepcion.slug);
    const campaignId = idSembrado(base.slug, FARMACIA_DE_EJEMPLO.id);
    return {
      id: `recibida-${campaignId}`,
      campaignId,
      farmacia: FARMACIA_DE_EJEMPLO.nombre,
      titulo: base.titulo,
      motivo: recepcion.motivo,
      medicamento: recepcion.medicamento,
      porcentaje: base.porcentaje,
      desde: new Date(instante + base.desdeEnDias * UN_DIA),
      hasta: new Date(instante + base.hastaEnDias * UN_DIA),
      factorDePuntos: recepcion.factorDePuntos,
      estado: recepcion.estado,
    };
  });
}

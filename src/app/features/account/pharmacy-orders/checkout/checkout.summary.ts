import {
  aCentavos,
  aTexto,
} from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.money';
import type { RenglonDelResumen, ResumenDelPedido } from './order-summary/order-summary.types';

/** Lo que el checkout sabe de un renglón antes de resumirlo. */
export interface RenglonACobrar {
  readonly indice: number;
  readonly medicamento: string;
  readonly presentacion: string | null;
  readonly cantidad: number;
  /** El precio unitario que publicó la farmacia, o `null`. */
  readonly precioUnitario: string | null;
  readonly disponible: boolean;
}

export interface EntradaDelResumen {
  readonly renglones: readonly RenglonACobrar[];
  readonly moneda: string | null;
}

/**
 * Suma los renglones del borrador en centavos, con la misma biblioteca que el
 * resto de los importes del módulo.
 *
 * **Sólo aritmética sobre precios publicados por la farmacia.** No hay
 * descuento de red, ni coaseguro, ni envío, ni puntos: nada de eso existe en el
 * contrato antes de crear el pedido, y el coaseguro sólo aparece tras la
 * adjudicación del seguro (`insuranceSettlement`, sobre un pedido ya creado).
 *
 * - Lo que la farmacia no tiene no suma y se muestra diciéndolo.
 * - Si falta un precio, el total queda en `null`: un total al que le falta un
 *   renglón es peor que uno que dice que no se puede calcular.
 */
export function resumirPedido(entrada: EntradaDelResumen): ResumenDelPedido {
  const conCentavos = entrada.renglones.map((renglon) => ({
    renglon,
    centavos: centavosDelRenglon(renglon),
  }));

  return {
    moneda: entrada.moneda,
    renglones: conCentavos.map(
      ({ renglon, centavos }): RenglonDelResumen => ({
        indice: renglon.indice,
        medicamento: renglon.medicamento,
        presentacion: renglon.presentacion,
        cantidad: renglon.cantidad,
        precioUnitario: renglon.disponible ? renglon.precioUnitario : null,
        subtotal: centavos === null || !renglon.disponible ? null : aTexto(centavos),
        disponible: renglon.disponible,
      }),
    ),
    total: sumar(conCentavos),
  };
}

/** `0` si la farmacia no lo tiene (no suma); `null` si falta el precio. */
function centavosDelRenglon(renglon: RenglonACobrar): number | null {
  if (!renglon.disponible) {
    return 0;
  }
  if (renglon.precioUnitario === null || !Number.isInteger(renglon.cantidad)) {
    return null;
  }
  const unitario = aCentavos(renglon.precioUnitario);
  return unitario === null ? null : unitario * renglon.cantidad;
}

function sumar(renglones: readonly { readonly centavos: number | null }[]): string | null {
  let total = 0;
  for (const { centavos } of renglones) {
    if (centavos === null) {
      return null;
    }
    total += centavos;
  }
  return aTexto(total);
}

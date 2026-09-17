import {
  aCentavos,
  aTexto,
} from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.money';
import {
  CENTAVOS_POR_PUNTO,
  COSTO_DE_ENVIO_DE_EJEMPLO,
  PORCENTAJE_DE_COASEGURO,
  PORCENTAJE_DE_DESCUENTO_DE_RED,
} from './checkout.fixtures';
import type { RenglonDelResumen, ResumenDelPedido } from './order-summary/order-summary.types';

/** Lo que el checkout sabe de un renglón antes de resumirlo. */
export interface RenglonACobrar {
  readonly indice: number;
  readonly medicamento: string;
  readonly presentacion: string | null;
  readonly cantidad: number;
  /** El precio unitario que la orden médica mostró, o `null`. */
  readonly precioUnitario: string | null;
  readonly esAlternativa: boolean;
  readonly aprobadoPorSeguro: boolean;
  readonly disponible: boolean;
}

export interface EntradaDelResumen {
  readonly renglones: readonly RenglonACobrar[];
  readonly moneda: string | null;
  readonly conSeguro: boolean;
  readonly conEnvio: boolean;
}

/**
 * Arma el resumen en centavos, con la misma biblioteca que las promociones.
 *
 * - Lo que la farmacia no tiene no suma.
 * - Con seguro, lo aprobado se reparte: la persona paga el coaseguro y el
 *   resto lo cubre la aseguradora. Lo no aprobado se paga entero. **Un solo
 *   total** consolida los dos bloques (F2.2.5).
 * - El descuento de red se aplica sobre lo que paga la persona sin seguro.
 * - Si falta un precio, las cifras que dependen de él quedan en `null`: un
 *   total al que le falta un renglón es peor que uno que dice que no se puede
 *   calcular.
 */
export function resumirPedido(entrada: EntradaDelResumen): ResumenDelPedido {
  const conPrecio = entrada.renglones.map((renglon) => ({
    renglon,
    centavos: centavosDelRenglon(renglon),
  }));
  const aResumen = ({
    renglon,
    centavos,
  }: {
    renglon: RenglonACobrar;
    centavos: number | null;
  }): RenglonDelResumen => ({
    indice: renglon.indice,
    medicamento: renglon.medicamento,
    presentacion: renglon.presentacion,
    cantidad: renglon.cantidad,
    subtotal: centavos === null || !renglon.disponible ? null : aTexto(centavos),
    esAlternativa: renglon.esAlternativa,
    disponible: renglon.disponible,
  });

  const esAprobado = (renglon: RenglonACobrar) =>
    entrada.conSeguro && renglon.aprobadoPorSeguro && renglon.disponible;
  const aprobados = conPrecio.filter(({ renglon }) => esAprobado(renglon));
  const noAprobados = conPrecio.filter(({ renglon }) => !esAprobado(renglon));

  const sumaAprobados = sumar(aprobados);
  const sumaNoAprobados = sumar(noAprobados);
  const subtotal =
    sumaAprobados === null || sumaNoAprobados === null ? null : sumaAprobados + sumaNoAprobados;

  const descuento =
    sumaNoAprobados === null ? null : porcentaje(sumaNoAprobados, PORCENTAJE_DE_DESCUENTO_DE_RED);
  const hayAprobados = aprobados.length > 0;
  const coaseguro =
    !hayAprobados || sumaAprobados === null
      ? null
      : porcentaje(sumaAprobados, PORCENTAJE_DE_COASEGURO);
  const envio = entrada.conEnvio ? aCentavos(COSTO_DE_ENVIO_DE_EJEMPLO) : null;

  const total =
    sumaNoAprobados === null || descuento === null || (hayAprobados && coaseguro === null)
      ? null
      : sumaNoAprobados - descuento + (coaseguro ?? 0) + (envio ?? 0);

  return {
    moneda: entrada.moneda,
    conSeguro: entrada.conSeguro,
    aprobados: aprobados.map(aResumen),
    noAprobados: noAprobados.map(aResumen),
    subtotal: textoONull(subtotal),
    descuentoDeRed: textoONull(descuento),
    coaseguro: textoONull(coaseguro),
    cubreElSeguro:
      coaseguro === null || sumaAprobados === null ? null : aTexto(sumaAprobados - coaseguro),
    envio: textoONull(envio),
    total: textoONull(total),
    puntos: total === null ? null : Math.floor(total / CENTAVOS_POR_PUNTO),
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

function sumar(renglones: readonly { centavos: number | null }[]): number | null {
  let total = 0;
  for (const { centavos } of renglones) {
    if (centavos === null) {
      return null;
    }
    total += centavos;
  }
  return total;
}

function porcentaje(centavos: number, por: number): number {
  return Math.round((centavos * por) / 100);
}

function textoONull(centavos: number | null): string | null {
  return centavos === null ? null : aTexto(centavos);
}

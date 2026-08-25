import type {
  LineaDePedido,
  PedidoFarmacia,
} from '../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import type { DocumentoDeComprobante, LineaDeComprobante } from './receipt-pdf.types';

/**
 * La proyección pedido → comprobante. Es UNA sola a propósito: la pantalla
 * del comprobante y su PDF la comparten, así los dos dicen exactamente lo
 * mismo — dos versiones del mismo pago es el problema que un comprobante
 * existe para evitar.
 */

/** Cómo se dice cada origen del contrato. El demo lo dice sin vueltas. */
const MEDIO_POR_ORIGEN: Readonly<Record<string, string>> = {
  MOSTRADOR: 'Pagado en mostrador',
  QR_DEMO: 'Pago demo — sin valor real',
};

/**
 * `null` cuando el pedido no tiene un pago registrado: un comprobante sin
 * pago detrás no existe — la pantalla muestra su vacío honesto y el PDF ni
 * se ofrece.
 */
export function comprobanteDesdePedido(pedido: PedidoFarmacia): DocumentoDeComprobante | null {
  const pago = pedido.pago;
  if (pago === null || pago.estado !== 'PAGADO' || pago.pagadoEl === null) {
    return null;
  }
  // Se cobran los renglones que la farmacia mantuvo en pie; los no
  // disponibles nunca se prepararon ni se pagaron.
  const cobradas = pedido.lineas.filter((linea) => linea.disponible);
  return {
    id: pedido.id,
    farmacia: pedido.farmacia,
    sede: pedido.sede,
    paciente: pedido.paciente,
    pagadoEl: pago.pagadoEl,
    medioDePago: MEDIO_POR_ORIGEN[pago.origen ?? ''] ?? 'Pagado',
    lineas: cobradas.map(lineaDeComprobante),
    // Lo CONGELADO al pagar, no el total vivo: si el pedido cambió después,
    // el papel sigue diciendo lo que de verdad se cobró.
    total: pago.total,
    moneda: pago.moneda ?? pedido.moneda,
  };
}

function lineaDeComprobante(linea: LineaDePedido): LineaDeComprobante {
  const descripcion =
    linea.presentacion === null
      ? linea.medicamento
      : `${linea.medicamento} · ${linea.presentacion}`;
  return { descripcion, cantidad: linea.cantidad, importe: importeDe(linea) };
}

/**
 * Importe del renglón (precio × cantidad) como texto exacto; `null` si el
 * precio no está publicado — un importe inventado es peor que decirlo.
 * `Number('')` es 0 —finito— y facturaría «0.00»: el vacío también es
 * ausencia (mismo criterio que el cliente de pedidos).
 */
function importeDe(linea: LineaDePedido): string | null {
  if (linea.precio === null || linea.precio.trim() === '') {
    return null;
  }
  const precio = Number(linea.precio);
  if (!Number.isFinite(precio)) {
    return null;
  }
  return (precio * linea.cantidad).toFixed(2);
}

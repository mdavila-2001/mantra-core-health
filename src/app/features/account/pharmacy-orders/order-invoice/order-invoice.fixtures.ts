import { environment } from '../../../../../environments/environment';
import type {
  EstadoDePedido,
  LineaDePedido,
  PagoDelPedido,
  PedidoFarmacia,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { uuid } from '../../../../core/mock/mock-store';
import {
  facturaDeEjemplo,
  NOTA_DE_DATOS_DE_EJEMPLO,
} from '../../../organization/pharmacy-inbox/pharmacy-inbox.fixtures';
import type { CoaseguroDeFactura, DocumentoDeFactura, LineaDeFactura } from './order-invoice.types';

/**
 * **Los datos de ejemplo del seguimiento y la factura** (T-E4, Farmacia-Mockup).
 *
 * El contrato de `pharmacy-orders` no publica ni el pago ni la factura: el
 * adaptador deja el pago en `null` sin condición (`pharmacy-orders.adapter.ts:95-98`).
 * Para que la maqueta se vea pagada y facturada, este archivo los aporta **por
 * pedido conocido** y la pantalla los rotula con el mismo cartel que la bandeja
 * del mostrador.
 *
 * Reglas que este archivo respeta (D-FARMOCK-2):
 *
 * - **Sólo con el backend simulado.** Con la API real (`mockBackend: false`)
 *   nada de acá se aplica: la pantalla se queda con el contrato.
 * - **Sólo pedidos conocidos**: los que el backend simulado siembra para la
 *   cuenta de paciente. Cualquier otro pedido sale como el mismo objeto.
 * - **Nunca reemplaza un valor del contrato.** Sólo completa el pago cuando
 *   llega `null`. La modalidad, el hito del envío y la dirección de entrega no
 *   se tocan: la rama de envío se pinta sólo cuando el contrato la trae.
 * - **Nada se persiste**: cada render deriva lo mismo del pedido recibido.
 *
 * TODO(FAR-E4): cuando el backend publique pago y facturación, esto se queda
 * sólo con los casos de las pruebas.
 */

/** El cartel único: el mismo que usa la bandeja del mostrador. */
export const NOTA_DE_EJEMPLO = NOTA_DE_DATOS_DE_EJEMPLO;

const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;

/** El NIT de ejemplo de la ficha de la farmacia (`pharmacy-profile.fixtures.ts`). */
const NIT_DE_EJEMPLO = '1028394027';

/** Lo que la maqueta aporta a un pedido conocido. */
interface CasoDeEjemplo {
  /** Minutos entre el envío del pedido y su pago: el pago del checkout (T-E3). */
  readonly pagoMinutosDespues: number;
  readonly factura?: {
    /** Horas entre el envío y la emisión: nunca antes de que exista el pedido. */
    readonly horasDespues: number;
    readonly porcentajeDeDescuentoDeRed: number;
    readonly documentoDelComprador: string;
  };
}

/**
 * Los pedidos que la maqueta reconoce. Son los que el backend simulado siembra
 * para `paciente@alovida.mock` (`pharmacy.handlers.ts:151-173`).
 */
const CASOS_DE_EJEMPLO: ReadonlyMap<string, CasoDeEjemplo> = new Map<string, CasoDeEjemplo>([
  // Listo para retirar y ya pagado: en el mostrador sólo se muestra el código.
  [uuid('pharmacy-order-1'), { pagoMinutosDespues: 4 }],
  // Pagado al enviar; la farmacia lo está preparando.
  [uuid('pharmacy-copay-partial'), { pagoMinutosDespues: 3 }],
  // Pagado, retirado y facturado.
  [
    uuid('pharmacy-order-3'),
    {
      pagoMinutosDespues: 6,
      factura: { horasDespues: 26, porcentajeDeDescuentoDeRed: 10, documentoDelComprador: 'CI 4832915 SC' },
    },
  ],
]);

/** Terminales sin cobro: un pedido rechazado, vencido o cancelado no se paga. */
const SIN_COBRO: readonly EstadoDePedido[] = ['RECHAZADO', 'VENCIDO', 'CANCELADO'];

function casoDeEjemplo(pedido: PedidoFarmacia, mockBackend: boolean): CasoDeEjemplo | null {
  return mockBackend ? (CASOS_DE_EJEMPLO.get(pedido.id) ?? null) : null;
}

/**
 * El pedido con el pago de ejemplo, o **el mismo objeto** si no corresponde:
 * pedido desconocido, API real, pago que el contrato ya trae, o un estado en el
 * que no se cobra. Lo único que se agrega es `pago`; nada más cambia.
 */
export function conSeguimientoDeEjemplo(
  pedido: PedidoFarmacia,
  mockBackend: boolean = environment.mockBackend,
): PedidoFarmacia {
  const caso = casoDeEjemplo(pedido, mockBackend);
  if (caso === null || pedido.pago !== null || SIN_COBRO.includes(pedido.estado)) {
    return pedido;
  }
  return { ...pedido, pago: pagoDeEjemplo(pedido, caso) };
}

function pagoDeEjemplo(pedido: PedidoFarmacia, caso: CasoDeEjemplo): PagoDelPedido {
  return {
    estado: 'PAGADO',
    // El único origen que el contrato provisorio admite fuera del mostrador.
    origen: 'QR_DEMO',
    pagadoEl: new Date(pedido.creadoEl.getTime() + caso.pagoMinutosDespues * MINUTO_MS),
    total: pedido.totalEstimado,
    moneda: pedido.moneda,
  };
}

/**
 * La factura de un pedido, o `null` si no la hay: sólo un pedido conocido,
 * con el backend simulado y **ya entregado con total** (la misma regla del
 * resumen del mostrador, `facturaDeEjemplo`, del que salen número y estado
 * para que las dos caras digan lo mismo).
 */
export function facturaDelPedido(
  pedido: PedidoFarmacia,
  mockBackend: boolean = environment.mockBackend,
): DocumentoDeFactura | null {
  const datos = casoDeEjemplo(pedido, mockBackend)?.factura;
  if (datos === undefined) {
    return null;
  }
  const emitidaEl = new Date(pedido.creadoEl.getTime() + datos.horasDespues * HORA_MS);
  const resumen = facturaDeEjemplo(pedido, emitidaEl);
  if (resumen === null) {
    return null;
  }
  // Se facturan los renglones que la farmacia mantuvo en pie.
  const lineas = pedido.lineas.filter((linea) => linea.disponible).map(lineaDeFactura);
  const subtotal = sumar(lineas.map((linea) => linea.importe));
  const descuento =
    subtotal === null ? null : Math.round((subtotal * datos.porcentajeDeDescuentoDeRed) / 100);
  return {
    id: pedido.id,
    numero: resumen.numero,
    emitidaEl: resumen.emitidaEl,
    estado: resumen.estado,
    emisor: {
      nombre: pedido.farmacia,
      detalle: pedido.sede,
      razonSocial: pedido.farmacia,
      nit: NIT_DE_EJEMPLO,
    },
    comprador: {
      nombre: pedido.paciente ?? 'No registrado',
      documento: datos.documentoDelComprador,
    },
    lineas,
    subtotal: subtotal === null ? null : texto(subtotal),
    descuentoDeRed: descuento === null ? null : texto(descuento),
    coaseguro: coaseguroDe(pedido),
    total: subtotal === null || descuento === null ? null : texto(subtotal - descuento),
    moneda: resumen.moneda,
  };
}

/** El coaseguro sale de la liquidación real del seguro, nunca de la maqueta. */
function coaseguroDe(pedido: PedidoFarmacia): CoaseguroDeFactura | null {
  const liquidacion = pedido.insuranceSettlement ?? null;
  if (pedido.insuranceSettlementAvailability !== 'AVAILABLE' || liquidacion === null) {
    return null;
  }
  return {
    aseguradora: liquidacion.carrierName,
    importe: liquidacion.totalPatientAmount,
    moneda: liquidacion.currencyCode,
  };
}

function lineaDeFactura(linea: LineaDePedido): LineaDeFactura {
  const descripcion =
    linea.presentacion === null ? linea.medicamento : `${linea.medicamento} · ${linea.presentacion}`;
  const precio = centavos(linea.precio);
  return {
    descripcion,
    cantidad: linea.cantidad,
    importe: precio === null ? null : texto(precio * linea.cantidad),
  };
}

/* ─── Importes: texto exacto por fuera, centavos enteros por dentro ────────── */

/** `null` si el texto no es un importe: un vacío no se factura como «0.00». */
function centavos(importe: string | null): number | null {
  if (importe === null || importe.trim() === '') {
    return null;
  }
  const valor = Number(importe);
  return Number.isFinite(valor) ? Math.round(valor * 100) : null;
}

function sumar(importes: readonly (string | null)[]): number | null {
  let total = 0;
  for (const importe of importes) {
    const valor = centavos(importe);
    if (valor === null) {
      return null;
    }
    total += valor;
  }
  return total;
}

function texto(centavosEnteros: number): string {
  return (centavosEnteros / 100).toFixed(2);
}

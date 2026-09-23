import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import type { StepperStep } from '../../../shared/components/molecules/stepper/stepper.types';
import {
  esEstadoTerminal,
  estaPagado,
} from '../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type {
  EstadoDePedido,
  ModalidadDeEntrega,
  PagoDelPedido,
  PedidoFarmacia,
} from '../../../core/data-access/pharmacy-orders/pharmacy-orders.types';

/** Cómo se muestra el estado de un pedido: tono, palabra y frase. */
export interface PedidoStatusPresentation {
  readonly tone: BadgeVariant;
  readonly label: string;
  /** La frase del detalle: qué significa este estado para la persona. */
  readonly descripcion: string;
}

/**
 * Cómo se ve cada estado del pedido, por **código del contrato**.
 *
 * Mismo criterio que `booking-status.ts`: el código es la identidad semántica
 * y estas frases son la decisión de la interfaz — un código jamás llega a la
 * pantalla. Cuando Marcelo publique el value set real, la clave sigue siendo
 * el código y esta tabla no se entera de los UUID.
 */
const PRESENTACION_POR_ESTADO: Readonly<Record<EstadoDePedido, PedidoStatusPresentation>> =
  Object.freeze({
    ENVIADO: {
      tone: 'info',
      label: 'Enviado',
      descripcion: 'La farmacia todavía no abrió tu pedido.',
    },
    EN_REVISION: {
      tone: 'info',
      label: 'En revisión',
      descripcion: 'La farmacia está revisando qué puede confirmarte.',
    },
    CONFIRMADO: {
      tone: 'success',
      // T-E4: lo que la persona necesita saber es que se está preparando; la
      // confirmación ya pasó. El código del contrato sigue siendo CONFIRMADO.
      label: 'En preparación',
      descripcion: 'La farmacia confirmó tu pedido y lo está preparando.',
    },
    ACEPTACION_PENDIENTE: {
      tone: 'warning',
      label: 'Esperando tu decisión',
      descripcion: 'La farmacia te propone una alternativa más económica. La decisión es tuya.',
    },
    ACEPTADO: {
      tone: 'success',
      label: 'Propuesta aceptada',
      descripcion: 'Aceptaste la alternativa y la farmacia sigue preparando tu pedido.',
    },
    LISTO_PARA_RETIRO: {
      tone: 'success',
      label: 'Listo para retirar',
      descripcion: 'Tu pedido te espera en el mostrador. Pagás al retirar.',
    },
    RETIRADO: {
      tone: 'secondary',
      label: 'Retirado',
      descripcion: 'Ya retiraste este pedido.',
    },
    RECHAZADO: {
      tone: 'error',
      label: 'Rechazado',
      descripcion: 'La farmacia no pudo tomar tu pedido.',
    },
    VENCIDO: {
      tone: 'warning',
      label: 'Vencido',
      descripcion: 'La reserva venció: pasaron las 48 horas y el mostrador liberó tu pedido.',
    },
    CANCELADO: {
      tone: 'error',
      label: 'Cancelado',
      descripcion: 'Cancelaste este pedido.',
    },
  });

/** Cómo mostrar un estado. Jamás lanza: la tabla cubre el contrato entero. */
export function toPedidoStatusPresentation(estado: EstadoDePedido): PedidoStatusPresentation {
  return PRESENTACION_POR_ESTADO[estado];
}

/**
 * La presentación del pedido completo (FAR-I3): con envío, el cierre no es
 * «Retirado» — nadie pasó por el mostrador — sino «Entregado». Y con el pago
 * ya registrado (FAR-I5), «pagás al retirar» dejaría de ser verdad: la frase
 * del mostrador cambia. Para todo lo demás delega en la tabla por estado.
 *
 * `pagado` sale del pedido por omisión; el detalle lo pasa explícito.
 */
export function presentacionDePedido(
  pedido: PedidoFarmacia,
  pagado: boolean = estaPagado(pedido),
): PedidoStatusPresentation {
  if (
    pedido.estado === 'RETIRADO' &&
    (pedido.modalidad === 'DOMICILIO' || pedido.modalidad === 'TRABAJO')
  ) {
    return { tone: 'secondary', label: 'Entregado', descripcion: 'Tu pedido llegó.' };
  }
  if (pedido.estado === 'LISTO_PARA_RETIRO' && pagado) {
    return {
      tone: 'success',
      label: 'Listo para retirar',
      descripcion: 'Tu pedido te espera en el mostrador. Ya está pagado: solo presentá tu código.',
    };
  }
  return toPedidoStatusPresentation(pedido.estado);
}

const ETIQUETA_DE_MODALIDAD: Readonly<Record<ModalidadDeEntrega, string>> = Object.freeze({
  RETIRO: 'Retiro en la farmacia',
  DOMICILIO: 'Envío a domicilio',
  TRABAJO: 'Envío a tu trabajo',
});

/** La modalidad en palabras de mostrador — el código jamás se pinta. */
export function etiquetaDeModalidad(modalidad: ModalidadDeEntrega | null): string {
  return modalidad === null ? 'Modalidad no registrada' : ETIQUETA_DE_MODALIDAD[modalidad];
}

/**
 * El medio de pago en palabras, para el badge del detalle (T-E4), o `null`
 * sin un pago registrado: sin pago no hay badge. Son las mismas palabras que
 * el resumen de `order-payment`.
 */
export function etiquetaDeMedioDePago(pago: PagoDelPedido | null): string | null {
  if (pago?.estado !== 'PAGADO') {
    return null;
  }
  if (pago.origen === 'QR_DEMO') {
    return 'Pagado por QR (demo)';
  }
  return pago.origen === 'MOSTRADOR' ? 'Pagado en mostrador' : 'Pagado';
}

/**
 * Un paso del recorrido antes de resolver cómo se dibuja.
 *
 * `pasadoDemostrable` es la regla de R-T-E4: un paso **anterior** al actual
 * sólo entra en la línea de tiempo si el backend garantiza que ocurrió. El
 * contrato publica el estado de hoy y no un historial, y la máquina de estados
 * admite saltos, así que dar por cumplido un paso por su posición en la fila
 * sería inventar un hecho.
 */
interface PasoDelRecorrido {
  /** Estados del contrato que ponen a este paso como el actual. */
  readonly estados: readonly EstadoDePedido[];
  readonly label: string;
  /** `true` sólo si, superado el paso, el backend demuestra que pasó. */
  readonly pasadoDemostrable: boolean;
}

/**
 * La línea de tiempo del pedido para el `app-stepper`, ya resuelta.
 *
 * El recorrido feliz es fijo; el paso de la decisión sólo aparece mientras la
 * decisión existe (`ACEPTACION_PENDIENTE`/`ACEPTADO`) — quien prefirió su
 * receta original vuelve a `CONFIRMADO` y su línea de tiempo sigue derecha,
 * porque la propuesta quedó como historia y no como etapa pendiente.
 *
 * El paso «Pagado» (T-E4) sigue la misma regla: aparece **sólo con un pago
 * registrado**. Sin pago, la línea de tiempo es la de siempre y el pedido se
 * paga al retirar. Con pago, va después de «Enviado» —el pago del checkout
 * sale junto con el pedido— y antes de «En preparación».
 *
 * ## Qué se puede afirmar del pasado (R-T-E4)
 *
 * El pedido real no trae historial: `GET /pharmacy/orders/:id` publica el
 * estado actual, `createdAt` y `expiresAt`, y nada más. Y la máquina del
 * backend permite saltarse etapas — `ENVIADO → CONFIRMADO` y
 * `ENVIADO → ACEPTACION_PENDIENTE` son transiciones legales
 * (`api:pharmacy_inventory/services/pharmacy-orders.service.ts:163-171`), y a
 * `LISTO_PARA_RETIRO` se llega tanto desde `CONFIRMADO` como desde `ACEPTADO`.
 * Por eso un paso ya superado se dibuja sólo cuando es **demostrable**:
 *
 * - **Enviado** — siempre: todo pedido nace `ENVIADO`.
 * - **Pagado** — cuando hay pago registrado; es un hecho observado, no una
 *   inferencia de posición.
 * - **Listo para retirar** — con el pedido `RETIRADO`: la dispensa exige el
 *   estado previo (`…/pharmacy-orders.service.ts:1299`).
 *
 * Los demás —«En revisión», «En preparación», «Tu decisión», «En camino»— se
 * muestran como paso actual o como paso por venir, pero **desaparecen** de la
 * línea de tiempo una vez que el pedido los dejó atrás: el contrato no puede
 * probar que sucedieran. Una fila más corta dice la verdad; una fila llena de
 * ✓ inventa un recorrido.
 *
 * Los terminales que cortan el recorrido (`RECHAZADO`, `VENCIDO`,
 * `CANCELADO`) devuelven vacío: un final anticipado se cuenta con un aviso y
 * sus salidas, no con una línea de progreso que insinúa que sigue.
 */
export function pasosDeLaLineaDeTiempo(
  pedido: PedidoFarmacia,
  pagado: boolean = estaPagado(pedido),
): readonly StepperStep[] {
  const { estado } = pedido;
  if (esEstadoTerminal(estado) && estado !== 'RETIRADO') {
    return [];
  }

  const conDecision = estado === 'ACEPTACION_PENDIENTE' || estado === 'ACEPTADO';
  // Con envío el tramo final es otro (FAR-I3): no hay mostrador ni retiro —
  // la farmacia marca «en camino» y la entrega cierra el pedido. Se exige la
  // modalidad declarada: el contrato admite `deliveryMode: null` en pedidos
  // anteriores a v4.2.1, y «no declarada» no es «es un envío».
  const esEnvio = pedido.modalidad === 'DOMICILIO' || pedido.modalidad === 'TRABAJO';
  const recorrido: readonly PasoDelRecorrido[] = [
    { estados: ['ENVIADO'], label: 'Enviado', pasadoDemostrable: true },
    // Como «en camino», el pago no es un estado del contrato: viaja aparte.
    ...(pagado
      ? [{ estados: [] as readonly EstadoDePedido[], label: 'Pagado', pasadoDemostrable: true }]
      : []),
    { estados: ['EN_REVISION'], label: 'En revisión', pasadoDemostrable: false },
    { estados: ['CONFIRMADO'], label: 'En preparación', pasadoDemostrable: false },
    ...(conDecision
      ? [
          {
            estados: ['ACEPTACION_PENDIENTE', 'ACEPTADO'] as readonly EstadoDePedido[],
            label: estado === 'ACEPTACION_PENDIENTE' ? 'Tu decisión' : 'Propuesta aceptada',
            pasadoDemostrable: false,
          },
        ]
      : []),
    ...(esEnvio
      ? [
          // El hito «en camino» no es un estado del contrato: viaja aparte
          // en `pedido.envio`, y por eso su paso no mapea a ningún estado.
          {
            estados: [] as readonly EstadoDePedido[],
            label: 'En camino',
            pasadoDemostrable: false,
          },
          {
            estados: ['RETIRADO'] as readonly EstadoDePedido[],
            label: 'Entregado',
            pasadoDemostrable: false,
          },
        ]
      : [
          {
            estados: ['LISTO_PARA_RETIRO'] as readonly EstadoDePedido[],
            label: 'Listo para retirar',
            // La dispensa sólo procede desde LISTO_PARA_RETIRO: con el pedido
            // retirado, el paso está demostrado por el propio backend.
            pasadoDemostrable: true,
          },
          { estados: ['RETIRADO'] as readonly EstadoDePedido[], label: 'Retirado', pasadoDemostrable: false },
        ]),
  ];

  const actual =
    esEnvio && pedido.envio === 'EN_CAMINO' && estado !== 'RETIRADO'
      ? recorrido.findIndex((paso) => paso.label === 'En camino')
      : pagado && estado === 'ENVIADO'
        ? // Enviado y pagado a la vez: lo último que pasó es el pago.
          recorrido.findIndex((paso) => paso.label === 'Pagado')
        : recorrido.findIndex((paso) => paso.estados.includes(estado));
  // El recorrido terminó: el paso actual también queda cumplido.
  const terminado = estado === 'RETIRADO';
  return recorrido.flatMap((paso, indice) => {
    if (indice < actual && !paso.pasadoDemostrable) {
      return [];
    }
    const status: StepperStep['status'] =
      indice < actual || (indice === actual && terminado)
        ? 'complete'
        : indice === actual
          ? 'current'
          : 'upcoming';
    return [{ label: paso.label, status }];
  });
}

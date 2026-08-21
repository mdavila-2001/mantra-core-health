import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import type { StepperStep } from '../../../shared/components/molecules/stepper/stepper.types';
import { esEstadoTerminal } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type {
  EstadoDePedido,
  ModalidadDeEntrega,
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
      label: 'Confirmado',
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

const ETIQUETA_DE_MODALIDAD: Readonly<Record<ModalidadDeEntrega, string>> = Object.freeze({
  RETIRO: 'Retiro en la farmacia',
  DOMICILIO: 'Envío a domicilio',
  TRABAJO: 'Envío a tu trabajo',
});

/** La modalidad en palabras de mostrador — el código jamás se pinta. */
export function etiquetaDeModalidad(modalidad: ModalidadDeEntrega): string {
  return ETIQUETA_DE_MODALIDAD[modalidad];
}

/**
 * La línea de tiempo del pedido para el `app-stepper`, ya resuelta.
 *
 * El recorrido feliz es fijo; el paso de la decisión sólo aparece mientras la
 * decisión existe (`ACEPTACION_PENDIENTE`/`ACEPTADO`) — quien prefirió su
 * receta original vuelve a `CONFIRMADO` y su línea de tiempo sigue derecha,
 * porque la propuesta quedó como historia y no como etapa pendiente.
 *
 * Los terminales que cortan el recorrido (`RECHAZADO`, `VENCIDO`,
 * `CANCELADO`) devuelven vacío: un final anticipado se cuenta con un aviso y
 * sus salidas, no con una línea de progreso que insinúa que sigue.
 */
export function pasosDeLaLineaDeTiempo(pedido: PedidoFarmacia): readonly StepperStep[] {
  const { estado } = pedido;
  if (esEstadoTerminal(estado) && estado !== 'RETIRADO') {
    return [];
  }

  const conDecision = estado === 'ACEPTACION_PENDIENTE' || estado === 'ACEPTADO';
  const recorrido: readonly { readonly estados: readonly EstadoDePedido[]; readonly label: string }[] = [
    { estados: ['ENVIADO'], label: 'Enviado' },
    { estados: ['EN_REVISION'], label: 'En revisión' },
    { estados: ['CONFIRMADO'], label: 'Confirmado' },
    ...(conDecision
      ? [
          {
            estados: ['ACEPTACION_PENDIENTE', 'ACEPTADO'] as const,
            label: estado === 'ACEPTACION_PENDIENTE' ? 'Tu decisión' : 'Propuesta aceptada',
          },
        ]
      : []),
    { estados: ['LISTO_PARA_RETIRO'], label: 'Listo para retirar' },
    { estados: ['RETIRADO'], label: 'Retirado' },
  ];

  const actual = recorrido.findIndex((paso) => paso.estados.includes(estado));
  return recorrido.map((paso, indice) => ({
    label: paso.label,
    status:
      indice < actual || estado === 'RETIRADO'
        ? 'complete'
        : indice === actual
          ? 'current'
          : 'upcoming',
  }));
}

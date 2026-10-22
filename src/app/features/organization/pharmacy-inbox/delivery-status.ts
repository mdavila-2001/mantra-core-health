import type {
  ModalidadDeEntrega,
  PedidoFarmacia,
} from '../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import type { ChipVariant } from '../../../shared/components/atoms/chip/chip.types';

/**
 * **Por qué medio se entrega** (carril FAR-I3) — el registro del cliente,
 * literal: «verán porque medio se entrega».
 *
 * Es un chip y no un badge a propósito: un badge dice en qué estado está el
 * pedido, y el medio de entrega no es un estado sino una faceta del pedido.
 * `neutral` existe justamente para eso.
 *
 * ## Por qué el ámbar queda afuera
 *
 * En el sistema el ámbar es el punto de acción único. Un pedido que sale a
 * domicilio no es una acción pendiente más urgente que uno que se retira:
 * es otra logística. Los dos envíos comparten tono porque para el mostrador
 * son el mismo trabajo — sale de la farmacia — y cambian sólo en la
 * dirección, que el detalle muestra cuando la API la trae.
 */
export interface DeliveryPresentation {
  readonly tone: ChipVariant;
  readonly label: string;
  /** Qué implica para quien atiende. */
  readonly descripcion: string;
}

const PRESENTATION_BY_MODALITY: Readonly<Record<ModalidadDeEntrega, DeliveryPresentation>> =
  Object.freeze({
    RETIRO: {
      tone: 'neutral',
      label: 'Recojo en mostrador',
      descripcion: 'La persona lo retira acá con su código.',
    },
    DOMICILIO: {
      tone: 'info',
      label: 'Delivery',
      descripcion: 'Sale a la dirección de domicilio que eligió la persona.',
    },
    TRABAJO: {
      tone: 'info',
      label: 'Delivery',
      descripcion: 'Sale a la dirección de trabajo que eligió la persona.',
    },
  });

/**
 * Cómo mostrar la modalidad. `null` es ausencia real —pedidos históricos sin
 * modalidad— y se resuelve no pintando nada: inventar «Recojo en mostrador»
 * donde el contrato no dice nada sería afirmar algo que nadie declaró.
 */
export function toDeliveryPresentation(
  modalidad: ModalidadDeEntrega | null,
): DeliveryPresentation | null {
  return modalidad === null ? null : PRESENTATION_BY_MODALITY[modalidad];
}

/** El medio de entrega ya resuelto: por dónde sale, cómo se dice y a dónde. */
export interface DeliveryInScreen {
  /**
   * **La modalidad efectiva del pedido.** Es la que manda para todo lo que la
   * pantalla haga con este pedido: lo que dibuja y lo que ofrece hacer.
   */
  readonly modalidad: ModalidadDeEntrega;
  readonly presentacion: DeliveryPresentation;
  /**
   * La dirección de entrega del contrato (`deliveryAddressText`), cuando la
   * hay. A un retiro no se le pinta domicilio aunque el pedido traiga uno.
   */
  readonly direccion: string | null;
}

/**
 * Cómo se entrega un pedido concreto. **Todo sale del contrato**: la
 * modalidad (`deliveryMode`) y la dirección (`deliveryAddressText`), también
 * sobre la maqueta, donde las declara el backend simulado.
 *
 * Vive acá y no en cada pantalla porque la bandeja y el detalle tienen que
 * decir lo mismo del mismo pedido. Y devuelve la modalidad, no sólo cómo
 * pintarla, porque **una segunda lectura de `pedido.modalidad` aguas abajo
 * vuelve a partir el pedido en dos**: la etiqueta diciendo que sale a
 * domicilio y el botón ofreciendo prepararlo para retiro en mostrador. Lo que
 * la pantalla muestra y lo que ofrece hacer salen de la misma respuesta.
 */
export function deliveryInScreen(pedido: PedidoFarmacia): DeliveryInScreen | null {
  const modalidad = pedido.modalidad;
  const presentacion = toDeliveryPresentation(modalidad);
  if (modalidad === null || presentacion === null) {
    return null;
  }
  return {
    modalidad,
    presentacion,
    direccion: modalidad === 'RETIRO' ? null : pedido.direccionDeEntrega,
  };
}

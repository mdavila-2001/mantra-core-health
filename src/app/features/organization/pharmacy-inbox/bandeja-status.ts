import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import type {
  EstadoDePedido,
  ModalidadDeEntrega,
} from '../../../core/data-access/pharmacy-orders/pharmacy-orders.types';

/**
 * La presentación de los estados DEL LADO DEL MOSTRADOR (FAR-I3).
 *
 * `pedido-status.ts` (FAR-I2) le habla al paciente («La farmacia todavía no
 * abrió tu pedido»); esta tabla le habla a quien atiende («Nadie lo abrió
 * todavía»). Mismo criterio: el código del contrato es la identidad y jamás
 * llega a la pantalla.
 */
export interface BandejaStatusPresentation {
  readonly tone: BadgeVariant;
  readonly label: string;
  /** Qué significa este estado para el mostrador, y qué toca hacer. */
  readonly descripcion: string;
}

const PRESENTACION_POR_ESTADO: Readonly<Record<EstadoDePedido, BandejaStatusPresentation>> =
  Object.freeze({
    ENVIADO: {
      tone: 'info',
      label: 'Nuevo',
      descripcion: 'Nadie lo abrió todavía. Abrilo para empezar a revisarlo.',
    },
    EN_REVISION: {
      tone: 'info',
      label: 'En revisión',
      descripcion: 'Lo estás revisando: confirmá, proponé una alternativa o rechazalo.',
    },
    CONFIRMADO: {
      tone: 'success',
      label: 'En preparación',
      descripcion: 'Confirmado. Cuando esté armado, marcalo como listo.',
    },
    ACEPTACION_PENDIENTE: {
      tone: 'warning',
      label: 'Esperando al paciente',
      descripcion: 'Le propusiste una alternativa. La decisión es suya.',
    },
    ACEPTADO: {
      tone: 'success',
      label: 'Propuesta aceptada',
      descripcion: 'Aceptó la alternativa. Seguí preparando el pedido.',
    },
    LISTO_PARA_RETIRO: {
      tone: 'success',
      label: 'Esperando el retiro',
      descripcion: 'El pedido espera en el mostrador con su código de retiro.',
    },
    RETIRADO: {
      tone: 'secondary',
      label: 'Entregado',
      descripcion: 'El pedido salió completo.',
    },
    RECHAZADO: {
      tone: 'error',
      label: 'Rechazado',
      descripcion: 'Lo rechazaste; el paciente ve el motivo en palabras.',
    },
    VENCIDO: {
      tone: 'warning',
      label: 'Vencido',
      descripcion: 'Pasaron las 48 horas y la reserva se liberó.',
    },
    CANCELADO: {
      tone: 'error',
      label: 'Cancelado',
      descripcion: 'El paciente canceló el pedido.',
    },
  });

/**
 * Lo que cambia cuando el pedido **no** se retira en el mostrador.
 *
 * La tabla de arriba se escribió cuando todos los pedidos eran de retiro, y
 * un par de frases dan por sentado ese final. «Cuando esté armado, marcalo
 * como listo» es la que miente: el detalle no le ofrece ese botón a un pedido
 * que sale por reparto —marcar listo es preparar un retiro— así que el texto
 * estaría pidiendo algo que la pantalla no deja hacer.
 *
 * Se aparta **sólo lo que cambia**: el resto del mapa vale igual para las dos
 * entregas, y el texto de retiro no se toca ni una coma.
 */
const DESCRIPCION_SI_SALE_POR_REPARTO: Readonly<Partial<Record<EstadoDePedido, string>>> =
  Object.freeze({
    // Los dos estados que `puedePrepararse` habilita, y en los que el detalle
    // ofrece «Marcar listo para retirar» sólo si el pedido se retira.
    CONFIRMADO: 'Confirmado. Este pedido sale por reparto, no se retira en el mostrador.',
    ACEPTADO:
      'Aceptó la alternativa. Seguí preparándolo: sale por reparto, no se retira en el mostrador.',
    // Y el estado en el que el detalle pide el código de retiro, que un
    // pedido de reparto no tiene a quién pedírselo.
    LISTO_PARA_RETIRO: 'El pedido está armado y sale por reparto; nadie lo retira del mostrador.',
  });

/**
 * Cómo mostrar un estado. Jamás lanza: la tabla cubre el contrato entero.
 *
 * La modalidad es opcional y por omisión no cambia nada: quien sólo necesita
 * el tono y la palabra —la tarjeta de la bandeja— la omite y recibe lo mismo
 * de siempre. El detalle, que sí muestra la frase y las acciones, la pasa
 * para que las dos digan lo mismo.
 */
export function toBandejaStatusPresentation(
  estado: EstadoDePedido,
  modalidad: ModalidadDeEntrega | null = null,
): BandejaStatusPresentation {
  const presentacion = PRESENTACION_POR_ESTADO[estado];
  if (modalidad === null || modalidad === 'RETIRO') {
    return presentacion;
  }
  const descripcion = DESCRIPCION_SI_SALE_POR_REPARTO[estado];
  return descripcion === undefined ? presentacion : { ...presentacion, descripcion };
}

/**
 * Los grupos de la bandeja, en el orden de la tarjeta: los cuatro primeros
 * a la vista —los nuevos arriba y destacados— y el resto plegado. «En
 * preparación» va al pliegue porque su siguiente paso no corre contra el
 * reloj de nadie; las cuatro colas visibles sí.
 */
export const GRUPOS_DE_BANDEJA = [
  'NUEVOS',
  'EN_REVISION',
  'ESPERANDO_PACIENTE',
  'LISTOS',
  'EN_PREPARACION',
  'CERRADOS',
] as const;

export type GrupoDeBandeja = (typeof GRUPOS_DE_BANDEJA)[number];

/** Cuántos grupos del orden anterior se muestran desplegados. */
export const GRUPOS_A_LA_VISTA = 4;

const ETIQUETA_DE_GRUPO: Readonly<Record<GrupoDeBandeja, string>> = Object.freeze({
  NUEVOS: 'Nuevos',
  EN_REVISION: 'En revisión',
  ESPERANDO_PACIENTE: 'Esperando al paciente',
  LISTOS: 'Listos para retiro',
  EN_PREPARACION: 'En preparación',
  CERRADOS: 'Cerrados',
});

export function etiquetaDeGrupo(grupo: GrupoDeBandeja): string {
  return ETIQUETA_DE_GRUPO[grupo];
}

const GRUPO_POR_ESTADO: Readonly<Record<EstadoDePedido, GrupoDeBandeja>> = Object.freeze({
  ENVIADO: 'NUEVOS',
  EN_REVISION: 'EN_REVISION',
  ACEPTACION_PENDIENTE: 'ESPERANDO_PACIENTE',
  LISTO_PARA_RETIRO: 'LISTOS',
  CONFIRMADO: 'EN_PREPARACION',
  ACEPTADO: 'EN_PREPARACION',
  RETIRADO: 'CERRADOS',
  RECHAZADO: 'CERRADOS',
  VENCIDO: 'CERRADOS',
  CANCELADO: 'CERRADOS',
});

/** En qué grupo de la bandeja cae un pedido según su estado. */
export function grupoDeBandeja(estado: EstadoDePedido): GrupoDeBandeja {
  return GRUPO_POR_ESTADO[estado];
}

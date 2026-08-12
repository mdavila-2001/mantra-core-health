import type { ValueSetOption } from '../../core/data-access/terminology/terminology.types';
import type { StatusSealVariant } from '../../shared/components/organisms/status-seal/status-seal.types';
import { UNKNOWN_STATUS_VARIANT } from '../../shared/components/organisms/status-seal/status-seal.types';

/**
 * El estado de una cita, en las tres formas que la identidad exige.
 *
 * ## Por qué existe
 *
 * La regla del sistema de diseño es literal: **todo estado se codifica en tres
 * canales a la vez** —color, forma y texto—, y la forma tiene que ser una
 * silueta distinta, «no el mismo círculo teñido». Un `app-badge` da dos de los
 * tres: color y palabra. Quien distingue mal los colores ve dos filas idénticas
 * salvo por el texto, que es justamente lo que la regla evita.
 *
 * `app-status-seal` es el componente que sí los da, y ya se usa así en los
 * listados de casos de identidad. Esto es el mapa que le falta a la agenda.
 *
 * ## Por código, no por identificador
 *
 * Mismo criterio que `case-status.ts`, y por la misma razón: el uuid es lo que
 * se deriva de la identidad semántica, no la identidad. Un re-seed cambia
 * identificadores; `BOOKING_CONFIRMED` sigue significando lo mismo.
 *
 * El prefijo de módulo se recorta porque el catálogo no es consistente: los
 * estados de cita llegan como `BOOKING_CONFIRMED` a secas y los de encuentro
 * como `clinical:ENCOUNTER_IN_PROGRESS`. Comparar el sufijo funciona con los
 * dos y no obliga a saber cuál usa cada módulo.
 *
 * ## Los cuatro estados son el conjunto cerrado del backend
 *
 * `scheduling:booking-status:*` no tiene más miembros —se leyó de
 * `common/constants/concepts.ts`, no se supuso—. Un quinto estado futuro cae en
 * `unknown`, que es neutro y con su palabra: nunca una pantalla rota.
 */
const VARIANTE_POR_CODIGO: Readonly<Record<string, StatusSealVariant>> = Object.freeze({
  /** Reservada y en pie: es el estado normal de la agenda del día. */
  BOOKING_CONFIRMED: 'approved',
  /**
   * La persona ya llegó y está esperando.
   *
   * `in-review` pinta **ámbar**, y eso es deliberado aunque la identidad limite
   * el ámbar a «un único punto de atención por pantalla, nunca más del 10 % de
   * la superficie». En una agenda del día quien ya llegó **es** el punto de
   * atención —hay alguien esperando— y son pocos a la vez: la mayoría de las
   * filas están confirmadas y sin llegar. El día que una sala entera esté
   * esperando, que la pantalla grite es lo correcto.
   */
  BOOKING_CHECKED_IN: 'in-review',
  BOOKING_CANCELLED: 'rejected',
  /**
   * Reprogramada: la cita que se mira ya no es la vigente. Se marca como
   * vencida y no como cancelada, porque no se anuló — se mudó.
   */
  BOOKING_RESCHEDULED: 'expired',
});

/*  Los tonos que estas cuatro variantes producen —`approved`→éxito,
    `in-review`→aviso, `rejected`→error, `expired`→info— salen del mapa único de
    `StatusSeal`, no de acá. Esta tabla decide **qué estado es cada cosa**; cómo
    se ve cada estado lo decide el sistema de diseño en un solo sitio, que es lo
    que impide que dos pantallas pinten «cancelada» de dos colores distintos. */

/** Cómo se muestra un estado: la variante del sello y la palabra. */
export interface BookingStatusPresentation {
  readonly variant: StatusSealVariant;
  readonly label: string;
}

/**
 * Traduce el concepto de estado de una cita a sello y palabra.
 *
 * Nunca lanza y nunca devuelve vacío: un estado que el catálogo todavía no
 * resolvió —o que esta versión no sabe pintar— sale en neutro con el texto que
 * haya. La agenda del día no se rompe porque un estado sea nuevo.
 *
 * @param concepto - El concepto ya resuelto por terminología, si se resolvió.
 * @param textoDeReserva - Qué decir cuando no hay concepto que traducir.
 * @returns La variante del sello y la etiqueta a mostrar.
 */
export function toBookingStatusPresentation(
  concepto: ValueSetOption | undefined,
  textoDeReserva: string,
): BookingStatusPresentation {
  if (concepto === undefined) {
    return { variant: UNKNOWN_STATUS_VARIANT, label: textoDeReserva };
  }

  const sufijo = concepto.code.includes(':')
    ? concepto.code.slice(concepto.code.lastIndexOf(':') + 1)
    : concepto.code;

  return {
    variant: VARIANTE_POR_CODIGO[sufijo] ?? UNKNOWN_STATUS_VARIANT,
    // La palabra sale del catálogo, no de acá: es el dato, y la interfaz sólo
    // decide con qué forma y tono acompañarlo.
    label: concepto.display || textoDeReserva,
  };
}

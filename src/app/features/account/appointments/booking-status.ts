import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import type { ValueSetOption } from '../../../core/data-access/terminology/terminology.types';

/** Cómo se muestra el estado de un turno: la palabra y el tono del badge. */
export interface BookingStatusPresentation {
  readonly tone: BadgeVariant;
  readonly label: string;
}

/**
 * El sufijo del código, sin el prefijo de módulo.
 *
 * El catálogo no es consistente —`BOOKING_CONFIRMED` a secas y
 * `scheduling:BOOKING_REQUESTED` con prefijo, verificado contra la API viva—;
 * comparar el segmento posterior al último `:` funciona con las dos formas.
 * Lo usan tanto la presentación de abajo como las allowlists de acciones del
 * portal: un solo normalizador, para que la etiqueta y el botón no puedan
 * discrepar sobre qué estado es.
 */
export function sufijoDeCodigo(code: string): string {
  return code.includes(':') ? code.slice(code.lastIndexOf(':') + 1) : code;
}

/**
 * Cómo se ve cada estado de un turno, por **código de catálogo** (ya sin el
 * prefijo de módulo: la clave es el sufijo que devuelve {@link sufijoDeCodigo}).
 *
 * ## Por qué la etiqueta no sale del catálogo
 *
 * `GET /terminology/concepts` devuelve el `display` en inglés —«Booking
 * confirmed», «Patient checked in»— porque es terminología técnica, no copy de
 * producto. Mostrarlo tal cual le pone al paciente una etiqueta de API en otro
 * idioma en la pantalla de sus turnos, que es exactamente lo que las
 * convenciones de UI prohíben: *«Never display a UUID, a raw column name or an
 * English API label: show the human Spanish label»*. Estas frases son la
 * decisión de la interfaz; el `code` es la identidad semántica que las ancla.
 *
 * ## Por qué el código y no el identificador
 *
 * Mismo criterio que `case-status.ts`: un mapa de UUID escritos a mano diría que
 * la interfaz conoce los identificadores del catálogo y que ese conocimiento no
 * caduca. El UUID se deriva del código, no al revés.
 */
const PRESENTACION_POR_CODIGO: Readonly<Record<string, BookingStatusPresentation>> = Object.freeze({
  // Ámbar y no azul: un pedido todavía no es una cita. Comparte tono con
  // «Por confirmar» y con la lista de espera porque comparten la
  // situación —depende de que el consultorio responda— y leerlos con el
  // mismo color es lo que deja ver de un vistazo qué está pendiente.
  BOOKING_REQUESTED: { tone: 'warning', label: 'Pedido' },
  BOOKING_PENDING_CONFIRMATION: { tone: 'warning', label: 'Por confirmar' },
  BOOKING_CONFIRMED: { tone: 'success', label: 'Confirmado' },
  BOOKING_CHECKED_IN: { tone: 'info', label: 'Ya llegaste' },
  // «Atendido» tiene dos códigos en el catálogo vivo: el estado de la cita y
  // el evento con que el flujo la dio por hecha. Para el titular son lo mismo.
  BOOKING_COMPLETED: { tone: 'secondary', label: 'Atendido' },
  EV_BOOKING_DONE: { tone: 'secondary', label: 'Atendido' },
  BOOKING_NO_SHOW: { tone: 'warning', label: 'No asististe' },
  BOOKING_CANCELLED: { tone: 'error', label: 'Cancelado' },
  BOOKING_RESCHEDULED: { tone: 'warning', label: 'Reprogramado' },
});

/**
 * Lo que se muestra mientras el catálogo no responde, o ante un estado que esta
 * versión de la interfaz no sabe nombrar.
 *
 * Es una frase en castellano y no el `display` del catálogo a propósito: caer al
 * inglés sería cambiar un hueco por una etiqueta de API, que es peor. La
 * contrapartida —un estado nuevo del backend se lee neutro hasta que alguien lo
 * agregue acá— es la misma que aceptó `case-status.ts`, y es preferible a que la
 * pantalla invente un significado.
 */
const SIN_RESOLVER: BookingStatusPresentation = Object.freeze({
  tone: 'info',
  label: 'Sin confirmar el estado',
});

/**
 * Cómo mostrar el estado de un turno.
 *
 * Jamás lanza: un concepto que todavía no llegó —o que no está en el mapa— se
 * muestra en neutro en vez de romper la lista de turnos del titular.
 *
 * @param concepto - El concepto ya resuelto contra terminología, si llegó.
 * @returns El tono del badge y el estado en palabras.
 */
export function toBookingStatusPresentation(
  concepto: ValueSetOption | undefined,
): BookingStatusPresentation {
  if (concepto === undefined) {
    return SIN_RESOLVER;
  }
  return PRESENTACION_POR_CODIGO[sufijoDeCodigo(concepto.code)] ?? SIN_RESOLVER;
}

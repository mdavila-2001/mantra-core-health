import type { StatusSealVariant } from '../../shared/components/organisms/status-seal/status-seal.types';
import { UNKNOWN_STATUS_VARIANT } from '../../shared/components/organisms/status-seal/status-seal.types';

/**
 * El estado de una visita de laboratorio, en las tres formas que exige la
 * identidad: color, forma y palabra.
 *
 * ## Por qué es el mismo tratamiento que una cita
 *
 * Una visita de laboratorio **ocupa lugar en la agenda**: se pide, se acepta o
 * se rechaza, cae en un horario y compite con la consulta del paciente por el
 * mismo hueco del día. Que la bandeja esté separada (spec 5399) es una decisión
 * de *dónde vive*, no de *cómo se lee*: quien mira las dos pantallas espera
 * reconocer «Solicitada» o «Completada» por la misma silueta y el mismo tono en
 * las dos. Este archivo es el gemelo de `agenda/booking-status.ts` y existe por
 * la misma razón: `app-badge` da color y palabra, y la regla del sistema de
 * diseño pide **tres** canales — la forma también porta significado.
 *
 * ## Por código de catálogo, nunca por uuid ni por rótulo
 *
 * El uuid se deriva de la semilla y cambia con cada re-seed; el rótulo cambia
 * con el idioma. `PHL_VISIT_CONFIRMED` significa lo mismo siempre. El prefijo
 * de módulo se recorta porque el catálogo no es consistente entre módulos.
 */
const VARIANTE_POR_CODIGO: Readonly<Record<string, StatusSealVariant>> = Object.freeze({
  /** Pedida por el visitador y todavía sin respuesta: espera una decisión. */
  PHL_VISIT_REQUESTED: 'in-review',
  PHL_VISIT_PENDING_CONFIRMATION: 'in-review',
  /** Aceptada: ya tiene su lugar en el día. */
  PHL_VISIT_CONFIRMED: 'approved',
  /** Está ocurriendo ahora. */
  PHL_VISIT_IN_PROGRESS: 'in-review',
  /** Se hizo y se cerró. */
  PHL_VISIT_COMPLETED: 'approved',
  /** Se mudó de horario: no se anuló, dejó de ser la vigente. */
  PHL_VISIT_RESCHEDULED: 'expired',
  PHL_VISIT_RESCHEDULE_PROPOSED: 'expired',
  /** El doctor dijo que no. */
  PHL_VISIT_REJECTED: 'rejected',
  /** La bajó el visitador. */
  PHL_VISIT_CANCELLED_BY_VISITOR: 'rejected',
  PHL_VISIT_CANCELLED_BY_DOCTOR: 'rejected',
  PHL_VISIT_CANCELLED: 'rejected',
  /** Nadie se presentó. Vencida, no rechazada: nadie la anuló. */
  PHL_VISIT_NO_SHOW: 'expired',
  PHL_VISIT_VISITOR_NO_SHOW: 'expired',
  PHL_VISIT_DOCTOR_NO_SHOW: 'expired',
});

/**
 * La palabra de cada estado, en castellano y por código.
 *
 * El diccionario del carril 17 ya devuelve castellano, así que el rótulo del
 * catálogo es un buen texto de reserva. Esta tabla existe para los dos casos en
 * que no alcanza: un `display` que llegue en inglés desde la API real, y los
 * rótulos largos —«Cancelada por el visitador»— que en una columna de tabla
 * empujan el resto de la fila fuera de la pantalla. Quién canceló se lee en el
 * detalle; la columna dice en qué estado está.
 */
const ETIQUETA_POR_CODIGO: Readonly<Record<string, string>> = Object.freeze({
  PHL_VISIT_REQUESTED: 'Solicitada',
  PHL_VISIT_PENDING_CONFIRMATION: 'Por confirmar',
  PHL_VISIT_CONFIRMED: 'Confirmada',
  PHL_VISIT_IN_PROGRESS: 'En curso',
  PHL_VISIT_COMPLETED: 'Completada',
  PHL_VISIT_RESCHEDULED: 'Reprogramada',
  PHL_VISIT_RESCHEDULE_PROPOSED: 'Reprogramada',
  PHL_VISIT_REJECTED: 'Rechazada',
  PHL_VISIT_CANCELLED_BY_VISITOR: 'Cancelada',
  PHL_VISIT_CANCELLED_BY_DOCTOR: 'Cancelada',
  PHL_VISIT_CANCELLED: 'Cancelada',
  PHL_VISIT_NO_SHOW: 'No asistió',
  PHL_VISIT_VISITOR_NO_SHOW: 'No asistió el visitador',
  PHL_VISIT_DOCTOR_NO_SHOW: 'No asististe',
});

/** Los códigos sobre los que el backend admite aceptar o rechazar. */
const ESPERAN_DECISION: ReadonlySet<string> = new Set([
  'PHL_VISIT_REQUESTED',
  'PHL_VISIT_PENDING_CONFIRMATION',
  'PHL_VISIT_RESCHEDULE_PROPOSED',
]);

/** Cómo se muestra el estado de una visita: la variante del sello y la palabra. */
export interface VisitStatusPresentation {
  readonly variant: StatusSealVariant;
  readonly label: string;
  /**
   * El código del catálogo, ya sin prefijo de módulo.
   *
   * Es lo que decide **qué acciones** ofrece la fila. `''` mientras el
   * diccionario no resolvió el concepto: sin estado conocido no se ofrece
   * ninguna acción, que es lo correcto — un botón que va a volver con 409 es
   * un error con forma de oferta.
   */
  readonly code: string;
}

/** El código sin el prefijo de módulo (`pharma:X` → `X`). */
export function sufijoDeCodigo(code: string): string {
  return code.includes(':') ? code.slice(code.lastIndexOf(':') + 1) : code;
}

/**
 * Traduce el concepto de estado de una visita a sello y palabra.
 *
 * Nunca lanza y nunca devuelve vacío: un estado que esta versión no sepa pintar
 * sale en neutro con el rótulo que haya dado el catálogo. La bandeja no se
 * rompe porque el backend agregue un estado.
 *
 * @param code - El código del catálogo, si el diccionario lo resolvió.
 * @param textoDeReserva - El rótulo del catálogo, para lo que no esté en la tabla.
 */
export function toVisitStatusPresentation(
  code: string | undefined,
  textoDeReserva: string,
): VisitStatusPresentation {
  if (code === undefined) {
    return { variant: UNKNOWN_STATUS_VARIANT, label: textoDeReserva, code: '' };
  }

  const sufijo = sufijoDeCodigo(code);

  return {
    variant: VARIANTE_POR_CODIGO[sufijo] ?? UNKNOWN_STATUS_VARIANT,
    label: ETIQUETA_POR_CODIGO[sufijo] ?? textoDeReserva,
    code: sufijo,
  };
}

/**
 * Si la visita sigue esperando que el doctor decida.
 *
 * Por código y no por rótulo: comparar contra la cadena «Solicitada» ataba la
 * oferta de los botones al idioma del catálogo, y bastaba que la API devolviera
 * el `display` en inglés para que una solicitud pendiente dejara de ofrecer
 * «Aceptar». Sin código resuelto no se ofrece nada.
 */
export function esperaDecisionDelDoctor(estado: VisitStatusPresentation): boolean {
  return ESPERAN_DECISION.has(estado.code);
}

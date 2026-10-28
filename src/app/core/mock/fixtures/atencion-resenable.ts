import { encuentros, type EncuentroSimulado } from './clinica';
import { ESTADO_ENCUENTRO, ESTADO_RESERVA } from './conceptos';
import {
  RECURSO_CONSULTORIO_MEDICA,
  recursoDe,
  reservas,
  type ReservaSimulada,
} from './agenda';
import { MEDICA, PROFESIONALES, type ProfesionalSimulado } from './personas';

/* ============================================================================
    El puente reserva → encuentro del simulador.

    Una invitación de encuesta cuelga de una **reserva**; una reseña pública,
    de un **encuentro**. La API real los une por `appointment_id`; los
    encuentros del simulador no guardan ese vínculo, así que acá se resuelve
    con lo que sí tienen en común: la misma persona, el mismo profesional y la
    fecha más cercana.

    Es la única definición de "esta reserva ya tiene su encuentro terminado":
    la usan `GET /patients/me/reviewable-care` y quien siembre una invitación
    "coherente" (que la reserva sea una completada, con encuentro cerrado).
    ========================================================================== */

/** El profesional que atendió una reserva, por el recurso de agenda que ocupó. */
export function profesionalDeReserva(reserva: ReservaSimulada): ProfesionalSimulado | undefined {
  if (reserva.resourceId === RECURSO_CONSULTORIO_MEDICA) return MEDICA;
  return PROFESIONALES.find((p) => recursoDe(p) === reserva.resourceId);
}

/**
 * El encuentro terminado que corresponde a una reserva, o `undefined`.
 *
 * Sólo una reserva **completada** tiene encuentro: una futura, cancelada o
 * ausente no se reseña. Entre los encuentros cerrados de la misma persona con
 * el mismo profesional se elige el de fecha más cercana a la reserva.
 */
export function encuentroDeReserva(reserva: ReservaSimulada): EncuentroSimulado | undefined {
  if (reserva.statusConceptId !== ESTADO_RESERVA['BK-COMPLETED']) return undefined;
  const profesional = profesionalDeReserva(reserva);
  if (profesional === undefined) return undefined;
  const inicio = new Date(reserva.startAt).getTime();
  return encuentros
    .filtrar(
      (e) =>
        e.patientProfileId === reserva.patientProfileId &&
        e.primaryPractitionerId === profesional.id &&
        e.statusConceptId === ESTADO_ENCUENTRO['ENCST-FINISHED'] &&
        e.endAt !== null,
    )
    .sort(
      (a, b) =>
        Math.abs(new Date(a.startAt).getTime() - inicio) -
        Math.abs(new Date(b.startAt).getTime() - inicio),
    )[0];
}

/**
 * Las reservas de la persona que ya terminaron y tienen su encuentro cerrado,
 * las más recientes primero y **con la médica de la demostración al frente**
 * (es con quien la paciente demostrativa se atiende y la que entra por el otro
 * lado). Son las únicas que una invitación sembrada puede nombrar sin mentir.
 */
export function reservasTerminadasDe(patientProfileId: string): ReservaSimulada[] {
  const terminadas = reservas
    .filtrar((r) => r.patientProfileId === patientProfileId)
    .filter((r) => new Date(r.startAt).getTime() < Date.now())
    .filter((r) => encuentroDeReserva(r) !== undefined)
    .sort((a, b) => b.startAt.localeCompare(a.startAt));
  const conLaMedica = terminadas.filter((r) => profesionalDeReserva(r)?.id === MEDICA.id);
  return [...conLaMedica.slice(0, 1), ...terminadas.filter((r) => r !== conLaMedica[0])];
}

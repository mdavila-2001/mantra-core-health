import type { Booking } from '../../../core/data-access/scheduling/scheduling.types';

/**
 * Cómo se le cuenta al paciente el último cambio de su turno (corrección #14).
 *
 * Quién lo hizo cambia la frase entera, y por eso no se resuelve en la
 * plantilla: «tu profesional canceló el turno» y «cancelaste el turno» son la
 * misma transición contada desde dos lados, y mostrar la segunda cuando pasó la
 * primera es peor que no mostrar nada.
 *
 * Devuelve `''` cuando no hay motivo registrado, que es lo corriente en un
 * turno que nadie tocó y en los anteriores a esta versión.
 */
export function changeNotice(cita: Booking): string {
  const cambio = cita.statusReason;
  if (cambio === undefined || cambio.reasonText.trim() === '') {
    return '';
  }
  const quien = cambio.actorKind === 'PATIENT' ? 'Indicó' : 'El profesional indicó';
  return `${quien}: ${cambio.reasonText}`;
}

/**
 * Cómo se le cuenta al paciente la demora de su profesional (P8).
 *
 * Los minutos van siempre —son lo único que permite decidir si salir de casa— y
 * el mensaje del profesional sólo si lo escribió: dejar «Motivo:» colgando
 * cuando no hay motivo es peor que no decir nada.
 *
 * Devuelve `''` cuando nadie informó una demora, que es el caso corriente.
 */
export function delayNotice(cita: Booking): string {
  const demora = cita.delayNotice;
  if (demora === undefined || demora.delayMinutes <= 0) {
    return '';
  }
  const base = `El profesional avisó que se demora unos ${demora.delayMinutes} minutos`;
  const mensaje = demora.message?.trim() ?? '';
  return mensaje === '' ? `${base}.` : `${base}: ${mensaje}`;
}

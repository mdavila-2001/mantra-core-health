/** What the booking screen announces once the hold became an appointment. */
export interface BookingToast {
  readonly message: string;
  readonly title: string;
}

/**
 * The toast after confirming or requesting a slot.
 *
 * Since v4.2.88 a patient's request may be born confirmed (the agenda or the
 * service does not require approval). The response says so with `confirmedAt`,
 * and promising "the practitioner will confirm" over a confirmed appointment
 * would be a lie, so the wording follows the response, not the route.
 */
export function bookingToast(
  selfService: boolean,
  result: { readonly id: string; readonly confirmedAt?: string },
  patientLabel: string,
): BookingToast {
  if (!selfService) {
    return { message: `La cita de ${patientLabel} quedó confirmada.`, title: 'Reserva confirmada' };
  }
  return result.confirmedAt === undefined
    ? {
        message: 'Enviamos su solicitud. El profesional la confirma o le propone otro horario.',
        title: 'Cita solicitada',
      }
    : {
        message: 'Su cita quedó confirmada: no necesita la aceptación del profesional.',
        title: 'Reserva confirmada',
      };
}

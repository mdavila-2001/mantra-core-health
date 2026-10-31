/**
 * Lo que solo declara el **personal de apoyo** al operar la agenda (agenda combinada). Vive aparte para que `scheduling.types.ts`
 * no siga creciendo; las interfaces de la cita directa y de la lista de espera lo extienden.
 */

/** Los campos de la lista de espera que son del personal de apoyo. */
export interface WaitlistSupportFields {
  /**
   * El horario concreto desde el que se anotó (agenda combinada del personal
   * de apoyo). **Propuesta**: la API lo usa para decidir con
   * `SupportAccessPolicy` si esa persona puede manejar la espera de ese
   * doctor, servicio y espacio.
   */
  readonly bookableSlotId?: string;
}

/** Los campos de la cita directa que son del personal de apoyo. */
export interface DirectAppointmentSupportFields {
  /**
   * La atención de quien **llegó sin cita**, para el personal de apoyo.
   * **Propuesta**: con `true` la API autoriza `schedule.walk_in` (y no
   * `schedule.create`) y deja la cita con la llegada ya registrada, en una sola
   * operación.
   */
  readonly walkIn?: boolean;
  /**
   * Solo para el personal de apoyo: el espacio donde se atiende. La API lo **contrasta** con los lugares
   * del doctor: si no atiende ahí, 403 «El doctor no atiende en ese espacio.». Sin declararlo, la API
   * toma el único que el doctor tiene.
   */
  readonly careSpaceId?: string;
  /**
   * Solo para el personal de apoyo: el servicio. Si el doctor no lo presta (o no tiene servicios propios), 403
   * «El doctor no presta ese servicio.»; sin declararlo, la API toma el único que el doctor tiene.
   */
  readonly healthcareServiceId?: string;
}

import type { ModalityCode } from './modalidades';

/* ============================================================================
    Horarios y equipos de un centro de diagnóstico, y la reserva de un estudio
    a partir de una orden médica.

    The real API publishes this contract (`diagnostic_units/center-schedule`);
    the simulator mirrors it for `development,demo`. Los nombres siguen el modelo
    (`diagnostic_study_offerings`, `diagnostic_equipment`).
    ========================================================================== */

/** Una franja de un día: `dayOfWeek` 1 = lunes … 7 = domingo; horas `HH:MM`. */
export interface ScheduleWindow {
  readonly dayOfWeek: number;
  readonly startTime: string;
  readonly endTime: string;
  /** This window's appointment length; absent, the block's `slotMinutes`. */
  readonly slotMinutes?: number;
  /** Rest after each appointment, as in the practitioner agenda; absent, none. */
  readonly gapMinutes?: number;
}

/** Un horario: sus franjas y cuánto dura cada turno. */
export interface ScheduleBlock {
  readonly windows: readonly ScheduleWindow[];
  readonly slotMinutes: number;
}

/** Horario propio de una modalidad (todas sus prestaciones). */
export interface ModalitySchedule {
  readonly modalityCode: ModalityCode;
  readonly schedule: ScheduleBlock;
}

/** Horario propio de un estudio puntual, que gana sobre el de su modalidad. */
export interface StudySchedule {
  readonly studyCode: string;
  readonly schedule: ScheduleBlock;
}

/** Own shift of one device: a production line that only attends inside it. */
export interface EquipmentSchedule {
  readonly equipmentId: string;
  readonly schedule: ScheduleBlock;
}

/**
 * El horario completo de un centro. Sin horarios propios, `general` vale para
 * todo; con alguno, `general` pasa a ser el de «Resto de servicios».
 */
export interface CenterSchedule {
  readonly general: ScheduleBlock;
  readonly modalities: readonly ModalitySchedule[];
  readonly studies: readonly StudySchedule[];
  /** Devices with a shift of their own; the rest follow their study's block. */
  readonly equipment?: readonly EquipmentSchedule[];
}

export type EquipmentStatus = 'OPERATIONAL' | 'MAINTENANCE' | 'OUT_OF_SERVICE';

/** Un equipo del centro, con la modalidad que atiende. */
export interface CenterEquipment {
  readonly id: string;
  readonly name: string;
  readonly manufacturer: string | null;
  readonly model: string | null;
  readonly serialNumber?: string | null;
  /** `null`: no limita turnos (un analizador, una centrífuga). */
  readonly modalityCode: ModalityCode | null;
  readonly status: EquipmentStatus;
  /** El concepto del tipo de equipo en el glosario, con su mapa de conexión de datos. */
  readonly glossaryConceptId: string | null;
}

/** Un estudio que el centro ofrece. */
export interface CenterStudy {
  readonly code: string;
  readonly name: string;
  readonly modalityCode: ModalityCode;
  readonly price: number | null;
  readonly currency: string | null;
  readonly preparation: string | null;
}

/** Body of `POST|PUT /diagnostic-units/{unitId}/equipment[/{equipmentId}]`. */
export interface CenterEquipmentInput {
  readonly name: string;
  readonly manufacturer: string | null;
  readonly serialNumber: string | null;
  /** `null`: an analyzer, which never limits appointments. */
  readonly modalityCode: ModalityCode | null;
}

/** Respuesta de `GET /diagnostic-units/{unitId}/schedule`. */
export interface CenterScheduleView {
  readonly unitId: string;
  readonly unitName: string;
  readonly kind: 'LABORATORY' | 'IMAGING';
  readonly schedule: CenterSchedule;
  readonly studies: readonly CenterStudy[];
  readonly equipment: readonly CenterEquipment[];
  readonly updatedAt: string | null;
  /**
   * Turnos ya reservados que no tienen un equipo operativo que los atienda
   * (se rompió o entró en mantenimiento después de reservarlos). El centro
   * tiene que reprogramarlos: el servidor no los cancela solo.
   */
  readonly bookingsWithoutEquipment?: number;
}

/** Respuesta 409 de `PUT …/schedule`: turnos ya reservados que quedarían afuera. */
export interface CenterScheduleConflict {
  readonly affectedBookings: number;
}

/** Un centro que puede hacer el estudio de una orden. */
export interface OrderBookingOption {
  readonly unitId: string;
  readonly unitName: string;
  readonly addressText: string | null;
  readonly price: number | null;
  readonly currency: string | null;
  /** Línea recta desde la casa del paciente; `null` si falta alguna ubicación. */
  readonly distanceKm: number | null;
  readonly nextStartAt: string | null;
  readonly preparation: string | null;
  readonly operationalEquipment: number;
}

/** Respuesta de `GET /diagnostic-results/me/orders/{orderId}/booking-options`. */
export interface OrderBookingOptions {
  readonly orderId: string;
  readonly studyCode: string;
  readonly studyName: string;
  readonly modalityCode: ModalityCode;
  readonly modalityLabel: string;
  readonly options: readonly OrderBookingOption[];
}

/** Un inicio de turno libre para un estudio en un centro. */
export interface StudyStart {
  readonly startAt: string;
  readonly endAt: string;
  readonly remaining: number;
  readonly capacity: number;
}

/** Respuesta de `GET /diagnostic-units/{unitId}/study-availability`. */
export interface StudyAvailability {
  readonly unitId: string;
  readonly studyCode: string;
  readonly origin: ScheduleOrigin;
  readonly items: readonly StudyStart[];
}

/** De qué nivel salió el horario que se aplicó a un estudio. */
export type ScheduleOrigin = 'STUDY' | 'MODALITY' | 'GENERAL';

/** El turno reservado de una orden. */
export interface OrderAppointment {
  readonly bookingId: string;
  readonly unitId: string;
  readonly unitName: string;
  readonly addressText: string | null;
  readonly startAt: string;
  readonly endAt: string;
  readonly studyName: string;
  readonly price: number | null;
  readonly currency: string | null;
  readonly preparation: string | null;
}

/** One booked slot of the active center, as `GET /diagnostic-units/me/bookings` returns it. */
export interface CenterBooking {
  readonly bookingId: string;
  readonly orderId: string | null;
  /** `null` when the API withholds or cannot resolve it. */
  readonly patientName: string | null;
  readonly studyName: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly siteName: string | null;
  /** Booking status code as the API sends it (`BOOKED`, `ARRIVED`, `FULFILLED`…). */
  readonly status: string;
  /** The device (production line) that attends it; `null` when no open line can. */
  readonly equipmentId?: string | null;
}

/** Response of `GET /diagnostic-units/me/bookings?from&to` (both required, at most 31 days apart). */
export interface CenterBookingPage {
  readonly items: readonly CenterBooking[];
  readonly count: number;
}

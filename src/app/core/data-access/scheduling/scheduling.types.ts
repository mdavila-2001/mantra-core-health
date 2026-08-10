/* ============================================================================
    Tipos de la vista para `scheduling` (M41).

    Se mapean desde los DTOs del backend, **no son ellos**: las fechas llegan
    como texto ISO y acá salen como `Date`, y los campos que el contrato declara
    opcionales se normalizan a `undefined` en vez de dejar `null` conviviendo
    con la ausencia.

    ## Por qué todo estado sigue siendo un uuid

    `statusConceptId`, `resourceTypeConceptId` y compañía viajan como uuid de
    concepto porque así los emite el modelo: los estados son datos de catálogo,
    no un enum del código. Quien los muestre los traduce con
    `TerminologyClient.readConceptLabels`, igual que la ficha de paciente. No se
    ramifica por el uuid: se ramifica por lo que el contrato **sí** declara como
    derivado (`remainingCapacity`, `available`).
    ========================================================================== */

/** Un recurso agendable: la agenda de un profesional, un box, un equipo. */
export interface AgendaResource {
  readonly id: string;
  readonly name: string;
  readonly resourceTypeConceptId: string;
  /** Tabla a la que apunta el recurso, p. ej. `health_practitioner_profiles`. */
  readonly resourceRefType: string;
  readonly resourceRefId: string;
  readonly practiceId: string | null;
  /** Zona horaria del recurso, p. ej. `America/La_Paz`. */
  readonly timeZone: string | null;
  readonly capacity: number;
  readonly stateConceptId: string;
}

/** Los recursos agendables de una organización. */
export interface AgendaResourcePage {
  readonly items: readonly AgendaResource[];
  readonly count: number;
}

/** Filtros de `GET /scheduling/resources`. `tenantId` es obligatorio. */
export interface AgendaResourceQuery {
  readonly tenantId: string;
  readonly practiceId?: string;
  readonly resourceType?: string;
  readonly includeInactive?: boolean;
}

/**
 * Un cupo de la agenda.
 *
 * `id` es el que se manda a `POST /scheduling/slots/{id}/holds` para reservar:
 * sin este listado no había forma de obtenerlo desde fuera de la base.
 */
export interface AgendaSlot {
  readonly id: string;
  readonly resourceId: string;
  readonly scheduleTemplateId: string | null;
  readonly startAt: Date;
  readonly endAt: Date;
  readonly capacity: number;
  readonly remainingCapacity: number;
  readonly statusConceptId: string;
  readonly serviceConceptId: string | null;
}

/**
 * Una ventana de cupos.
 *
 * `truncated` no es cosmético: una agenda a la que le faltan huecos sin avisar
 * se lee como una agenda llena, que es exactamente la lectura contraria.
 */
export interface AgendaSlotPage {
  readonly items: readonly AgendaSlot[];
  readonly count: number;
  readonly limit: number;
  readonly truncated: boolean;
}

/** Filtros de `GET /scheduling/slots`. La ventana es obligatoria. */
export interface AgendaSlotQuery {
  readonly resourceId?: string;
  readonly scheduleTemplateId?: string;
  /** Inicio de la ventana consultada. */
  readonly from: Date;
  /** Fin de la ventana, exclusivo. */
  readonly to: Date;
  /** Sólo los cupos abiertos y con capacidad libre: lo que se puede ofrecer. */
  readonly onlyAvailable?: boolean;
  readonly limit?: number;
}

/**
 * Una cita confirmada.
 *
 * `startAt` puede ser `undefined` aunque la cita exista: el instante se toma
 * del cupo, y una cita que quedó sin cupo no tiene ninguno que mostrar.
 */
export interface Booking {
  readonly id: string;
  readonly patientProfileId?: string;
  readonly resourceId?: string;
  readonly bookableSlotId?: string;
  readonly startAt?: Date;
  readonly endAt?: Date;
  readonly statusConceptId: string;
  readonly serviceConceptId?: string;
  readonly bookingChannelConceptId?: string;
  readonly confirmedAt?: Date;
  readonly checkedInAt?: Date;
  readonly reasonText?: string;
  readonly createdAt: Date;
}

/** Una ventana de citas. */
export interface BookingPage {
  readonly items: readonly Booking[];
  readonly count: number;
  readonly limit: number;
  readonly truncated: boolean;
}

/** Filtros de `GET /scheduling/bookings`. Todos opcionales. */
export interface BookingQuery {
  readonly patientProfileId?: string;
  readonly resourceId?: string;
  readonly from?: Date;
  readonly to?: Date;
  /** Incluye canceladas y ausencias, que por omisión no vienen. */
  readonly includeCancelled?: boolean;
  readonly limit?: number;
}

/* ---- el flujo de reserva: hold → confirm ---------------------------------
   El backend lo exige en dos pasos, y no es ceremonia: el hold decrementa la
   capacidad con `FOR UPDATE` (anti-double-booking) y expira solo — TTL de la
   política, 300 s por defecto. Un hold vencido no se puede confirmar. */

/** Lo que pide la retención. El paciente puede resolverlo la sesión (rol PATIENT). */
export interface NewHold {
  readonly patientProfileId?: string;
}

/** Una retención vigente de un cupo (UC-41-05). */
export interface SlotHold {
  readonly id: string;
  /**
   * Token de un solo uso con el que se confirma. **Se entrega una sola vez**:
   * quien lo pierda pierde la retención y tiene que volver a retener.
   */
  readonly holdToken: string;
  /** Hasta cuándo vale. Pasado este instante, el confirm se rechaza. */
  readonly expiresAt: Date;
  /** Cupos que quedan libres en el slot después de esta retención. */
  readonly remainingCapacity: number;
}

/** Canal por el que se origina la reserva. Del DTO del backend. */
export type BookingChannel = 'PORTAL' | 'DESK' | 'PHONE';

/** Cuerpo del confirm (UC-41-06). `tenantId` porque opera fuera del RLS. */
export interface BookingConfirmation {
  readonly tenantId: string;
  readonly patientProfileId: string;
  readonly channel: BookingChannel;
  readonly reasonText?: string;
}

/** La cita recién confirmada. */
export interface BookingConfirmed {
  readonly id: string;
  readonly bookableSlotId: string;
  readonly statusConceptId: string;
  readonly remindersScheduled: number;
}

/**
 * Cancelación de una cita (UC-41-09).
 *
 * `isNoShow` no es un matiz: es lo que dispara el cargo de la política. Una
 * cancelación avisada no se cobra.
 */
export interface BookingCancellation {
  readonly cancelledBy: 'PATIENT' | 'PROVIDER';
  readonly isNoShow?: boolean;
}

export interface BookingCancelled {
  readonly bookingId: string;
  /** Cargo aplicado, si la política lo contempla y fue no-show. */
  readonly feeAmount?: string;
  readonly capacityReleased: boolean;
}

/** Resultado del check-in (UC-41-10). */
export interface BookingCheckedIn {
  readonly bookingId: string;
  readonly checkedInAt: Date;
}

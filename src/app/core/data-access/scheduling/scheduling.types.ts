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

/**
 * **Dónde** se atiende con un recurso — la mitad que le faltaba a la agenda.
 *
 * El backend lo deriva de lo que el recurso ya declara: la asignación de rol
 * vigente si apunta a un profesional, el espacio de atención si apunta a un
 * box. No hay columna nueva detrás, y por eso el dato no puede discrepar del
 * que guarda `practice`.
 *
 * `addressText` viene compuesto en una línea desde el servidor: la dirección se
 * guarda en piezas y decidir cómo se juntan es del dato, no de cada pantalla.
 */
export interface AgendaResourceSite {
  readonly id: string;
  readonly name: string;
  /** Código único dentro de la práctica. */
  readonly code: string;
  /** Dirección en una línea, o `null` si la sede no tiene ninguna cargada. */
  readonly addressText: string | null;
  /** Zona horaria de la sede, p. ej. `America/La_Paz`. */
  readonly timeZone: string | null;
}

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
  /**
   * Dónde se atiende con este recurso.
   *
   * `null` es un estado **corriente**, no un error: un recurso sin asignación
   * vigente con sede no tiene dónde que mostrar, y la agenda sigue sirviendo
   * para elegir horario. Quien lo pinte tiene que decir «sin consultorio
   * registrado», nunca dejar el hueco.
   */
  readonly site: AgendaResourceSite | null;
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
  /**
   * Cita clínica que respalda la reserva, si la tiene.
   *
   * Es el valor que acepta el check-in de un encuentro en su `appointmentId` —y
   * el único que acepta: el `id` de esta reserva apunta a otra tabla—. Llega
   * `null` cuando la reserva no tiene cita clínica detrás, que hoy es el caso
   * corriente porque la reserva nace en la agenda y la cita clínica es un
   * registro posterior.
   */
  readonly appointmentId?: string | null;
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

/**
 * Reprogramación de una cita (UC-41-08): moverla a otro cupo sin cancelarla.
 *
 * No es una transición de estado: el backend libera el cupo viejo, ocupa el
 * nuevo y la cita queda como estaba (confirmada o con llegada). Sólo se
 * reprograma una cita vigente; lo demás responde 422.
 */
export interface BookingReschedule {
  readonly toSlotId: string;
  readonly reasonText?: string;
}

export interface BookingRescheduled {
  readonly bookingId: string;
  readonly fromSlotId: string;
  readonly toSlotId: string;
}

/** Resultado del check-in (UC-41-10). */
export interface BookingCheckedIn {
  readonly bookingId: string;
  readonly checkedInAt: Date;
}

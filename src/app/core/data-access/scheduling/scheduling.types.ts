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
  /**
   * Nombre del profesional detrás del recurso, cuando la referencia apunta a
   * un perfil profesional y la persona pudo resolverse. `null` para salas,
   * equipos, o si el nombre no se pudo resolver — en ese caso la pantalla cae
   * a `name`, que es lo que mostraba siempre.
   */
  readonly practitionerName: string | null;
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
/**
 * Estado de pago de una cita (TAREA-13 punto 5).
 *
 * Son **tres**, y el del medio es el que existe porque el propietario lo pidió:
 * un booleano no puede decir «parcialmente pagada». `reembolsada` quedó fuera
 * a propósito.
 */
export type PaymentStateCode = 'PENDING' | 'PARTIALLY_PAID' | 'PAID';

/**
 * El estado de pago tal como lo publica la API.
 *
 * La **etiqueta la manda el servidor**: la pantalla no traduce estados. Y
 * `markedByUserId`/`markedAt` viajan siempre porque marcar una cita como pagada
 * es una afirmación sobre el dinero de alguien y no puede quedar sin autor.
 */
export interface PaymentStateInfo {
  readonly state: PaymentStateCode;
  readonly label: string;
  readonly conceptId: string;
  /** Marca **separada** del estado: se puede estar a medio pagar con seguro o sin él. */
  readonly insuranceUsed: boolean;
  readonly markedByUserId: string;
  readonly markedAt: Date;
}

/** Cuerpo de `PUT /scheduling/bookings/:id/payment-state`. */
export interface NewPaymentState {
  readonly state: PaymentStateCode;
  readonly insuranceUsed?: boolean;
}

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
  /**
   * El estado de pago, **si alguien lo marcó**.
   *
   * Ausente no es «pendiente de pago»: pendiente es algo que alguien firmó, la
   * ausencia es que del pago todavía no se dijo nada. Comprobalo con
   * `if (cita.paymentState)`, nunca con un valor por defecto.
   */
  readonly paymentState?: PaymentStateInfo;
  readonly startAt?: Date;
  readonly endAt?: Date;
  readonly statusConceptId: string;
  readonly serviceConceptId?: string;
  readonly bookingChannelConceptId?: string;
  readonly confirmedAt?: Date;
  readonly checkedInAt?: Date;
  readonly reasonText?: string;
  /**
   * Nombre del paciente.
   *
   * Viaja con la **misma regla que el motivo**: lo manda el servidor sólo al
   * titular y al profesional que atiende en esa agenda. Ausente no significa
   * «no tiene nombre», significa «no te corresponde verlo».
   */
  readonly patientName?: string;
  /**
   * Por qué la cita está como está, cuando el último cambio lo explicó.
   *
   * Es lo que hace que una cancelación deje de ser un cartel mudo: el paciente
   * ve que su médico la canceló **y** por qué, sin salir de su lista. Ausente
   * cuando el último cambio no exigía motivo o la cita es anterior a la
   * corrección #14.
   */
  /**
   * De cuándo se movió, si la cita se reprogramó (TJ-2).
   *
   * Ausente cuando nunca se movió — que no es lo mismo que «se movió y no sé
   * desde cuándo». Es el instante original, ya resuelto por el servidor.
   */
  readonly rescheduledFrom?: Date;

  readonly statusReason?: BookingStatusReason;
  /**
   * La demora que informó el profesional sobre este turno (P8).
   *
   * Llega con la cita —y no sólo como notificación— a propósito: el aviso
   * in-app puede no haberse entregado (cuenta sin portal, preferencia en
   * contra, campana sin abrir) y el turno tiene que poder explicarse solo.
   */
  readonly delayNotice?: BookingDelayNotice;
  readonly createdAt: Date;
}

/** Una demora informada por el profesional (P8 · registro del cliente 3.5). */
export interface BookingDelayNotice {
  /** Minutos de demora estimados. */
  readonly delayMinutes: number;
  /** Lo que el profesional escribió, si escribió algo. */
  readonly message?: string;
  /** Cuándo la informó. */
  readonly announcedAt: Date;
}

/** Desde qué lado del mostrador se hizo el cambio. */
export type BookingActorKind = 'PATIENT' | 'PROVIDER';

/** El motivo del último cambio de una cita, tal como lo devuelve la API. */
export interface BookingStatusReason {
  readonly reasonText: string;
  readonly actorKind?: BookingActorKind;
  readonly toStateConceptId?: string;
  readonly changedAt: Date;
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

/**
 * Cuerpo de la **solicitud** (corrección #11).
 *
 * Mismo cuerpo que el confirm menos los recordatorios: la cita nace pendiente
 * de que el profesional la acepte, y recordar un turno que todavía puede
 * rechazarse sería prometer algo que nadie comprometió.
 */
export type BookingRequest = BookingConfirmation;

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
  /**
   * **Obligatorio** (corrección #14): el servidor rechaza la cancelación sin
   * motivo, y con relleno («na», «prueba») también. Se le muestra a la otra
   * parte en el detalle de su cita.
   */
  readonly reasonText: string;
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
  /**
   * **Obligatorio** (corrección #14): mover un turno le cambia el día a alguien,
   * y esa persona ve el motivo en el detalle de su cita.
   */
  readonly reasonText: string;
}

export interface BookingRescheduled {
  readonly bookingId: string;
  readonly fromSlotId: string;
  readonly toSlotId: string;
}

/**
 * Lo que devuelven aceptar, iniciar y completar (correcciones #11 y #15).
 *
 * Los tres son la misma clase de acto —una transición que decide el
 * profesional— y quien los llama hace lo mismo con la respuesta: releer.
 */
export interface BookingDecision {
  readonly bookingId: string;
  /** Estado en el que quedó la cita. */
  readonly statusConceptId: string;
  readonly occurredAt: Date;
}

/** Resultado del check-in (UC-41-10). */
export interface BookingCheckedIn {
  readonly bookingId: string;
  readonly checkedInAt: Date;
}

/* ---- construcción de agenda (M41) -----------------------------------------
   Las cinco fases del alta: recurso → política → plantilla → generación de
   slots → excepción. Cada una persiste contra su propio `POST`, y su respuesta
   entrega el identificador que la fase siguiente necesita. Los cuerpos se
   mandan campo a campo en el cliente: el backend valida con
   `forbidNonWhitelisted`, así que un opcional en `undefined` es un 400. */

/** Tipo de recurso agendable. Es el enum del DTO, no un concepto de catálogo. */
export type ResourceType = 'PRACTITIONER' | 'ROOM' | 'EQUIPMENT';
export const RESOURCE_TYPES: readonly ResourceType[] = ['PRACTITIONER', 'ROOM', 'EQUIPMENT'];

/** Cuerpo de `POST /scheduling/resources` (UC-41-01). */
export interface NewAgendaResource {
  readonly tenantId: string;
  readonly resourceType: ResourceType;
  /** Tabla referenciada, p. ej. `practitioner_profiles`. */
  readonly resourceRefType: string;
  readonly resourceRefId: string;
  readonly name: string;
  readonly practiceId?: string;
  /** Zona horaria IANA del recurso, p. ej. `America/La_Paz`. */
  readonly timeZone?: string;
  /** Atenciones simultáneas que admite (≥ 1). */
  readonly capacity?: number;
}

/** La respuesta mínima del alta de recurso: el `id` es lo que sigue usándose. */
export interface AgendaResourceCreated {
  readonly id: string;
  readonly name: string;
  readonly stateConceptId: string;
}

/** Cuerpo de `POST /scheduling/booking-policies` (UC-41-01). */
export interface NewBookingPolicy {
  readonly tenantId: string;
  readonly code: string;
  readonly name: string;
  readonly practiceId?: string;
  readonly minNoticeMinutes?: number;
  readonly maxAdvanceDays?: number;
  readonly cancellationWindowMinutes?: number;
  /** Cargo por inasistencia; viaja como texto (`@IsNumberString` en el DTO). */
  readonly noShowFeeAmount?: string;
  readonly maxActivePerPatient?: number;
  /** Vigencia de la retención del slot, en segundos (≥ 30, por defecto 300). */
  readonly holdTtlSeconds?: number;
}

export interface BookingPolicyCreated {
  readonly id: string;
  readonly code: string;
  readonly stateConceptId: string;
}

/** Una franja semanal de la plantilla (`ScheduleRuleDto`). */
export interface ScheduleRule {
  /** 0 = domingo … 6 = sábado. */
  readonly dayOfWeek: number;
  /** Hora de inicio `HH:MM` o `HH:MM:SS`. */
  readonly startTime: string;
  /** Hora de fin `HH:MM` o `HH:MM:SS`. */
  readonly endTime: string;
  readonly slotMinutes?: number;
  readonly capacityPerSlot?: number;
  /**
   * El respiro entre una consulta y la siguiente, en minutos.
   *
   * El generador avanza `slotMinutes + gapMinutes`, pero **cada turno sigue
   * durando `slotMinutes`**: el respiro separa un turno del siguiente, no
   * alarga la consulta.
   *
   * **Ausente ≡ 0.** La columna es anulable y nadie está obligado a
   * declararlo, así que el formulario no manda `0` cuando el médico no eligió
   * respiro: «no lo dijo» y «dijo que no hay» se guardan distinto.
   */
  readonly gapMinutes?: number;
}

/** Cuerpo de `POST /scheduling/resources/:id/templates` (UC-41-02). */
export interface NewScheduleTemplate {
  readonly name: string;
  /** Al menos una franja: sin franjas no hay agenda que generar. */
  readonly rules: readonly ScheduleRule[];
  readonly slotMinutes?: number;
  readonly bookingPolicyId?: string;
  readonly validFrom?: string;
  readonly validTo?: string;
}

export interface ScheduleTemplateCreated {
  readonly id: string;
  readonly name: string;
  /** Franjas creadas. */
  readonly ruleCount: number;
  readonly statusConceptId: string;
}

/** Cuerpo de `POST /scheduling/templates/:id/generate-slots` (UC-41-03). */
export interface GenerateSlotsRequest {
  /** Inicio de la ventana a materializar (ISO 8601). */
  readonly from: string;
  /** Fin de la ventana, exclusivo (ISO 8601). */
  readonly to: string;
}

/**
 * Resultado de la materialización. Es idempotente: los slots que ya existían
 * se conservan y se cuentan en `skipped`.
 */
export interface SlotsGenerated {
  readonly templateId: string;
  readonly created: number;
  readonly skipped: number;
}

/**
 * Tipo de excepción de disponibilidad (`ExceptionType`).
 *
 * Son **siete**, no tres. Los cuatro que faltaban —`VACATION`, `CONFERENCE`,
 * `ERRAND`, `OTHER`— existían en la base desde siempre; lo que no existía era
 * quien los publicara, así que el front no tenía de dónde sacarlos y mandaba
 * `ABSENCE` para todo. Ese era el defecto que arregla la TAREA-11 punto 4.
 *
 * **No los pongas en un `<select>` a mano.** La lista que se muestra viene de
 * `GET /scheduling/exception-types`, que además dice cuál exige explicación y
 * cuál abre horario en vez de cerrarlo. Esta unión existe para tipar el envío,
 * no para dibujar la pantalla.
 */
export type AvailabilityExceptionType =
  | 'ABSENCE'
  | 'HOLIDAY'
  | 'VACATION'
  | 'CONFERENCE'
  | 'ERRAND'
  | 'EXTRA'
  | 'OTHER';
export const AVAILABILITY_EXCEPTION_TYPES: readonly AvailabilityExceptionType[] = [
  'ABSENCE',
  'HOLIDAY',
  'VACATION',
  'CONFERENCE',
  'ERRAND',
  'EXTRA',
  'OTHER',
];

/**
 * Un motivo del catálogo, tal como lo publica la API.
 *
 * La pantalla **no decide** ninguna de las tres reglas: el servidor manda la
 * etiqueta en castellano, si el motivo obliga a escribir texto y si bloquea o
 * abre horario. Duplicar cualquiera de las tres acá sería tener dos verdades.
 */
export interface AvailabilityExceptionTypeOption {
  readonly type: AvailabilityExceptionType;
  readonly conceptId: string;
  readonly label: string;
  /** Elegirlo obliga a explicar por qué. Hoy es `OTHER`, y sólo él. */
  readonly requiresText: boolean;
  /** `false` en `EXTRA`, que **abre** disponibilidad en vez de cerrarla. */
  readonly blocks: boolean;
}

export interface AvailabilityExceptionTypeList {
  readonly items: readonly AvailabilityExceptionTypeOption[];
}

/** Cuerpo de `POST /scheduling/resources/:id/exceptions` (UC-41-04). */
export interface NewAvailabilityException {
  readonly exceptionType: AvailabilityExceptionType;
  readonly startAt: string;
  readonly endAt: string;
  readonly reason?: string;
  /** `true` cuando la excepción **añade** disponibilidad extraordinaria. */
  readonly isAvailable?: boolean;
}

export interface AvailabilityExceptionCreated {
  readonly id: string;
  /** Slots libres que quedaron bloqueados por la excepción. */
  readonly blockedSlots: number;
}

/* ==========================================================================
   P8 · lista de espera y avisos de demora
   ========================================================================== */

/** Alta en la lista de espera (`POST /scheduling/waitlist`, UC-41-11). */
export interface NewWaitlistEntry {
  readonly tenantId: string;
  readonly patientProfileId: string;
  /** Agenda en la que se espera. Opcional: se puede esperar «con cualquiera». */
  readonly resourceId?: string;
  /** Desde cuándo sirve un cupo. */
  readonly desiredFrom?: Date;
  /** Hasta cuándo. */
  readonly desiredTo?: Date;
  /** A mayor valor, antes se promueve. */
  readonly priority?: number;
}

/** Lo que devuelve el alta en la lista de espera. */
export interface WaitlistEntryCreated {
  readonly id: string;
  readonly priority: number;
  readonly statusConceptId: string;
}

/**
 * Una espera activa, tal como la lee «Mis turnos».
 *
 * `resourceLabel` viene resuelto del servidor: la pantalla necesita decir con
 * quién se espera, y un uuid no se lo dice a nadie.
 */
export interface WaitlistEntry {
  readonly id: string;
  readonly patientProfileId: string;
  readonly resourceId?: string;
  readonly resourceLabel: string;
  readonly desiredFrom?: Date;
  readonly desiredTo?: Date;
  readonly priority: number;
  readonly statusConceptId: string;
  readonly createdAt: Date;
}

/** Filtros de `GET /scheduling/waitlist`. */
export interface WaitlistQuery {
  readonly patientProfileId: string;
  /** `true` para incluir también las esperas ya cubiertas o canceladas. */
  readonly includeClosed?: boolean;
  readonly limit?: number;
}

/** Página de esperas. */
export interface WaitlistPage {
  readonly items: readonly WaitlistEntry[];
}

/** Lo que el profesional informa al demorarse. */
export interface DelayNotice {
  /** Minutos de demora estimados (entre 5 y 240). */
  readonly delayMinutes: number;
  /** Mensaje opcional para el paciente. */
  readonly message?: string;
  /** Ventana afectada, sólo para la demora de toda la agenda. */
  readonly from?: Date;
  readonly to?: Date;
}

/** Resultado de informar una demora. */
export interface DelayNoticeResult {
  /** Pacientes que recibieron el aviso in-app. */
  readonly notified: number;
  /** Citas alcanzadas por la demora. */
  readonly affected: number;
  readonly bookingIds: readonly string[];
  readonly detail: string;
}

/**
 * Una franja publicada, tal como la devuelve el `GET` de plantillas.
 *
 * La hora viene de pared —`09:00:00`— y no como instante: la regla dice «los
 * lunes de nueve a una», y convertirla obligaría a elegir un lunes concreto.
 */
export interface PublishedRule {
  readonly dayOfWeek: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly slotMinutes?: number;
  readonly capacityPerSlot?: number;
  /**
   * El respiro entre consultas, si la franja lo declara.
   *
   * Ausente ≡ 0. El servidor lo omite cuando la columna está nula, para que
   * «no declarado» y «cero» sigan siendo distinguibles.
   */
  readonly gapMinutes?: number;
}

/** Lo que deja retirar un horario (`DELETE /scheduling/templates/:id`). */
export interface RetiredTemplate {
  readonly id: string;
  readonly statusConceptId: string;
  /** Cupos que nadie reservó y dejaron de publicarse. */
  readonly releasedSlots: number;
  /**
   * Cupos conservados por tener una cita detrás.
   *
   * Distinto de cero **no es un error**: es el historial que el retiro respeta
   * a propósito, y la pantalla tiene que decirlo en vez de callarlo.
   */
  readonly keptSlots: number;
}

/** Una plantilla publicada, con sus franjas. */
export interface PublishedTemplate {
  readonly id: string;
  /**
   * Si el horario fue retirado y ya no se publica.
   *
   * Viene como booleano desde el servidor —no hay que comparar contra un uuid
   * de concepto— y es lo que separa el horario vigente del histórico: el
   * listado devuelve **todas** las plantillas del recurso, retiradas incluidas.
   */
  readonly retired: boolean;

  readonly name: string;
  readonly rules: readonly PublishedRule[];
  readonly slotMinutes?: number;
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly bookingPolicyId?: string;
  readonly statusConceptId: string;
}

/** La respuesta del listado de plantillas de un recurso. */
export interface PublishedTemplatePage {
  readonly items: readonly PublishedTemplate[];
  readonly count: number;
}

/** Un bloqueo de disponibilidad ya publicado. */
export interface PublishedException {
  readonly id: string;
  readonly exceptionTypeConceptId: string;
  readonly startAt: string;
  readonly endAt: string;
  /** Por qué. Lo lee el profesional, no el paciente. */
  readonly reason?: string;
  /** `true` cuando la excepción ABRE disponibilidad en vez de cerrarla. */
  readonly isAvailable?: boolean;
}

/** La respuesta del listado de excepciones de un recurso. */
export interface AvailabilityExceptionPage {
  readonly items: readonly PublishedException[];
  readonly count: number;
}

/**
 * Alta de una cita puntual — el doctor asigna (AG-2).
 *
 * «Volvé el jueves a las 10»: nace confirmada, el paciente se entera por la
 * campana con la salida de «pedir cambio». No hay paso de aceptación.
 */
export interface NewDirectAppointment {
  readonly patientProfileId: string;
  /** La agenda del doctor donde ocurre; elegirla ES elegir la sede. */
  readonly resourceId: string;
  readonly startAt: string;
  /** Libre a propósito: la cirugía de 3 h y la consulta de 45 conviven. */
  readonly durationMinutes: number;
  readonly reasonText?: string;
  /**
   * Por qué medio ocurre la atención.
   *
   * **Omitirlo significa presencial** — es lo que fueron todas las citas hasta
   * que existió este conjunto, así que no se manda un valor que nadie eligió.
   * No confundir con el canal de la RESERVA, que dice cómo se pidió el turno.
   */
  readonly channel?: ModalidadDeAtencion;
}

/**
 * Por qué medio ocurre la atención.
 *
 * Los códigos son los del catálogo de la API (`APPT_CH_*`) y por eso van en
 * castellano: son el contrato, no texto de pantalla. Lo que la persona lee sale
 * de {@link MODALIDADES}.
 */
export type ModalidadDeAtencion = 'PRESENCIAL' | 'TELECONSULTA' | 'DOMICILIO';

/** Las modalidades con su nombre para la pantalla, en orden de uso. */
export const MODALIDADES: readonly {
  readonly valor: ModalidadDeAtencion;
  readonly nombre: string;
}[] = [
  { valor: 'PRESENCIAL', nombre: 'En el consultorio' },
  { valor: 'TELECONSULTA', nombre: 'Por videollamada' },
  { valor: 'DOMICILIO', nombre: 'A domicilio' },
];

/** Lo que la cita puntual devuelve. */
export interface DirectAppointmentCreated {
  readonly bookingId: string;
  readonly bookableSlotId: string;
  readonly statusConceptId: string;
  /**
   * Horarios libres que la cita retiró al pisar cupos ofrecidos. Se muestra
   * como AVISO («esto quitó N horarios disponibles»), no como pregunta.
   */
  readonly retractedSlots: number;
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AgendaResource,
  AgendaResourceCreated,
  AgendaResourcePage,
  AgendaResourceQuery,
  AgendaSlot,
  AgendaSlotPage,
  AgendaSlotQuery,
  AvailabilityExceptionCreated,
  TemplateReactivated,
  AvailabilityExceptionTypeList,
  ActivityTypeList,
  ShiftSlotsRequest,
  SlotsShifted,
  CloseSlotsRequest,
  SlotsClosed,
  NewPaymentState,
  PaymentStateInfo,
  Booking,
  BookingCancellation,
  BookingCancelled,
  BookingCheckedIn,
  BookingDecision,
  BookingConfirmation,
  BookingConfirmed,
  BookingPage,
  BookingPolicyCreated,
  BookingQuery,
  BookingRequest,
  BookingReschedule,
  BookingRescheduled,
  BookingDelayNotice,
  BookingStatusReason,
  DelayNotice,
  DelayNoticeResult,
  GenerateSlotsRequest,
  NewAgendaResource,
  NewAvailabilityException,
  NewBookingPolicy,
  NewHold,
  NewScheduleTemplate,
  ScheduleTemplateCreated,
  SlotHold,
  SlotsGenerated,
  NewWaitlistEntry,
  WaitlistEntry,
  WaitlistEntryCreated,
  WaitlistPage,
  WaitlistQuery,
  PublishedTemplatePage,
  RetiredTemplate,
  AvailabilityExceptionPage,
  NewDirectAppointment,
  DirectAppointmentCreated,
} from './scheduling.types';

/**
 * Cliente de `scheduling` (M41): la lectura de la agenda y el ciclo de la
 * reserva.
 *
 * ## Por qué la lectura existe recién desde 2026-08-07
 *
 * El módulo se había construido entero de escritura: se generaban cupos y se
 * confirmaban citas, pero no había forma de *verlos*. Sin `GET /scheduling/slots`
 * tampoco se podía obtener el `slotId` que exige `POST /scheduling/slots/{id}/holds`,
 * así que reservar era imposible desde fuera de la base de datos.
 *
 * ## El ciclo de reserva es de dos pasos, y no por ceremonia
 *
 * `placeHold` retiene el cupo (anti-double-booking, con TTL) y `confirmHold`
 * lo convierte en cita con el token que la retención entregó **una sola vez**.
 * Un hold vencido no se puede confirmar: la pantalla lo trata como paso a
 * repetir, no como error terminal.
 *
 * ## Lista de espera y avisos de demora (P8)
 *
 * Desde el carril P8 el cliente cubre las dos: anotarse en lista de espera y
 * leerla —«estás en espera» dejó de ser una suposición de la pantalla sobre un
 * POST que ya devolvió— y el aviso de demora del profesional, que no mueve el
 * turno: avisa que empieza más tarde.
 *
 * Los recordatorios los programa el servidor al aceptar la cita (24 h y 2 h) y
 * los entrega su worker; el cliente no los pide.
 */
@Injectable({
  providedIn: 'root',
})
export class SchedulingClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /scheduling/resources` — los recursos agendables de la organización.
   *
   * @param query - Organización (obligatoria) y filtros opcionales.
   * @returns Los recursos, con su capacidad y su zona horaria.
   */
  listResources(query: AgendaResourceQuery): Observable<AgendaResourcePage> {
    // Parámetro a parámetro y nunca con un objeto: el backend valida con
    // `forbidNonWhitelisted`, y un opcional en `undefined` viaja como clave
    // declarada y vuelve 400.
    let params = new HttpParams().set('tenantId', query.tenantId);
    if (query.practiceId !== undefined) {
      params = params.set('practiceId', query.practiceId);
    }
    if (query.resourceType !== undefined) {
      params = params.set('resourceType', query.resourceType);
    }
    if (query.includeInactive !== undefined) {
      params = params.set('includeInactive', String(query.includeInactive));
    }

    return this.http
      .get<WireResourcePage>(this.url('/scheduling/resources'), { params })
      .pipe(map((body) => ({ ...body, items: body.items.map(toResource) })));
  }

  /**
   * `GET /scheduling/slots` — los cupos de una ventana.
   *
   * La ventana es obligatoria del lado del backend, y con razón: una agenda sin
   * acotar es la tabla entera de cupos del tenant.
   *
   * @param query - Ventana obligatoria, recurso y tope opcionales.
   * @returns Los cupos, con aviso de si la ventana quedó recortada.
   */
  listSlots(query: AgendaSlotQuery): Observable<AgendaSlotPage> {
    let params = new HttpParams()
      .set('from', query.from.toISOString())
      .set('to', query.to.toISOString());
    if (query.resourceId !== undefined) {
      params = params.set('resourceId', query.resourceId);
    }
    if (query.scheduleTemplateId !== undefined) {
      params = params.set('scheduleTemplateId', query.scheduleTemplateId);
    }
    if (query.onlyAvailable !== undefined) {
      params = params.set('onlyAvailable', String(query.onlyAvailable));
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http
      .get<WireSlotPage>(this.url('/scheduling/slots'), { params })
      .pipe(map((body) => ({ ...body, items: body.items.map(toSlot) })));
  }

  /**
   * `GET /scheduling/bookings` — las citas (UC-41-15).
   *
   * Sin filtros devuelve las próximas del tenant hasta el tope. Las canceladas
   * y las ausencias quedan fuera salvo que se pidan: una agenda del día que
   * mezcla lo vigente con lo cancelado no se puede leer de un vistazo.
   */
  searchBookings(query: BookingQuery = {}): Observable<BookingPage> {
    let params = new HttpParams();
    if (query.patientProfileId !== undefined) {
      params = params.set('patientProfileId', query.patientProfileId);
    }
    if (query.resourceId !== undefined) {
      params = params.set('resourceId', query.resourceId);
    }
    if (query.from !== undefined) {
      params = params.set('from', query.from.toISOString());
    }
    if (query.to !== undefined) {
      params = params.set('to', query.to.toISOString());
    }
    if (query.includeCancelled !== undefined) {
      params = params.set('includeCancelled', String(query.includeCancelled));
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http
      .get<WireBookingPage>(this.url('/scheduling/bookings'), { params })
      .pipe(map((body) => ({ ...body, items: body.items.map(toBooking) })));
  }

  /**
   * `PUT /scheduling/bookings/:id/payment-state` — marca el pago.
   *
   * `PUT` porque es idempotente: hay un estado por cita y volver a mandar el
   * mismo deja el mismo resultado.
   *
   * **Una cita cancelada o rechazada responde 422**, y es la regla del
   * propietario aplicada donde corresponde. Que la pantalla no ofrezca el botón
   * ahí es una cortesía, no la garantía.
   */
  setPaymentState(
    bookingId: string,
    body: NewPaymentState,
  ): Observable<PaymentStateInfo> {
    return this.http
      .put<WirePaymentState>(
        this.url(`/scheduling/bookings/${encodeURIComponent(bookingId)}/payment-state`),
        body,
      )
      .pipe(map((wire) => ({ ...wire, markedAt: new Date(wire.markedAt) })));
  }

  /** `GET /scheduling/bookings/:id` — una cita concreta (UC-41-15). */
  getBooking(bookingId: string): Observable<Booking> {
    return this.http
      .get<WireBooking>(this.url(`/scheduling/bookings/${encodeURIComponent(bookingId)}`))
      .pipe(map(toBooking));
  }

  /* -- Construcción de agenda (UC-41-01 → UC-41-04) ------------------------
     Las cinco fases del alta. Los cuerpos se arman campo a campo: un opcional
     en `undefined` viaja como clave declarada y el backend lo rechaza con 400
     (`forbidNonWhitelisted`). Cada respuesta trae el id que consume la fase
     siguiente. */

  /**
   * `POST /scheduling/resources` — da de alta un recurso agendable (UC-41-01).
   *
   * Es la primera fase: sin recurso no hay dónde colgar la plantilla ni las
   * excepciones. Devuelve el `id` que las dos usan en su ruta.
   */
  createResource(resource: NewAgendaResource): Observable<AgendaResourceCreated> {
    return this.http.post<AgendaResourceCreated>(this.url('/scheduling/resources'), {
      tenantId: resource.tenantId,
      resourceType: resource.resourceType,
      resourceRefType: resource.resourceRefType,
      resourceRefId: resource.resourceRefId,
      name: resource.name,
      ...(resource.practiceId === undefined ? {} : { practiceId: resource.practiceId }),
      ...(resource.timeZone === undefined ? {} : { timeZone: resource.timeZone }),
      ...(resource.capacity === undefined ? {} : { capacity: resource.capacity }),
    });
  }

  /**
   * `POST /scheduling/booking-policies` — define una política de reserva
   * (UC-41-01). Su `id` es opcional aguas abajo: la plantilla puede referirla
   * en `bookingPolicyId`.
   */
  createPolicy(policy: NewBookingPolicy): Observable<BookingPolicyCreated> {
    return this.http.post<BookingPolicyCreated>(this.url('/scheduling/booking-policies'), {
      tenantId: policy.tenantId,
      code: policy.code,
      name: policy.name,
      ...(policy.practiceId === undefined ? {} : { practiceId: policy.practiceId }),
      ...(policy.minNoticeMinutes === undefined
        ? {}
        : { minNoticeMinutes: policy.minNoticeMinutes }),
      ...(policy.maxAdvanceDays === undefined ? {} : { maxAdvanceDays: policy.maxAdvanceDays }),
      ...(policy.cancellationWindowMinutes === undefined
        ? {}
        : { cancellationWindowMinutes: policy.cancellationWindowMinutes }),
      ...(policy.noShowFeeAmount === undefined ? {} : { noShowFeeAmount: policy.noShowFeeAmount }),
      ...(policy.maxActivePerPatient === undefined
        ? {}
        : { maxActivePerPatient: policy.maxActivePerPatient }),
      ...(policy.holdTtlSeconds === undefined ? {} : { holdTtlSeconds: policy.holdTtlSeconds }),
    });
  }

  /**
   * `POST /scheduling/resources/:id/templates` — publica una plantilla con sus
   * franjas semanales (UC-41-02). Cada franja se arma campo a campo por la
   * misma razón que el cuerpo: sus opcionales no pueden viajar en `undefined`.
   */
  createTemplate(
    resourceId: string,
    template: NewScheduleTemplate,
  ): Observable<ScheduleTemplateCreated> {
    return this.http.post<ScheduleTemplateCreated>(
      this.url(`/scheduling/resources/${encodeURIComponent(resourceId)}/templates`),
      {
        name: template.name,
        rules: template.rules.map((rule) => ({
          dayOfWeek: rule.dayOfWeek,
          startTime: rule.startTime,
          endTime: rule.endTime,
          ...(rule.slotMinutes === undefined ? {} : { slotMinutes: rule.slotMinutes }),
          ...(rule.capacityPerSlot === undefined ? {} : { capacityPerSlot: rule.capacityPerSlot }),
          // Omitido y no `0`: la columna es anulable y el servidor distingue
          // «no lo declaró» de «declaró cero». Este cuerpo se arma campo por
          // campo a propósito —para no filtrar nada que el DTO no acepte— y
          // por eso agregar uno al tipo NO alcanza: hay que nombrarlo acá.
          ...(rule.gapMinutes === undefined ? {} : { gapMinutes: rule.gapMinutes }),
        })),
        ...(template.slotMinutes === undefined ? {} : { slotMinutes: template.slotMinutes }),
        ...(template.bookingPolicyId === undefined
          ? {}
          : { bookingPolicyId: template.bookingPolicyId }),
        ...(template.validFrom === undefined ? {} : { validFrom: template.validFrom }),
        ...(template.validTo === undefined ? {} : { validTo: template.validTo }),
      },
    );
  }

  /**
   * `GET /scheduling/resources/:id/templates` — el horario publicado del recurso.
   *
   * Es la lectura que faltaba hasta MAC-4: `scheduling` sólo tenía los dos POST
   * de plantilla, así que publicar un horario era escribirlo y no poder volver
   * a verlo. Un recurso sin plantillas responde `[]` con 200 —existe y todavía
   * no publicó—, y uno ajeno, 403.
   */
  listTemplates(resourceId: string): Observable<PublishedTemplatePage> {
    return this.http.get<PublishedTemplatePage>(
      this.url(`/scheduling/resources/${encodeURIComponent(resourceId)}/templates`),
    );
  }

  /**
   * `POST /scheduling/templates/:id/reactivate` — vuelve a activar un horario
   * pausado.
   *
   * **No regenera los cupos**, y la respuesta lo dice con `slotsPendientes`:
   * retirar los borró, y volver a crearlos es `generateSlots` con la ventana
   * que el profesional elija. Quien llame a esto tiene que ofrecer ese paso, o
   * el horario queda vigente sin un solo turno.
   */
  reactivateTemplate(templateId: string): Observable<TemplateReactivated> {
    return this.http.post<TemplateReactivated>(
      this.url(`/scheduling/templates/${encodeURIComponent(templateId)}/reactivate`),
      {},
    );
  }

  /**
   * `DELETE /scheduling/templates/:id` — retira un horario publicado.
   *
   * **Retira, no borra.** La plantilla queda en `TPL_RETIRED` y deja de
   * publicarse; se sueltan los cupos que nadie reservó y se conservan los que
   * tienen una cita detrás, viva o histórica.
   *
   * Responde **409** cuando el horario tiene citas comprometidas, con la lista
   * de las que hay que resolver primero en `details.bookingIds`.
   */
  retireTemplate(templateId: string): Observable<RetiredTemplate> {
    return this.http.delete<RetiredTemplate>(
      this.url(`/scheduling/templates/${encodeURIComponent(templateId)}`),
    );
  }

  /**
   * `POST /scheduling/templates/:id/generate-slots` — materializa los slots de
   * la plantilla en una ventana (UC-41-03). Idempotente: reejecutar no duplica,
   * los ya existentes vuelven como `skipped`.
   */
  generateSlots(templateId: string, window: GenerateSlotsRequest): Observable<SlotsGenerated> {
    return this.http.post<SlotsGenerated>(
      this.url(`/scheduling/templates/${encodeURIComponent(templateId)}/generate-slots`),
      { from: window.from, to: window.to },
    );
  }

  /**
   * `POST /scheduling/resources/:id/exceptions` — registra una excepción de
   * disponibilidad (UC-41-04). Bloquea los slots libres que se solapan; las
   * citas ya reservadas no se tocan.
   */
  /**
   * `GET /scheduling/resources/:id/exceptions` — los bloqueos de una ventana.
   *
   * Es el hueco gemelo del de plantillas: se podían crear y no leer. Sin esto,
   * el mes no puede distinguir un día **bloqueado** de un día **sin agenda**:
   * los dos aparecen sin cupos, y la diferencia es justamente lo que hay que
   * mostrarle al profesional.
   */
  /**
   * El catálogo de motivos de bloqueo (TAREA-11, punto 4).
   *
   * Es una lectura de catálogo, no de datos de nadie: no lleva recurso ni
   * ventana. Se pide una vez al abrir el formulario.
   *
   * **La respuesta manda sobre la pantalla.** Trae la etiqueta en castellano,
   * `requiresText` —hoy sólo `OTHER`— y `blocks`, que distingue el motivo que
   * abre horario del que lo cierra. Si mañana el propietario agrega un motivo,
   * aparece solo: acá no hay lista que actualizar.
   */
  /**
   * `GET /scheduling/activity-types` — las tipologías que la agenda pinta.
   *
   * Es catálogo: se pide una vez y no lleva recurso ni ventana. La etiqueta y
   * el tono los manda el servidor, así que agregar una tipología no exige
   * tocar el front.
   */
  /**
   * `POST /scheduling/resources/:id/shift-slots` — corre la agenda N minutos.
   *
   * Distinto de avisar demora, que **sólo avisa**: acá el turno de la persona
   * pasa a ser otro, y el servidor le manda el aviso.
   *
   * Es todo o nada: si un cupo no puede moverse porque su horario nuevo pisa
   * otra cita, no se mueve ninguno y responde 409.
   */
  shiftSlots(resourceId: string, body: ShiftSlotsRequest): Observable<SlotsShifted> {
    return this.http.post<SlotsShifted>(
      this.url(`/scheduling/resources/${encodeURIComponent(resourceId)}/shift-slots`),
      body,
    );
  }

  /**
   * `POST /scheduling/resources/:id/close-slots` — cierra ratos sueltos.
   *
   * Deja además la excepción que impide que regenerar los devuelva, que es
   * justamente lo que el pedido pone entre paréntesis.
   *
   * Un cupo con paciente citado responde **409** con los ids: cancelar el turno
   * de alguien es otro acto, con su motivo y su aviso.
   */
  closeSlots(resourceId: string, body: CloseSlotsRequest): Observable<SlotsClosed> {
    return this.http.post<SlotsClosed>(
      this.url(`/scheduling/resources/${encodeURIComponent(resourceId)}/close-slots`),
      body,
    );
  }

  listActivityTypes(): Observable<ActivityTypeList> {
    return this.http.get<ActivityTypeList>(this.url('/scheduling/activity-types'));
  }

  listExceptionTypes(): Observable<AvailabilityExceptionTypeList> {
    return this.http.get<AvailabilityExceptionTypeList>(
      this.url('/scheduling/exception-types'),
    );
  }

  listExceptions(
    resourceId: string,
    ventana: { from: Date; to: Date },
  ): Observable<AvailabilityExceptionPage> {
    const params = new HttpParams()
      .set('from', ventana.from.toISOString())
      .set('to', ventana.to.toISOString());
    return this.http.get<AvailabilityExceptionPage>(
      this.url(`/scheduling/resources/${encodeURIComponent(resourceId)}/exceptions`),
      { params },
    );
  }

  createException(
    resourceId: string,
    exception: NewAvailabilityException,
  ): Observable<AvailabilityExceptionCreated> {
    return this.http.post<AvailabilityExceptionCreated>(
      this.url(`/scheduling/resources/${encodeURIComponent(resourceId)}/exceptions`),
      {
        exceptionType: exception.exceptionType,
        startAt: exception.startAt,
        endAt: exception.endAt,
        ...(exception.reason === undefined ? {} : { reason: exception.reason }),
        ...(exception.isAvailable === undefined ? {} : { isAvailable: exception.isAvailable }),
      },
    );
  }

  /**
   * `POST /scheduling/appointments/direct` — la cita puntual (AG-2).
   *
   * El doctor asigna y el paciente SE ENTERA: la cita nace confirmada porque
   * ya se acordó en el consultorio. La API corre la regla madre antes de crear
   * nada — si el rato pisa un compromiso del profesional en CUALQUIERA de sus
   * sedes, responde 422 con qué, cuándo y dónde, y ese mensaje se puede
   * mostrar tal cual.
   */
  createDirectAppointment(cita: NewDirectAppointment): Observable<DirectAppointmentCreated> {
    return this.http.post<DirectAppointmentCreated>(this.url('/scheduling/appointments/direct'), {
      patientProfileId: cita.patientProfileId,
      resourceId: cita.resourceId,
      startAt: cita.startAt,
      durationMinutes: cita.durationMinutes,
      ...(cita.reasonText === undefined ? {} : { reasonText: cita.reasonText }),
      // Ausente = presencial: no se manda un valor que nadie eligió.
      //
      // Ojo al agregar campos acá: este cuerpo se arma nombre por nombre, así
      // que lo que el contrato declare y esta lista no repita **se descarta
      // en silencio** — la petición sale sin él y nada falla. Es el mismo
      // patrón que dejó la modalidad sin escribir del lado de la API.
      ...(cita.channel === undefined ? {} : { channel: cita.channel }),
    });
  }

  /**
   * `DELETE /scheduling/exceptions/:id` — quita un tiempo ocupado (AG-3).
   *
   * Borrar NO resucita los cupos que la excepción retiró: se regeneran con la
   * plantilla si corresponde. Está declarado así en el contrato.
   */
  deleteException(exceptionId: string): Observable<void> {
    return this.http.delete<void>(
      this.url(`/scheduling/exceptions/${encodeURIComponent(exceptionId)}`),
    );
  }

  /**
   * `POST /scheduling/slots/:id/holds` — retiene un cupo (UC-41-05).
   *
   * El backend bloquea el slot con `FOR UPDATE` y descuenta la capacidad: si
   * dos personas retienen a la vez, una recibe el cupo y la otra un rechazo,
   * nunca las dos. El cupo vuelve solo cuando la retención expira.
   */
  placeHold(slotId: string, hold: NewHold = {}): Observable<SlotHold> {
    return this.http
      .post<WireHold>(
        this.url(`/scheduling/slots/${encodeURIComponent(slotId)}/holds`),
        // Campo a campo: un opcional en `undefined` viaja como clave declarada
        // y el backend lo rechaza con 400 (`forbidNonWhitelisted`).
        hold.patientProfileId === undefined ? {} : { patientProfileId: hold.patientProfileId },
      )
      .pipe(map((body) => ({ ...body, expiresAt: new Date(body.expiresAt) })));
  }

  /**
   * `POST /scheduling/holds/:holdToken/confirm` — confirma la cita
   * (UC-41-06). Si la retención venció, el backend rechaza: se vuelve a
   * retener, no se reintenta el confirm.
   */
  confirmHold(holdToken: string, confirmation: BookingConfirmation): Observable<BookingConfirmed> {
    return this.http.post<BookingConfirmed>(
      this.url(`/scheduling/holds/${encodeURIComponent(holdToken)}/confirm`),
      {
        tenantId: confirmation.tenantId,
        patientProfileId: confirmation.patientProfileId,
        channel: confirmation.channel,
        ...(confirmation.reasonText === undefined ? {} : { reasonText: confirmation.reasonText }),
      },
    );
  }

  /**
   * `POST /scheduling/holds/:holdToken/request` — solicita la cita
   * (corrección #11).
   *
   * Es la otra salida de la misma retención: `confirmHold` compromete la agenda
   * y esto la **pide**. La cita nace pendiente y el profesional la acepta o la
   * rechaza desde su agenda.
   */
  requestHold(holdToken: string, request: BookingRequest): Observable<BookingConfirmed> {
    return this.http.post<BookingConfirmed>(
      this.url(`/scheduling/holds/${encodeURIComponent(holdToken)}/request`),
      {
        tenantId: request.tenantId,
        patientProfileId: request.patientProfileId,
        channel: request.channel,
        ...(request.reasonText === undefined ? {} : { reasonText: request.reasonText }),
      },
    );
  }

  /**
   * `POST /scheduling/bookings/:id/cancel` — cancela y libera el cupo
   * (UC-41-09). El cargo por inasistencia sólo aplica si la política lo
   * define **y** la cancelación va marcada como no-show.
   *
   * `reasonText` va siempre: desde la corrección #14 el servidor lo exige y
   * responde 422 sin él.
   */
  cancelBooking(
    bookingId: string,
    cancellation: BookingCancellation,
  ): Observable<BookingCancelled> {
    return this.http.post<BookingCancelled>(
      this.url(`/scheduling/bookings/${encodeURIComponent(bookingId)}/cancel`),
      {
        cancelledBy: cancellation.cancelledBy,
        reasonText: cancellation.reasonText,
        ...(cancellation.isNoShow === undefined ? {} : { isNoShow: cancellation.isNoShow }),
      },
    );
  }

  /**
   * `POST /scheduling/bookings/:id/reschedule` — mueve la cita a otro cupo
   * (UC-41-08). Libera el cupo viejo y ocupa el nuevo en la misma operación;
   * el estado de la cita **no cambia**. Sólo se reprograma una cita vigente
   * —confirmada o con llegada—: lo demás responde 422.
   */
  rescheduleBooking(
    bookingId: string,
    reschedule: BookingReschedule,
  ): Observable<BookingRescheduled> {
    return this.http.post<BookingRescheduled>(
      this.url(`/scheduling/bookings/${encodeURIComponent(bookingId)}/reschedule`),
      {
        toSlotId: reschedule.toSlotId,
        // Obligatorio desde la corrección #14: sin motivo el servidor responde
        // 422 y la otra parte se quedaría sin saber por qué le movieron el día.
        reasonText: reschedule.reasonText,
      },
    );
  }

  /* -- lo que decide el profesional (correcciones #11 y #15) ---------------
     Aceptar, rechazar, iniciar y completar. Las cuatro validan estado y actor
     en el servidor; **ninguna valida el reloj**: una cita confirmada se puede
     empezar y cerrar en cualquier momento. */

  /**
   * `POST /scheduling/bookings/:id/accept` — el profesional acepta la solicitud.
   *
   * Recién acá hay compromiso: la cita pasa a confirmada, su cita clínica deja
   * de estar pendiente y se programan los recordatorios que la solicitud no
   * programó.
   */
  acceptBooking(
    bookingId: string,
    offsetsMinutes?: readonly number[],
  ): Observable<BookingDecision> {
    return this.decidir(bookingId, 'accept', {
      ...(offsetsMinutes === undefined ? {} : { reminderOffsetsMinutes: [...offsetsMinutes] }),
    });
  }

  /**
   * `POST /scheduling/bookings/:id/reject` — rechaza la solicitud, con motivo.
   *
   * Devuelve lo mismo que cancelar porque **es** una cancelación desde el otro
   * lado del mostrador: libera el cupo y el paciente ve el motivo.
   */
  rejectBooking(bookingId: string, reasonText: string): Observable<BookingCancelled> {
    return this.http.post<BookingCancelled>(
      this.url(`/scheduling/bookings/${encodeURIComponent(bookingId)}/reject`),
      { reasonText },
    );
  }

  /**
   * `POST /scheduling/bookings/:id/start` — inicia la atención.
   *
   * Disponible sobre cualquier cita confirmada **en cualquier momento**: el
   * backend no exige que haya llegado el día agendado (corrección #15).
   */
  startBooking(bookingId: string): Observable<BookingDecision> {
    return this.decidir(bookingId, 'start', {});
  }

  /** `POST /scheduling/bookings/:id/complete` — cierra la atención en curso. */
  completeBooking(bookingId: string): Observable<BookingDecision> {
    return this.decidir(bookingId, 'complete', {});
  }

  /** Las tres decisiones comparten forma de ida y de vuelta. */
  private decidir(
    bookingId: string,
    accion: 'accept' | 'start' | 'complete',
    cuerpo: Record<string, unknown>,
  ): Observable<BookingDecision> {
    return this.http
      .post<WireDecision>(
        this.url(`/scheduling/bookings/${encodeURIComponent(bookingId)}/${accion}`),
        cuerpo,
      )
      .pipe(map((body) => ({ ...body, occurredAt: new Date(body.occurredAt) })));
  }

  /** `POST /scheduling/bookings/:id/check-in` — registra la llegada (UC-41-10). */
  checkInBooking(bookingId: string): Observable<BookingCheckedIn> {
    return this.http
      .post<WireCheckedIn>(
        this.url(`/scheduling/bookings/${encodeURIComponent(bookingId)}/check-in`),
        {},
      )
      .pipe(map((body) => ({ ...body, checkedInAt: new Date(body.checkedInAt) })));
  }

  /* -- P8 · lista de espera ------------------------------------------------ */

  /**
   * `POST /scheduling/waitlist` — anota al paciente en la lista de espera
   * (UC-41-11).
   *
   * Es lo que ofrece la pantalla cuando **no** hay cupo: sin esto, un horario
   * completo es un callejón sin salida. Anotarse no reserva nada; cuando se
   * libera un cupo el paciente recibe el aviso y confirma por el flujo normal.
   */
  enrollWaitlist(entry: NewWaitlistEntry): Observable<WaitlistEntryCreated> {
    return this.http.post<WaitlistEntryCreated>(this.url('/scheduling/waitlist'), {
      tenantId: entry.tenantId,
      patientProfileId: entry.patientProfileId,
      ...(entry.resourceId === undefined ? {} : { resourceId: entry.resourceId }),
      ...(entry.desiredFrom === undefined ? {} : { desiredFrom: entry.desiredFrom.toISOString() }),
      ...(entry.desiredTo === undefined ? {} : { desiredTo: entry.desiredTo.toISOString() }),
      ...(entry.priority === undefined ? {} : { priority: entry.priority }),
    });
  }

  /**
   * `GET /scheduling/waitlist` — en qué esperas está el paciente.
   *
   * Por omisión sólo las activas: una espera ya cubierta no es una espera, y
   * mostrarla como tal haría creer que sigue pendiente.
   */
  listWaitlist(query: WaitlistQuery): Observable<WaitlistPage> {
    // Parámetro a parámetro, como el resto del cliente: el backend valida con
    // `forbidNonWhitelisted` y una clave en `undefined` vuelve 400.
    let params = new HttpParams().set('patientProfileId', query.patientProfileId);
    if (query.includeClosed === true) {
      params = params.set('includeClosed', 'true');
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http
      .get<WireWaitlistPage>(this.url('/scheduling/waitlist'), { params })
      .pipe(map((body) => ({ items: body.items.map(toWaitlistEntry) })));
  }

  /* -- P8 · «el médico se demora» ------------------------------------------ */

  /**
   * `POST /scheduling/bookings/:id/delay` — avisa una demora sobre un turno.
   *
   * No lo mueve ni toca su cupo: la cita sigue donde estaba y el paciente se
   * entera de que empieza más tarde.
   */
  delayBooking(bookingId: string, notice: DelayNotice): Observable<DelayNoticeResult> {
    return this.http.post<DelayNoticeResult>(
      this.url(`/scheduling/bookings/${encodeURIComponent(bookingId)}/delay`),
      {
        delayMinutes: notice.delayMinutes,
        ...(notice.message === undefined || notice.message === ''
          ? {}
          : { message: notice.message }),
      },
    );
  }

  /**
   * `POST /scheduling/resources/:id/delay` — «me demoro veinte minutos hoy».
   *
   * Alcanza a las citas vigentes de la ventana; por omisión, de ahora al fin
   * del día. Es como la demora ocurre en la práctica: es de la jornada, no de
   * un turno suelto.
   */
  delayResource(resourceId: string, notice: DelayNotice): Observable<DelayNoticeResult> {
    return this.http.post<DelayNoticeResult>(
      this.url(`/scheduling/resources/${encodeURIComponent(resourceId)}/delay`),
      {
        delayMinutes: notice.delayMinutes,
        ...(notice.message === undefined || notice.message === ''
          ? {}
          : { message: notice.message }),
        ...(notice.from === undefined ? {} : { from: notice.from.toISOString() }),
        ...(notice.to === undefined ? {} : { to: notice.to.toISOString() }),
      },
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

type WireHold = Omit<SlotHold, 'expiresAt'> & { readonly expiresAt: string };

type WireCheckedIn = Omit<BookingCheckedIn, 'checkedInAt'> & { readonly checkedInAt: string };

type WireDecision = Omit<BookingDecision, 'occurredAt'> & { readonly occurredAt: string };

/* ---- formas de transporte ------------------------------------------------
   Las fechas llegan como texto ISO. Se declaran acá y no en `scheduling.types`
   porque son del protocolo: quien consuma el cliente ve `Date`. */

interface WireResource extends Omit<AgendaResource, never> {
  readonly id: string;
}

interface WireResourcePage extends Omit<AgendaResourcePage, 'items'> {
  readonly items: readonly WireResource[];
}

type WireSlot = Omit<AgendaSlot, 'startAt' | 'endAt'> & {
  readonly startAt: string;
  readonly endAt: string;
};

interface WireSlotPage extends Omit<AgendaSlotPage, 'items'> {
  readonly items: readonly WireSlot[];
}

type WireBooking = Omit<
  Booking,
  | 'startAt'
  | 'endAt'
  | 'confirmedAt'
  | 'checkedInAt'
  | 'createdAt'
  | 'rescheduledFrom'
  | 'statusReason'
  | 'delayNotice'
  | 'paymentState'
> & {
  readonly startAt?: string | null;
  readonly endAt?: string | null;
  readonly confirmedAt?: string | null;
  readonly checkedInAt?: string | null;
  readonly createdAt: string;
  readonly rescheduledFrom?: string | null;
  readonly statusReason?: WireStatusReason | null;
  readonly delayNotice?: WireDelayNotice | null;
  readonly paymentState?: WirePaymentState | null;
};

type WirePaymentState = Omit<PaymentStateInfo, 'markedAt'> & {
  readonly markedAt: string;
};

type WireStatusReason = Omit<BookingStatusReason, 'changedAt'> & {
  readonly changedAt: string;
};

type WireDelayNotice = Omit<BookingDelayNotice, 'announcedAt'> & {
  readonly announcedAt: string;
};

type WireWaitlistEntry = Omit<WaitlistEntry, 'desiredFrom' | 'desiredTo' | 'createdAt'> & {
  readonly desiredFrom?: string | null;
  readonly desiredTo?: string | null;
  readonly createdAt: string;
};

interface WireWaitlistPage {
  readonly items: readonly WireWaitlistEntry[];
}

interface WireBookingPage extends Omit<BookingPage, 'items'> {
  readonly items: readonly WireBooking[];
}

/** Un recurso tal cual: no transporta fechas. */
function toResource(item: WireResource): AgendaResource {
  return { ...item };
}

function toSlot({ startAt, endAt, ...resto }: WireSlot): AgendaSlot {
  return { ...resto, startAt: new Date(startAt), endAt: new Date(endAt) };
}

/**
 * Una cita con sus cinco instantes convertidos.
 *
 * `startAt` y `endAt` pueden llegar `null` —cita sin cupo— y se normalizan a
 * ausencia: un `null` conviviendo con `undefined` obliga a comprobar los dos en
 * cada pantalla, y tarde o temprano alguna comprueba sólo uno.
 */
function toBooking({
  paymentState,
  startAt,
  endAt,
  confirmedAt,
  checkedInAt,
  createdAt,
  rescheduledFrom,
  statusReason,
  delayNotice,
  ...resto
}: WireBooking): Booking {
  return {
    ...resto,
    ...optionalDate('startAt', startAt),
    ...optionalDate('endAt', endAt),
    ...optionalDate('confirmedAt', confirmedAt),
    ...optionalDate('checkedInAt', checkedInAt),
    ...optionalDate('rescheduledFrom', rescheduledFrom),
    // Se OMITE cuando la API no lo mandó, en vez de normalizarse a un estado
    // por defecto: «nadie marcó nada» y «alguien marcó pendiente» son cosas
    // distintas, y la diferencia tiene que llegar hasta la pantalla.
    ...(paymentState === null || paymentState === undefined
      ? {}
      : {
          paymentState: {
            ...paymentState,
            markedAt: new Date(paymentState.markedAt),
          },
        }),
    ...(statusReason === null || statusReason === undefined
      ? {}
      : {
          statusReason: {
            ...statusReason,
            changedAt: new Date(statusReason.changedAt),
          },
        }),
    ...(delayNotice === null || delayNotice === undefined
      ? {}
      : {
          delayNotice: {
            ...delayNotice,
            announcedAt: new Date(delayNotice.announcedAt),
          },
        }),
    createdAt: new Date(createdAt),
  };
}

/** Una espera con sus tres instantes convertidos. */
function toWaitlistEntry({
  desiredFrom,
  desiredTo,
  createdAt,
  ...resto
}: WireWaitlistEntry): WaitlistEntry {
  return {
    ...resto,
    ...optionalDate('desiredFrom', desiredFrom),
    ...optionalDate('desiredTo', desiredTo),
    createdAt: new Date(createdAt),
  };
}

/** La clave con su fecha, o nada: `{}` no pisa, `undefined` sí lo haría. */
function optionalDate<K extends string>(
  key: K,
  value: string | null | undefined,
): Partial<Record<K, Date>> {
  return value === null || value === undefined
    ? {}
    : ({ [key]: new Date(value) } as Record<K, Date>);
}

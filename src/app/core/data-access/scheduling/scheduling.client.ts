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
  Booking,
  BookingCancellation,
  BookingCancelled,
  BookingCheckedIn,
  BookingConfirmation,
  BookingConfirmed,
  BookingPage,
  BookingPolicyCreated,
  BookingQuery,
  BookingReschedule,
  BookingRescheduled,
  GenerateSlotsRequest,
  NewAgendaResource,
  NewAvailabilityException,
  NewBookingPolicy,
  NewHold,
  NewScheduleTemplate,
  ScheduleTemplateCreated,
  SlotHold,
  SlotsGenerated,
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
 * ## Lo que este cliente sigue sin hacer
 *
 * Recordatorios y lista de espera: existen en el backend y entrarán con las
 * pantallas que los pidan.
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
      ...(policy.minNoticeMinutes === undefined ? {} : { minNoticeMinutes: policy.minNoticeMinutes }),
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
   * `POST /scheduling/bookings/:id/cancel` — cancela y libera el cupo
   * (UC-41-09). El cargo por inasistencia sólo aplica si la política lo
   * define **y** la cancelación va marcada como no-show.
   */
  cancelBooking(bookingId: string, cancellation: BookingCancellation): Observable<BookingCancelled> {
    return this.http.post<BookingCancelled>(
      this.url(`/scheduling/bookings/${encodeURIComponent(bookingId)}/cancel`),
      {
        cancelledBy: cancellation.cancelledBy,
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
        // Construimos el body campo a campo para no enviar propiedades opcionales
        // cuando no fueron proporcionadas.
        ...(reschedule.reasonText === undefined ? {} : { reasonText: reschedule.reasonText }),
      },
    );
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

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

type WireHold = Omit<SlotHold, 'expiresAt'> & { readonly expiresAt: string };

type WireCheckedIn = Omit<BookingCheckedIn, 'checkedInAt'> & { readonly checkedInAt: string };

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
  'startAt' | 'endAt' | 'confirmedAt' | 'checkedInAt' | 'createdAt'
> & {
  readonly startAt?: string | null;
  readonly endAt?: string | null;
  readonly confirmedAt?: string | null;
  readonly checkedInAt?: string | null;
  readonly createdAt: string;
};

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
  startAt,
  endAt,
  confirmedAt,
  checkedInAt,
  createdAt,
  ...resto
}: WireBooking): Booking {
  return {
    ...resto,
    ...optionalDate('startAt', startAt),
    ...optionalDate('endAt', endAt),
    ...optionalDate('confirmedAt', confirmedAt),
    ...optionalDate('checkedInAt', checkedInAt),
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

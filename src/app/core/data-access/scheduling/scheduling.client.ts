import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AgendaResource,
  AgendaResourcePage,
  AgendaResourceQuery,
  AgendaSlot,
  AgendaSlotPage,
  AgendaSlotQuery,
  Booking,
  BookingCancellation,
  BookingCancelled,
  BookingCheckedIn,
  BookingConfirmation,
  BookingConfirmed,
  BookingPage,
  BookingQuery,
  NewHold,
  SlotHold,
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
 * Reprogramar (`/reschedule`), recordatorios, lista de espera: existen en el
 * backend y entrarán con las pantallas que los pidan.
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

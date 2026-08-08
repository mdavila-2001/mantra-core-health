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
  BookingPage,
  BookingQuery,
} from './scheduling.types';

/**
 * Cliente de `scheduling` (M41) — **sólo lectura de la agenda**.
 *
 * ## Por qué existe recién ahora
 *
 * El módulo se había construido entero de escritura: se generaban cupos y se
 * confirmaban citas, pero no había forma de *verlos*. Sin `GET /scheduling/slots`
 * tampoco se podía obtener el `slotId` que exige `POST /scheduling/slots/{id}/holds`,
 * así que reservar era imposible desde fuera de la base de datos. Las tres
 * lecturas de acá son las que abrieron esa puerta.
 *
 * ## Lo que este cliente no hace
 *
 * No reserva, no reprograma y no cancela. Esas operaciones existen en el backend
 * y van a necesitar su propio flujo —con confirmación, motivo y política de
 * cancelación—, y meterlas acá antes de tener la pantalla que las pide sería
 * escribir código sin nadie que lo llame.
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

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

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

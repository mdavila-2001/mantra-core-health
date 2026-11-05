import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  CenterBookingPage,
  CenterSchedule,
  CenterScheduleView,
  EquipmentChanges,
  EquipmentStatus,
  EquipmentType,
  NewEquipment,
  OrderAppointment,
  OrderBookingOptions,
  ScheduleBlock,
  StudyAvailability,
} from './center-schedule.types';

/**
 * Horarios y equipos de un centro de diagnóstico, y la reserva de un estudio a
 * partir de la orden médica.
 *
 * Cada equipo que da turnos es una línea de producción con su propio horario:
 * la API los ofrece y reserva por equipo. Los instantes viajan en ISO y se
 * dejan como texto: la pantalla los formatea al mostrar.
 */
@Injectable({ providedIn: 'root' })
export class CenterScheduleClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /diagnostic-units/me/schedule` — el centro de la organización activa. */
  getMySchedule(): Observable<CenterScheduleView> {
    return this.http.get<CenterScheduleView>(this.url('/diagnostic-units/me/schedule'));
  }

  /** `GET /diagnostic-units/me/bookings` — the active center's bookings between `from` and `to`. */
  getMyBookings(from: Date, to: Date): Observable<CenterBookingPage> {
    const params = new HttpParams().set('from', from.toISOString()).set('to', to.toISOString());
    return this.http.get<CenterBookingPage>(this.url('/diagnostic-units/me/bookings'), { params });
  }

  /** `GET /diagnostic-units/{unitId}/schedule` — horario, estudios y equipos del centro. */
  getSchedule(unitId: string): Observable<CenterScheduleView> {
    return this.http.get<CenterScheduleView>(this.url(`/diagnostic-units/${encodeURIComponent(unitId)}/schedule`));
  }

  /**
   * `PUT /diagnostic-units/{unitId}/schedule` — publica el horario completo.
   * 409 si dejaría afuera turnos ya reservados (`affectedBookings`).
   */
  saveSchedule(unitId: string, schedule: CenterSchedule): Observable<CenterScheduleView> {
    return this.http.put<CenterScheduleView>(
      this.url(`/diagnostic-units/${encodeURIComponent(unitId)}/schedule`),
      schedule,
    );
  }

  /** `PATCH /diagnostic-units/{unitId}/equipment/{equipmentId}` — operativo o no. */
  setEquipmentStatus(unitId: string, equipmentId: string, status: EquipmentStatus): Observable<CenterScheduleView> {
    return this.updateEquipment(unitId, equipmentId, { status });
  }

  /** `GET /diagnostic-units/me/equipment-types` — the catalog a center picks its devices from. */
  getEquipmentTypes(): Observable<{ readonly items: readonly EquipmentType[] }> {
    return this.http.get<{ readonly items: readonly EquipmentType[] }>(this.url('/diagnostic-units/me/equipment-types'));
  }

  /** `POST /diagnostic-units/{unitId}/equipment` — 409 on a serial already used at the site. */
  addEquipment(unitId: string, body: NewEquipment): Observable<CenterScheduleView> {
    return this.http.post<CenterScheduleView>(this.url(`/diagnostic-units/${encodeURIComponent(unitId)}/equipment`), body);
  }

  /** `PATCH /diagnostic-units/{unitId}/equipment/{equipmentId}` — status, make, model, serial. */
  updateEquipment(unitId: string, equipmentId: string, changes: EquipmentChanges): Observable<CenterScheduleView> {
    return this.http.patch<CenterScheduleView>(
      this.url(`/diagnostic-units/${encodeURIComponent(unitId)}/equipment/${encodeURIComponent(equipmentId)}`),
      changes,
    );
  }

  /** `DELETE /diagnostic-units/{unitId}/equipment/{equipmentId}` — 409 when it already attended bookings. */
  removeEquipment(unitId: string, equipmentId: string): Observable<CenterScheduleView> {
    return this.http.delete<CenterScheduleView>(
      this.url(`/diagnostic-units/${encodeURIComponent(unitId)}/equipment/${encodeURIComponent(equipmentId)}`),
    );
  }

  /**
   * `PUT /diagnostic-units/{unitId}/equipment/{equipmentId}/schedule` — the device's own
   * hours; `null` puts it back on the general schedule. 409 with `affectedBookings`.
   */
  saveEquipmentSchedule(unitId: string, equipmentId: string, schedule: ScheduleBlock | null): Observable<CenterScheduleView> {
    return this.http.put<CenterScheduleView>(
      this.url(`/diagnostic-units/${encodeURIComponent(unitId)}/equipment/${encodeURIComponent(equipmentId)}/schedule`),
      { schedule },
    );
  }

  /** `GET /diagnostic-results/me/orders/{orderId}/booking-options` — centros que hacen el estudio de la orden. */
  getBookingOptions(orderId: string): Observable<OrderBookingOptions> {
    return this.http.get<OrderBookingOptions>(
      this.url(`/diagnostic-results/me/orders/${encodeURIComponent(orderId)}/booking-options`),
    );
  }

  /** `GET /diagnostic-units/{unitId}/study-availability` — turnos libres de un estudio. */
  getStudyAvailability(unitId: string, studyCode: string, from: Date, to: Date): Observable<StudyAvailability> {
    const params = new HttpParams()
      .set('studyCode', studyCode)
      .set('from', from.toISOString())
      .set('to', to.toISOString());
    return this.http.get<StudyAvailability>(
      this.url(`/diagnostic-units/${encodeURIComponent(unitId)}/study-availability`),
      { params },
    );
  }

  /**
   * `POST /diagnostic-results/me/orders/{orderId}/booking` — reserva el turno y queda
   * confirmado. 409 si el horario se ocupó en el medio (`slotTaken`) o si la
   * orden ya tiene turno.
   */
  bookOrder(orderId: string, unitId: string, startAt: string): Observable<OrderAppointment> {
    return this.http.post<OrderAppointment>(
      this.url(`/diagnostic-results/me/orders/${encodeURIComponent(orderId)}/booking`),
      { unitId, startAt },
    );
  }

  /** `DELETE /diagnostic-results/me/orders/{orderId}/booking` — cancela el turno de la orden. */
  cancelOrderBooking(orderId: string): Observable<void> {
    return this.http.delete<void>(this.url(`/diagnostic-results/me/orders/${encodeURIComponent(orderId)}/booking`));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

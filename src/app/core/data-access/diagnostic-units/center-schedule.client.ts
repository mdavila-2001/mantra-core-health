import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  CenterSchedule,
  CenterScheduleView,
  EquipmentStatus,
  OrderAppointment,
  OrderBookingOptions,
  StudyAvailability,
} from './center-schedule.types';

/**
 * Horarios y equipos de un centro de diagnóstico, y la reserva de un estudio a
 * partir de la orden médica.
 *
 * Contrato que hoy sólo implementa el simulador: ver `PENDIENTES-BACKEND.md`
 * (P-CENTRO-HORARIOS). Los instantes viajan en ISO y se dejan como texto: la
 * pantalla los formatea al mostrar.
 */
@Injectable({ providedIn: 'root' })
export class CenterScheduleClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

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
    return this.http.patch<CenterScheduleView>(
      this.url(`/diagnostic-units/${encodeURIComponent(unitId)}/equipment/${encodeURIComponent(equipmentId)}`),
      { status },
    );
  }

  /** `GET /diagnostic-orders/{orderId}/booking-options` — centros que hacen el estudio de la orden. */
  getBookingOptions(orderId: string): Observable<OrderBookingOptions> {
    return this.http.get<OrderBookingOptions>(
      this.url(`/diagnostic-orders/${encodeURIComponent(orderId)}/booking-options`),
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
   * `POST /diagnostic-orders/{orderId}/booking` — reserva el turno y queda
   * confirmado. 409 si el horario se ocupó en el medio (`slotTaken`) o si la
   * orden ya tiene turno.
   */
  bookOrder(orderId: string, unitId: string, startAt: string): Observable<OrderAppointment> {
    return this.http.post<OrderAppointment>(
      this.url(`/diagnostic-orders/${encodeURIComponent(orderId)}/booking`),
      { unitId, startAt },
    );
  }

  /** `DELETE /diagnostic-orders/{orderId}/booking` — cancela el turno de la orden. */
  cancelOrderBooking(orderId: string): Observable<void> {
    return this.http.delete<void>(this.url(`/diagnostic-orders/${encodeURIComponent(orderId)}/booking`));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

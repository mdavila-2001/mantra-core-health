import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { CaptureActivityEvents, CaptureActivityEventsResult } from './telemetry.types';

/**
 * Cliente de la ingesta de telemetría del M28 (`telemetry`).
 *
 * ## Lo que este cliente NO hace
 *
 * Los endpoints de gobierno (`/telemetry/event-schemas`, `/tracking-purposes`,
 * `/funnels`) son de `SECURITY_ADMIN` y se operan desde la API, no desde una
 * pantalla del portal. Acá solo está lo que el navegador manda.
 */
@Injectable({
  providedIn: 'root',
})
export class TelemetryClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `POST /telemetry/activity-events` — un lote de eventos de actividad.
   *
   * @param body - Entre 1 y 500 eventos.
   * @param keepalive - `true` cuando la pestaña se está ocultando o cerrando:
   *   el navegador termina de mandar la petición aunque la página ya no exista.
   *   Solo funciona con `withFetch()`, que es lo que usa `app.config.ts`.
   * @returns Cuántos se persistieron y cuántos descartó la API.
   */
  captureActivityEvents(
    body: CaptureActivityEvents,
    keepalive = false,
  ): Observable<CaptureActivityEventsResult> {
    return this.http.post<CaptureActivityEventsResult>(
      apiUrl(this.baseUrl, '/telemetry/activity-events'),
      body,
      { keepalive },
    );
  }
}

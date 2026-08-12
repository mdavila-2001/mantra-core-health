import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate, sinNulos } from '../wire';
import type {
  Geofence,
  GeofenceEvent,
  LastPosition,
  NewGeofence,
  NewGeofenceEvent,
  NewTrackedSubject,
  NewTrackingSession,
  NewTrip,
  OperationOk,
  PingBatch,
  PingsIngested,
  TrackedSubject,
  TrackingSession,
  Trip,
  TripClosure,
} from './geo.types';

/**
 * Cliente de `geo` (M13): rastreo de sujetos, sesiones, viajes y geocercas.
 *
 * **Diez comandos y una sola lectura**, `GET /geo/tracked-subjects/:id/
 * last-position`. No hay `GET` de colección de sujetos, sesiones, viajes ni
 * geocercas, así que las pantallas del módulo operan pegando identificadores.
 *
 * Todos los endpoints exigen `SECURITY_ADMIN` (o el comodín `SUPERADMIN`), y
 * los cuatro controllers del backend cuelgan del mismo prefijo `/geo`.
 *
 * **Ojo con `tenantId`.** `NewTrackedSubject.tenantId` y `NewGeofence.tenantId`
 * son campos de propiedad: el interceptor de tenant del backend los contrasta
 * con la cabecera `X-Tenant-Id` y responde 403 si difieren. En el sujeto es
 * opcional y conviene omitirlo; en la geocerca es obligatorio y tiene que ser
 * el tenant activo de la sesión.
 */
@Injectable({
  providedIn: 'root',
})
export class GeoClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /* -- La lectura ---------------------------------------------------------- */

  /**
   * `GET /geo/tracked-subjects/:trackedSubjectId/last-position`.
   *
   * Responde 404 en **dos casos distintos** —el sujeto no existe, o existe y no
   * tiene posiciones registradas—, y el código de error es el mismo en los dos.
   * Quien lo consuma no debería leer el mensaje para distinguirlos: hacerlo
   * revelaría si el identificador es real.
   */
  lastPosition(trackedSubjectId: string): Observable<LastPosition> {
    return this.http
      .get<LastPositionBody>(
        this.url(`/geo/tracked-subjects/${encodeURIComponent(trackedSubjectId)}/last-position`),
      )
      .pipe(map(toLastPosition));
  }

  /* -- Sujetos rastreados -------------------------------------------------- */

  /**
   * `POST /geo/tracked-subjects` — alta.
   *
   * No se permite un segundo sujeto activo con el mismo tipo e identificador
   * dentro de la organización: eso es un 409.
   */
  enrollTrackedSubject(subject: NewTrackedSubject): Observable<TrackedSubject> {
    return this.http
      .post<TrackedSubjectBody>(this.url('/geo/tracked-subjects'), subject)
      .pipe(map(toTrackedSubject));
  }

  /**
   * `POST /geo/tracked-subjects/:trackedSubjectId/pings` — ingesta por lote.
   *
   * Se rechaza con 422 si el sujeto no está activo o no tiene sesión abierta.
   */
  ingestPings(trackedSubjectId: string, batch: PingBatch): Observable<PingsIngested> {
    return this.http.post<PingsIngested>(
      this.url(`/geo/tracked-subjects/${encodeURIComponent(trackedSubjectId)}/pings`),
      batch,
    );
  }

  /**
   * `POST /geo/tracked-subjects/:trackedSubjectId/revoke-consent` — sin cuerpo.
   *
   * Suspende al sujeto y **cierra en cascada sus sesiones abiertas**. Repetirlo
   * sobre un sujeto ya suspendido es un 422.
   */
  revokeConsent(trackedSubjectId: string): Observable<OperationOk> {
    return this.http.post<OperationOk>(
      this.url(`/geo/tracked-subjects/${encodeURIComponent(trackedSubjectId)}/revoke-consent`),
      {},
    );
  }

  /* -- Sesiones y viajes --------------------------------------------------- */

  /** `POST /geo/tracking-sessions` — abrir. Solo sobre sujetos activos. */
  startTrackingSession(session: NewTrackingSession): Observable<TrackingSession> {
    return this.http
      .post<TrackingSessionBody>(this.url('/geo/tracking-sessions'), session)
      .pipe(map(toTrackingSession));
  }

  /**
   * `POST /geo/tracking-sessions/:sessionId/close` — sin cuerpo.
   *
   * Se rechaza con 422 si la sesión todavía tiene viajes en curso.
   */
  closeTrackingSession(sessionId: string): Observable<TrackingSession> {
    return this.http
      .post<TrackingSessionBody>(
        this.url(`/geo/tracking-sessions/${encodeURIComponent(sessionId)}/close`),
        {},
      )
      .pipe(map(toTrackingSession));
  }

  /** `POST /geo/trips` — iniciar. Uno en curso por sesión, y la sesión abierta. */
  startTrip(trip: NewTrip): Observable<Trip> {
    return this.http.post<TripBody>(this.url('/geo/trips'), trip).pipe(map(toTrip));
  }

  /** `POST /geo/trips/:tripId/close` — cerrar, con distancia y duración opcionales. */
  closeTrip(tripId: string, closure: TripClosure): Observable<Trip> {
    return this.http
      .post<TripBody>(this.url(`/geo/trips/${encodeURIComponent(tripId)}/close`), closure)
      .pipe(map(toTrip));
  }

  /* -- Geocercas ----------------------------------------------------------- */

  /**
   * `POST /geo/geofences` — crear.
   *
   * El nombre es único por organización (409) y la forma tiene que ser coherente
   * con la geometría (422): círculo con radio y centro, polígono con GeoJSON.
   */
  createGeofence(geofence: NewGeofence): Observable<Geofence> {
    return this.http
      .post<GeofenceBody>(this.url('/geo/geofences'), geofence)
      .pipe(map(toGeofence));
  }

  /** `POST /geo/geofence-events` — registrar un cruce. */
  recordGeofenceEvent(event: NewGeofenceEvent): Observable<GeofenceEvent> {
    return this.http
      .post<GeofenceEventBody>(this.url('/geo/geofence-events'), event)
      .pipe(map(toGeofenceEvent));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/* ---- formas de transporte ---------------------------------------------------
   Todas las marcas de tiempo del módulo son **instantes** —cuándo se capturó un
   punto, cuándo se abrió una sesión—, así que van por `maybeDate` y nunca por
   `maybeDateOnly`: anclarlas a medianoche local destruiría el dato.

   Las coordenadas y `distanceM` NO se convierten a número: llegan como texto
   desde `numeric` y así se quedan. Ver la cabecera de `geo.types.ts`. */

type ConFechasEnTexto<T, K extends keyof T> = Omit<T, K> &
  Partial<Readonly<Record<K, string | null>>>;

type LastPositionBody = Omit<LastPosition, 'accuracyM' | 'capturedAt' | 'recordedAt'> & {
  readonly accuracyM?: string | null;
  readonly capturedAt?: string | null;
  readonly recordedAt: string;
};

function toLastPosition(body: LastPositionBody): LastPosition {
  const { accuracyM, capturedAt, recordedAt, ...resto } = body;
  const capturado = maybeDate(capturedAt);

  return {
    ...resto,
    ...(accuracyM === null || accuracyM === undefined ? {} : { accuracyM }),
    ...(capturado === undefined ? {} : { capturedAt: capturado }),
    recordedAt: new Date(recordedAt),
  };
}

type TrackedSubjectBody = Omit<TrackedSubject, 'createdAt'> & { readonly createdAt: string };

function toTrackedSubject(body: TrackedSubjectBody): TrackedSubject {
  return { ...body, createdAt: new Date(body.createdAt) };
}

type TrackingSessionBody = ConFechasEnTexto<TrackingSession, 'startedAt' | 'endedAt'>;

function toTrackingSession(body: TrackingSessionBody): TrackingSession {
  const { startedAt, endedAt, ...resto } = body;
  const inicio = maybeDate(startedAt);
  const fin = maybeDate(endedAt);

  return {
    ...resto,
    ...(inicio === undefined ? {} : { startedAt: inicio }),
    ...(fin === undefined ? {} : { endedAt: fin }),
  };
}

type TripBody = ConFechasEnTexto<Trip, 'startedAt' | 'endedAt'> & {
  readonly trackingSessionId?: string | null;
  readonly distanceM?: string | null;
  readonly durationS?: number | null;
};

function toTrip(body: TripBody): Trip {
  const { startedAt, endedAt, ...resto } = body;
  const inicio = maybeDate(startedAt);
  const fin = maybeDate(endedAt);

  return {
    ...sinNulos<Omit<Trip, 'startedAt' | 'endedAt'>>(resto),
    ...(inicio === undefined ? {} : { startedAt: inicio }),
    ...(fin === undefined ? {} : { endedAt: fin }),
  };
}

type GeofenceBody = Omit<Geofence, 'createdAt'> & { readonly createdAt: string };

function toGeofence(body: GeofenceBody): Geofence {
  return { ...body, createdAt: new Date(body.createdAt) };
}

type GeofenceEventBody = Omit<GeofenceEvent, 'occurredAt' | 'recordedAt'> & {
  readonly occurredAt?: string | null;
  readonly recordedAt: string;
};

function toGeofenceEvent(body: GeofenceEventBody): GeofenceEvent {
  const { occurredAt, recordedAt, ...resto } = body;
  const ocurrio = maybeDate(occurredAt);

  return {
    ...resto,
    ...(ocurrio === undefined ? {} : { occurredAt: ocurrio }),
    recordedAt: new Date(recordedAt),
  };
}

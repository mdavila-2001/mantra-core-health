import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { ConNulos } from '../wire';
import type {
  InAppNotification,
  MyPreferences,
  UpdatePreferences,
  InAppNotificationPage,
  InAppReadResult,
  MarkAllReadResult,
  MyNotificationsQuery,
  NotificationCategory,
  NotificationDestination,
} from './notifications.types';

/**
 * Cliente de la bandeja in-app del M35 (`messaging`) — carril P1.
 *
 * ## Por qué un cliente aparte y no un método más en `community`
 *
 * Porque son dos backends con dos bandejas distintas, y meterlos en el mismo
 * cliente habría hecho invisible esa diferencia justo donde importa: quién
 * puede silenciar qué. `community.social_notifications` no tiene preferencias;
 * `messaging` sí, y son las que P9 va a exponer.
 *
 * ## Lo que este cliente NO hace
 *
 * `POST /notifications/requests` y `/internal/notifications/*` no están: la
 * primera es de un módulo de negocio pidiendo un envío —no de una pantalla— y
 * las segundas son del worker. Un navegador que pueda pedir el envío de una
 * notificación arbitraria es una superficie que nadie pidió.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /notifications/me` — mi bandeja, con el total sin leer.
   *
   * La campana la pide con `unread: true, limit: 1` para el badge y sin filtro
   * para el panel. Es la misma lectura porque es la misma bandeja.
   *
   * @param query - Filtro de no leídas, cursor y tope.
   * @returns Una página de notificaciones más el total sin leer.
   */
  listMine(query: MyNotificationsQuery = {}): Observable<InAppNotificationPage> {
    let params = new HttpParams();
    // Parámetro a parámetro y nunca con un objeto: el backend valida con
    // `forbidNonWhitelisted`, y un opcional en `undefined` viaja como clave
    // declarada y vuelve 400.
    if (query.unread !== undefined) {
      params = params.set('unread', String(query.unread));
    }
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http
      .get<WireNotificationPage>(this.url('/notifications/me'), { params })
      .pipe(map(toPage));
  }

  /**
   * `POST /notifications/in-app/:id/read` — marcar una como leída.
   *
   * Idempotente del lado del servidor: se conserva la primera lectura.
   *
   * @param id - La notificación que se abrió.
   * @returns Cuándo quedó leída y si ya lo estaba.
   */
  markRead(id: string): Observable<InAppReadResult> {
    return this.http
      .post<WireReadResult>(
        this.url(`/notifications/in-app/${encodeURIComponent(id)}/read`),
        {},
      )
      .pipe(
        map((body) => ({
          id: body.id,
          readAt: new Date(body.readAt),
          alreadyRead: body.alreadyRead,
        })),
      );
  }

  /**
   * `POST /notifications/in-app/read-all` — vaciar el badge.
   *
   * @returns Cuántas se marcaron y cuántas quedaron sin leer.
   */
  markAllRead(): Observable<MarkAllReadResult> {
    return this.http.post<MarkAllReadResult>(
      this.url('/notifications/in-app/read-all'),
      {},
    );
  }

  /**
   * `GET /notifications/preferences/me` — qué avisos quiero recibir.
   *
   * Devuelve **siempre las cuatro categorías**, haya filas guardadas o no.
   *
   * @returns Las categorías y la ventana de silencio, en UTC.
   */
  readPreferences(): Observable<MyPreferences> {
    return this.http.get<MyPreferences>(
      this.url('/notifications/preferences/me'),
    );
  }

  /**
   * `PUT /notifications/preferences/me` — guardar las preferencias.
   *
   * @param datos - Sólo lo que cambia.
   * @returns Las preferencias ya guardadas.
   */
  updatePreferences(datos: UpdatePreferences): Observable<MyPreferences> {
    return this.http.put<MyPreferences>(
      this.url('/notifications/preferences/me'),
      datos,
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/* ============================================================================
    La forma del transporte — ver `wire.ts`.
    ========================================================================== */

/** Una notificación tal como viaja: fechas en texto y opcionales en `null`. */
type WireNotification = ConNulos<{
  id: string;
  category: NotificationCategory;
  subject: string;
  bodyText: string;
  destination: NotificationDestination;
  payloadJson: unknown;
  unread: boolean;
  availableAt: string;
  readAt: string;
}>;

/** La página tal como viaja. */
interface WireNotificationPage {
  readonly items: readonly WireNotification[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
  readonly unreadCount: number;
}

/** El acuse de lectura tal como viaja. */
interface WireReadResult {
  readonly id: string;
  readonly readAt: string;
  readonly alreadyRead: boolean;
}

/**
 * Convierte una notificación del transporte al tipo de la vista.
 *
 * `availableAt` es obligatorio en el contrato, así que no pasa por `maybeDate`:
 * si faltara, la bandeja tendría un problema mayor que una fecha ausente.
 */
function toNotification(wire: WireNotification): InAppNotification {
  return {
    id: wire.id ?? '',
    ...(wire.category === null ? {} : { category: wire.category }),
    ...(wire.subject === null ? {} : { subject: wire.subject }),
    ...(wire.bodyText === null ? {} : { bodyText: wire.bodyText }),
    ...(wire.destination === null ? {} : { destination: wire.destination }),
    ...(wire.payloadJson === null ? {} : { payloadJson: wire.payloadJson }),
    unread: wire.unread ?? true,
    availableAt: new Date(wire.availableAt ?? ''),
    ...(wire.readAt === null || wire.readAt === undefined
      ? {}
      : { readAt: new Date(wire.readAt) }),
  };
}

/** Convierte la página entera. */
function toPage(body: WireNotificationPage): InAppNotificationPage {
  return { ...body, items: body.items.map(toNotification) };
}

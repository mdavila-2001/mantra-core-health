import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate, sinNulos, type ConNulos } from '../wire';
import type {
  MyInAppNotification,
  NotificationChannel,
  NotificationPreference,
  SetPreferenceInput,
} from './notifications.types';

/**
 * Carril 18 — canales, preferencias y bandeja in-app propios del usuario
 * autenticado (`messaging`, M35). Antes de este carril `RecipientPreferences`
 * solo se leía internamente al entregar; no había forma de que un usuario
 * configurara nada, ni de ver su propia bandeja desde el frontend.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /notifications/channels` — canales disponibles (interna, correo, WhatsApp, SMS, push). */
  listChannels(): Observable<readonly NotificationChannel[]> {
    return this.http
      .get<RespuestaCanales>(this.url('/notifications/channels'))
      .pipe(map((body) => body.items));
  }

  /** `GET /notifications/preferences` — mis preferencias ya declaradas. */
  getMyPreferences(): Observable<readonly NotificationPreference[]> {
    return this.http
      .get<RespuestaPreferencias>(this.url('/notifications/preferences'))
      .pipe(
        map((body) =>
          body.items.map((p) => sinNulos(p as ConNulos<NotificationPreference>)),
        ),
      );
  }

  /** `PUT /notifications/preferences` — alta o actualización por (canal, categoría). */
  setPreference(input: SetPreferenceInput): Observable<NotificationPreference> {
    return this.http
      .put<ConNulos<NotificationPreference>>(this.url('/notifications/preferences'), input)
      .pipe(map((body) => sinNulos(body)));
  }

  /** `GET /notifications/in-app` — mi bandeja, la más reciente primero. */
  listMyInApp(limit?: number): Observable<readonly MyInAppNotification[]> {
    let params = new HttpParams();
    if (limit !== undefined) {
      params = params.set('limit', String(limit));
    }
    return this.http
      .get<RespuestaBandeja>(this.url('/notifications/in-app'), { params })
      .pipe(map((body) => body.items.map(aNotificacion)));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

interface RespuestaCanales {
  readonly items: readonly NotificationChannel[];
}

interface RespuestaPreferencias {
  readonly items: readonly ConNulos<NotificationPreference>[];
}

interface WireNotificacion {
  readonly id: string;
  readonly categoryConceptId: string | null;
  readonly subject: string | null;
  readonly bodyText: string | null;
  readonly payloadJson?: unknown;
  readonly statusConceptId: string;
  readonly relatedResourceType: string | null;
  readonly relatedResourceId: string | null;
  readonly availableAt: string;
  readonly readAt: string | null;
}

interface RespuestaBandeja {
  readonly items: readonly WireNotificacion[];
  readonly count: number;
}

function aNotificacion(body: WireNotificacion): MyInAppNotification {
  const { availableAt, readAt, ...resto } = body;
  return {
    ...sinNulos(resto as ConNulos<Omit<MyInAppNotification, 'availableAt' | 'readAt'>>),
    availableAt: maybeDate(availableAt) ?? new Date(availableAt),
    ...(maybeDate(readAt) === undefined ? {} : { readAt: maybeDate(readAt) }),
  };
}

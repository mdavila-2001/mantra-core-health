import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';

/** Respuesta de `GET /notifications/web-push/config`. */
export interface WebPushConfig {
  /** `false` cuando el servidor no tiene claves VAPID: no se ofrece el push. */
  readonly enabled: boolean;
  readonly publicKey: string | null;
}

/** Lo que entrega `PushSubscription.toJSON()` y la API guarda cifrado. */
export interface WebPushSubscriptionBody {
  readonly endpoint: string;
  readonly keys: { readonly p256dh: string; readonly auth: string };
}

/**
 * Suscripción del navegador a los avisos push. La API guarda la suscripción
 * cifrada en el dispositivo de la cuenta; un navegador pertenece a una cuenta
 * a la vez.
 */
@Injectable({ providedIn: 'root' })
export class WebPushClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /notifications/web-push/config` — clave pública o `enabled: false`. */
  config(): Observable<WebPushConfig> {
    return this.http.get<WebPushConfig>(this.url('/notifications/web-push/config'));
  }

  /** `PUT /notifications/web-push/subscription` — guarda o refresca. */
  subscribe(body: WebPushSubscriptionBody): Observable<void> {
    return this.http.put<void>(this.url('/notifications/web-push/subscription'), body);
  }

  /** `DELETE /notifications/web-push/subscription` — quita este navegador. */
  unsubscribe(endpoint: string): Observable<void> {
    return this.http.delete<void>(this.url('/notifications/web-push/subscription'), {
      body: { endpoint },
    });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

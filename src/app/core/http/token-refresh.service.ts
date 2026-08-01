import { inject, Injectable } from '@angular/core';
import { finalize, shareReplay, tap, throwError, type Observable } from 'rxjs';

import { IamClient } from '../data-access/iam/iam.client';
import type { Session } from '../data-access/iam/iam.types';
import { SessionStore } from '../auth/session.store';
import { SessionStorage } from '../auth/session.storage';

/**
 * Refresco de la sesión, **con una sola petición en vuelo**.
 *
 * Si tres llamadas fallan con 401 a la vez —lo normal al volver de una pestaña
 * en segundo plano— y cada una pidiera su propio refresco, se gastarían tres de
 * los 20 intentos por minuto que admite la API y las tres rotarían el token
 * unas sobre otras: la última ganaría y las otras dos dejarían tokens muertos.
 *
 * Por eso el estado vive en un servicio y no en el interceptor: las funciones
 * interceptoras se ejecutan por petición y no tienen dónde recordar nada.
 */
@Injectable({
  providedIn: 'root',
})
export class TokenRefreshService {
  private readonly iam = inject(IamClient);
  private readonly session = inject(SessionStore);
  private readonly storage = inject(SessionStorage);

  /** Refresco en curso, compartido por todos los que lleguen mientras dure. */
  private inFlight: Observable<Session> | null = null;

  /**
   * Rota el par de tokens. Quien llame mientras hay uno en curso recibe **ese
   * mismo**, no uno nuevo.
   */
  refresh(): Observable<Session> {
    const current = this.inFlight;
    if (current !== null) {
      return current;
    }

    const refreshToken = this.session.refreshToken();
    if (refreshToken === null) {
      return throwError(() => new Error('No hay refresh token: la sesión no se puede renovar'));
    }

    const request = this.iam.refresh(refreshToken).pipe(
      tap((session) => {
        this.session.renew(session);
        // La rotación invalida el token que estaba guardado. No reescribirlo dejaría en
        // `localStorage` una credencial muerta, y la próxima recarga terminaría en el login
        // aunque la sesión en memoria estuviera perfecta.
        this.storage.writeRefreshToken(session.refreshToken);
      }),
      // Se libera pase lo que pase: si quedara ocupado tras un fallo, ningún
      // intento posterior podría volver a refrescar en toda la sesión.
      finalize(() => {
        this.inFlight = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.inFlight = request;

    return request;
  }
}

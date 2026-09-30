import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { MySession, PasswordChanged } from './iam.types';

interface WireMySession {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly ip?: string | null;
  readonly current: boolean;
}

/**
 * Seguridad de la **propia** cuenta (ID-24, CV-22): cambiar la contraseña, ver y
 * cerrar las sesiones abiertas, y cerrarlas todas.
 *
 * Es un cliente aparte de `IamClient` a propósito: `IamClient` está en el paquete
 * inicial —lo usa el login— y estas cuatro rutas sólo las toca la pantalla de
 * Seguridad, que se descarga al entrar. Sin `@Roles` en la API: la titularidad
 * sale del `id` del token.
 */
@Injectable({ providedIn: 'root' })
export class AccountSecurityClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `POST /iam/auth/change-password`. La contraseña actual y la nueva; la API
   * cierra las **otras** sesiones. Un error de contraseña es 422 (no 401): la
   * sesión sigue siendo válida.
   */
  changePassword(currentPassword: string, newPassword: string): Observable<PasswordChanged> {
    return this.http.post<PasswordChanged>(this.url('/iam/auth/change-password'), {
      currentPassword,
      newPassword,
    });
  }

  /** `GET /iam/me/sessions`. Las sesiones abiertas de la propia cuenta. */
  listMySessions(): Observable<readonly MySession[]> {
    return this.http.get<readonly WireMySession[]>(this.url('/iam/me/sessions')).pipe(
      map((rows) =>
        rows.map((row) => ({
          id: row.id,
          createdAt: new Date(row.createdAt),
          expiresAt: new Date(row.expiresAt),
          ...(row.ip === undefined || row.ip === null ? {} : { ip: row.ip }),
          current: row.current,
        })),
      ),
    );
  }

  /** `POST /iam/me/sessions/:id/revoke`. Cierra una sesión propia. */
  revokeMySession(sessionId: string): Observable<{ readonly revoked: boolean }> {
    return this.http.post<{ readonly revoked: boolean }>(
      this.url(`/iam/me/sessions/${encodeURIComponent(sessionId)}/revoke`),
      {},
    );
  }

  /** `POST /iam/auth/logout-all`. Cierra las sesiones de **todos** los dispositivos. */
  logoutAll(): Observable<{ readonly revokedSessions: number }> {
    return this.http.post<{ readonly revokedSessions: number }>(
      this.url('/iam/auth/logout-all'),
      {},
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

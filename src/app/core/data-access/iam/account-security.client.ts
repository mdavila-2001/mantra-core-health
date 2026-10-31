import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { DeviceCodeRequested, DeviceConfirmed, DeviceReportedNotMe, MyNetwork } from './iam-new-device';
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
 * cerrar las sesiones abiertas, cerrarlas todas y responder al aviso de dispositivo nuevo.
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

  /**
   * `POST /iam/me/devices/:id/confirm` — «Fui yo»: la persona reconoce el dispositivo, queda de confianza y el aviso
   * no vuelve a salir por él (idempotente). Un dispositivo ajeno es 404.
   *
   * **Confirmar «desde el propio dispositivo» no prueba nada** (el aviso lo ve quien inicia sesión, que puede ser
   * quien no debe): solo se confirma desde una sesión abierta en OTRO dispositivo de confianza, o con `code`, el
   * código de 8 dígitos que {@link requestDeviceCode} manda al correo verificado. Sin ninguno de los dos, 422
   * `DEVICE_CONFIRM_CODE_REQUIRED` (con `details.canRequestCode`); un código equivocado, de otro dispositivo o ya
   * usado, 422 `DEVICE_CONFIRM_CODE_INVALID`.
   */
  confirmDevice(deviceId: string, code?: string): Observable<DeviceConfirmed> {
    return this.http.post<DeviceConfirmed>(
      this.url(`/iam/me/devices/${encodeURIComponent(deviceId)}/confirm`),
      code === undefined ? {} : { code },
    );
  }

  /**
   * `POST /iam/me/devices/:id/confirm-code` — manda al correo **verificado** de la cuenta el código de 8 dígitos con el
   * que se confirma un dispositivo. Responde `{ sent, sentTo }` con la dirección **enmascarada**; `sent: false` si el
   * dispositivo ya era de confianza. Sin correo verificado, 422 `DEVICE_CONFIRM_NO_VERIFIED_EMAIL`. Tope: 3 por minuto.
   */
  requestDeviceCode(deviceId: string): Observable<DeviceCodeRequested> {
    return this.http.post<DeviceCodeRequested>(
      this.url(`/iam/me/devices/${encodeURIComponent(deviceId)}/confirm-code`),
      {},
    );
  }

  /**
   * `POST /iam/me/devices/:id/not-me` — «No fui yo»: el dispositivo deja de ser
   * de confianza y la API revoca **todas las demás** sesiones y refresh tokens
   * de la cuenta en un solo paso (`revokedSessions` es cuántas cerró). Es la ruta
   * atómica: no se arma con listar y revocar una por una.
   */
  reportDeviceNotMe(deviceId: string): Observable<DeviceReportedNotMe> {
    return this.http.post<DeviceReportedNotMe>(
      this.url(`/iam/me/devices/${encodeURIComponent(deviceId)}/not-me`),
      {},
    );
  }

  /** `GET /iam/me/network` — la dirección con la que la API ve esta conexión y cuántos saltos de proxy de confianza tiene. */
  getMyNetwork(): Observable<MyNetwork> {
    return this.http.get<MyNetwork>(this.url('/iam/me/network'));
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

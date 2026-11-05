import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { MfaFactor, MfaFactorRevoked, MfaReauth, MfaStatus, MfaTotpConfirmed, MfaTotpStarted } from './mfa.types';

interface WireMfaFactor {
  readonly id: string;
  readonly type: string;
  readonly state: string;
  readonly label?: string | null;
  readonly verifiedAt?: string | null;
  readonly createdAt: string;
}

interface WireMfaStatus {
  readonly required: boolean;
  readonly enrolled: boolean;
  readonly enrollmentRequired: boolean;
  readonly factors: readonly WireMfaFactor[];
}

/**
 * `MfaFactorResponseDto`: el factor recién creado. **No** trae `type`, `label` ni
 * `createdAt` (eso es de `GET /iam/me/mfa`) y su `state` es un concept id, no un
 * código: solo se usan el `id`, el `secret` y el `otpauthUri`.
 */
interface WireTotpStarted {
  readonly id: string;
  readonly userId?: string;
  readonly state?: string;
  readonly secret: string;
  readonly otpauthUri: string;
}

interface WireTotpConfirmed {
  readonly verified: boolean;
  readonly factorId: string;
  readonly verifiedAt: string;
}

function toFactor(row: WireMfaFactor): MfaFactor {
  return {
    id: row.id,
    type: row.type,
    state: row.state,
    ...(row.label === undefined || row.label === null ? {} : { label: row.label }),
    ...(row.verifiedAt === undefined || row.verifiedAt === null ? {} : { verifiedAt: new Date(row.verifiedAt) }),
    createdAt: new Date(row.createdAt),
  };
}

/**
 * La **verificación en dos pasos de la propia cuenta** (`/iam/me/mfa`).
 *
 * Solo opera sobre la cuenta del token: no hay `id` de usuario en ninguna ruta.
 * Es un cliente aparte para que el cierre de sesión, el login y la guarda que
 * restringe la aplicación no arrastren la pantalla de alta.
 */
@Injectable({ providedIn: 'root' })
export class MfaClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /iam/me/mfa` — si alguna política la exige, si ya la tiene y sus factores (sin secretos). */
  getStatus(): Observable<MfaStatus> {
    return this.http.get<WireMfaStatus>(apiUrl(this.baseUrl, '/iam/me/mfa')).pipe(
      map((body) => ({
        required: body.required,
        enrolled: body.enrolled,
        enrollmentRequired: body.enrollmentRequired,
        factors: body.factors.map(toFactor),
      })),
    );
  }

  /**
   * `POST /iam/me/mfa/totp` — empieza el alta de la app autenticadora. **Exige reautenticación**: la contraseña
   * actual (`currentPassword`) o un código de un factor ya verificado (`mfaCode`); sin ninguna, `422
   * MFA_REAUTH_REQUIRED`, y si no valen, `422 MFA_REAUTH_FAILED`. La API devuelve el `secret` y el `otpauthUri`
   * **una sola vez** y retira los intentos anteriores sin confirmar.
   */
  startTotp(reauth: MfaReauth, label?: string): Observable<MfaTotpStarted> {
    return this.http
      .post<WireTotpStarted>(apiUrl(this.baseUrl, '/iam/me/mfa/totp'), { ...(label === undefined || label === '' ? {} : { label }), ...reauth })
      .pipe(map((body) => ({ factorId: body.id, secret: body.secret, otpauthUri: body.otpauthUri })));
  }

  /**
   * `POST /iam/me/mfa/:factorId/revoke` — quita un método propio. **Exige la misma reautenticación** que agregarlo.
   * Si era el último confirmado, el segundo paso de la cuenta queda apagado y una organización que lo exija vuelve a
   * pedir el alta: la persona queda sin acceso a ella hasta darlo de alta de nuevo.
   */
  revokeFactor(factorId: string, reauth: MfaReauth): Observable<MfaFactorRevoked> {
    return this.http.post<MfaFactorRevoked>(apiUrl(this.baseUrl, `/iam/me/mfa/${encodeURIComponent(factorId)}/revoke`), { ...reauth });
  }

  /**
   * `POST /iam/me/mfa/totp/:factorId/confirm` — confirma el factor con el código
   * vigente de la app. Un código inválido es `422 MFA_CODE_INVALID`.
   */
  confirmTotp(factorId: string, code: string): Observable<MfaTotpConfirmed> {
    return this.http
      .post<WireTotpConfirmed>(apiUrl(this.baseUrl, `/iam/me/mfa/totp/${encodeURIComponent(factorId)}/confirm`), { code })
      .pipe(map((body) => ({ verified: body.verified, factorId: body.factorId, verifiedAt: new Date(body.verifiedAt) })));
  }
}

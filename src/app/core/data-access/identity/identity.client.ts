import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate } from '../wire';
import type {
  LicenseVerificationRequest,
  VerificationCase,
  VerificationRequest,
  VerificationRequestResult,
} from './identity.types';

/**
 * El caso tal como llega.
 *
 * Las dos fechas son `nullable: true` en la entidad y el servicio las copia tal
 * cual, así que **llegan como `null`, no ausentes** — igual que en `profiles`.
 */
interface VerificationCaseBody {
  readonly id: string;
  readonly status: string;
  readonly openedAt?: string | null;
  readonly completedAt?: string | null;
}

/**
 * Cliente de `identity/me`: verificaciones que inicia el propio titular.
 *
 * Ninguna ruta recibe a quién se verifica: el backend lo resuelve del usuario
 * autenticado en vez de leerlo del cuerpo, justamente para que nadie pueda
 * pedir la verificación de otro.
 */
@Injectable({
  providedIn: 'root',
})
export class IdentityClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `POST /identity/me/identity-verification` — el paciente verifica su identidad. */
  requestPatientIdentityVerification(
    request: VerificationRequest,
  ): Observable<VerificationRequestResult> {
    return this.http.post<VerificationRequestResult>(
      this.url('/identity/me/identity-verification'),
      { evidenceFileId: request.evidenceFileId },
    );
  }

  /** `POST /identity/me/practitioner/identity-verification`. */
  requestPractitionerIdentityVerification(
    request: VerificationRequest,
  ): Observable<VerificationRequestResult> {
    return this.http.post<VerificationRequestResult>(
      this.url('/identity/me/practitioner/identity-verification'),
      { evidenceFileId: request.evidenceFileId },
    );
  }

  /** `POST /identity/me/practitioner/license-verification` — la matrícula. */
  requestPractitionerLicenseVerification(
    request: LicenseVerificationRequest,
  ): Observable<VerificationRequestResult> {
    return this.http.post<VerificationRequestResult>(
      this.url('/identity/me/practitioner/license-verification'),
      {
        evidenceFileId: request.evidenceFileId,
        ...(request.jurisdictionAuthorizationId === undefined
          ? {}
          : { jurisdictionAuthorizationId: request.jurisdictionAuthorizationId }),
      },
    );
  }

  /** `GET /identity/me/verification-cases/:caseId`. */
  getVerificationCase(caseId: string): Observable<VerificationCase> {
    return this.http
      .get<VerificationCaseBody>(this.url(`/identity/me/verification-cases/${caseId}`))
      .pipe(
        // `maybeDate` y no `=== undefined`: con `null`, aquella comparación era
        // falsa y `new Date(null)` daba **1970-01-01**. La pantalla comprueba
        // `@if (abierto.openedAt)`, y una fecha de 1970 es verdadera, así que un
        // caso sin fecha de apertura mostraba «1/1/1970» en vez de ocultar el
        // dato. Mismo defecto que el corregido en `profiles`.
        map((body) => ({
          id: body.id,
          status: body.status,
          openedAt: maybeDate(body.openedAt),
          completedAt: maybeDate(body.completedAt),
        })),
      );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

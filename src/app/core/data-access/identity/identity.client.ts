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

  /**
   * `GET /identity/me/verification-cases` — todos los casos del titular.
   *
   * El backend lo expone desde siempre y nadie lo pedía: la pantalla mostraba
   * **un** caso, el que estuviera abierto, y con eso quien ya se verificó ve un
   * formulario vacío como si nunca hubiera hecho el trámite. El historial es lo
   * que responde «¿esto ya lo mandé?», que es la pregunta que la gente trae.
   *
   * Sin argumentos: el sujeto lo resuelve el backend desde la sesión, igual que
   * el resto de `identity/me`.
   */
  listVerificationCases(): Observable<readonly VerificationCase[]> {
    return this.http
      .get<readonly VerificationCaseBody[]>(this.url('/identity/me/verification-cases'))
      .pipe(map((cuerpos) => cuerpos.map(toVerificationCase)));
  }

  /** `GET /identity/me/verification-cases/:caseId`. */
  getVerificationCase(caseId: string): Observable<VerificationCase> {
    return this.http
      .get<VerificationCaseBody>(this.url(`/identity/me/verification-cases/${caseId}`))
      .pipe(map(toVerificationCase));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/**
 * Del cuerpo de la API al tipo de la vista.
 *
 * **Las dos fechas llegan como `null`, no ausentes.** Son columnas
 * `nullable: true` que el servicio copia tal cual, y `=== undefined` no las
 * atrapa: `new Date(null)` da **1970-01-01**, no `Invalid Date`. La pantalla
 * comprueba `@if (caso.openedAt)` y una fecha de 1970 es un valor verdadero, así
 * que un caso sin fecha mostraba «1/1/1970» en vez de ocultar el dato.
 *
 * Verificado contra el contrato del backend el 2026-08-08. Es el mismo defecto
 * que se corrigió en `profiles`, y por eso la conversión vive ahora en
 * `data-access/wire.ts`: se normaliza en la frontera, una sola vez.
 *
 * Las fechas opcionales se omiten en vez de viajar como `undefined`: el tipo las
 * declara opcionales, y una clave presente valiendo `undefined` no es lo mismo
 * que una clave ausente para nada de lo que las consume.
 */
function toVerificationCase(body: VerificationCaseBody): VerificationCase {
  return {
    id: body.id,
    status: body.status,
    openedAt: maybeDate(body.openedAt),
    completedAt: maybeDate(body.completedAt),
  };
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';

/**
 * C-10 / MD-01 · para qué tipo de usuario se pregunta si el CI está libre.
 * Un médico y un paciente pueden compartir el CI; dos médicos, no.
 */
export type DocumentHolderKind = 'PATIENT' | 'PRACTITIONER';

/** Consulta de `GET /iam/auth/document-availability`: los nombres del contrato C-10. */
export interface DocumentAvailabilityQuery {
  /** El número del documento. */
  readonly number: string;
  /** El departamento que lo emitió (`VS_BO_DEPARTMENT`). */
  readonly issuer: string;
  readonly userType: DocumentHolderKind;
}

/** Sólo si está libre: la API nunca dice a quién pertenece. */
export interface DocumentAvailability {
  readonly available: boolean;
}

/**
 * `GET /iam/auth/document-availability`. El alta pregunta si el CI (número +
 * departamento) está libre para ese tipo de usuario antes de enviar. Pública
 * y con límite por IP en la API; la respuesta es sólo `available`.
 *
 * Vive aparte de `IamClient` porque es una consulta del formulario de alta,
 * no una operación de la cuenta.
 */
@Injectable({ providedIn: 'root' })
export class DocumentAvailabilityClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  check(query: DocumentAvailabilityQuery): Observable<DocumentAvailability> {
    return this.http.get<DocumentAvailability>(
      apiUrl(this.baseUrl, '/iam/auth/document-availability'),
      // `type` explícito: hoy la cédula es el único documento con unicidad.
      { params: { type: 'NATIONAL_ID', ...query } },
    );
  }
}

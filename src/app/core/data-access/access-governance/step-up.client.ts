import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { StepUpResult, StepUpStatus } from './access-lifecycle.types';

/**
 * Cliente del **paso extra** (verificación en dos pasos fresca, CONTRATO-GOBIERNO §3.7, §8.3 bloque H).
 *
 * Sin cambiar el token: la API sella la sesión en Redis y las acciones que lo exigen responden
 * `403 STEP_UP_REQUIRED`. Quien llama reintenta la misma petición después de `verify`.
 * Errores: 422 `MFA_NOT_ENROLLED`, 422 `MFA_CODE_INVALID`, 429 (límite o `STEP_UP_ATTEMPTS_EXCEEDED`) y
 * 503 `STEP_UP_UNAVAILABLE` (falla cerrado).
 */
@Injectable({ providedIn: 'root' })
export class StepUpClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `POST /iam/me/step-up` — verifica el código de 6 a 8 dígitos de la app autenticadora y sella la sesión. */
  verify(code: string): Observable<StepUpResult> {
    return this.http.post<StepUpResult>(apiUrl(this.baseUrl, '/iam/me/step-up'), { code });
  }

  /** `GET /iam/me/step-up?maxAgeMinutes` — `{ fresh, ageMinutes }` (1 a 60 minutos; por omisión 10). */
  status(maxAgeMinutes?: number): Observable<StepUpStatus> {
    const params = maxAgeMinutes === undefined ? new HttpParams() : new HttpParams().set('maxAgeMinutes', String(maxAgeMinutes));
    return this.http.get<StepUpStatus>(apiUrl(this.baseUrl, '/iam/me/step-up'), { params });
  }
}

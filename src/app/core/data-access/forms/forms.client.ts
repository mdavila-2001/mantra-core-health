import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { FieldValueInput, FormInstance, OpenFormInstanceInput } from './forms.types';

/**
 * Cliente de `forms`: el ciclo de vida de una instancia de formulario dinámico
 * — abrir, capturar valores, cerrar.
 *
 * Cubre sólo lo que **carril 2** necesita para completar una plantilla de
 * chart dentro de un encuentro (`specialty-form-block`). El motor de `forms`
 * tiene mucho más — sets versionados, migraciones, curación de valores — y
 * queda sin cliente hasta que una pantalla lo necesite de verdad.
 */
@Injectable({
  providedIn: 'root',
})
export class FormsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `POST /forms/instances` (UC-09-07) — abre una instancia para un recurso. */
  openInstance(input: OpenFormInstanceInput): Observable<FormInstance> {
    return this.http.post<FormInstance>(this.url('/forms/instances'), input);
  }

  /**
   * `POST /forms/instances/:id/values` (UC-09-08) — captura los valores de una
   * instancia abierta.
   *
   * @returns Los identificadores de los valores creados, en el orden en que se
   * mandaron.
   */
  captureValues(
    instanceId: string,
    values: readonly FieldValueInput[],
  ): Observable<readonly string[]> {
    return this.http
      .post<{ ids: string[] }>(
        this.url(`/forms/instances/${encodeURIComponent(instanceId)}/values`),
        { values },
      )
      .pipe(map((res) => res.ids));
  }

  /** `POST /forms/instances/:id/close` (UC-09-11) — cierra la instancia. */
  closeInstance(instanceId: string): Observable<void> {
    return this.http
      .post<{ ok: boolean }>(
        this.url(`/forms/instances/${encodeURIComponent(instanceId)}/close`),
        {},
      )
      .pipe(map(() => undefined));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

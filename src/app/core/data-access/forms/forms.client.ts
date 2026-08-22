import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  FieldValueInput,
  FormInstance,
  FormInstanceDetail,
  FormInstanceList,
  MyFormInstanceList,
  OpenFormInstanceInput,
} from './forms.types';

/**
 * Cliente de `forms`: el ciclo de vida de una instancia de formulario dinámico
 * — abrir, capturar valores, cerrar — y su lectura: qué formularios tiene un
 * encuentro y qué se respondió en cada uno.
 *
 * Cubre sólo lo que **carril 2** necesita dentro de un encuentro
 * (`specialty-form-block`). El motor de `forms` tiene mucho más — sets
 * versionados, migraciones, curación de valores — y queda sin cliente hasta
 * que una pantalla lo necesite de verdad.
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

  /**
   * `GET /forms/instances?encounter=` — los formularios de un encuentro.
   *
   * Es la memoria que la captura no tenía: antes de ofrecer completar, el
   * bloque pregunta si el encuentro ya tiene una instancia, en vez de
   * enterarse por el `409` al guardar.
   */
  listInstancesByEncounter(
    encounterId: string,
    limit?: number,
  ): Observable<FormInstanceList> {
    let params = new HttpParams().set('encounter', encounterId);
    if (limit !== undefined) {
      params = params.set('limit', limit);
    }
    return this.http.get<FormInstanceList>(this.url('/forms/instances'), { params });
  }

  /** `GET /forms/instances/:id` — la instancia con sus valores vigentes. */
  getInstance(instanceId: string): Observable<FormInstanceDetail> {
    return this.http.get<FormInstanceDetail>(
      this.url(`/forms/instances/${encodeURIComponent(instanceId)}`),
    );
  }

  /**
   * `GET /forms/me/instances` — los formularios del paciente de la sesión.
   *
   * Sin identificador de paciente a propósito: el servidor lo toma del claim
   * de la sesión, y aceptar uno por parámetro sería dejar pedir los de otro.
   */
  listMyInstances(limit?: number): Observable<MyFormInstanceList> {
    let params = new HttpParams();
    if (limit !== undefined) {
      params = params.set('limit', limit);
    }
    return this.http.get<MyFormInstanceList>(this.url('/forms/me/instances'), { params });
  }

  /** `GET /forms/me/instances/:id` — un formulario propio con sus respuestas. */
  getMyInstance(instanceId: string): Observable<FormInstanceDetail> {
    return this.http.get<FormInstanceDetail>(
      this.url(`/forms/me/instances/${encodeURIComponent(instanceId)}`),
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

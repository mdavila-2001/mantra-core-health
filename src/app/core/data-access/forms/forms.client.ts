import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  CreateAssignmentInput,
  CreateFieldDefinitionInput,
  ExtensionBudget,
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

  /* -- Generador de formularios --------------------------------------------- */

  /**
   * `POST /forms/field-definitions` (UC-09-02) — declara un campo.
   *
   * Declarar no es colgar: el campo existe en el catálogo global y no aparece
   * en ningún formulario hasta que {@link createAssignment} lo asigna. Son dos
   * llamadas y no una porque son dos permisos distintos del backend —declarar
   * sólo pide sesión; asignar pide rol clínico y presupuesto—, y juntarlas acá
   * escondería cuál de las dos falló.
   */
  createFieldDefinition(input: CreateFieldDefinitionInput): Observable<string> {
    return this.http
      .post<{ id: string }>(this.url('/forms/field-definitions'), input)
      .pipe(map((res) => res.id));
  }

  /**
   * `POST /forms/assignments` (UC-09-06) — cuelga un campo de un formulario.
   *
   * El tenant **no viaja en el cuerpo**: el backend lo toma del contexto de la
   * sesión y rechaza cualquier otro. Mandarlo desde acá sería pedir permiso
   * para algo que no se puede.
   */
  createAssignment(input: CreateAssignmentInput): Observable<string> {
    return this.http
      .post<{ id: string }>(this.url('/forms/assignments'), input)
      .pipe(map((res) => res.id));
  }

  /**
   * `GET /forms/assignments/budget` — cuánto puede extender el tenant un target.
   *
   * Se pregunta **antes** de ofrecer el alta: sin esto la pantalla ofrece un
   * botón y descubre el techo cuando el `POST` vuelve con un 412, que es
   * enterarse tarde y con el trabajo escrito.
   */
  getExtensionBudget(targetResourceConceptId: string): Observable<ExtensionBudget> {
    const params = new HttpParams().set(
      'targetResourceConceptId',
      targetResourceConceptId,
    );
    return this.http.get<ExtensionBudget>(this.url('/forms/assignments/budget'), {
      params,
    });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

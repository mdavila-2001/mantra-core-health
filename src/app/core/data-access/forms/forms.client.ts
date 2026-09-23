import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  CreateAssignmentInput,
  CreateFieldDefinitionInput,
  UpdateAssignmentInput,
  UpdateFieldDefinitionInput,
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
   * `PATCH /forms/field-definitions/:id` — corrige el nombre o el tipo de un
   * campo propio.
   *
   * La definición es **global** (`forms.dynamic_field_definitions`), así que
   * esto cambia el campo dondequiera que esté colgado. Es lo correcto: es el
   * mismo campo, no una copia por formulario.
   *
   * @param fieldId - Identificador de la definición.
   * @param cambios - Sólo lo que cambió.
   */
  updateFieldDefinition(
    fieldId: string,
    cambios: UpdateFieldDefinitionInput,
  ): Observable<void> {
    return this.http
      .patch<unknown>(
        this.url(`/forms/field-definitions/${encodeURIComponent(fieldId)}`),
        cambios,
      )
      .pipe(map(() => undefined));
  }

  /**
   * `PATCH /forms/assignments/:id` — cambia si el campo es obligatorio.
   *
   * Va aparte de la definición porque son dos cosas distintas: el campo
   * «¿Fuma?» es el mismo en todos lados, pero puede ser obligatorio en un
   * formulario y opcional en otro. Lo obligatorio es de la **asignación**.
   *
   * @param assignmentId - Identificador de la asignación.
   * @param cambios - Sólo lo que cambió.
   */
  updateAssignment(
    assignmentId: string,
    cambios: UpdateAssignmentInput,
  ): Observable<void> {
    return this.http
      .patch<unknown>(
        this.url(`/forms/assignments/${encodeURIComponent(assignmentId)}`),
        cambios,
      )
      .pipe(map(() => undefined));
  }

  /**
   * `DELETE /forms/assignments/:id` — descuelga un campo propio.
   *
   * No borra la definición: el campo sigue en el catálogo global y puede estar
   * colgado de otro formulario. Lo que se quita es su presencia acá.
   *
   * @param assignmentId - Identificador de la asignación.
   */
  deleteAssignment(assignmentId: string): Observable<void> {
    return this.http
      .delete<unknown>(this.url(`/forms/assignments/${encodeURIComponent(assignmentId)}`))
      .pipe(map(() => undefined));
  }

  /**
   * `PUT /forms/assignments/order` — reordena los campos propios de un target.
   *
   * Se manda **la lista entera** en el orden final, no «subí éste un lugar»:
   * dos reordenamientos seguidos sobre una posición relativa se pisan y el
   * resultado depende de cuál llegó primero.
   *
   * @param targetResourceConceptId - El formulario cuyos campos se reordenan.
   * @param assignmentIds - Las asignaciones propias, en el orden final.
   */
  reorderAssignments(
    targetResourceConceptId: string,
    assignmentIds: readonly string[],
  ): Observable<void> {
    return this.http
      .put<unknown>(this.url('/forms/assignments/order'), {
        targetResourceConceptId,
        assignmentIds,
      })
      .pipe(map(() => undefined));
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

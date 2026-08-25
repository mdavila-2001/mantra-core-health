import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AppendClinicalNoteVersionInput,
  ClinicalNoteVersionRef,
  CreateClinicalNoteInput,
} from './chart-notes.types';

/**
 * Cliente de la nota clínica narrativa (`chart.clinical_note_*`).
 *
 * El módulo tenía las rutas y ningún cliente las usaba: la historia se escribía
 * sólo con fichas por especialidad, y el médico que quería escribir en prosa no
 * tenía dónde. Esto es esa mitad.
 *
 * **Escribir crea una versión, nunca pisa la anterior.** Es una historia
 * clínica: `PUT /charts/notes/:id/versions` agrega, y la versión previa queda
 * con su número y su autor. Corregir después de firmar es otra operación
 * (`/amendments`), que exige decir por qué.
 *
 * La lectura no vive acá sino en `ClinicalClient.readChart`, que trae la
 * historia entera —notas, planes y documentos— en una sola llamada.
 */
@Injectable({
  providedIn: 'root',
})
export class ChartNotesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `POST /charts/notes` (UC-15-01) — abre una nota con su primera versión.
   *
   * @param input - Paciente, autor y el contenido inicial.
   * @returns La nota y la versión recién creadas.
   */
  createNote(input: CreateClinicalNoteInput): Observable<ClinicalNoteVersionRef> {
    return this.http.post<ClinicalNoteVersionRef>(this.url('/charts/notes'), input);
  }

  /**
   * `PUT /charts/notes/:noteId/versions` (UC-15-02) — agrega una versión.
   *
   * @param noteId - La nota a la que se le agrega.
   * @param input - Autor y contenido de la versión nueva.
   * @returns La versión recién creada.
   */
  appendVersion(
    noteId: string,
    input: AppendClinicalNoteVersionInput,
  ): Observable<ClinicalNoteVersionRef> {
    return this.http.put<ClinicalNoteVersionRef>(
      this.url(`/charts/notes/${encodeURIComponent(noteId)}/versions`),
      input,
    );
  }

  /** Arma la URL absoluta contra la base configurada. */
  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

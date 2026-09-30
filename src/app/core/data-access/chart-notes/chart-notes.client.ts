import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { ChartNote } from '../clinical/clinical.types';
import type {
  AppendClinicalNoteVersionInput,
  ChartNotesPage,
  ClinicalNoteVersionRef,
  CreateClinicalNoteInput,
  ListChartNotesParams,
} from './chart-notes.types';

/** La nota como viaja: las fechas son texto ISO. */
type WireChartNote = Omit<ChartNote, 'signedAt' | 'createdAt'> & {
  readonly signedAt?: string | null;
  readonly createdAt: string;
};

interface WireChartNotesPage extends Omit<ChartNotesPage, 'items'> {
  readonly items: readonly WireChartNote[];
}

/**
 * Cliente de la nota médica (`chart.clinical_note_*`).
 *
 * El módulo tenía las rutas y ningún cliente las usaba: la historia se escribía
 * sólo con fichas por especialidad, y la médica que quería anotar lo que veía
 * no tenía dónde. Esto es esa mitad.
 *
 * **Escribir crea una versión, nunca pisa la anterior.** Es una historia
 * clínica: `PUT /charts/notes/:id/versions` agrega, y la versión previa queda
 * con su número y su autor. Corregir después de firmar exige decir por qué
 * (`amendmentReasonText`); sin motivo el servidor responde 409.
 *
 * La lectura de la historia entera —notas, planes y documentos— sigue en
 * `ClinicalClient.readChart`. `listNotes` existe para el bloque que escribe:
 * relee **sólo** las notas después de guardar, sin pedir de nuevo el resto.
 */
@Injectable({
  providedIn: 'root',
})
export class ChartNotesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /charts/notes` — las notas de una persona, de la más nueva a la más
   * vieja.
   *
   * @param params - De quién, y opcionalmente de qué consulta y cuántas.
   * @returns La página, con las fechas ya como `Date`.
   */
  listNotes(params: ListChartNotesParams): Observable<ChartNotesPage> {
    let query = new HttpParams().set('patientProfileId', params.patientProfileId);
    if (params.encounterId !== undefined) {
      query = query.set('encounterId', params.encounterId);
    }
    if (params.limit !== undefined) {
      query = query.set('limit', String(params.limit));
    }
    return this.http
      .get<WireChartNotesPage>(this.url('/charts/notes'), { params: query })
      .pipe(map((page) => ({ ...page, items: page.items.map(toNote) })));
  }

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

  /**
   * `POST /charts/notes/:noteId/versions/:versionId/sign` — firma la versión
   * vigente. Desde ahí la nota no se edita: se enmienda.
   *
   * @param noteId - La nota.
   * @param versionId - La versión que se firma; tiene que ser la vigente.
   * @returns La nota, ya con `signedAt`.
   */
  signVersion(noteId: string, versionId: string): Observable<ChartNote> {
    return this.http
      .post<WireChartNote>(
        this.url(
          `/charts/notes/${encodeURIComponent(noteId)}/versions/${encodeURIComponent(versionId)}/sign`,
        ),
        {},
      )
      .pipe(map(toNote));
  }

  /** Arma la URL absoluta contra la base configurada. */
  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function toNote({ signedAt, createdAt, ...resto }: WireChartNote): ChartNote {
  return {
    ...resto,
    ...(signedAt === undefined || signedAt === null ? {} : { signedAt: new Date(signedAt) }),
    createdAt: new Date(createdAt),
  };
}

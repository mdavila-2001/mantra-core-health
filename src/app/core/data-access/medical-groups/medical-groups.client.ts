import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { sinNulos, type ConNulos } from '../wire';
import type {
  MedicalGroup,
  MedicalGroupConditionOption,
  MedicalGroupDecision,
  MedicalGroupListItem,
  MedicalGroupMember,
  MedicalGroupPage,
  MedicalGroupTab,
  NewMedicalGroup,
} from './medical-groups.types';

/**
 * Lo que el servidor manda de verdad: los opcionales vacíos llegan como `null`
 * (`wire.ts`), y los tipos de la vista los declaran con `?:`. Se normaliza acá,
 * en la frontera, para que ninguna pantalla se pregunte si un opcional es
 * `null`.
 */
type WireMember = ConNulos<MedicalGroupMember>;
type WireGroup = Omit<ConNulos<MedicalGroup>, 'members'> & { readonly members: readonly WireMember[] };
interface WirePage {
  readonly items: readonly ConNulos<MedicalGroupListItem>[];
  readonly nextCursor?: string | null;
}

function toGroup(body: WireGroup): MedicalGroup {
  return {
    ...sinNulos<Omit<MedicalGroup, 'members'>>(body),
    members: body.members.map((member) => sinNulos<MedicalGroupMember>(member)),
  };
}

function toPage(body: WirePage): MedicalGroupPage {
  return {
    items: body.items.map((row) => sinNulos<MedicalGroupListItem>(row)),
    // La ausencia SÍ significa algo —«no hay más páginas»—: se conserva como `null`.
    nextCursor: body.nextCursor ?? null,
  };
}

/**
 * Cliente de `medical_groups` (FT-21): grupos médicos, un equipo de
 * profesionales alrededor de un servicio del catálogo.
 *
 * Son las 8 rutas del controller, todas de `PRACTITIONER` o `CLINICIAN`. Los
 * cuerpos viajan tal como los declaran los tipos: la API valida con
 * `forbidNonWhitelisted`, así que una propiedad de más es un 400, y los
 * opcionales ausentes se omiten.
 *
 * Los identificadores de la ruta se codifican: un `/` dentro de uno no puede
 * abrir un segmento más.
 */
@Injectable({ providedIn: 'root' })
export class MedicalGroupsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /medical-groups?tab=` — una página del listado de la pestaña.
   *
   * Sólo viajan `tab`, `cursor` y `limit`, y los dos últimos si vienen.
   */
  list(
    tab: MedicalGroupTab,
    page: { readonly cursor?: string; readonly limit?: number } = {},
  ): Observable<MedicalGroupPage> {
    let params = new HttpParams().set('tab', tab);
    if (page.cursor !== undefined) {
      params = params.set('cursor', page.cursor);
    }
    if (page.limit !== undefined) {
      params = params.set('limit', String(page.limit));
    }
    return this.http
      .get<WirePage>(this.url('/medical-groups'), { params })
      .pipe(map(toPage));
  }

  /** `GET /medical-groups/:id` — la ficha de un grupo. */
  get(id: string): Observable<MedicalGroup> {
    return this.http
      .get<WireGroup>(this.url(`/medical-groups/${encodeURIComponent(id)}`))
      .pipe(map(toGroup));
  }

  /**
   * `GET /medical-groups/patients/:patientProfileId/conditions` — los
   * diagnósticos del paciente, el más reciente primero.
   */
  listPatientConditions(patientProfileId: string): Observable<readonly MedicalGroupConditionOption[]> {
    return this.http
      .get<readonly ConNulos<MedicalGroupConditionOption>[]>(
        this.url(`/medical-groups/patients/${encodeURIComponent(patientProfileId)}/conditions`),
      )
      .pipe(map((rows) => rows.map((row) => sinNulos<MedicalGroupConditionOption>(row))));
  }

  /** `POST /medical-groups` — crea el grupo e invita al equipo. */
  create(group: NewMedicalGroup): Observable<MedicalGroup> {
    return this.http.post<WireGroup>(this.url('/medical-groups'), group).pipe(map(toGroup));
  }

  /**
   * `POST /medical-groups/:id/members/:memberId/respond` — el invitado acepta
   * o rechaza su cargo. Devuelve el grupo ya actualizado.
   */
  respondToInvitation(
    groupId: string,
    memberId: string,
    decision: MedicalGroupDecision,
  ): Observable<MedicalGroup> {
    return this.http
      .post<WireGroup>(
        this.url(
          `/medical-groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}/respond`,
        ),
        { decision },
      )
      .pipe(map(toGroup));
  }

  /** `POST /medical-groups/:id/reschedule-requests` — propone otra fecha. */
  requestReschedule(groupId: string, proposedAt: string): Observable<MedicalGroup> {
    return this.http
      .post<WireGroup>(
        this.url(`/medical-groups/${encodeURIComponent(groupId)}/reschedule-requests`),
        { proposedAt },
      )
      .pipe(map(toGroup));
  }

  /**
   * `POST /medical-groups/:id/reschedule-requests/respond` — el creador acepta
   * o rechaza la fecha propuesta.
   */
  respondToReschedule(groupId: string, decision: MedicalGroupDecision): Observable<MedicalGroup> {
    return this.http
      .post<WireGroup>(
        this.url(`/medical-groups/${encodeURIComponent(groupId)}/reschedule-requests/respond`),
        { decision },
      )
      .pipe(map(toGroup));
  }

  /** `PATCH /medical-groups/:id/exercise-notes` — carga o corrige las notas del procedimiento. */
  updateExerciseNotes(groupId: string, notesText: string): Observable<MedicalGroup> {
    return this.http
      .patch<WireGroup>(this.url(`/medical-groups/${encodeURIComponent(groupId)}/exercise-notes`), {
        notesText,
      })
      .pipe(map(toGroup));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

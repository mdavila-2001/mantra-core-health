import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  EligibleMember,
  MedicalGroup,
  MedicalGroupConditionOption,
  MedicalGroupDecision,
  MedicalGroupListItem,
  MedicalGroupMember,
  MedicalGroupPage,
  MedicalGroupTab,
  NewMedicalGroup,
} from './medical-groups.types';

/** Lo que llega por la red: las fechas todavía son texto ISO. */
type Wire<T, K extends keyof T> = Omit<T, K> & Readonly<Record<K, string>>;
type WireMember = Wire<MedicalGroupMember, 'respondedAt'>;
type WireGroup = Omit<
  Wire<
    MedicalGroup,
    'scheduledAt' | 'createdAt' | 'exerciseNotesUpdatedAt' | 'proposedRescheduleAt'
  >,
  'members'
> & { readonly members: readonly WireMember[] };
type WireListItem = Wire<MedicalGroupListItem, 'scheduledAt'>;
type WireCondition = Wire<MedicalGroupConditionOption, 'onsetAt'>;

/**
 * Cliente de `medical-groups` (FT-21, carril 21): el evento de equipo alrededor
 * de un servicio del catálogo, con cargos, pago acordado por cargo y un
 * expediente que se cierra una semana después de realizado.
 *
 * Todas las reglas de estado las aplica la API (quién ve qué, cuándo se puede
 * pedir cambio de horario, la ventana de notas, el cierre): este cliente no
 * decide nada, sólo traduce fechas.
 */
@Injectable({ providedIn: 'root' })
export class MedicalGroupsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /medical-groups?tab=` — una página de la pestaña, por cursor. */
  list(tab: MedicalGroupTab, cursor?: string): Observable<MedicalGroupPage> {
    let params = new HttpParams().set('tab', tab);
    if (cursor !== undefined) {
      params = params.set('cursor', cursor);
    }
    return this.http
      .get<{
        readonly items: readonly WireListItem[];
        readonly nextCursor?: string | null;
      }>(this.url('/medical-groups'), { params })
      .pipe(
        map((body) => ({
          items: body.items.map((item) => ({ ...item, scheduledAt: new Date(item.scheduledAt) })),
          nextCursor: body.nextCursor ?? null,
        })),
      );
  }

  /** `GET /medical-groups/:id` — el grupo entero, para el formulario de consulta. */
  get(id: string): Observable<MedicalGroup> {
    return this.http
      .get<WireGroup>(this.url(`/medical-groups/${encodeURIComponent(id)}`))
      .pipe(map(toGroup));
  }

  /** `POST /medical-groups` — crea el grupo e invita al equipo. */
  create(group: NewMedicalGroup): Observable<MedicalGroup> {
    return this.http.post<WireGroup>(this.url('/medical-groups'), group).pipe(map(toGroup));
  }

  /**
   * `GET /medical-groups/eligible-members?serviceCatalogId=` — los colegas que
   * la API aceptaría como invitados a un grupo de ese servicio: los de la
   * misma organización, sin quien pregunta.
   */
  listEligibleMembers(serviceCatalogId: string): Observable<readonly EligibleMember[]> {
    return this.http.get<readonly EligibleMember[]>(this.url('/medical-groups/eligible-members'), {
      params: new HttpParams().set('serviceCatalogId', serviceCatalogId),
    });
  }

  /** `GET /medical-groups/patients/:id/conditions` — diagnósticos para el selector. */
  listPatientConditions(
    patientProfileId: string,
  ): Observable<readonly MedicalGroupConditionOption[]> {
    return this.http
      .get<readonly WireCondition[]>(
        this.url(`/medical-groups/patients/${encodeURIComponent(patientProfileId)}/conditions`),
      )
      .pipe(
        map((items) =>
          items.map(({ onsetAt, ...rest }) => ({
            ...rest,
            ...(onsetAt === undefined || onsetAt === null ? {} : { onsetAt: new Date(onsetAt) }),
          })),
        ),
      );
  }

  /** `POST /medical-groups/:id/members/:memberId/respond` — el invitado acepta o rechaza su cargo. */
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
  requestReschedule(groupId: string, proposedAt: Date): Observable<MedicalGroup> {
    return this.http
      .post<WireGroup>(
        this.url(`/medical-groups/${encodeURIComponent(groupId)}/reschedule-requests`),
        { proposedAt: proposedAt.toISOString() },
      )
      .pipe(map(toGroup));
  }

  /** `POST /medical-groups/:id/reschedule-requests/respond` — el creador resuelve la propuesta. */
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

function optionalDate(value: string | null | undefined): Date | undefined {
  return value === undefined || value === null ? undefined : new Date(value);
}

function toGroup(wire: WireGroup): MedicalGroup {
  const { exerciseNotesUpdatedAt, proposedRescheduleAt, members, ...rest } = wire;
  const notesAt = optionalDate(exerciseNotesUpdatedAt);
  const proposedAt = optionalDate(proposedRescheduleAt);
  return {
    ...rest,
    scheduledAt: new Date(wire.scheduledAt),
    createdAt: new Date(wire.createdAt),
    ...(notesAt === undefined ? {} : { exerciseNotesUpdatedAt: notesAt }),
    ...(proposedAt === undefined ? {} : { proposedRescheduleAt: proposedAt }),
    members: members.map(({ respondedAt, ...member }) => {
      const at = optionalDate(respondedAt);
      return at === undefined ? member : { ...member, respondedAt: at };
    }),
  };
}

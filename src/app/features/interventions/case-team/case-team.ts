import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { ProceduresClient } from '../../../core/data-access/procedures/procedures.client';
import type { CaseTeamMember, TeamParticipationResponse } from '../../../core/data-access/procedures/procedures.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { LoadingState } from '../../../shared/components/molecules/loading-state/loading-state';

/** Lo que se muestra cuando un concepto no tiene etiqueta en el catálogo. */
const NO_DATA = '—';

/**
 * Las tres respuestas negativas, enteras: pedir una modificación es seguir
 * queriendo participar, e informar indisponibilidad no objeta la intervención.
 */
const NEGATIVE_RESPONSES: readonly SelectOption<TeamParticipationResponse>[] = [
  { value: 'DECLINE', label: 'Rechazar la participación' },
  { value: 'REQUEST_CHANGE', label: 'Pedir una modificación' },
  { value: 'UNAVAILABLE', label: 'Informar indisponibilidad' },
];

/**
 * **El equipo de un caso y la aceptación propia** (spec 162/164).
 *
 * Es la aceptación que vivía dentro de la agenda de Intervenciones, sacada a un
 * componente para que la monten la agenda y la ficha del caso (F4) sin
 * duplicarla. El contrato no cambia: `accept` sin cuerpo y `respond` con
 * respuesta y motivo obligatorio, y los botones sólo en la fila de quien mira
 * —el backend rechaza responder por otro (spec 168)—.
 *
 * Si la terminología falla, el equipo se muestra con guiones: perder los
 * nombres es molesto, perder la lista entera sería peor.
 */
@Component({
  selector: 'app-case-team',
  imports: [Alert, AppButton, LoadingState, Select, Textarea],
  templateUrl: './case-team.html',
  styleUrl: './case-team.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseTeam {
  private readonly procedures = inject(ProceduresClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly auth = inject(AuthService);

  /** El caso cuyo equipo se muestra. */
  readonly caseId = input.required<string>();

  protected readonly negativeResponses = NEGATIVE_RESPONSES;
  protected readonly myProfile = this.auth.practitionerProfileId;

  protected readonly team = signal<ViewState<readonly CaseTeamMember[]>>(loading());
  protected readonly responding = signal<CaseTeamMember | null>(null);
  protected readonly chosenResponse = signal<TeamParticipationResponse>('DECLINE');
  protected readonly reason = signal('');
  protected readonly sending = signal(false);
  protected readonly problem = signal<string | null>(null);
  private readonly labels = signal<ConceptLabels>(new Map());

  protected readonly reasonValid = computed(() => this.reason().trim().length > 0);
  protected readonly byMember = (row: CaseTeamMember): string => row.id;

  constructor() {
    effect(() => {
      const id = this.caseId();
      untracked(() => {
        this.cancelResponse();
        this.load(id);
      });
    });
  }

  protected labelOf(conceptId: string | undefined): string {
    return conceptId === undefined ? NO_DATA : (this.labels().get(conceptId)?.display ?? NO_DATA);
  }

  protected isMine(member: CaseTeamMember): boolean {
    const profile = this.myProfile();
    return profile !== null && profile === member.practitionerProfileId;
  }

  protected accept(member: CaseTeamMember): void {
    if (this.sending()) return;
    this.sending.set(true);
    this.problem.set(null);
    this.procedures.acceptTeamMember(this.caseId(), member.id).subscribe({
      next: () => {
        this.sending.set(false);
        this.load(this.caseId());
      },
      error: (error: unknown) => {
        this.sending.set(false);
        this.problem.set(messageOf(error));
      },
    });
  }

  protected startResponse(member: CaseTeamMember): void {
    this.responding.set(member);
    this.chosenResponse.set('DECLINE');
    this.reason.set('');
    this.problem.set(null);
  }

  protected cancelResponse(): void {
    this.responding.set(null);
    this.reason.set('');
  }

  protected chooseResponse(value: TeamParticipationResponse | null): void {
    this.chosenResponse.set(value ?? 'DECLINE');
  }

  protected sendResponse(): void {
    const member = this.responding();
    if (member === null || !this.reasonValid() || this.sending()) return;
    this.sending.set(true);
    this.problem.set(null);
    this.procedures
      .respondTeamMember(this.caseId(), member.id, { response: this.chosenResponse(), reasonText: this.reason().trim() })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.cancelResponse();
          this.load(this.caseId());
        },
        error: (error: unknown) => {
          this.sending.set(false);
          this.problem.set(messageOf(error));
        },
      });
  }

  private load(caseId: string): void {
    this.team.set(loading());
    this.procedures
      .listTeamMembers(caseId)
      .pipe(
        switchMap((members) =>
          forkJoin({
            members: of(members),
            labels: this.terminology
              .readConceptLabels(members.flatMap((m) => [m.teamRoleConceptId, m.statusConceptId]))
              .pipe(catchError(() => of(new Map() as ConceptLabels))),
          }),
        ),
      )
      .subscribe({
        next: ({ members, labels }) => {
          this.labels.update((previous) => new Map([...previous, ...labels]));
          this.team.set(
            members.length === 0
              ? empty({ label: 'Volver a la agenda', route: '/interventions' }, 'La intervención no tiene integrantes asignados.')
              : ready(members),
          );
        },
        error: (error: unknown) => this.team.set(errorToViewState<readonly CaseTeamMember[]>(error)),
      });
  }
}

/**
 * El error de un acto puntual, en una frase. El 422 de CAN-INT-002 (credencial
 * no vigente) es una precondición y se lee como tal.
 */
function messageOf(error: unknown): string {
  const status = (error as { status?: number } | null)?.status;
  if (status === 422) {
    return 'No se pudo registrar: el integrante no tiene una credencial profesional vigente, o la intervención ya no admite este acto.';
  }
  if (status === 403) return 'Sólo el propio integrante puede responder a su participación.';
  return 'No pudimos registrar la respuesta. Vuelva a intentarlo.';
}

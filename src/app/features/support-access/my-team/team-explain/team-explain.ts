import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { AccessExplainClient } from '../../../../core/data-access/access-governance/access-explain.client';
import type { DoctorTeamMember } from '../../../../core/data-access/support-access/support-access.types';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { ExplainQuestion } from '../../../access-governance/simulator/explain-question/explain-question';
import { ExplainResult } from '../../../access-governance/simulator/explain-result/explain-result';
import { ExplainSession, questionBody } from '../../../access-governance/simulator/explain-session';
import { actionOptions } from '../../../access-governance/simulator/explain-text';
import { templateLabel } from '../../support-labels';

/**
 * **«¿Por qué {persona} pudo o no pudo…?»** — el doctor pregunta por alguien de **su** equipo y solo sobre **su** agenda
 * (CONTRATO-GOBIERNO §5.4, §9.3 fila 14). La API responde 404 uniforme a cualquier otra pregunta, y esta pantalla no
 * distingue «no existe» de «no es suyo».
 *
 * La API pide la vinculación del doctor con la organización (`practitionerRoleAssignmentId`): ya viene en cada miembro de
 * `GET /me/practitioner/support-team` (`SupportTeamMemberDto.practitionerRoleAssignmentId`), así que no hay que leer sus
 * vinculaciones ni preguntarle en cuál: se usa la de ese miembro.
 */
@Component({
  selector: 'app-team-explain',
  imports: [ContentDialog, ExplainQuestion, ExplainResult, ViewStateHost],
  templateUrl: './team-explain.html',
  styleUrl: './team-explain.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamExplain {
  private readonly explain = inject(AccessExplainClient);

  readonly member = input.required<DoctorTeamMember>();
  readonly closed = output<void>();

  protected readonly actions = actionOptions(null, true);
  protected readonly session = new ExplainSession((question, assume) =>
    this.explain.explainTeam({
      engagementId: this.member().engagementId!,
      practitionerRoleAssignmentId: this.member().practitionerRoleAssignmentId,
      ...questionBody(question, assume),
    }),
  );

  protected readonly heading = computed(
    () => `¿Por qué ${this.member().personName} pudo o no pudo…?`,
  );
  protected readonly roleLabel = computed(() => templateLabel(this.member().roleTemplate));
}

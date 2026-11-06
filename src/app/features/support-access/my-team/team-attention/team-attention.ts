import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of, throwError, type Observable } from 'rxjs';

import { AccessApprovalsClient } from '../../../../core/data-access/access-governance/access-approvals.client';
import { AccessGovernanceClient } from '../../../../core/data-access/access-governance/access-governance.client';
import {
  ANOMALY_KIND_LABELS,
  type AnomalyKind,
  type GovernancePanel,
} from '../../../../core/data-access/access-governance/access-governance.types';
import type {
  SupportApproval,
  SupportApprovalList,
} from '../../../../core/data-access/access-governance/access-reviews.types';
import type { DoctorTeamMember } from '../../../../core/data-access/support-access/support-access.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Card } from '../../../../shared/components/molecules/card/card';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { formatDateTime } from '../../support-labels';

interface Attention {
  readonly panel: GovernancePanel;
  readonly approvals: readonly SupportApproval[];
}

const PANEL_VACIO: GovernancePanel = { generatedAt: '', team: [], pendingReviews: 0, openAnomalies: [] };
const APROBACIONES_VACIAS: SupportApprovalList = { items: [], count: 0, nextCursor: null };

/**
 * Una fuente de «Para su atención» que el servidor todavía no publica (404) cuenta como «sin pendientes»: no tapa lo que
 * sí responde las otras. Cualquier otro error sigue siendo un error.
 */
function sinEndpoint<T>(fuente: Observable<T>, vacio: T): Observable<T> {
  return fuente.pipe(
    catchError((failure: unknown) =>
      (failure as { status?: number } | null)?.status === 404 ? of(vacio) : throwError(() => failure),
    ),
  );
}

/** El texto de una cantidad: «1 aprobación espera», «3 aprobaciones esperan». */
export function countText(n: number, singular: string, plural: string): string {
  return n === 1 ? `1 ${singular}` : `${n} ${plural}`;
}

/**
 * **Para su atención** — lo que espera al doctor en «Mi equipo»: aprobaciones de cuatro ojos que le tocan, accesos de su
 * equipo que debe revisar y alertas sobre la actividad de **su** agenda (CONTRATO-GOBIERNO §9.3 fila 14). Solo cuenta y lleva a
 * donde se decide; esta tarjeta no aprueba, no revisa y no descarta nada.
 */
@Component({
  selector: 'app-team-attention',
  imports: [AppButtonLink, Card, RouterLink, ViewStateHost],
  templateUrl: './team-attention.html',
  styleUrl: './team-attention.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamAttention implements OnInit {
  private readonly governance = inject(AccessGovernanceClient);
  private readonly approvalsClient = inject(AccessApprovalsClient);

  /** Para poner nombre a las personas de las alertas. */
  readonly members = input<readonly DoctorTeamMember[]>([]);

  protected readonly state = signal<ViewState<Attention>>(loading());

  protected readonly data = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : null;
  });
  protected readonly alerts = computed(() => {
    const names = new Map(
      this.members().flatMap((m) =>
        m.userId === undefined ? [] : [[m.userId, m.personName] as const],
      ),
    );
    return (this.data()?.panel.openAnomalies ?? []).map((a) => ({
      id: a.id,
      who: names.get(a.userId) ?? 'Alguien de su equipo',
      what: ANOMALY_KIND_LABELS[a.kindConceptId as AnomalyKind] ?? 'Actividad inusual',
      since: formatDateTime(a.windowStart),
    }));
  });
  protected readonly firstApprovals = computed(() => (this.data()?.approvals ?? []).slice(0, 3));

  protected readonly countText = countText;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set(loading());
    forkJoin({
      panel: sinEndpoint(this.governance.getPractitionerPanel(), PANEL_VACIO),
      approvals: sinEndpoint(this.approvalsClient.listPending(), APROBACIONES_VACIAS),
    }).subscribe({
      next: ({ panel, approvals }) =>
        this.state.set(
          panel.pendingReviews === 0 &&
            panel.openAnomalies.length === 0 &&
            approvals.items.length === 0
            ? empty(
                { label: 'Cuando algo necesite su decisión, aparecerá acá' },
                'No tiene nada pendiente por ahora.',
              )
            : ready({ panel, approvals: approvals.items }),
        ),
      error: (failure: unknown) => this.state.set(errorToViewState<Attention>(failure)),
    });
  }
}

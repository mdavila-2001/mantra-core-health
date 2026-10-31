import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { AccessExplainClient } from '../../../core/data-access/access-governance/access-explain.client';
import type { PermissionCatalog } from '../../../core/data-access/access-governance/access-explain.types';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type {
  SupportCatalog,
  SupportEngagement,
} from '../../../core/data-access/support-access/support-access.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { DraftPanel } from './draft-panel/draft-panel';
import { ExplainPanel, type ExplainPrefill } from './explain-panel/explain-panel';
import type { QuestionValue } from './explain-question/explain-question';

interface ReferenceData {
  readonly engagements: readonly SupportEngagement[];
  /** Doctores, servicios y espacios; `null` si no se pudo leer (el simulador sigue sin esos filtros). */
  readonly catalog: SupportCatalog | null;
  /** Los 73 permisos con su sensibilidad; `null` → se usa el espejo local. */
  readonly permissionCatalog: PermissionCatalog | null;
}

const EXPLAIN_TAB = 0;
const DRAFT_TAB = 1;

/**
 * **Simulador y «¿por qué?»** (CONTRATO-GOBIERNO §9.3 fila 10, §5).
 *
 * Dos pestañas en una tarjeta: **explicar** («¿por qué puede o no puede?», con la traza paso a paso y «¿y si…?») y **simular**
 * («¿qué pasa si cambio estos permisos?», antes y después). Todo lo calcula la API; esta pantalla solo pregunta y explica,
 * y no guarda nada. Acepta una consulta precargada por dirección: `?engagementId=…&action=…` (se envía con un clic).
 */
@Component({
  selector: 'app-simulator',
  imports: [Card, DraftPanel, ExplainPanel, PageHeader, Tab, Tabs, ViewStateHost],
  templateUrl: './simulator.html',
  styleUrl: './simulator.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Simulator implements OnInit {
  private readonly explain = inject(AccessExplainClient);
  private readonly support = inject(SupportAccessClient);
  private readonly route = inject(ActivatedRoute);

  protected readonly state = signal<ViewState<ReferenceData>>(loading());
  protected readonly tab = signal(EXPLAIN_TAB);
  protected readonly prefill = signal<ExplainPrefill | null>(null);
  protected readonly draftPerson = signal<string | null>(null);

  protected readonly data = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : null;
  });

  ngOnInit(): void {
    this.applyLink();
    this.load();
  }

  protected load(): void {
    this.state.set(loading());
    forkJoin({
      engagements: this.support.listEngagements(),
      catalog: this.support.getCatalog().pipe(catchError(() => of(null))),
      permissionCatalog: this.explain.getPermissionCatalog().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ engagements, catalog, permissionCatalog }) =>
        this.state.set(
          engagements.items.filter((e) => e.status !== 'ENDED').length === 0
            ? empty(
                {
                  label: 'Emita una invitación para sumar a alguien',
                  route: '/administration/support-invitations',
                },
                'Todavía no hay personal de apoyo para simular.',
              )
            : ready({ engagements: engagements.items, catalog, permissionCatalog }),
        ),
      error: (failure: unknown) => this.state.set(errorToViewState<ReferenceData>(failure)),
    });
  }

  /** `?engagementId=&action=&doctor=&patient=&at=&tab=simular`: otra pantalla deja la consulta precargada. */
  private applyLink(): void {
    const q = this.route.snapshot.queryParamMap;
    const engagementId = q.get('engagementId');
    if (q.get('tab') === 'simular') {
      this.tab.set(DRAFT_TAB);
      this.draftPerson.set(engagementId);
      return;
    }
    const action = q.get('action');
    if (engagementId === null || action === null) return;
    const question: QuestionValue = {
      action,
      ...(q.get('doctor') === null ? {} : { practitionerRoleAssignmentId: q.get('doctor')! }),
      ...(q.get('patient') === null ? {} : { patientProfileId: q.get('patient')! }),
      ...(q.get('at') === null ? {} : { at: q.get('at')! }),
    };
    // Solo se precarga: un enlace no debe disparar la consulta (un POST) sin un clic de la persona (F7). Un `ask=1`
    // antiguo en la dirección se ignora; el «¿Por qué?» de un caso del borrador (`explainCase`) sí consulta, porque
    // nace de un clic.
    this.prefill.set({ engagementId, question });
  }

  /** «¿Por qué?» de un caso del borrador: se pasa a explicar con el caso ya escrito. */
  protected explainCase(prefill: ExplainPrefill): void {
    this.prefill.set(prefill);
    this.tab.set(EXPLAIN_TAB);
  }
}

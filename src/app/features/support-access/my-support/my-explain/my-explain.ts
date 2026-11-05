import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { AccessExplainClient } from '../../../../core/data-access/access-governance/access-explain.client';
import { accessFailureOf } from '../../../../core/data-access/access-governance/access-errors';
import { AccessLifecycleClient } from '../../../../core/data-access/access-governance/access-lifecycle.client';
import { SupportAccessClient } from '../../../../core/data-access/support-access/support-access.client';
import type {
  SupportCatalog,
  SupportEngagement,
} from '../../../../core/data-access/support-access/support-access.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import {
  ExplainQuestion,
  type QuestionValue,
} from '../../../access-governance/simulator/explain-question/explain-question';
import { ExplainResult } from '../../../access-governance/simulator/explain-result/explain-result';
import { ExplainSession, questionBody } from '../../../access-governance/simulator/explain-session';
import { actionOptions } from '../../../access-governance/simulator/explain-text';

/**
 * Una pregunta que otra pantalla deja lista (por ejemplo, el «¿Por qué no puedo?» de un bloque «Reservado» en la agenda).
 * Solo se **precarga**: la consulta (un POST) la dispara el clic de la persona, nunca la carga de la página (F7).
 */
export interface MyExplainPrefill {
  readonly tenantId?: string;
  readonly question: QuestionValue;
}

/** La ruta donde la persona activa su segundo paso. */
export const MFA_ROUTE = '/my-account/security/mfa';

/**
 * **«¿Por qué no puedo?»** — el autoservicio de explicación de la persona de apoyo (CONTRATO-GOBIERNO §5.4, §9.3 fila 13).
 *
 * Tres datos —qué quiso hacer, en la agenda de quién y cuándo— y la API explica con el mismo motor que decide, **sin** lo que
 * solo ve el administrador (en su lugar, «Pida a su administrador que…»). Si lo que falta es algo que la persona sí puede
 * hacer (el compromiso de confidencialidad, el segundo paso), el botón está ahí mismo.
 */
@Component({
  selector: 'app-my-explain',
  imports: [
    AppButton,
    AppButtonLink,
    Card,
    ExplainQuestion,
    ExplainResult,
    FormField,
    RouterLink,
    Select,
    ViewStateHost,
  ],
  templateUrl: './my-explain.html',
  styleUrl: './my-explain.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyExplain {
  private readonly explain = inject(AccessExplainClient);
  private readonly support = inject(SupportAccessClient);
  private readonly lifecycle = inject(AccessLifecycleClient);
  private readonly toasts = inject(ToastService);

  readonly engagements = input.required<readonly SupportEngagement[]>();
  readonly prefill = input<MyExplainPrefill | null>(null);

  protected readonly tenantId = signal<string | null>(null);
  protected readonly catalog = signal<SupportCatalog | null>(null);
  protected readonly initial = signal<QuestionValue | null>(null);
  protected readonly acknowledging = signal(false);
  protected readonly mfaRoute = MFA_ROUTE;
  protected readonly session = new ExplainSession((question, assume) =>
    this.explain.explainMine({ tenantId: this.tenantId()!, ...questionBody(question, assume) }),
  );

  /** Los vínculos sobre los que tiene sentido preguntar: todos menos los terminados y los que aún no empiezan. */
  protected readonly askable = computed(() =>
    this.engagements().filter((e) => e.status === 'ACTIVE' || e.status === 'SUSPENDED'),
  );
  protected readonly organizations = computed<readonly SelectOption<string>[]>(() => {
    const seen = new Map<string, string>();
    for (const e of this.askable()) seen.set(e.tenantId, e.organizationName);
    return [...seen].map(([value, label]) => ({ value, label }));
  });
  protected readonly actions = computed(() => actionOptions(null, true));
  protected readonly doctors = computed<readonly SelectOption<string>[]>(() =>
    (this.catalog()?.doctors ?? []).map((d) => ({
      value: d.id,
      label: `${d.name} · ${d.specialty}`,
    })),
  );
  protected readonly pendingOnboarding = computed(
    () =>
      this.session
        .current()
        ?.reasons.some((r) => r.code === 'ONBOARDING_INCOMPLETE' && !r.passed) === true,
  );
  protected readonly needsStepUp = computed(
    () => this.session.current()?.missing.some((m) => m.kind === 'STEP_UP') === true,
  );

  constructor() {
    // Con una sola organización no hay nada que elegir: se usa esa.
    effect(() => {
      const options = this.organizations();
      const current = untracked(() => this.tenantId());
      if (options.length > 0 && (current === null || !options.some((o) => o.value === current)))
        untracked(() => this.pickOrganization(options[0]!.value));
    });
    effect(() => {
      const prefill = this.prefill();
      if (prefill === null) return;
      untracked(() => {
        if (prefill.tenantId !== undefined) this.pickOrganization(prefill.tenantId);
        this.initial.set(prefill.question);
      });
    });
  }

  protected pickOrganization(id: string | null): void {
    if (id === null || id === this.tenantId()) return;
    this.tenantId.set(id);
    this.catalog.set(null);
    this.session.markStale();
    this.support.getMyCatalog(id).subscribe({
      next: (catalog) => this.catalog.set(catalog),
      error: () => this.catalog.set(null),
    });
  }

  /** El compromiso de confidencialidad de **su** vínculo en la organización elegida; luego se vuelve a preguntar. */
  protected acknowledge(): void {
    const engagement = this.askable().find((e) => e.tenantId === this.tenantId());
    if (engagement === undefined || this.acknowledging()) return;
    this.acknowledging.set(true);
    this.lifecycle.acknowledgeConfidentiality(engagement.id).subscribe({
      next: () => {
        this.acknowledging.set(false);
        this.toasts.success(
          'Aceptó el compromiso de confidencialidad.',
          'Vuelva a probar la acción: ya no debería faltar eso.',
        );
        this.session.repeat();
      },
      error: (failure: unknown) => {
        this.acknowledging.set(false);
        this.toasts.error(
          accessFailureOf(failure)?.message ??
            'No pudimos registrar su compromiso. Vuelva a intentarlo.',
        );
      },
    });
  }
}

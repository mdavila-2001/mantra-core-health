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

import { AccessExplainClient } from '../../../../core/data-access/access-governance/access-explain.client';
import type { PermissionCatalog } from '../../../../core/data-access/access-governance/access-explain.types';
import type {
  SupportCatalog,
  SupportEngagement,
} from '../../../../core/data-access/support-access/support-access.types';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { templateLabel } from '../../../support-access/support-labels';
import { ExplainQuestion, type QuestionValue } from '../explain-question/explain-question';
import { ExplainResult } from '../explain-result/explain-result';
import { ExplainSession, questionBody } from '../explain-session';
import { actionOptions } from '../explain-text';

/** Lo que otra pantalla (la matriz, un caso del simulador) deja listo para preguntar. */
export interface ExplainPrefill {
  readonly engagementId: string;
  readonly question: QuestionValue;
  /** Pregunta de una vez. Solo para lo que nace de un clic en la propia pantalla (el «¿Por qué?» de un caso del borrador): una dirección nunca lo pone (F7). */
  readonly ask?: boolean;
}

/**
 * **«¿Por qué puede o no puede?»** — la pestaña de explicar del simulador (CONTRATO-GOBIERNO §9.3 fila 10).
 *
 * Elegir persona, acción, doctor/servicio/espacio, paciente de ejemplo y momento; la API devuelve ✔/✖/⚠, la traza ordenada
 * y lo que faltaría. Los supuestos («¿y si…?») vuelven a preguntar con la misma consulta. No guarda nada: `explain` solo lee.
 */
@Component({
  selector: 'app-explain-panel',
  imports: [ExplainQuestion, ExplainResult, FormField, Select, ViewStateHost],
  templateUrl: './explain-panel.html',
  styleUrl: './explain-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExplainPanel {
  private readonly client = inject(AccessExplainClient);

  readonly engagements = input.required<readonly SupportEngagement[]>();
  readonly catalog = input<SupportCatalog | null>(null);
  readonly permissionCatalog = input<PermissionCatalog | null>(null);
  readonly prefill = input<ExplainPrefill | null>(null);

  protected readonly engagementId = signal<string | null>(null);
  protected readonly initial = signal<QuestionValue | null>(null);
  protected readonly tried = signal(false);
  protected readonly session = new ExplainSession((question, assume) =>
    this.client.explain({ engagementId: this.engagementId()!, ...questionBody(question, assume) }),
  );

  protected readonly personOptions = computed<readonly SelectOption<string>[]>(() =>
    this.engagements()
      .filter((e) => e.status !== 'ENDED')
      .map((e) => ({
        value: e.id,
        label: `${e.personName} · ${templateLabel(e.roleTemplate)}`,
        description: e.organizationName,
      })),
  );
  protected readonly actions = computed(() => actionOptions(this.permissionCatalog()));
  protected readonly doctors = computed<readonly SelectOption<string>[]>(() =>
    (this.catalog()?.doctors ?? []).map((d) => ({
      value: d.id,
      label: `${d.name} · ${d.specialty}`,
    })),
  );
  protected readonly services = computed<readonly SelectOption<string>[]>(() =>
    (this.catalog()?.services ?? []).map((s) => ({ value: s.id, label: s.name })),
  );
  protected readonly spaces = computed<readonly SelectOption<string>[]>(() =>
    (this.catalog()?.locations ?? [])
      .filter((l) => l.kind !== 'SITE')
      .map((l) => ({ value: l.id, label: l.name })),
  );
  protected readonly personError = computed(() =>
    this.tried() && this.engagementId() === null ? 'Elija a la persona.' : '',
  );

  constructor() {
    effect(() => {
      const prefill = this.prefill();
      if (prefill === null) return;
      untracked(() => {
        this.engagementId.set(prefill.engagementId);
        this.initial.set(prefill.question);
        if (prefill.ask === true) this.askFresh(prefill.question);
      });
    });
  }

  protected askFresh(question: QuestionValue): void {
    this.tried.set(true);
    if (this.engagementId() === null) return;
    this.session.askFresh(question);
  }

  protected pickPerson(id: string | null): void {
    this.engagementId.set(id);
    this.session.markStale();
  }
}

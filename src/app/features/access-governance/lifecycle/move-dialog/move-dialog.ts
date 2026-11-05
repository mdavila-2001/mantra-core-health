import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { accessFailureOf } from '../../../../core/data-access/access-governance/access-errors';
import { AccessExplainClient } from '../../../../core/data-access/access-governance/access-explain.client';
import type { SimulateAccessResponse } from '../../../../core/data-access/access-governance/access-explain.types';
import { AccessLifecycleClient } from '../../../../core/data-access/access-governance/access-lifecycle.client';
import type { MoveResult } from '../../../../core/data-access/access-governance/access-lifecycle.types';
import { SupportAccessClient } from '../../../../core/data-access/support-access/support-access.client';
import {
  SUPPORT_ROLE_TEMPLATE_CODES,
  SUPPORT_ROLE_TEMPLATE_LABELS,
  type SupportCatalog,
  type SupportEngagement,
} from '../../../../core/data-access/support-access/support-access.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, notFound, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { AccessChallengeService } from '../../access-challenge/access-challenge.service';
import {
  draftFromGrant,
  emptyDraft,
  hasPerActionConditions,
  labelOfTarget,
  optionsFromCatalog,
  toMoveGrant,
  toSimulationGrant,
  withTargetsOf,
  type GrantDraft,
  type TargetOption,
} from '../grant-draft/grant-draft';
import { GrantComposer } from '../grant-composer/grant-composer';
import { SimulationPreview } from '../simulation-preview/simulation-preview';

interface MoveData {
  readonly engagement: SupportEngagement;
  readonly catalog: SupportCatalog;
  readonly options: readonly TargetOption[];
}

const MIN_REASON = 10;

/**
 * **Cambiar de rol o alcance** (CONTRATO-GOBIERNO §6.1 «mover», §9.3 fila 9): se arma el conjunto nuevo de permisos, se
 * **simula antes de guardar** (qué cambia, a cuántos casos reales afecta, conflictos de funciones y puntaje de privilegios)
 * y recién entonces se confirma.
 *
 * - **Lo anterior vence ahora**: lo que no esté en el conjunto nuevo termina al aplicar (mínimo privilegio, sin gracia).
 * - La API responde **200** si lo aplicó o **202** si el cambio sube mucho el privilegio y pide **cuatro ojos**: la pantalla
 *   dice en cuál de los dos quedó.
 * - Aplicado, se abre una **revisión posterior** de cada permiso nuevo (14 días).
 *
 * La autoridad es la API: simular y mover validan de nuevo. Cualquier cambio del borrador invalida la vista previa.
 */
@Component({
  selector: 'app-move-engagement',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Card,
    FormField,
    GrantComposer,
    PageHeader,
    RouterLink,
    Select,
    SimulationPreview,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './move-dialog.html',
  styleUrl: './move-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoveEngagement implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly support = inject(SupportAccessClient);
  private readonly explain = inject(AccessExplainClient);
  private readonly lifecycle = inject(AccessLifecycleClient);
  private readonly challenges = inject(AccessChallengeService);

  private readonly engagementId = this.route.snapshot.paramMap.get('engagementId') ?? '';

  protected readonly state = signal<ViewState<MoveData>>(loading());
  protected readonly drafts = signal<readonly GrantDraft[]>([]);
  protected readonly template = signal<string | null>(null);
  protected readonly preview = signal<SimulateAccessResponse | null>(null);
  protected readonly previewOutdated = signal(false);
  protected readonly simulating = signal(false);
  protected readonly simulationFailure = signal('');
  protected readonly reason = signal('');
  protected readonly attempted = signal(false);
  protected readonly confirming = signal(false);
  protected readonly failure = signal<{
    readonly message: string;
    readonly reason?: string;
  } | null>(null);
  protected readonly result = signal<MoveResult | null>(null);

  protected readonly templateOptions: readonly SelectOption<string>[] =
    SUPPORT_ROLE_TEMPLATE_CODES.map((code) => ({
      value: code,
      label: SUPPORT_ROLE_TEMPLATE_LABELS[code],
    }));

  protected readonly data = computed<MoveData | null>(() => {
    const current = this.state();
    return current.status === 'ready' ? current.data : null;
  });

  protected readonly title = computed(() => {
    const d = this.data();
    return d === null
      ? 'Cambiar de rol o alcance'
      : `Cambiar de rol o alcance: ${d.engagement.personName}`;
  });

  protected readonly breadcrumbs = computed(() => [
    { label: 'Equipo de apoyo', routerLink: '/administration/support-team' },
    { label: this.data()?.engagement.personName ?? 'Persona' },
    { label: 'Cambiar de rol o alcance' },
  ]);

  /** Las prohibiciones expresas se conservan tal cual: no se editan acá. */
  protected readonly editable = computed(() => this.drafts().filter((d) => d.effect !== 'DENY'));
  protected readonly preserved = computed(() => this.drafts().filter((d) => d.effect === 'DENY'));

  protected readonly dropsConditions = computed(() => hasPerActionConditions(this.drafts()));

  protected readonly templateChanged = computed(() => {
    const d = this.data();
    const chosen = this.template();
    return d !== null && chosen !== null && chosen !== d.engagement.roleTemplate;
  });

  protected readonly needsApproval = computed(
    () => this.preview()?.governance.needsFourEyes.required === true,
  );
  protected readonly reasonError = computed(() =>
    this.attempted() && this.reason().trim().length < MIN_REASON
      ? `Escriba al menos ${MIN_REASON} caracteres: queda en el registro.`
      : '',
  );
  protected readonly canConfirm = computed(
    () => this.preview()?.valid === true && !this.previewOutdated(),
  );

  protected readonly targetLabel = (draft: GrantDraft): string => this.optionLabel(draft);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set(loading());
    forkJoin({
      engagements: this.support.listEngagements(),
      catalog: this.support.getCatalog(),
    }).subscribe({
      next: ({ engagements, catalog }) => {
        const engagement = engagements.items.find((e) => e.id === this.engagementId);
        if (engagement === undefined) {
          this.state.set(
            notFound({ label: 'Volver al equipo de apoyo', route: '/administration/support-team' }),
          );
          return;
        }
        if (engagement.status === 'ENDED') {
          this.state.set(
            empty(
              { label: 'Volver al equipo de apoyo', route: '/administration/support-team' },
              'Este vínculo ya terminó: no se puede cambiar su rol ni su alcance.',
            ),
          );
          return;
        }
        const live = engagement.grants.filter((g) => g.status === 'ACTIVE');
        const options = withTargetsOf(optionsFromCatalog(catalog), live, catalog);
        this.drafts.set(live.map(draftFromGrant));
        this.template.set(engagement.roleTemplate);
        this.preview.set(null);
        this.previewOutdated.set(false);
        this.attempted.set(false);
        this.state.set(ready({ engagement, catalog, options }));
      },
      error: (error: unknown) => this.state.set(errorToViewState<MoveData>(error)),
    });
  }

  /* ---- el borrador ------------------------------------------------------------------------------------------------ */

  private invalidate(): void {
    if (this.preview() !== null) this.previewOutdated.set(true);
    this.failure.set(null);
  }

  protected setTemplate(code: string | null): void {
    this.template.set(code);
    this.invalidate();
  }

  protected updateDraft(next: GrantDraft): void {
    this.drafts.update((current) => current.map((d) => (d.id === next.id ? next : d)));
    this.invalidate();
  }

  protected removeDraft(id: string): void {
    this.drafts.update((current) => current.filter((d) => d.id !== id));
    this.invalidate();
  }

  protected addDraft(): void {
    const first = this.data()?.options[0];
    if (first === undefined) return;
    this.drafts.update((current) => [...current, emptyDraft(first.key)]);
    this.invalidate();
  }

  private optionLabel(draft: GrantDraft): string {
    const d = this.data();
    return (
      d?.options.find((o) => o.key === draft.targetKey)?.label ??
      labelOfTarget({ targetKind: 'ALL' }, d?.catalog ?? null)
    );
  }

  protected atomsText(draft: GrantDraft): string {
    return draft.atoms.length === 0
      ? 'sin permisos'
      : `${draft.atoms.length} ${draft.atoms.length === 1 ? 'permiso' : 'permisos'}`;
  }

  /* ---- vista previa ------------------------------------------------------------------------------------------------ */

  private optionFor(draft: GrantDraft): TargetOption | undefined {
    return this.data()?.options.find((o) => o.key === draft.targetKey);
  }

  private complete(): boolean {
    return this.drafts().every(
      (d) => this.optionFor(d) !== undefined && (d.effect === 'DENY' || d.atoms.length > 0),
    );
  }

  protected simulate(): void {
    const d = this.data();
    if (d === null || this.simulating()) return;
    if (!this.complete()) {
      this.simulationFailure.set(
        'Cada permiso necesita un lugar donde rige y al menos una cosa que pueda hacer. Complete o quite los que estén vacíos.',
      );
      return;
    }
    this.simulationFailure.set('');
    this.simulating.set(true);
    const grants = this.drafts().map((draft) => toSimulationGrant(draft, this.optionFor(draft)!));
    this.explain
      .simulate({
        engagementId: d.engagement.id,
        draft: {
          mode: 'REPLACE',
          ...(this.templateChanged() ? { templateCode: this.template() } : {}),
          grants,
        },
      })
      .subscribe({
        next: (response) => {
          this.simulating.set(false);
          this.preview.set(response);
          this.previewOutdated.set(false);
        },
        error: (error: unknown) => {
          this.simulating.set(false);
          this.simulationFailure.set(
            accessFailureOf(error)?.message ??
              'No pudimos calcular la vista previa. Vuelva a intentarlo.',
          );
        },
      });
  }

  /* ---- confirmar ---------------------------------------------------------------------------------------------------- */

  protected confirm(): void {
    const d = this.data();
    const preview = this.preview();
    this.attempted.set(true);
    if (
      d === null ||
      preview === null ||
      this.confirming() ||
      this.reason().trim().length < MIN_REASON ||
      !this.canConfirm()
    )
      return;
    const grants = this.drafts().map((draft) => toMoveGrant(draft, this.optionFor(draft)!));
    const request = {
      reason: this.reason().trim(),
      ...(this.templateChanged() ? { newTemplateCode: this.template()! } : {}),
      grants,
      ...(preview.simulationToken === undefined
        ? {}
        : { simulationToken: preview.simulationToken }),
    };
    this.confirming.set(true);
    this.failure.set(null);
    this.challenges
      .run(() => this.lifecycle.move(d.engagement.id, request), {
        actionLabel: `Cambiar el rol o alcance de ${d.engagement.personName}`,
      })
      .subscribe({
        next: (outcome) => {
          this.confirming.set(false);
          this.result.set(outcome);
          this.reason.set('');
          this.load();
        },
        error: (error: unknown) => {
          this.confirming.set(false);
          const known = accessFailureOf(error);
          if (known?.reason === 'SIMULATION_STALE') {
            this.preview.set(null);
            this.previewOutdated.set(false);
          }
          this.failure.set({
            message: known?.message ?? 'No pudimos aplicar el cambio. Vuelva a intentarlo.',
            ...(known?.reason === undefined ? {} : { reason: known.reason }),
          });
        },
      });
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { forkJoin, type Subscription } from 'rxjs';

import { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import type { RoleAssignment } from '../../../../../core/data-access/authz-admin/authz-admin.types';
import { AuthzGovernanceClient } from '../../../../../core/data-access/authz-governance/authz-governance.client';
import {
  GOVERNANCE_REASON_MAX,
  GOVERNANCE_REASON_MIN,
  type AccessReview,
  type AccessReviewDecision,
} from '../../../../../core/data-access/authz-governance/authz-governance.types';
import { fieldErrorsOf } from '../../../../../core/http/api-failure';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { DrawerPanel } from '../../../../../shared/components/organisms/drawer-panel/drawer-panel';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import { scopeSummary } from '../../governance/access/access.model';
import { dateOnly, dateTime, roleScope } from '../../governance/governance-labels';
import { governanceFailure, reviewDecision, staleAfter } from '../permissions-labels';

interface ReviewData {
  readonly active: readonly RoleAssignment[];
  readonly history: readonly AccessReview[];
}

const DECISIONS: readonly SelectOption<string>[] = [
  { value: 'CERTIFIED', label: 'Certifico que estos accesos siguen siendo los correctos' },
  { value: 'CHANGES_REQUIRED', label: 'Hay que cambiar algún acceso' },
];

/**
 * El cajón de la revisión de accesos de una persona: sus asignaciones activas,
 * el formulario para certificarlas o pedir cambios, y el historial de
 * revisiones anteriores (quién, cuándo, qué decidió y por qué). Revisar no
 * cambia ningún acceso: quitar un rol se hace en «Usuarios y roles».
 */
@Component({
  selector: 'app-portal-review-drawer',
  imports: [AppButton, Badge, Select, Textarea, Alert, FormField, DrawerPanel, ViewStateHost],
  template: `
    <app-drawer-panel
      [open]="userId() !== ''"
      heading="Revisión de accesos"
      [subheading]="name()"
      closeLabel="Cerrar"
      (closed)="closed.emit()"
    >
      <div class="panel" data-testid="portal-review">
        @if (notice(); as message) {
          <app-alert tone="success" data-testid="portal-review-notice">{{ message }}</app-alert>
        }
        @if (error(); as message) {
          <app-alert tone="error" data-testid="portal-review-error">{{ message }}</app-alert>
        }
        <app-view-state-host [state]="data()" (retry)="reload()">
          @if (data(); as state) {
            @if (state.status === 'ready') {
              <h3 class="panel__name">Accesos activos que se revisan</h3>
              @if (state.data.active.length === 0) {
                <p class="panel__note">No tiene asignaciones de rol activas: no hay accesos que certificar.</p>
              } @else {
                <ul class="panel__list" aria-label="Asignaciones activas">
                  @for (a of state.data.active; track a.id) {
                    <li class="panel__item" data-testid="portal-review-assignment">
                      <div class="panel__badges">
                        <span class="panel__name">{{ a.roleName }}</span>
                        <code class="panel__code">{{ a.roleCode }}</code>
                      </div>
                      <div class="panel__badges">
                        <app-badge size="sm" [variant]="scope(a.roleScope).tone">{{ scope(a.roleScope).label }}</app-badge>
                        <app-badge size="sm" [variant]="a.isEffective ? 'success' : 'warning'">
                          {{ a.isEffective ? 'Vale hoy' : 'Fuera de su vigencia' }}
                        </app-badge>
                      </div>
                      <span class="panel__secondary">
                        {{ where(a) }}
                        @if (a.validTo) { · vale hasta el {{ day(a.validTo) }} }
                      </span>
                    </li>
                  }
                </ul>
              }

              <form class="panel__form" novalidate (submit)="$event.preventDefault(); record()">
                <app-form-field label="Decisión" [required]="true">
                  <app-select ariaLabel="Decisión" data-testid="portal-review-decision" [options]="decisions" [(value)]="decision" />
                </app-form-field>
                <app-form-field
                  label="Motivo"
                  [required]="true"
                  [hint]="'Entre ' + min + ' y ' + max + ' caracteres. Queda en el historial.'"
                  [errorMessage]="reasonProblem()"
                >
                  <app-textarea
                    ariaLabel="Motivo"
                    data-testid="portal-review-reason"
                    [rows]="3"
                    [maxLength]="max"
                    [(value)]="reason"
                  />
                </app-form-field>
                <div class="panel__actions">
                  <button app-button variant="primary" data-testid="portal-review-save" [isLoading]="saving()" (clicked)="record()">
                    Registrar la revisión
                  </button>
                </div>
              </form>

              <h3 class="panel__name">Revisiones anteriores</h3>
              @if (state.data.history.length === 0) {
                <p class="panel__note">Estos accesos nunca se revisaron.</p>
              } @else {
                <ul class="panel__list" aria-label="Historial de revisiones">
                  @for (r of state.data.history; track r.id) {
                    <li class="panel__item" data-testid="portal-review-event">
                      <div class="panel__badges">
                        <app-badge size="sm" [variant]="decisionLabel(r.decision).tone">{{ decisionLabel(r.decision).label }}</app-badge>
                        <span class="panel__secondary">{{ when(r.reviewedAt) }}</span>
                      </div>
                      <p class="panel__note">{{ r.reason }}</p>
                      <span class="panel__secondary">
                        {{ r.assignmentIds.length }} {{ r.assignmentIds.length === 1 ? 'asignación revisada' : 'asignaciones revisadas' }}
                        @if (r.reviewerUserId) {
                          · por <code class="panel__code" [title]="r.reviewerUserId">{{ r.reviewerUserId.slice(0, 8) }}…</code>
                        }
                      </span>
                    </li>
                  }
                </ul>
              }
            }
          }
        </app-view-state-host>
      </div>
    </app-drawer-panel>
  `,
  styleUrl: '../permissions-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewDrawer {
  private readonly authz = inject(AuthzAdminClient);
  private readonly governance = inject(AuthzGovernanceClient);

  /** La persona abierta; `''` es «cerrado». */
  readonly userId = input.required<string>();
  readonly closed = output<void>();
  /** Se registró una revisión; lleva el aviso para la lista. */
  readonly changed = output<string>();

  protected readonly min = GOVERNANCE_REASON_MIN;
  protected readonly max = GOVERNANCE_REASON_MAX;
  protected readonly decisions = DECISIONS;
  protected readonly data = signal<ViewState<ReviewData>>(loading());
  protected readonly name = signal('');
  protected readonly decision = signal<string | null>('CERTIFIED');
  protected readonly reason = signal('');
  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly scope = roleScope;
  protected readonly where = scopeSummary;
  protected readonly day = dateOnly;
  protected readonly when = dateTime;
  protected readonly decisionLabel = reviewDecision;

  private readonly submitted = signal(false);
  private readonly server = signal('');
  protected readonly reasonProblem = computed(() => {
    if (this.server() !== '') return this.server();
    const length = this.reason().trim().length;
    return this.submitted() && length < GOVERNANCE_REASON_MIN
      ? `Escriba al menos ${GOVERNANCE_REASON_MIN} caracteres.`
      : '';
  });

  private reading: Subscription | null = null;
  private naming: Subscription | null = null;
  private mutation: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.reading?.unsubscribe();
      this.naming?.unsubscribe();
      this.mutation?.unsubscribe();
    });
    effect(() => {
      const id = this.userId();
      untracked(() => {
        this.notice.set(null);
        this.error.set(null);
        this.name.set('');
        this.reason.set('');
        this.decision.set('CERTIFIED');
        this.submitted.set(false);
        this.server.set('');
        this.naming?.unsubscribe();
        if (id === '') return;
        this.naming = this.authz.displayNameOf(id).subscribe({ next: (n) => this.name.set(n), error: () => undefined });
        this.load(id);
      });
    });
  }

  protected reload(): void {
    this.load(this.userId());
  }

  protected record(): void {
    this.submitted.set(true);
    this.server.set('');
    const state = this.data();
    if (state.status !== 'ready' || this.reason().trim().length < GOVERNANCE_REASON_MIN) return;
    this.saving.set(true);
    this.error.set(null);
    this.mutation = this.governance
      .recordAccessReview(this.userId(), {
        decision: (this.decision() ?? 'CERTIFIED') as AccessReviewDecision,
        reason: this.reason().trim(),
        assignmentIds: state.data.active.map((a) => a.id),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          const message = `Quedó registrada la revisión de los accesos de ${this.name() || 'esta persona'}.`;
          this.notice.set(message);
          this.reason.set('');
          this.submitted.set(false);
          this.changed.emit(message);
          this.reload();
        },
        // Lo escrito se conserva: el motivo sigue en el formulario.
        error: (e: unknown) => {
          this.saving.set(false);
          this.server.set(fieldErrorsOf(e)['reason'] ?? '');
          this.error.set(governanceFailure(e, 'No se pudo registrar la revisión. Lo que escribió sigue acá.'));
          if (staleAfter(e)) this.reload();
        },
      });
  }

  private load(id: string): void {
    this.reading?.unsubscribe();
    this.data.set(loading());
    this.reading = forkJoin({
      assignments: this.authz.assignmentsOf(id),
      reviews: this.governance.accessReviewsOf(id),
    }).subscribe({
      next: ({ assignments, reviews }) =>
        this.data.set(
          ready({
            active: assignments.items.filter((a) => a.status === 'ACTIVE'),
            history: reviews.items,
          }),
        ),
      error: (e: unknown) => this.data.set(errorToViewState<ReviewData>(e)),
    });
  }
}

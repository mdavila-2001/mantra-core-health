import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import type { Subscription } from 'rxjs';

import { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import { AuthzGovernanceClient } from '../../../../../core/data-access/authz-governance/authz-governance.client';
import {
  GOVERNANCE_REASON_MAX,
  GOVERNANCE_REASON_MIN,
  type LifecycleAction,
  type UserLifecycle,
} from '../../../../../core/data-access/authz-governance/authz-governance.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { DrawerPanel } from '../../../../../shared/components/organisms/drawer-panel/drawer-panel';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import { dateTime } from '../../governance/governance-labels';
import {
  actionsFor,
  governanceFailure,
  LIFECYCLE_ACTIONS,
  lifecycleEvent,
  lifecycleState,
  staleAfter,
} from '../permissions-labels';

/**
 * El cajón del ciclo de vida de una cuenta interna: su estado, lo que se puede
 * hacer desde ese estado y el historial con motivo, autor y fecha. Cada acción
 * pide el motivo y se confirma; la API valida la transición y, si ya no vale
 * (otra persona se adelantó), lo explica y el cajón se relee.
 */
@Component({
  selector: 'app-portal-lifecycle-drawer',
  imports: [AppButton, Badge, Alert, DrawerPanel, ViewStateHost],
  template: `
    <app-drawer-panel
      [open]="userId() !== ''"
      heading="Ciclo de vida de la cuenta"
      [subheading]="name()"
      closeLabel="Cerrar"
      (closed)="closed.emit()"
    >
      <div class="panel" data-testid="portal-lifecycle">
        @if (notice(); as message) {
          <app-alert tone="success" data-testid="portal-lifecycle-notice">{{ message }}</app-alert>
        }
        @if (error(); as message) {
          <app-alert tone="error" data-testid="portal-lifecycle-error">{{ message }}</app-alert>
        }
        <app-view-state-host [state]="lifecycle()" (retry)="reload()">
          @if (lifecycle(); as state) {
            @if (state.status === 'ready') {
              <div class="panel__badges">
                <app-badge [variant]="stateLabel(state.data.state).tone" data-testid="portal-lifecycle-state">
                  {{ stateLabel(state.data.state).label }}
                </app-badge>
              </div>
              @if (actions(state.data.state).length === 0) {
                <p class="panel__note">Desde este estado no hay acciones disponibles.</p>
              } @else {
                <div class="panel__actions">
                  @for (a of actions(state.data.state); track a) {
                    <button
                      app-button
                      [variant]="catalog[a].destructive ? 'outline' : 'primary'"
                      [attr.data-testid]="'portal-lifecycle-' + a"
                      [isLoading]="running() === a"
                      [disabled]="running() !== null"
                      (clicked)="run(a)"
                    >
                      {{ catalog[a].verb }}
                    </button>
                  }
                </div>
              }
              <h3 class="panel__name">Historial</h3>
              @if (state.data.history.length === 0) {
                <p class="panel__note">Esta cuenta nunca se suspendió ni se dio de baja desde la consola.</p>
              } @else {
                <ul class="panel__list" aria-label="Historial del ciclo de vida">
                  @for (e of state.data.history; track e.id) {
                    <li class="panel__item" data-testid="portal-lifecycle-event">
                      <div class="panel__badges">
                        <app-badge size="sm" [variant]="eventLabel(e.kind).tone">{{ eventLabel(e.kind).label }}</app-badge>
                        <span class="panel__secondary">{{ when(e.recordedAt) }}</span>
                      </div>
                      <p class="panel__note">{{ e.reason }}</p>
                      @if (e.actorUserId) {
                        <span class="panel__secondary">Por <code class="panel__code" [title]="e.actorUserId">{{ e.actorUserId.slice(0, 8) }}…</code></span>
                      }
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
export class LifecycleDrawer {
  private readonly authz = inject(AuthzAdminClient);
  private readonly governance = inject(AuthzGovernanceClient);
  private readonly dialogs = inject(DialogService);

  /** La persona abierta; `''` es «cerrado». */
  readonly userId = input.required<string>();
  readonly closed = output<void>();
  /** Una acción se aplicó; lleva el aviso para la lista. */
  readonly changed = output<string>();

  protected readonly catalog = LIFECYCLE_ACTIONS;
  protected readonly lifecycle = signal<ViewState<UserLifecycle>>(loading());
  protected readonly name = signal('');
  protected readonly running = signal<LifecycleAction | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly stateLabel = lifecycleState;
  protected readonly eventLabel = lifecycleEvent;
  protected readonly actions = actionsFor;
  protected readonly when = dateTime;

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
        this.naming?.unsubscribe();
        if (id === '') return;
        // Sin nombre el cajón dice sólo el estado: la acción igual se puede hacer.
        this.naming = this.authz.displayNameOf(id).subscribe({ next: (n) => this.name.set(n), error: () => undefined });
        this.load(id);
      });
    });
  }

  protected reload(): void {
    this.load(this.userId());
  }

  protected async run(action: LifecycleAction): Promise<void> {
    const spec = LIFECYCLE_ACTIONS[action];
    const who = this.name() || 'esta persona';
    const reason = await this.dialogs.confirmWithReason(
      {
        title: spec.title,
        message: `${spec.effect} Cuenta: ${who}. Queda en la bitácora con su autor.`,
        confirmLabel: spec.verb,
        cancelLabel: 'Volver',
        destructive: spec.destructive,
      },
      {
        label: 'Motivo',
        hint: 'Queda en el historial de la cuenta.',
        minLength: GOVERNANCE_REASON_MIN,
        maxLength: GOVERNANCE_REASON_MAX,
      },
    );
    if (reason === null) return;
    this.running.set(action);
    this.error.set(null);
    this.notice.set(null);
    this.mutation = this.governance.lifecycleAction(this.userId(), action, reason).subscribe({
      next: (result) => {
        this.running.set(null);
        const revoked = result.revokedAssignments > 0 ? ` Se revocaron ${result.revokedAssignments} roles.` : '';
        const message = `${spec.title.replace(' la cuenta', '')}: ${who}.${revoked}`;
        this.notice.set(message);
        this.changed.emit(message);
        this.reload();
      },
      error: (e: unknown) => {
        this.running.set(null);
        this.error.set(governanceFailure(e, 'No se pudo aplicar el cambio. Intente de nuevo.'));
        if (staleAfter(e)) this.reload();
      },
    });
  }

  private load(id: string): void {
    this.reading?.unsubscribe();
    this.lifecycle.set(loading());
    this.reading = this.governance.lifecycleOf(id).subscribe({
      next: (body) => this.lifecycle.set(ready(body)),
      error: (e: unknown) => this.lifecycle.set(errorToViewState<UserLifecycle>(e)),
    });
  }
}

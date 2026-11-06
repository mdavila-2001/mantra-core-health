import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import type { Subscription } from 'rxjs';

import { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import { AuthzGovernanceClient } from '../../../../../core/data-access/authz-governance/authz-governance.client';
import {
  LIFECYCLE_REASON_MAX,
  type LifecycleAction,
  type LifecycleEvent,
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
 *
 * Las rutas son las de `iam` (`/iam/users/:id/...`): suspender, reactivar y
 * dar de baja. La historia viene paginada: se muestra la primera página y
 * «Ver más antiguos» pide la siguiente.
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
              @if (events().length === 0) {
                <p class="panel__note">Esta cuenta nunca se suspendió ni se dio de baja desde la consola.</p>
              } @else {
                <ul class="panel__list" aria-label="Historial del ciclo de vida">
                  @for (e of events(); track e.id) {
                    <li class="panel__item" data-testid="portal-lifecycle-event">
                      <div class="panel__badges">
                        <app-badge size="sm" [variant]="eventLabel(e.action).tone">{{ eventLabel(e.action).label }}</app-badge>
                        <span class="panel__secondary">{{ when(e.recordedAt) }}</span>
                      </div>
                      @if (e.reason) {
                        <p class="panel__note">{{ e.reason }}</p>
                      }
                      @if (e.recordedByUserId) {
                        <span class="panel__secondary">Por <code class="panel__code" [title]="e.recordedByUserId">{{ e.recordedByUserId.slice(0, 8) }}…</code></span>
                      }
                    </li>
                  }
                </ul>
                @if (nextCursor() !== null) {
                  <div class="panel__actions">
                    <button
                      app-button
                      variant="outline"
                      data-testid="portal-lifecycle-more"
                      [isLoading]="loadingMore()"
                      (clicked)="more()"
                    >
                      Ver más antiguos
                    </button>
                  </div>
                }
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
  /** La historia acumulada (primera página + las que se pidieron después). */
  protected readonly events = signal<readonly LifecycleEvent[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loadingMore = signal(false);
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
  private paging: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.reading?.unsubscribe();
      this.naming?.unsubscribe();
      this.mutation?.unsubscribe();
      this.paging?.unsubscribe();
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
        minLength: 1,
        maxLength: LIFECYCLE_REASON_MAX,
      },
    );
    if (reason === null) return;
    this.running.set(action);
    this.error.set(null);
    this.notice.set(null);
    this.mutation = this.governance.lifecycleAction(this.userId(), action, reason).subscribe({
      next: (result) => {
        this.running.set(null);
        // Idempotente: si otra persona ya la había dejado así, la API no escribe y lo dice.
        const message = result.changed
          ? `${spec.title.replace(' la cuenta', '')}: ${who}.${result.revokedSessions > 0 ? ` Se cortaron ${result.revokedSessions} sesiones.` : ''}`
          : `${who} ya estaba así: no se cambió nada.`;
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

  /** Pide la página siguiente de la historia y la suma a lo que ya se ve. */
  protected more(): void {
    const cursor = this.nextCursor();
    if (cursor === null) return;
    this.paging?.unsubscribe();
    this.loadingMore.set(true);
    this.paging = this.governance.lifecycleOf(this.userId(), { cursor }).subscribe({
      next: (page) => {
        this.loadingMore.set(false);
        this.events.update((all) => [...all, ...page.items]);
        this.nextCursor.set(page.nextCursor);
      },
      error: (e: unknown) => {
        this.loadingMore.set(false);
        this.error.set(governanceFailure(e, 'No se pudo leer el resto del historial. Intente de nuevo.'));
      },
    });
  }

  private load(id: string): void {
    this.reading?.unsubscribe();
    this.paging?.unsubscribe();
    this.lifecycle.set(loading());
    this.events.set([]);
    this.nextCursor.set(null);
    this.reading = this.governance.lifecycleOf(id).subscribe({
      next: (body) => {
        this.events.set(body.items);
        this.nextCursor.set(body.nextCursor);
        this.lifecycle.set(ready(body));
      },
      error: (e: unknown) => this.lifecycle.set(errorToViewState<UserLifecycle>(e)),
    });
  }
}

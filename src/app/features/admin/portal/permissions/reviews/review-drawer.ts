import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { forkJoin, type Subscription } from 'rxjs';

import { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import { AuthzGovernanceClient } from '../../../../../core/data-access/authz-governance/authz-governance.client';
import type { AccessMap, AccessReview } from '../../../../../core/data-access/authz-governance/authz-governance.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { DrawerPanel } from '../../../../../shared/components/organisms/drawer-panel/drawer-panel';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import { scopeSummary } from '../../governance/access/access.model';
import { roleScope } from '../../governance/governance-labels';
import { fecha, fechaHora } from '../../../../../shared/components/organisms/data-table/sin-cortes';
import { accountStatusLabel, governanceFailure, staleAfter } from '../permissions-labels';

interface ReviewData {
  readonly map: AccessMap;
  readonly history: readonly AccessReview[];
  /** Hay más revisiones que las que se muestran. */
  readonly moreHistory: boolean;
}

const HISTORY_SHOWN = 10;

/**
 * El cajón de la revisión de accesos de una persona: lo que tiene hoy (roles
 * globales, asignaciones, excepciones y campos restringidos, contados), el botón
 * para registrar que se revisó y las revisiones anteriores (quién y cuándo).
 *
 * Una revisión es un HECHO, no una decisión: la API sólo guarda quién revisó a
 * quién y cuándo. No lleva motivo ni certifica asignaciones concretas, y no
 * cambia ningún acceso: quitar un rol se hace en «Usuarios y roles». Nadie
 * revisa sus propios accesos (la API responde 422).
 */
@Component({
  selector: 'app-portal-review-drawer',
  imports: [AppButton, Badge, Alert, DrawerPanel, ViewStateHost],
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
              <div class="panel__badges">
                <app-badge [variant]="status(state.data.map.user.accountStatus).tone">
                  {{ status(state.data.map.user.accountStatus).label }}
                </app-badge>
                @for (code of state.data.map.globalRoles; track code) {
                  <app-badge size="sm" variant="secondary">{{ code }}</app-badge>
                }
              </div>
              <p class="panel__secondary" data-testid="portal-review-counts">
                {{ state.data.map.counts.directGrants }} excepciones por persona ·
                {{ state.data.map.counts.resourceScopeGrants }} permisos sobre un recurso ·
                {{ state.data.map.counts.restrictedFields }} campos restringidos
              </p>

              <h3 class="panel__name">Asignaciones de rol</h3>
              @if (state.data.map.assignments.length === 0) {
                <p class="panel__note">No tiene asignaciones de rol: sólo los roles globales de arriba.</p>
              } @else {
                <ul class="panel__list" aria-label="Asignaciones de rol">
                  @for (a of state.data.map.assignments; track a.id) {
                    <li class="panel__item" data-testid="portal-review-assignment">
                      <div class="panel__badges">
                        <span class="panel__name">{{ a.roleName }}</span>
                        <code class="panel__code">{{ a.roleCode }}</code>
                      </div>
                      <div class="panel__badges">
                        <app-badge size="sm" [variant]="scope(a.roleScope).tone">{{ scope(a.roleScope).label }}</app-badge>
                        <app-badge size="sm" [variant]="a.isEffective ? 'success' : 'warning'">
                          {{ a.isEffective ? 'Vale hoy' : 'No vale hoy' }}
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

              <div class="panel__actions">
                <button app-button variant="primary" data-testid="portal-review-save" [isLoading]="saving()" (clicked)="record()">
                  Registrar que revisé estos accesos
                </button>
              </div>

              <h3 class="panel__name">Revisiones anteriores</h3>
              @if (state.data.history.length === 0) {
                <p class="panel__note">Estos accesos nunca se revisaron.</p>
              } @else {
                <ul class="panel__list" aria-label="Historial de revisiones">
                  @for (r of state.data.history; track r.id) {
                    <li class="panel__item" data-testid="portal-review-event">
                      <span class="panel__name">{{ when(r.reviewedAt) }}</span>
                      <span class="panel__secondary">
                        por
                        @if (r.reviewerDisplayName) {
                          {{ r.reviewerDisplayName }}
                        } @else {
                          <code class="panel__code" [title]="r.reviewerUserId">{{ r.reviewerUserId.slice(0, 8) }}…</code>
                        }
                      </span>
                    </li>
                  }
                </ul>
                @if (state.data.moreHistory) {
                  <p class="panel__secondary">Hay revisiones más antiguas; se ven en la bitácora.</p>
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
export class ReviewDrawer {
  private readonly authz = inject(AuthzAdminClient);
  private readonly governance = inject(AuthzGovernanceClient);

  /** La persona abierta; `''` es «cerrado». */
  readonly userId = input.required<string>();
  readonly closed = output<void>();
  /** Se registró una revisión; lleva el aviso para la lista. */
  readonly changed = output<string>();

  protected readonly data = signal<ViewState<ReviewData>>(loading());
  protected readonly name = signal('');
  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly scope = roleScope;
  protected readonly status = accountStatusLabel;
  protected readonly where = scopeSummary;
  protected readonly day = fecha;
  protected readonly when = fechaHora;

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
        this.naming = this.authz.displayNameOf(id).subscribe({ next: (n) => this.name.set(n), error: () => undefined });
        this.load(id);
      });
    });
  }

  protected reload(): void {
    this.load(this.userId());
  }

  protected record(): void {
    this.saving.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.mutation = this.governance.recordAccessReview(this.userId()).subscribe({
      next: () => {
        this.saving.set(false);
        const message = `Quedó registrada la revisión de los accesos de ${this.name() || 'esta persona'}.`;
        this.notice.set(message);
        this.changed.emit(message);
        this.reload();
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.error.set(governanceFailure(e, 'No se pudo registrar la revisión. Intente de nuevo.'));
        if (staleAfter(e)) this.reload();
      },
    });
  }

  private load(id: string): void {
    this.reading?.unsubscribe();
    this.data.set(loading());
    this.reading = forkJoin({
      map: this.governance.accessMap(id),
      reviews: this.governance.accessReviews({ userId: id, limit: HISTORY_SHOWN }),
    }).subscribe({
      next: ({ map, reviews }) =>
        this.data.set(ready({ map, history: reviews.items, moreHistory: reviews.nextCursor !== null })),
      error: (e: unknown) => this.data.set(errorToViewState<ReviewData>(e)),
    });
  }
}

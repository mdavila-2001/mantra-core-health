import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, viewChild, type TemplateRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthzGovernanceClient } from '../../../../../core/data-access/authz-governance/authz-governance.client';
import type { AccessReviewDue } from '../../../../../core/data-access/authz-governance/authz-governance.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { dateOnly } from '../../governance/governance-labels';
import { portalUrl } from '../../portal-nav';
import { patchQuery, queryFilters, queryParamsSignal } from '../../support/route-query';
import { ReviewDrawer } from './review-drawer';

const URL_KEYS = ['review'] as const;

/**
 * La cola de revisión periódica: quiénes tienen accesos activos y cuándo se
 * revisaron por última vez. El plazo lo elige quien gobierna («sin revisar hace
 * más de N días»); la pantalla no inventa una cadencia. Sin plazo, se listan
 * todos, los nunca revisados primero.
 */
@Component({
  selector: 'app-portal-reviews-panel',
  imports: [Badge, Input, Alert, FormField, DataTable, ReviewDrawer],
  template: `
    <div class="panel" data-testid="portal-reviews-panel">
      @if (notice(); as message) {
        <app-alert tone="success" dismissible (dismissed)="notice.set(null)">{{ message }}</app-alert>
      }
      <p class="panel__note">
        Revisar es certificar que los accesos activos de una persona siguen siendo los que debe tener, o dejar asentado
        que hay que cambiarlos. Nadie revisa sus propios accesos.
      </p>
      <app-form-field
        label="Sin revisar hace más de (días)"
        hint="Déjelo vacío para ver a todas las personas con accesos activos."
        [errorMessage]="daysProblem()"
      >
        <app-input type="number" ariaLabel="Días sin revisar" data-testid="portal-reviews-days" [(value)]="daysText" />
      </app-form-field>
      <app-data-table
        data-testid="portal-reviews-table"
        caption="Personas con accesos por revisar"
        [state]="due()"
        [columns]="columns()"
        [trackBy]="byId"
        [rowLabel]="rowName"
        rowNavigable
        stackedOnMobile
        fitContainer
        (rowActivated)="open($event)"
        (retry)="reload()"
      />
    </div>
    <ng-template #nameCell let-row>
      <span class="panel__name">{{ row.displayName }}</span>
    </ng-template>
    <ng-template #countCell let-row>
      <app-badge size="sm" variant="secondary">{{ row.activeAssignments }}</app-badge>
    </ng-template>
    <ng-template #lastCell let-row>
      @if (row.lastReviewedAt) {
        <span class="panel__secondary">{{ day(row.lastReviewedAt) }}</span>
      } @else {
        <app-badge size="sm" variant="warning">Nunca revisada</app-badge>
      }
    </ng-template>
    <app-portal-review-drawer [userId]="values().review" (closed)="close()" (changed)="changed($event)" />
  `,
  styleUrl: '../permissions-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewsPanel {
  private readonly governance = inject(AuthzGovernanceClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly values = queryFilters(queryParamsSignal(this.route), URL_KEYS);
  protected readonly daysText = signal<string | number | null>('');
  protected readonly due = signal<ViewState<readonly AccessReviewDue[]>>(loading());
  protected readonly notice = signal<string | null>(null);
  protected readonly day = dateOnly;

  /** Los días que valen: entero entre 1 y 3650 (lo que acepta la API) o ninguno. */
  private readonly days = computed<number | null | 'invalid'>(() => {
    const text = String(this.daysText() ?? '').trim();
    if (text === '') return null;
    const n = Number(text);
    return Number.isInteger(n) && n >= 1 && n <= 3650 ? n : 'invalid';
  });
  protected readonly daysProblem = computed(() => (this.days() === 'invalid' ? 'Escriba un número entero de 1 a 3650.' : ''));

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: AccessReviewDue }>>('nameCell');
  private readonly countCell = viewChild.required<TemplateRef<{ $implicit: AccessReviewDue }>>('countCell');
  private readonly lastCell = viewChild.required<TemplateRef<{ $implicit: AccessReviewDue }>>('lastCell');

  protected readonly columns = computed<readonly ColumnDef<AccessReviewDue>[]>(() => [
    { key: 'displayName', header: 'Persona', priority: 1, cell: this.nameCell() },
    { key: 'activeAssignments', header: 'Roles activos', priority: 2, cell: this.countCell() },
    { key: 'lastReviewedAt', header: 'Última revisión', priority: 1, cell: this.lastCell() },
  ]);
  protected readonly byId = (row: AccessReviewDue): string => row.userId;
  protected readonly rowName = (row: AccessReviewDue): string => row.displayName;

  private pending: { unsubscribe(): void } | null = null;


  constructor() {
    effect(() => {
      this.days();
      untracked(() => this.reload());
    });
  }

  protected reload(): void {
    const days = this.days();
    if (days === 'invalid') return;
    this.pending?.unsubscribe();
    this.due.set(loading());
    this.pending = this.governance.accessReviewsDue(days ?? undefined).subscribe({
      next: ({ items }) =>
        this.due.set(
          items.length === 0
            ? empty(
                { label: 'Ver usuarios y roles', route: portalUrl('governance/users') },
                days === null
                  ? 'Nadie tiene accesos activos que revisar.'
                  : `Todas las personas con accesos se revisaron en los últimos ${days} días.`,
              )
            : ready(items),
        ),
      error: (e: unknown) => this.due.set(errorToViewState<readonly AccessReviewDue[]>(e)),
    });
  }

  protected open(row: AccessReviewDue): void {
    void patchQuery(this.router, this.route, { review: row.userId });
  }

  protected close(): void {
    void patchQuery(this.router, this.route, { review: null });
  }

  protected changed(message: string): void {
    this.notice.set(message);
    this.reload();
  }
}

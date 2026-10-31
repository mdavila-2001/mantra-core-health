import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, viewChild, type TemplateRef } from '@angular/core';
import { map } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthzGovernanceClient } from '../../../../../core/data-access/authz-governance/authz-governance.client';
import type { AccessReviewDue } from '../../../../../core/data-access/authz-governance/authz-governance.types';
import { empty } from '../../../../../core/view-state/view-state';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { dateOnly } from '../../governance/governance-labels';
import { pagedList } from '../../support/paged-list';
import { accountStatusLabel } from '../permissions-labels';
import { portalUrl } from '../../portal-nav';
import { patchQuery, queryFilters, queryParamsSignal } from '../../support/route-query';
import { ReviewDrawer } from './review-drawer';

const URL_KEYS = ['review'] as const;

/**
 * La cola de revisión periódica: las cuentas con acceso administrativo y cuándo
 * se revisaron por última vez. El plazo lo elige quien gobierna («sin revisar
 * hace más de N días»); sin plazo, la API usa 90 días y lo dice en la respuesta
 * (`olderThanDays`), que es lo que la pantalla muestra. Los nunca revisados
 * entran siempre. Paginada por cursor.
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
        Revisar es dejar asentado que alguien miró los accesos de una cuenta: quién, a quién y cuándo. Registrar la
        revisión no cambia ningún permiso; quitar un rol se hace en «Usuarios y roles». Nadie revisa sus propios accesos.
      </p>
      <app-form-field
        label="Sin revisar hace más de (días)"
        [hint]="'Déjelo vacío para usar el plazo por omisión de la API (90 días).'"
        [errorMessage]="daysProblem()"
      >
        <app-input type="number" ariaLabel="Días sin revisar" data-testid="portal-reviews-days" [(value)]="daysText" />
      </app-form-field>
      <app-data-table
        data-testid="portal-reviews-table"
        caption="Personas con accesos por revisar"
        [state]="due.state()"
        [columns]="columns()"
        [trackBy]="byId"
        [rowLabel]="rowName"
        [cursor]="due.cursor()"
        rowNavigable
        stackedOnMobile
        fitContainer
        (rowActivated)="open($event)"
        (cursorChanged)="due.move($event)"
        (retry)="due.reload()"
      />
    </div>
    <ng-template #nameCell let-row>
      <span class="panel__name">{{ row.displayName }}</span>
    </ng-template>
    <ng-template #statusCell let-row>
      <app-badge size="sm" [variant]="status(row.accountStatus).tone">{{ status(row.accountStatus).label }}</app-badge>
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
  protected readonly notice = signal<string | null>(null);
  protected readonly day = dateOnly;
  protected readonly status = accountStatusLabel;

  /** Los días que valen: entero entre 1 y 3650 (lo que acepta la API) o ninguno. */
  private readonly days = computed<number | null | 'invalid'>(() => {
    const text = String(this.daysText() ?? '').trim();
    if (text === '') return null;
    const n = Number(text);
    return Number.isInteger(n) && n >= 1 && n <= 3650 ? n : 'invalid';
  });
  protected readonly daysProblem = computed(() => (this.days() === 'invalid' ? 'Escriba un número entero de 1 a 3650.' : ''));

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: AccessReviewDue }>>('nameCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: AccessReviewDue }>>('statusCell');
  private readonly lastCell = viewChild.required<TemplateRef<{ $implicit: AccessReviewDue }>>('lastCell');

  protected readonly columns = computed<readonly ColumnDef<AccessReviewDue>[]>(() => [
    { key: 'displayName', header: 'Persona', priority: 1, cell: this.nameCell() },
    { key: 'accountStatus', header: 'Estado de la cuenta', priority: 2, cell: this.statusCell() },
    { key: 'lastReviewedAt', header: 'Última revisión', priority: 1, cell: this.lastCell() },
  ]);
  protected readonly byId = (row: AccessReviewDue): string => row.userId;
  protected readonly rowName = (row: AccessReviewDue): string => row.displayName;

  protected readonly due = pagedList<AccessReviewDue>(
    (cursor) =>
      this.governance
        .accessReviewsDue({
          ...(this.days() !== 'invalid' && this.days() !== null ? { olderThanDays: this.days() as number } : {}),
          ...(cursor ? { cursor } : {}),
        })
        .pipe(map((page) => ({ items: page.items, nextCursor: page.nextCursor }))),
    () =>
      empty(
        { label: 'Ver usuarios y roles', route: portalUrl('governance/users') },
        this.days() === null || this.days() === 'invalid'
          ? 'Todas las cuentas con acceso administrativo se revisaron en los últimos 90 días.'
          : `Todas las cuentas con acceso administrativo se revisaron en los últimos ${this.days()} días.`,
      ),
  );

  constructor() {
    effect(() => {
      const days = this.days();
      untracked(() => {
        if (days !== 'invalid') this.due.restart();
      });
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
    this.due.reload();
  }
}

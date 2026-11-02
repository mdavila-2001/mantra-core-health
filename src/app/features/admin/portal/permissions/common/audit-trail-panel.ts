import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  computed,
  type TemplateRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuditClient } from '../../../../../core/data-access/audit/audit.client';
import type { AuditLogEntry } from '../../../../../core/data-access/audit/audit.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../../shared/components/atoms/link/link';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { auditResult } from '../../governance/governance-labels';
import { fechaHora } from '../../../../../shared/components/organisms/data-table/sin-cortes';
import { portalUrl } from '../../portal-nav';

const LIMIT = 10;

/** Códigos de acción de la bitácora → texto. Uno que no está acá se muestra tal cual. */
const ACTION_LABELS: Readonly<Record<string, string>> = {
  ROLE_PERMISSIONS_SET: 'Permisos de un rol reemplazados',
  ROLE_FIELD_PERMISSIONS_SET: 'Permisos por campo de un rol cambiados',
  RESOURCE_SCOPE_GRANTED: 'Permiso por alcance concedido',
  RESOURCE_SCOPE_GRANT_ENDED: 'Permiso por alcance terminado',
  ACCESS_DECISION_SIMULATED: 'Decisión simulada en el PDP',
  USER_SUSPENDED: 'Cuenta suspendida',
  USER_REACTIVATED: 'Cuenta reactivada',
  USER_DEACTIVATED: 'Cuenta dada de baja',
  ACCESS_REVIEWED: 'Revisión de accesos registrada',
  ROLE_ASSIGNED: 'Rol asignado',
  ROLE_ASSIGNMENT_REVOKED: 'Rol revocado',
};

/**
 * Lo último que quedó en la bitácora para unas acciones dadas: es la prueba de
 * que un cambio de esta pantalla dejó rastro. Lee `/audit/log` (la ventana por
 * omisión de la API son los últimos 30 días); para más, se sigue a Auditoría.
 */
@Component({
  selector: 'app-portal-audit-trail-panel',
  imports: [RouterLink, Badge, Link, DataTable],
  template: `
    <div class="panel" data-testid="portal-audit-trail">
      <p class="panel__note">
        Lo último que quedó registrado de estas acciones, con quién la hizo y cuándo. Mira los últimos 30 días;
        <a app-link [routerLink]="auditUrl" [queryParams]="firstAction()">abrir la bitácora completa</a>.
      </p>
      <app-data-table
        data-testid="portal-audit-trail-table"
        caption="Cambios registrados"
        [state]="entries()"
        [columns]="columns()"
        [trackBy]="byId"
        [rowLabel]="rowName"
        stackedOnMobile
        fitContainer
        (retry)="load()"
      />
    </div>
    <ng-template #actionCell let-row>
      <div class="panel__cell">
        <span class="panel__name">{{ actionText(row.action) }}</span>
        <code class="panel__code">{{ row.action }}</code>
      </div>
    </ng-template>
    <ng-template #resultCell let-row>
      <app-badge size="sm" [variant]="result(row.result).tone">{{ result(row.result).label }}</app-badge>
    </ng-template>
    <ng-template #whenCell let-row>
      <span class="panel__secondary panel__date">{{ when(row.recordedAt) }}</span>
    </ng-template>
    <ng-template #actorCell let-row>
      <code class="panel__code" [title]="row.userId">{{ row.userId.slice(0, 8) }}…</code>
    </ng-template>
  `,
  styleUrl: '../permissions-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditTrailPanel {
  private readonly audit = inject(AuditClient);

  /** Los códigos de acción de la bitácora que interesan. */
  readonly actions = input.required<readonly string[]>();

  protected readonly auditUrl = portalUrl('governance/audit');
  protected readonly firstAction = computed(() => ({ action: this.actions()[0] ?? '' }));
  protected readonly entries = signal<ViewState<readonly AuditLogEntry[]>>(loading());
  protected readonly result = auditResult;
  protected readonly when = fechaHora;
  protected readonly actionText = (code: string): string => ACTION_LABELS[code] ?? code;
  protected readonly byId = (row: AuditLogEntry): string => row.id;
  protected readonly rowName = (row: AuditLogEntry): string => this.actionText(row.action);

  private readonly actionCell = viewChild.required<TemplateRef<{ $implicit: AuditLogEntry }>>('actionCell');
  private readonly resultCell = viewChild.required<TemplateRef<{ $implicit: AuditLogEntry }>>('resultCell');
  private readonly whenCell = viewChild.required<TemplateRef<{ $implicit: AuditLogEntry }>>('whenCell');
  private readonly actorCell = viewChild.required<TemplateRef<{ $implicit: AuditLogEntry }>>('actorCell');

  protected readonly columns = computed<readonly ColumnDef<AuditLogEntry>[]>(() => [
    { key: 'action', header: 'Acción', priority: 1, cell: this.actionCell() },
    { key: 'result', header: 'Resultado', priority: 1, cell: this.resultCell() },
    { key: 'userId', header: 'Quién', priority: 2, cell: this.actorCell() },
    { key: 'recordedAt', header: 'Cuándo', priority: 1, cell: this.whenCell() },
  ]);

  private subscription: { unsubscribe(): void } | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe());
    effect(() => {
      this.actions();
      untracked(() => this.load());
    });
  }

  protected load(): void {
    this.subscription?.unsubscribe();
    this.entries.set(loading());
    this.subscription = forkJoin(this.actions().map((action) => this.audit.log({ action, limit: LIMIT }))).subscribe({
      next: (pages) => {
        const rows = pages
          .flatMap((p) => p.items)
          .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())
          .slice(0, LIMIT);
        this.entries.set(
          rows.length === 0
            ? empty(
                { label: 'Abrir la bitácora completa', route: this.auditUrl },
                'Todavía no hay cambios registrados de estas acciones en los últimos 30 días.',
              )
            : ready(rows),
        );
      },
      error: (e: unknown) => this.entries.set(errorToViewState<readonly AuditLogEntry[]>(e)),
    });
  }
}

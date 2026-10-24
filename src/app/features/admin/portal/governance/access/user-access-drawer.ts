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
import type { Subscription } from 'rxjs';

import { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import type { RoleAssignment } from '../../../../../core/data-access/authz-admin/authz-admin.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { DrawerPanel } from '../../../../../shared/components/organisms/drawer-panel/drawer-panel';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import { assignmentStatus, dateOnly, roleScope } from '../governance-labels';
import {
  assignmentFailure,
  byRelevance,
  failureNeedsReload,
  globalRoleTiedToTenant,
  scopeSummary,
} from './access.model';
import { AssignRoleDialog } from './assign-role-dialog';

/**
 * El cajón de una persona: todas sus asignaciones de rol, activas o no, con
 * su alcance y vigencia. Desde acá se asigna un rol nuevo y se revoca uno
 * activo, siempre con confirmación. La revocación es lógica: la fila queda.
 */
@Component({
  selector: 'app-portal-user-access-drawer',
  imports: [Badge, AppButton, Alert, DrawerPanel, ViewStateHost, AssignRoleDialog],
  templateUrl: './user-access-drawer.html',
  styleUrl: './user-access-drawer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserAccessDrawer {
  private readonly authz = inject(AuthzAdminClient);
  private readonly dialogs = inject(DialogService);

  /** La persona abierta; `''` es «cerrado». */
  readonly userId = input.required<string>();
  /** `''` mientras no se sabe: se muestra «esta persona». */
  readonly userName = input.required<string>();
  readonly closed = output<void>();
  /** Algo cambió (asignó o revocó); lleva el aviso para la lista. */
  readonly changed = output<string>();

  protected readonly assignments = signal<ViewState<readonly RoleAssignment[]>>(loading());
  protected readonly assigning = signal(false);
  protected readonly revoking = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly status = assignmentStatus;
  protected readonly scope = roleScope;
  protected readonly where = scopeSummary;
  protected readonly tiedToTenant = globalRoleTiedToTenant;
  protected readonly day = dateOnly;
  protected readonly name = computed(() => this.userName() || 'esta persona');
  protected readonly activeCount = computed(() => {
    const s = this.assignments();
    return s.status === 'ready' ? s.data.filter((a) => a.status === 'ACTIVE').length : 0;
  });

  private reading: Subscription | null = null;
  private mutation: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.reading?.unsubscribe();
      this.mutation?.unsubscribe();
    });
    effect(() => {
      const id = this.userId();
      untracked(() => {
        this.error.set(null);
        this.notice.set(null);
        this.assigning.set(false);
        this.load(id);
      });
    });
  }

  protected reload(): void {
    this.load(this.userId());
  }

  protected assigned(message: string): void {
    this.assigning.set(false);
    this.notice.set(message);
    this.changed.emit(message);
    this.reload();
  }

  protected async revoke(assignment: RoleAssignment): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: 'Revocar el rol',
      message: `${this.capitalized()} dejará de tener el rol «${assignment.roleName}» (${this.where(assignment).toLowerCase()}) desde la próxima vez que su sesión se renueve. La asignación queda en el historial.`,
      confirmLabel: 'Revocar',
      cancelLabel: 'Volver',
      destructive: true,
    });
    if (!ok) return;
    this.revoking.set(assignment.id);
    this.error.set(null);
    this.notice.set(null);
    this.mutation = this.authz.revoke(this.userId(), assignment.id).subscribe({
      next: () => {
        this.revoking.set(null);
        const message = `Se revocó el rol «${assignment.roleName}» de ${this.name()}.`;
        this.notice.set(message);
        this.changed.emit(message);
        this.reload();
      },
      error: (e: unknown) => {
        this.revoking.set(null);
        this.error.set(assignmentFailure(e, 'No se pudo revocar el rol. Intente de nuevo.'));
        if (failureNeedsReload(e)) this.reload();
      },
    });
  }

  private capitalized(): string {
    const n = this.name();
    return n.charAt(0).toUpperCase() + n.slice(1);
  }

  private load(id: string): void {
    this.reading?.unsubscribe();
    if (id === '') return;
    this.assignments.set(loading());
    this.reading = this.authz.assignmentsOf(id).subscribe({
      next: (body) => this.assignments.set(ready([...body.items].sort(byRelevance))),
      error: (e: unknown) => this.assignments.set(errorToViewState<readonly RoleAssignment[]>(e)),
    });
  }
}

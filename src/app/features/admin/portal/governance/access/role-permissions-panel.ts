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
  viewChild,
  type TemplateRef,
} from '@angular/core';
import type { Subscription } from 'rxjs';

import { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import type {
  AssignableRole,
  RolePermission,
} from '../../../../../core/data-access/authz-admin/authz-admin.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { portalUrl } from '../../portal-nav';
import { permissionEffect, roleScope } from '../governance-labels';

const SCREEN = portalUrl('governance/users');

/**
 * Los permisos activos de un rol, con su efecto y su ámbito. El rol elegido
 * lo guarda la pantalla en la URL; este panel sólo lo lee y avisa el cambio.
 */
@Component({
  selector: 'app-portal-role-permissions-panel',
  imports: [Badge, Select, FormField, DataTable],
  template: `
    <div class="role-permissions">
      <app-form-field
        label="Rol"
        [hint]="rolesUnavailable() ? 'No llegó la lista de roles asignables.' : 'Los roles que se pueden asignar a una persona.'"
      >
        <app-select
          ariaLabel="Rol"
          placeholder="Elegir un rol"
          data-testid="portal-role-select"
          [options]="roleOptions()"
          [value]="roleId() || null"
          (valueChange)="roleChanged.emit($event ?? '')"
        />
      </app-form-field>
      <app-data-table
        data-testid="portal-role-permissions-table"
        caption="Permisos del rol elegido"
        [state]="permissions()"
        [columns]="columns()"
        [trackBy]="byId"
        [rowLabel]="rowName"
        stackedOnMobile
        fitContainer
        (retry)="reload()"
      />
    </div>

    <ng-template #permissionCell let-row>
      <div class="role-permissions__cell">
        <span class="role-permissions__name">{{ row.name }}</span>
        <code class="role-permissions__code">{{ row.code }}</code>
      </div>
    </ng-template>
    <ng-template #effectCell let-row>
      <app-badge size="sm" [variant]="effect(row.effect).tone">{{ effect(row.effect).label }}</app-badge>
    </ng-template>
    <ng-template #scopeCell let-row>
      <app-badge size="sm" [variant]="scope(row.scope).tone">{{ scope(row.scope).label }}</app-badge>
    </ng-template>
  `,
  styles: `
    .role-permissions {
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);
    }
    .role-permissions__cell {
      min-inline-size: 0;
    }
    .role-permissions__name {
      display: block;
    }
    .role-permissions__code {
      display: block;
      font-family: var(--font-mono);
      font-size: var(--fs-caption);
      color: var(--text-secondary);
      overflow-wrap: break-word;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolePermissionsPanel {
  private readonly authz = inject(AuthzAdminClient);

  /** El rol elegido; `''` es ninguno. */
  readonly roleId = input.required<string>();
  readonly roleChanged = output<string>();

  private readonly roles = signal<readonly AssignableRole[]>([]);
  protected readonly rolesUnavailable = signal(false);
  protected readonly permissions = signal<ViewState<readonly RolePermission[]>>(loading());
  protected readonly effect = permissionEffect;
  protected readonly scope = roleScope;

  protected readonly roleOptions = computed<readonly SelectOption<string>[]>(() =>
    this.roles().map((r) => ({ value: r.id, label: `${r.name} · ${r.code}` })),
  );

  private readonly permissionCell = viewChild.required<TemplateRef<{ $implicit: RolePermission }>>('permissionCell');
  private readonly effectCell = viewChild.required<TemplateRef<{ $implicit: RolePermission }>>('effectCell');
  private readonly scopeCell = viewChild.required<TemplateRef<{ $implicit: RolePermission }>>('scopeCell');

  protected readonly columns = computed<readonly ColumnDef<RolePermission>[]>(() => [
    { key: 'code', header: 'Permiso', priority: 1, cell: this.permissionCell() },
    { key: 'resource', header: 'Recurso', priority: 2 },
    { key: 'effect', header: 'Efecto', priority: 1, cell: this.effectCell() },
    { key: 'scope', header: 'Ámbito', priority: 2, cell: this.scopeCell() },
  ]);
  protected readonly byId = (row: RolePermission): string => row.permissionId;
  protected readonly rowName = (row: RolePermission): string => row.name;

  private readonly subscriptions: Subscription[] = [];
  private reading: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.subscriptions.forEach((s) => s.unsubscribe());
      this.reading?.unsubscribe();
    });
    this.subscriptions.push(
      this.authz.assignableRoles().subscribe({
        next: (roles) => this.roles.set([...roles].sort((a, b) => a.name.localeCompare(b.name, 'es'))),
        error: () => this.rolesUnavailable.set(true),
      }),
    );
    effect(() => {
      const id = this.roleId();
      untracked(() => this.load(id));
    });
  }

  protected reload(): void {
    this.load(this.roleId());
  }

  private load(id: string): void {
    this.reading?.unsubscribe();
    if (id === '') {
      this.permissions.set(
        empty({ label: 'Ver el catálogo de permisos', route: SCREEN, queryParams: { view: 'permissions' } }, 'Elija un rol para ver qué permite y qué niega.'),
      );
      return;
    }
    this.permissions.set(loading());
    this.reading = this.authz.rolePermissions(id).subscribe({
      next: (body) =>
        this.permissions.set(
          body.items.length === 0
            ? empty(
                { label: 'Ver el catálogo de permisos', route: SCREEN, queryParams: { view: 'permissions' } },
                `El rol ${body.roleCode} no tiene permisos activos: autoriza sólo donde una ruta lo exige por nombre.`,
              )
            : ready(body.items),
        ),
      error: (e: unknown) => this.permissions.set(errorToViewState<readonly RolePermission[]>(e)),
    });
  }
}

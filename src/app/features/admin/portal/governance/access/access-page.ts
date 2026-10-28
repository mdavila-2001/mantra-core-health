import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import type {
  AssignableRole,
  InternalUser,
} from '../../../../../core/data-access/authz-admin/authz-admin.types';
import { NavigationService } from '../../../../../core/navigation/navigation.service';
import { empty } from '../../../../../core/view-state/view-state';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../../shared/components/atoms/link/link';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import {
  FilterBar,
  type FilterDef,
} from '../../../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { portalUrl } from '../../portal-nav';
import { pagedList } from '../../support/paged-list';
import { dateTime } from '../governance-labels';
import { patchQuery, queryParamsSignal, queryFilters } from '../../support/route-query';
import { roleCodesOf } from './access.model';
import { PermissionCatalog } from './permission-catalog';
import { RolePermissionsPanel } from './role-permissions-panel';
import { UserAccessDrawer } from './user-access-drawer';

const PAGE_SIZE = 50;
const SCREEN = portalUrl('governance/users');
const VIEWS = ['users', 'role-permissions', 'permissions'] as const;
const URL_KEYS = ['view', 'q', 'roleCode', 'user', 'role'] as const;

/**
 * Usuarios y roles: quiénes operan la consola, con qué roles y dónde valen;
 * qué permite cada rol; y el catálogo de permisos. Asignar y revocar se hace
 * desde el cajón de cada persona (`?user=`), siempre con confirmación. Lo
 * decide todo la API: esta pantalla no oculta un rol ni impide un alcance.
 */
@Component({
  selector: 'app-portal-access-page',
  imports: [
    RouterLink,
    Badge,
    Link,
    Alert,
    Card,
    Tab,
    Tabs,
    DataTable,
    FilterBar,
    PageHeader,
    PermissionCatalog,
    RolePermissionsPanel,
    UserAccessDrawer,
  ],
  templateUrl: './access-page.html',
  styleUrl: './access-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessPage {
  private readonly authz = inject(AuthzAdminClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly values = queryFilters(queryParamsSignal(this.route), URL_KEYS);
  private readonly filters = computed(
    () => ({ q: this.values().q.trim(), roleCode: this.values().roleCode }),
    { equal: (a, b) => a.q === b.q && a.roleCode === b.roleCode },
  );
  protected readonly tabIndex = computed(() =>
    Math.max(0, VIEWS.indexOf(this.values().view as (typeof VIEWS)[number])),
  );
  protected readonly selectedUser = computed(() => this.values().user);
  protected readonly when = dateTime;
  protected readonly roleCodes = roleCodesOf;
  protected readonly notice = signal<string | null>(null);

  /** Nombre de quien está abierto en el cajón, de la página vigente. */
  private readonly names = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly selectedName = computed(() => this.names().get(this.selectedUser()) ?? '');

  private readonly roles = signal<readonly AssignableRole[]>([]);
  private readonly rolesUnavailable = signal(false);
  protected readonly filterDefs = computed<readonly FilterDef[]>(() => [
    {
      key: 'roleCode',
      label: 'Rol',
      placeholder: 'Con cualquier rol interno',
      options: this.roles().map((r) => ({ value: r.code, label: `${r.name} · ${r.code}` })),
      unavailableReason: this.rolesUnavailable() ? 'No llegó la lista de roles asignables.' : 'Cargando los roles…',
    },
  ]);

  protected readonly users = pagedList<InternalUser>(
    (cursor) => {
      const { q, roleCode } = this.filters();
      return this.authz.internalUsers({
        limit: PAGE_SIZE,
        ...(q ? { q } : {}),
        ...(roleCode ? { roleCode } : {}),
        ...(cursor ? { cursor } : {}),
      });
    },
    () =>
      this.filters().q !== '' || this.filters().roleCode !== ''
        ? empty({ label: 'Ver todos los usuarios internos', route: SCREEN }, 'Nadie coincide con la búsqueda o el rol elegidos.')
        : empty(
            { label: 'Ver la deriva de permisos', route: portalUrl('governance/permission-drift') },
            'Todavía nadie tiene un rol de plataforma ni un rol de ámbito global.',
          ),
  );

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: InternalUser }>>('nameCell');
  private readonly rolesCell = viewChild.required<TemplateRef<{ $implicit: InternalUser }>>('rolesCell');
  private readonly loginCell = viewChild.required<TemplateRef<{ $implicit: InternalUser }>>('loginCell');

  protected readonly columns = computed<readonly ColumnDef<InternalUser>[]>(() => [
    { key: 'displayName', header: 'Persona', priority: 1, cell: this.nameCell() },
    { key: 'roles', header: 'Roles', priority: 1, cell: this.rolesCell() },
    { key: 'lastLoginAt', header: 'Último ingreso', priority: 2, cell: this.loginCell() },
  ]);
  protected readonly byId = (row: InternalUser): string => row.id;
  protected readonly rowName = (row: InternalUser): string => row.displayName;

  constructor() {
    const subscription = this.authz.assignableRoles().subscribe({
      next: (roles) => this.roles.set([...roles].sort((a, b) => a.name.localeCompare(b.name, 'es'))),
      error: () => this.rolesUnavailable.set(true),
    });
    this.destroyRef.onDestroy(() => subscription.unsubscribe());

    effect(() => {
      this.filters();
      untracked(() => this.users.restart());
    });
    // Los nombres salen de la página vigente; quien se abre por su dirección y
    // no está en ella (todavía sin roles, por ejemplo) se lee de su ficha.
    effect(() => {
      const state = this.users.state();
      const id = this.selectedUser();
      if (state.status === 'loading') return;
      untracked(() => {
        if (state.status === 'ready') {
          this.names.update((m) => new Map([...m, ...state.data.map((u) => [u.id, u.displayName] as const)]));
        }
        if (id !== '' && !this.names().has(id)) this.lookUpName(id);
      });
    });
  }

  private lookUpName(id: string): void {
    // `''` marca «pedido»: el cajón dice «esta persona» hasta que llegue y no se pide dos veces.
    this.names.update((m) => new Map([...m, [id, '']]));
    const subscription = this.authz.displayNameOf(id).subscribe({
      next: (name) => this.names.update((m) => new Map([...m, [id, name]])),
      // Sin nombre, el cajón dice «esta persona»: las asignaciones igual se leen y se pueden gestionar.
      error: () => this.names.update((m) => new Map([...m, [id, '']])),
    });
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { view: index === 0 ? null : VIEWS[index]! });
  }

  protected open(row: InternalUser): void {
    void patchQuery(this.router, this.route, { user: row.id });
  }

  protected close(): void {
    void patchQuery(this.router, this.route, { user: null });
  }

  protected selectRole(roleId: string): void {
    void patchQuery(this.router, this.route, { role: roleId });
  }

  /** Algo cambió en el cajón: la lista vuelve a leerse para que sus roles no mientan. */
  protected changed(message: string): void {
    this.notice.set(message);
    this.users.reload();
  }
}

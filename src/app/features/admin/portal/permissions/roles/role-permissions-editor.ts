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
import { forkJoin, type Subscription } from 'rxjs';

import { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import type {
  AssignableRole,
  PermissionSummary,
  RolePermission,
} from '../../../../../core/data-access/authz-admin/authz-admin.types';
import { AuthzGovernanceClient } from '../../../../../core/data-access/authz-governance/authz-governance.client';
import {
  PERMISSION_SCOPES,
  type PermissionEffectInput,
  type PermissionScopeInput,
  type RolePermissionBinding,
} from '../../../../../core/data-access/authz-governance/authz-governance.types';
import { Breakpoints } from '../../../../../core/layout/breakpoints';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../../../../shared/components/molecules/search-field/search-field';
import { MetricCard } from '../../../../../shared/components/molecules/metric-card/metric-card';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { portalUrl } from '../../portal-nav';
import { byName, effectLabel, governanceFailure, optionsOf, scopeLabel } from '../permissions-labels';
import { readWholeCatalog } from '../common/permission-catalog-source';

const NONE = '';
const CATALOG_ACTION = {
  label: 'Ver el catálogo de permisos',
  route: portalUrl('governance/users'),
  queryParams: { view: 'permissions' },
} as const;
const EFFECT_OPTIONS: readonly SelectOption<string>[] = [
  { value: NONE, label: 'Sin asignar' },
  ...optionsOf(['ALLOW', 'DENY'], (c) => effectLabel(c)),
];
const SCOPE_OPTIONS: readonly SelectOption<string>[] = [
  { value: NONE, label: 'Predeterminado' },
  ...optionsOf(PERMISSION_SCOPES, (c) => scopeLabel(c)),
];

interface Cell {
  readonly effect: string;
  readonly scope: string;
}

/**
 * Editor de los permisos por acción de un rol. Trabaja sobre un borrador: nada
 * se escribe hasta «Guardar», que pide confirmación con el resumen del cambio.
 * La API reemplaza **todos** los permisos activos del rol en una sola
 * escritura, así que lo que no se toca se manda igual que estaba.
 */
@Component({
  selector: 'app-portal-role-permissions-editor',
  imports: [AppButton, Badge, Select, Alert, FormField, SearchField, DataTable, MetricCard],
  template: `
    <div class="panel" data-testid="portal-role-editor">
      @if (notice(); as message) {
        <app-alert tone="success" dismissible (dismissed)="notice.set(null)" data-testid="portal-role-editor-notice">
          {{ message }}
        </app-alert>
      }
      @if (error(); as message) {
        <app-alert tone="error" data-testid="portal-role-editor-error">{{ message }}</app-alert>
      }
      @if (truncated()) {
        <app-alert tone="warning">
          El catálogo tiene más permisos de los que esta pantalla recorre. Los que faltan no se pueden editar acá y se
          conservan como están en el rol.
        </app-alert>
      }
      <div class="panel__toolbar panel__toolbar--wide">
        <app-form-field label="Rol" [errorMessage]="rolesUnavailable() ? 'No llegó la lista de roles.' : ''">
          <app-select
            ariaLabel="Rol"
            placeholder="Elegir un rol"
            data-testid="portal-role-editor-role"
            [options]="roleOptions()"
            [value]="roleId() || null"
            [disabled]="saving()"
            (valueChange)="roleChanged.emit($event ?? '')"
          />
        </app-form-field>
        @if (roleId() !== '') {
          <app-search-field label="Buscar permisos" placeholder="Código, nombre o recurso" [(value)]="query" />
        }
      </div>

      @if (roleId() === '') {
        <section class="panel__pick" aria-labelledby="role-pick-title">
          <h2 class="panel__pick-title" id="role-pick-title">Elija un rol para ver y editar qué permite y qué niega.</h2>
          @if (roles().length > 0) {
            <ul class="panel__pick-list">
              @for (r of roles(); track r.id) {
                <li>
                  <button type="button" class="panel__pick-item" (click)="roleChanged.emit(r.id)">
                    <span class="panel__name">{{ r.name }}</span>
                    <code class="panel__code">{{ r.code }}</code>
                  </button>
                </li>
              }
            </ul>
          }
        </section>
      } @else {
        @if (catalogReady()) {
          <ul class="panel__kpis" aria-label="Resumen del rol" data-testid="portal-role-editor-kpis">
            <li><app-metric-card label="Permite" tone="success" icon="check-circle" [value]="kpis().allow" /></li>
            <li><app-metric-card label="Niega" tone="error" icon="lock" [value]="kpis().deny" /></li>
            <li>
              <app-metric-card label="Sensibles" tone="warning" icon="shield" [value]="kpis().dangerous" />
            </li>
            <li><app-metric-card label="Pendientes" tone="info" icon="edit" [value]="changes().total" /></li>
          </ul>
        }

        <app-data-table
          data-testid="portal-role-editor-table"
          caption="Permisos por acción del rol elegido"
          [state]="rows()"
          [columns]="columns()"
          [trackBy]="byId"
          [rowLabel]="rowName"
          [maxHeight]="narrow() ? null : '60vh'"
          dense
          stackedOnMobile
          fitContainer
          (retry)="reload()"
        />
      }

      @if (roleId() !== '') {
        <div class="panel__actions">
          <span class="panel__secondary" aria-live="polite" data-testid="portal-role-editor-summary">{{ summary() }}</span>
          <button app-button variant="ghost" [disabled]="saving() || changes().total === 0" (clicked)="discard()">
            Descartar cambios
          </button>
          <button
            app-button
            variant="primary"
            data-testid="portal-role-editor-save"
            [isLoading]="saving()"
            [disabled]="changes().total === 0 || bindingCount() === 0"
            (clicked)="save()"
          >
            Guardar cambios
          </button>
        </div>
        @if (bindingCount() === 0 && changes().total > 0) {
          <app-alert tone="warning">
            Un rol tiene que conservar al menos un permiso: la API no acepta dejarlo vacío.
          </app-alert>
        }
      }
    </div>

    <ng-template #permissionCell let-row>
      <div class="panel__cell">
        <span class="panel__name">{{ row.name }}</span>
        <code class="panel__code">{{ row.code }}</code>
        <span class="panel__badges">
          @if (row.isDangerous) {
            <app-badge size="sm" variant="warning">Sensible</app-badge>
          }
          @if (isChanged(row.id)) {
            <app-badge size="sm" variant="info">Cambiado</app-badge>
          }
        </span>
      </div>
    </ng-template>
    <ng-template #effectCell let-row>
      <app-select
        ariaLabel="Efecto"
        [options]="effectOptions"
        [value]="cellOf(row.id).effect"
        [disabled]="saving()"
        (valueChange)="setEffect(row.id, $event ?? '')"
      />
    </ng-template>
    <ng-template #scopeCell let-row>
      <app-select
        ariaLabel="Ámbito"
        [options]="scopeOptions"
        [value]="cellOf(row.id).scope"
        [disabled]="saving() || cellOf(row.id).effect === ''"
        (valueChange)="setScope(row.id, $event ?? '')"
      />
    </ng-template>
  `,
  styleUrl: '../permissions-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolePermissionsEditor {
  private readonly authz = inject(AuthzAdminClient);
  private readonly governance = inject(AuthzGovernanceClient);
  private readonly dialogs = inject(DialogService);
  /** En teléfono la tabla apilada no va en una caja con alto propio: se lee con el desplazamiento de la página. */
  protected readonly narrow = inject(Breakpoints).isNavDrawer;

  /** El rol elegido (vive en la URL); `''` es ninguno. */
  readonly roleId = input.required<string>();
  readonly roleChanged = output<string>();

  protected readonly effectOptions = EFFECT_OPTIONS;
  protected readonly scopeOptions = SCOPE_OPTIONS;
  protected readonly query = signal('');
  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly truncated = signal(false);
  protected readonly rolesUnavailable = signal(false);

  protected readonly roles = signal<readonly AssignableRole[]>([]);
  private readonly catalog = signal<ViewState<readonly PermissionSummary[]>>(loading());
  /** Lo que el servidor tiene hoy, por permiso. */
  private readonly serverState = signal<ReadonlyMap<string, Cell>>(new Map());
  /** Lo que la persona va dejando. */
  private readonly draft = signal<ReadonlyMap<string, Cell>>(new Map());

  protected readonly roleOptions = computed<readonly SelectOption<string>[]>(() =>
    this.roles().map((r) => ({ value: r.id, label: `${r.name} · ${r.code}` })),
  );

  protected readonly rows = computed<ViewState<readonly PermissionSummary[]>>(() => {
    const state = this.catalog();
    if (this.roleId() === '') {
      return empty(CATALOG_ACTION, 'Elija un rol para ver y editar qué permite y qué niega.');
    }
    if (state.status !== 'ready') return state;
    const text = this.query().trim().toLowerCase();
    const filtered = state.data.filter(
      (p) => text === '' || `${p.code} ${p.name} ${p.resource}`.toLowerCase().includes(text),
    );
    return filtered.length === 0
      ? empty(CATALOG_ACTION, 'Ningún permiso coincide con la búsqueda.')
      : ready(filtered);
  });

  protected readonly changes = computed(() => {
    let added = 0;
    let changed = 0;
    let removed = 0;
    const before = this.serverState();
    const after = this.draft();
    for (const [id, cell] of after) {
      const was = before.get(id);
      if (cell.effect === '' && (was?.effect ?? '') !== '') removed += 1;
      else if (cell.effect !== '' && (was?.effect ?? '') === '') added += 1;
      else if (cell.effect !== '' && (was?.effect !== cell.effect || was?.scope !== cell.scope)) changed += 1;
    }
    return { added, changed, removed, total: added + changed + removed };
  });
  protected readonly catalogReady = computed(() => this.catalog().status === 'ready');
  /** Lo que el borrador deja: es lo que se guardaría, no lo que el servidor tiene. */
  protected readonly kpis = computed(() => {
    const state = this.catalog();
    const dangerousIds = new Set(state.status === 'ready' ? state.data.filter((p) => p.isDangerous).map((p) => p.id) : []);
    let allow = 0;
    let deny = 0;
    let dangerous = 0;
    for (const [id, cell] of this.draft()) {
      if (cell.effect === 'ALLOW') {
        allow += 1;
        if (dangerousIds.has(id)) dangerous += 1;
      } else if (cell.effect === 'DENY') deny += 1;
    }
    return { allow, deny, dangerous };
  });
  protected readonly bindingCount = computed(() => [...this.draft().values()].filter((c) => c.effect !== '').length);
  protected readonly summary = computed(() => {
    const c = this.changes();
    return c.total === 0
      ? 'Sin cambios pendientes.'
      : `Pendiente: ${c.added} por agregar, ${c.changed} por cambiar, ${c.removed} por quitar.`;
  });

  private readonly permissionCell = viewChild.required<TemplateRef<{ $implicit: PermissionSummary }>>('permissionCell');
  private readonly effectCell = viewChild.required<TemplateRef<{ $implicit: PermissionSummary }>>('effectCell');
  private readonly scopeCell = viewChild.required<TemplateRef<{ $implicit: PermissionSummary }>>('scopeCell');

  protected readonly columns = computed<readonly ColumnDef<PermissionSummary>[]>(() => [
    { key: 'code', header: 'Permiso', priority: 1, cell: this.permissionCell() },
    { key: 'resource', header: 'Recurso', priority: 2 },
    { key: 'effect', header: 'Efecto', priority: 1, cell: this.effectCell() },
    { key: 'scope', header: 'Ámbito', priority: 2, cell: this.scopeCell() },
  ]);
  protected readonly byId = (row: PermissionSummary): string => row.id;
  protected readonly rowName = (row: PermissionSummary): string => row.name;

  private readonly subscriptions: Subscription[] = [];
  private reading: Subscription | null = null;
  private readonly empty: Cell = { effect: NONE, scope: NONE };

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.subscriptions.forEach((s) => s.unsubscribe());
      this.reading?.unsubscribe();
    });
    this.subscriptions.push(
      this.authz.assignableRoles().subscribe({
        next: (roles) => this.roles.set([...roles].sort(byName)),
        error: () => this.rolesUnavailable.set(true),
      }),
    );
    effect(() => {
      const id = this.roleId();
      untracked(() => {
        this.notice.set(null);
        this.error.set(null);
        this.query.set('');
        this.load(id);
      });
    });
  }

  protected reload(): void {
    this.load(this.roleId());
  }

  protected cellOf(permissionId: string): Cell {
    return this.draft().get(permissionId) ?? this.empty;
  }

  protected isChanged(permissionId: string): boolean {
    const a = this.draft().get(permissionId) ?? this.empty;
    const b = this.serverState().get(permissionId) ?? this.empty;
    return a.effect !== b.effect || a.scope !== b.scope;
  }

  protected setEffect(permissionId: string, effect: string): void {
    this.draft.update((m) => {
      const next = new Map(m);
      next.set(permissionId, { effect, scope: effect === NONE ? NONE : (m.get(permissionId)?.scope ?? NONE) });
      return next;
    });
  }

  protected setScope(permissionId: string, scope: string): void {
    this.draft.update((m) => new Map(m).set(permissionId, { effect: m.get(permissionId)?.effect ?? NONE, scope }));
  }

  protected discard(): void {
    this.draft.set(new Map(this.serverState()));
    this.error.set(null);
  }

  protected async save(): Promise<void> {
    const c = this.changes();
    const role = this.roles().find((r) => r.id === this.roleId());
    const ok = await this.dialogs.confirmarCambios({
      title: `Guardar los permisos de ${role?.name ?? 'este rol'}`,
      message:
        'Se reemplazan los permisos del rol. Quienes lo tienen lo notan en la próxima renovación de su sesión. El cambio queda en la bitácora con su autor.',
      details: [
        { label: 'Por agregar', value: String(c.added) },
        { label: 'Por cambiar', value: String(c.changed) },
        { label: 'Por quitar', value: String(c.removed) },
      ],
      confirmLabel: 'Guardar',
    });
    if (!ok) return;
    const permissions: RolePermissionBinding[] = [];
    for (const [permissionId, cell] of this.draft()) {
      if (cell.effect === NONE) continue;
      permissions.push({
        permissionId,
        effect: cell.effect as PermissionEffectInput,
        ...(cell.scope !== NONE ? { scope: cell.scope as PermissionScopeInput } : {}),
      });
    }
    this.saving.set(true);
    this.error.set(null);
    this.subscriptions.push(
      this.governance.setRolePermissions(this.roleId(), { permissions }).subscribe({
        next: (result) => {
          this.saving.set(false);
          this.notice.set(`Se guardaron los permisos de ${role?.name ?? 'el rol'}: ahora tiene ${result.permissionCount}.`);
          // Se vuelve a leer del servidor: lo que se ve es lo que quedó, no lo que se mandó.
          this.load(this.roleId());
        },
        // El borrador se conserva: perder lo que se editó por un fallo está prohibido.
        error: (e: unknown) => {
          this.saving.set(false);
          this.error.set(governanceFailure(e, 'No se pudieron guardar los permisos. Lo que editó sigue acá.'));
        },
      }),
    );
  }

  private load(id: string): void {
    this.reading?.unsubscribe();
    this.draft.set(new Map());
    this.serverState.set(new Map());
    if (id === '') return;
    this.catalog.set(loading());
    this.reading = forkJoin({
      catalog: readWholeCatalog(this.authz),
      role: this.authz.rolePermissions(id),
    }).subscribe({
      next: ({ catalog, role }) => {
        this.truncated.set(catalog.truncated);
        const map = new Map<string, Cell>();
        for (const p of role.items as readonly RolePermission[]) {
          map.set(p.permissionId, {
            effect: p.effect === 'ALLOW' || p.effect === 'DENY' ? p.effect : NONE,
            scope: p.scope !== null && (PERMISSION_SCOPES as readonly string[]).includes(p.scope) ? p.scope : NONE,
          });
        }
        this.serverState.set(map);
        this.draft.set(new Map(map));
        this.catalog.set(
          catalog.items.length === 0
            ? empty(CATALOG_ACTION, 'El catálogo de permisos está vacío: no hay nada que asignar.')
            : ready(catalog.items),
        );
      },
      error: (e: unknown) => this.catalog.set(errorToViewState<readonly PermissionSummary[]>(e)),
    });
  }
}

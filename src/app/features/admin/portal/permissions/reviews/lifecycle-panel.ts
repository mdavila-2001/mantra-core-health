import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, viewChild, type TemplateRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import type { InternalUser } from '../../../../../core/data-access/authz-admin/authz-admin.types';
import { empty } from '../../../../../core/view-state/view-state';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { SearchField } from '../../../../../shared/components/molecules/search-field/search-field';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { roleCodesOf } from '../../governance/access/access.model';
import { dateTime } from '../../governance/governance-labels';
import { pagedList } from '../../support/paged-list';
import { patchQuery, queryFilters, queryParamsSignal } from '../../support/route-query';
import { portalUrl } from '../../portal-nav';
import { LifecycleDrawer } from './lifecycle-drawer';

const PAGE_SIZE = 50;
const URL_KEYS = ['user'] as const;

/**
 * Las cuentas internas, para suspenderlas, reactivarlas o darlas de baja. La
 * lista sale de la misma API que «Usuarios y roles»; el estado de cada cuenta
 * se lee al abrirla, no en la fila (sería una petición por fila).
 */
@Component({
  selector: 'app-portal-lifecycle-panel',
  imports: [Badge, Alert, SearchField, DataTable, LifecycleDrawer],
  template: `
    <div class="panel" data-testid="portal-lifecycle-panel">
      @if (notice(); as message) {
        <app-alert tone="success" dismissible (dismissed)="notice.set(null)">{{ message }}</app-alert>
      }
      <p class="panel__note">
        Suspender bloquea la cuenta, corta las sesiones y se puede deshacer. La baja además revoca sus credenciales y sus
        roles globales, y no se reactiva. Elija una persona para ver su estado, su historial y lo que se puede hacer.
      </p>
      <app-search-field label="Buscar personas" placeholder="Nombre visible" [value]="query()" (searched)="query.set($event)" [loading]="users.state().status === 'loading'" />
      <app-data-table
        data-testid="portal-lifecycle-table"
        caption="Cuentas internas"
        [state]="users.state()"
        [columns]="columns()"
        [trackBy]="byId"
        [rowLabel]="rowName"
        [cursor]="users.cursor()"
        rowNavigable
        stackedOnMobile
        fitContainer
        (rowActivated)="open($event)"
        (cursorChanged)="users.move($event)"
        (retry)="users.reload()"
      />
    </div>
    <ng-template #nameCell let-row>
      <span class="panel__name">{{ row.displayName }}</span>
    </ng-template>
    <ng-template #rolesCell let-row>
      @let codes = roleCodes(row);
      @if (codes.length === 0) {
        <span class="panel__secondary">Sin roles activos</span>
      } @else {
        <span class="panel__badges">
          @for (code of codes; track code) {
            <app-badge size="sm" variant="secondary">{{ code }}</app-badge>
          }
        </span>
      }
    </ng-template>
    <ng-template #loginCell let-row>
      <span class="panel__secondary">{{ row.lastLoginAt ? when(row.lastLoginAt) : 'Nunca ingresó' }}</span>
    </ng-template>
    <app-portal-lifecycle-drawer [userId]="values().user" (closed)="close()" (changed)="changed($event)" />
  `,
  styleUrl: '../permissions-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LifecyclePanel {
  private readonly authz = inject(AuthzAdminClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly values = queryFilters(queryParamsSignal(this.route), URL_KEYS);
  protected readonly query = signal('');
  protected readonly notice = signal<string | null>(null);
  protected readonly roleCodes = roleCodesOf;
  protected readonly when = dateTime;

  private readonly text = computed(() => this.query().trim());

  protected readonly users = pagedList<InternalUser>(
    (cursor) =>
      this.authz.internalUsers({
        limit: PAGE_SIZE,
        ...(this.text() ? { q: this.text() } : {}),
        ...(cursor ? { cursor } : {}),
      }),
    () =>
      this.text() !== ''
        ? empty({ label: 'Ver todos los usuarios internos', route: portalUrl('governance/access-reviews') }, 'Nadie coincide con la búsqueda.')
        : empty(
            { label: 'Ver usuarios y roles', route: portalUrl('governance/users') },
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
    effect(() => {
      this.text();
      untracked(() => this.users.restart());
    });
  }

  protected open(row: InternalUser): void {
    void patchQuery(this.router, this.route, { user: row.id });
  }

  protected close(): void {
    void patchQuery(this.router, this.route, { user: null });
  }

  protected changed(message: string): void {
    this.notice.set(message);
    this.users.reload();
  }
}

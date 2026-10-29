import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import type { PermissionSummary } from '../../../../../core/data-access/authz-admin/authz-admin.types';
import { empty } from '../../../../../core/view-state/view-state';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { FilterBar } from '../../../../../shared/components/organisms/filter-bar/filter-bar';
import { portalUrl } from '../../portal-nav';
import { pagedList } from '../../support/paged-list';
import { queryParamsSignal, queryFilters } from '../../support/route-query';

const PAGE_SIZE = 50;
/** Parámetro propio del buscador: no comparte el `q` de la lista de usuarios. */
export const PERMISSION_SEARCH_PARAM = 'permissionQ';
const SCREEN = portalUrl('governance/users');

/**
 * El catálogo de permisos, paginado por código, con su buscador en la URL.
 * Marca los peligrosos, los que van por campo y los que sólo concede un rol.
 */
@Component({
  selector: 'app-portal-permission-catalog',
  imports: [Badge, DataTable, FilterBar],
  template: `
    <div class="permission-catalog">
      <app-filter-bar
        searchLabel="Buscar permisos"
        searchPlaceholder="Código, nombre o recurso"
        [searchParam]="searchParam"
        [searchLoading]="list.state().status === 'loading'"
      />
      <app-data-table
        data-testid="portal-permissions-table"
        caption="Catálogo de permisos"
        [state]="list.state()"
        [columns]="columns()"
        [trackBy]="byId"
        [rowLabel]="rowName"
        [cursor]="list.cursor()"
        stackedOnMobile
        fitContainer
        (cursorChanged)="list.move($event)"
        (retry)="list.reload()"
      />
    </div>

    <ng-template #permissionCell let-row>
      <div class="permission-catalog__cell">
        <span class="permission-catalog__name">{{ row.name }}</span>
        <code class="permission-catalog__code">{{ row.code }}</code>
      </div>
    </ng-template>
    <ng-template #flagsCell let-row>
      <span class="permission-catalog__flags">
        @if (row.isDangerous) {
          <app-badge size="sm" variant="error">Peligroso</app-badge>
        }
        @if (row.isFieldLevel) {
          <app-badge size="sm" variant="info">Por campo</app-badge>
        }
        @if (row.isRoleRestricted) {
          <app-badge size="sm" variant="secondary">Sólo por rol</app-badge>
        }
        @if (!row.isDangerous && !row.isFieldLevel && !row.isRoleRestricted) {
          <span class="permission-catalog__none">Sin marcas</span>
        }
      </span>
    </ng-template>
  `,
  styles: `
    .permission-catalog {
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);
    }
    .permission-catalog__cell {
      min-inline-size: 0;
    }
    .permission-catalog__name {
      display: block;
    }
    .permission-catalog__code {
      display: block;
      font-family: var(--font-mono);
      font-size: var(--fs-caption);
      color: var(--text-secondary);
      overflow-wrap: break-word;
    }
    .permission-catalog__flags {
      display: inline-flex;
      flex-wrap: wrap;
      gap: var(--sp-1);
    }
    .permission-catalog__none {
      color: var(--text-secondary);
      font-size: var(--fs-caption);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionCatalog {
  private readonly authz = inject(AuthzAdminClient);
  protected readonly searchParam = PERMISSION_SEARCH_PARAM;
  private readonly search = queryFilters(queryParamsSignal(inject(ActivatedRoute)), [PERMISSION_SEARCH_PARAM]);

  protected readonly list = pagedList<PermissionSummary>(
    (cursor) => {
      const q = this.search()[PERMISSION_SEARCH_PARAM].trim();
      return this.authz.permissions({ limit: PAGE_SIZE, ...(q ? { q } : {}), ...(cursor ? { cursor } : {}) });
    },
    () =>
      this.search()[PERMISSION_SEARCH_PARAM].trim() !== ''
        ? empty(
            { label: 'Ver todos los permisos', route: SCREEN, queryParams: { view: 'permissions' } },
            'Ningún permiso coincide con la búsqueda.',
          )
        : empty(
            { label: 'Volver a los usuarios', route: SCREEN },
            'El catálogo de permisos está vacío: todavía no se sembró.',
          ),
  );

  private readonly permissionCell =
    viewChild.required<TemplateRef<{ $implicit: PermissionSummary }>>('permissionCell');
  private readonly flagsCell = viewChild.required<TemplateRef<{ $implicit: PermissionSummary }>>('flagsCell');

  protected readonly columns = computed<readonly ColumnDef<PermissionSummary>[]>(() => [
    { key: 'code', header: 'Permiso', priority: 1, cell: this.permissionCell() },
    { key: 'resource', header: 'Recurso', priority: 2 },
    { key: 'flags', header: 'Marcas', priority: 2, cell: this.flagsCell() },
  ]);
  protected readonly byId = (row: PermissionSummary): string => row.id;
  protected readonly rowName = (row: PermissionSummary): string => row.name;

  constructor() {
    effect(() => {
      this.search();
      untracked(() => this.list.restart());
    });
  }
}

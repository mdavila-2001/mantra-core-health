import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { tap } from 'rxjs';

import { AuthzAdminClient } from '../../../../../../core/data-access/authz-admin/authz-admin.client';
import {
  DIRECTORY_USER_STATUSES,
  DIRECTORY_USER_TYPES,
  type DirectoryTypeCounts,
  type DirectoryUser,
  type DirectoryUserStatus,
  type DirectoryUserType,
} from '../../../../../../core/data-access/authz-admin/authz-admin-directory.types';
import { empty } from '../../../../../../core/view-state/view-state';
import { AppButton } from '../../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../../../shared/components/atoms/link/link';
import { Alert } from '../../../../../../shared/components/molecules/alert/alert';
import { DataTable } from '../../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../../shared/components/organisms/data-table/data-table.types';
import {
  FilterBar,
  type FilterDef,
} from '../../../../../../shared/components/organisms/filter-bar/filter-bar';
import { portalUrl } from '../../../portal-nav';
import { pagedList } from '../../../support/paged-list';
import { queryFilters, queryParamsSignal } from '../../../support/route-query';
import { dateTime } from '../../governance-labels';
import {
  permissionsLine,
  statusLabel,
  typePlural,
  typeSingular,
  visibleEmail,
} from './directory.model';

const PAGE_SIZE = 50;
const SCREEN = portalUrl('governance/users');
const URL_KEYS = ['q', 'type', 'status'] as const;

/**
 * Todas las cuentas de la aplicación, agrupables por tipo, con estado, roles y
 * un resumen de permisos. Sin contraseñas ni documentos y con el correo
 * enmascarado por la API. Lista lo que la API informa; no autoriza nada.
 */
@Component({
  selector: 'app-portal-directory-panel',
  imports: [RouterLink, AppButton, Badge, Link, Alert, DataTable, FilterBar],
  templateUrl: './directory-panel.html',
  styleUrl: './directory-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectoryPanel {
  private readonly authz = inject(AuthzAdminClient);
  private readonly values = queryFilters(queryParamsSignal(inject(ActivatedRoute)), URL_KEYS);
  private readonly filters = computed(() => this.values(), {
    equal: (a, b) => a.q === b.q && a.type === b.type && a.status === b.status,
  });

  protected readonly counts = signal<DirectoryTypeCounts | null>(null);
  protected readonly unavailable = signal<readonly DirectoryUserType[]>([]);
  protected readonly source = signal<'SIMULATED' | null>(null);
  protected readonly unavailableText = computed(() =>
    this.unavailable().map((t) => typePlural(t).toLowerCase()).join(', '),
  );

  protected readonly filterDefs = computed<readonly FilterDef[]>(() => {
    const counts = this.counts();
    return [
      {
        key: 'type',
        label: 'Tipo',
        asChips: true,
        options: DIRECTORY_USER_TYPES.map((t) => ({
          value: t,
          label: counts ? `${typePlural(t)} · ${counts[t]}` : typePlural(t),
        })),
      },
      {
        key: 'status',
        label: 'Estado',
        placeholder: 'Cualquier estado',
        options: DIRECTORY_USER_STATUSES.map((s) => ({ value: s, label: statusLabel(s).label })),
      },
    ];
  });

  protected readonly list = pagedList<DirectoryUser>(
    (cursor) => {
      const { q, type, status } = this.filters();
      return this.authz
        .directoryUsers({
          limit: PAGE_SIZE,
          ...(q.trim() ? { q: q.trim() } : {}),
          ...(isType(type) ? { type } : {}),
          ...(isStatus(status) ? { status } : {}),
          ...(cursor ? { cursor } : {}),
        })
        .pipe(
          tap((page) => {
            this.counts.set(page.typeCounts);
            this.unavailable.set(page.unavailableTypes);
            this.source.set(page.source);
          }),
        );
    },
    () => {
      const f = this.filters();
      return f.q !== '' || f.type !== '' || f.status !== ''
        ? empty({ label: 'Quitar los filtros', route: SCREEN }, 'Ninguna cuenta coincide con la búsqueda, el tipo o el estado elegidos.')
        : empty(
            { label: 'Ver los usuarios internos', route: SCREEN, queryParams: { view: 'users' } },
            'Todavía no hay cuentas que mostrar.',
          );
    },
  );

  private readonly personCell = viewChild.required<TemplateRef<{ $implicit: DirectoryUser }>>('personCell');
  private readonly typeCell = viewChild.required<TemplateRef<{ $implicit: DirectoryUser }>>('typeCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: DirectoryUser }>>('statusCell');
  private readonly rolesCell = viewChild.required<TemplateRef<{ $implicit: DirectoryUser }>>('rolesCell');
  private readonly permCell = viewChild.required<TemplateRef<{ $implicit: DirectoryUser }>>('permCell');
  private readonly loginCell = viewChild.required<TemplateRef<{ $implicit: DirectoryUser }>>('loginCell');

  protected readonly columns = computed<readonly ColumnDef<DirectoryUser>[]>(() => [
    { key: 'displayName', header: 'Persona', priority: 1, cell: this.personCell() },
    { key: 'type', header: 'Tipo', priority: 1, cell: this.typeCell() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.statusCell() },
    { key: 'roles', header: 'Roles', priority: 2, cell: this.rolesCell() },
    { key: 'permissions', header: 'Permisos', priority: 2, cell: this.permCell() },
    { key: 'lastLoginAt', header: 'Último ingreso', priority: 3, cell: this.loginCell() },
  ]);

  protected readonly byId = (row: DirectoryUser): string => row.id;
  protected readonly rowName = (row: DirectoryUser): string => row.displayName;
  protected readonly when = dateTime;
  protected readonly email = visibleEmail;
  protected readonly perms = permissionsLine;
  protected readonly singular = typeSingular;
  protected readonly status = statusLabel;

  constructor() {
    effect(() => {
      this.filters();
      untracked(() => this.list.restart());
    });
  }
}

const isType = (value: string): value is DirectoryUserType => DIRECTORY_USER_TYPES.some((t) => t === value);
const isStatus = (value: string): value is Exclude<DirectoryUserStatus, 'OTHER'> =>
  DIRECTORY_USER_STATUSES.some((s) => s === value);

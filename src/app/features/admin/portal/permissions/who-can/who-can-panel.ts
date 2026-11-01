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
import { map, of, type Subscription } from 'rxjs';

import { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import type { PermissionSummary } from '../../../../../core/data-access/authz-admin/authz-admin.types';
import { AuthzGovernanceClient } from '../../../../../core/data-access/authz-governance/authz-governance.client';
import {
  HOLDER_SOURCES,
  type HolderSource,
  type HolderSourceKind,
  type PermissionHolder,
} from '../../../../../core/data-access/authz-governance/authz-governance.types';
import { empty } from '../../../../../core/view-state/view-state';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../../../../shared/components/molecules/search-field/search-field';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { portalUrl } from '../../portal-nav';
import { pagedList } from '../../support/paged-list';
import { readWholeCatalog } from '../common/permission-catalog-source';
import { accountStatusLabel, effectLabel, holderSourceLabel } from '../permissions-labels';

const PAGE_SIZE = 50;
const ALL = '';
const SOURCE_OPTIONS: readonly SelectOption<string>[] = [
  { value: ALL, label: 'Todos los caminos' },
  ...HOLDER_SOURCES.map((code) => ({ value: code, label: holderSourceLabel(code).label })),
];

/**
 * «Quién puede qué»: elegido un permiso, las PERSONAS que lo tienen y el camino
 * por el que lo tienen (un rol propio o heredado, una excepción a la persona o
 * un permiso sobre un recurso), con su efecto. Sale de
 * `GET /authz/permissions/:id/holders`, una fila por persona, sólo lo vigente.
 *
 * Es una vista ORIENTATIVA: no reproduce toda la evaluación del PDP (propósito
 * de uso, alcance clínico por paciente, políticas). La decisión real la da el
 * simulador. Sólo la ve una persona administradora de plataforma: la API
 * responde 403 a una administración acotada a una organización.
 */
@Component({
  selector: 'app-portal-who-can-panel',
  imports: [Badge, Select, Alert, FormField, SearchField, DataTable],
  template: `
    <div class="panel" data-testid="portal-who-can">
      <p class="panel__note">
        Qué personas tienen un permiso y por qué camino. Es orientativa: no considera el propósito de uso ni el alcance
        clínico por paciente; para un caso concreto, use el simulador.
      </p>
      @if (catalogUnavailable()) {
        <app-alert tone="warning" data-testid="portal-who-can-catalog-error">
          No llegó el catálogo de permisos: no se puede elegir uno desde acá.
        </app-alert>
      }
      <div class="panel__toolbar">
        <app-form-field label="Permiso">
          <app-select
            ariaLabel="Permiso"
            placeholder="Código o nombre del permiso"
            data-testid="portal-who-can-permission"
            [searchable]="true"
            [options]="permissionOptions()"
            [value]="permissionId() || null"
            (valueChange)="permissionChanged.emit($event ?? '')"
          />
        </app-form-field>
        @if (permissionId() !== '') {
          <app-form-field label="Camino">
            <app-select
              ariaLabel="Camino por el que tiene el permiso"
              data-testid="portal-who-can-source"
              [options]="sourceOptions"
              [value]="source()"
              (valueChange)="source.set($event ?? '')"
            />
          </app-form-field>
          <app-search-field
            label="Buscar personas"
            placeholder="Nombre visible"
            [value]="query()"
            (searched)="query.set($event)"
            [loading]="holders.state().status === 'loading'"
          />
        }
      </div>
      <app-data-table
        data-testid="portal-who-can-table"
        caption="Personas con el permiso elegido"
        [state]="holders.state()"
        [columns]="columns()"
        [trackBy]="byId"
        [rowLabel]="rowName"
        [cursor]="holders.cursor()"
        dense
        stackedOnMobile
        fitContainer
        (cursorChanged)="holders.move($event)"
        (retry)="holders.reload()"
      />
    </div>
    <ng-template #personCell let-row>
      <div class="panel__cell">
        <span class="panel__name">{{ row.displayName }}</span>
        <app-badge size="sm" [variant]="status(row.accountStatus).tone">{{ status(row.accountStatus).label }}</app-badge>
      </div>
    </ng-template>
    <ng-template #pathCell let-row>
      <div class="panel__cell">
        <ul class="panel__list" [attr.aria-label]="'Caminos de ' + row.displayName">
          @for (s of row.sources; track $index) {
            <li class="panel__badges" data-testid="portal-who-can-source-row">
              <app-badge size="sm" [variant]="effect(s.effect).tone">{{ effect(s.effect).label }}</app-badge>
              <app-badge size="sm" [variant]="path(s.source).tone">{{ path(s.source).label }}</app-badge>
              <span class="panel__secondary">{{ detail(s) }}</span>
            </li>
          }
        </ul>
      </div>
    </ng-template>
  `,
  styleUrl: '../permissions-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhoCanPanel {
  private readonly authz = inject(AuthzAdminClient);
  private readonly governance = inject(AuthzGovernanceClient);

  readonly permissionId = input.required<string>();
  readonly permissionChanged = output<string>();

  protected readonly sourceOptions = SOURCE_OPTIONS;
  protected readonly source = signal<string>(ALL);
  protected readonly query = signal('');
  protected readonly catalogUnavailable = signal(false);
  protected readonly effect = effectLabel;
  protected readonly status = accountStatusLabel;
  protected readonly path = holderSourceLabel;
  private readonly catalog = signal<readonly PermissionSummary[]>([]);

  protected readonly permissionOptions = computed<readonly SelectOption<string>[]>(() =>
    this.catalog().map((p) => ({ value: p.id, label: `${p.name} · ${p.code}` })),
  );

  protected readonly holders = pagedList<PermissionHolder>(
    (cursor) =>
      this.permissionId() === ''
        ? of({ items: [] as readonly PermissionHolder[], nextCursor: null })
        : this.governance
        .permissionHolders(this.permissionId(), {
          limit: PAGE_SIZE,
          ...(this.source() !== ALL ? { source: this.source() as HolderSourceKind } : {}),
          ...(this.query().trim() ? { q: this.query().trim() } : {}),
          ...(cursor ? { cursor } : {}),
        })
        .pipe(map((page) => ({ items: page.items, nextCursor: page.nextCursor }))),
    () =>
      this.permissionId() === ''
        ? empty(
            { label: 'Simular una decisión', route: portalUrl('governance/who-can') },
            'Elija un permiso para ver qué personas lo tienen y por qué camino.',
          )
        : empty(
            { label: 'Editar los roles y permisos', route: portalUrl('governance/roles') },
            this.source() !== ALL || this.query().trim() !== ''
              ? 'Nadie coincide con ese filtro.'
              : 'Nadie lo tiene hoy, ni por un rol, ni por una excepción, ni sobre un recurso. Se concede desde «Roles y permisos».',
          ),
  );

  private readonly personCell = viewChild.required<TemplateRef<{ $implicit: PermissionHolder }>>('personCell');
  private readonly pathCell = viewChild.required<TemplateRef<{ $implicit: PermissionHolder }>>('pathCell');

  protected readonly columns = computed<readonly ColumnDef<PermissionHolder>[]>(() => [
    { key: 'person', header: 'Persona', priority: 1, cell: this.personCell() },
    { key: 'paths', header: 'Cómo lo tiene', priority: 1, cell: this.pathCell() },
  ]);
  protected readonly byId = (row: PermissionHolder): string => row.userId;
  protected readonly rowName = (row: PermissionHolder): string => row.displayName;

  private subscription: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe());
    this.subscription = readWholeCatalog(this.authz).subscribe({
      next: (read) => this.catalog.set([...read.items].sort((a, b) => a.code.localeCompare(b.code))),
      error: () => this.catalogUnavailable.set(true),
    });
    // Otro permiso, otro camino u otro texto: otra consulta, desde la primera página.
    effect(() => {
      this.permissionId();
      this.source();
      this.query();
      untracked(() => this.holders.restart());
    });
  }

  /** Dónde se nota el camino: el rol (y el que lo hereda) o el recurso. */
  protected detail(s: HolderSource): string {
    if (s.source === 'ROLE') {
      if (s.roleCode && s.viaRoleCode && s.roleCode !== s.viaRoleCode) return `${s.roleCode}, heredado de ${s.viaRoleCode}`;
      return s.roleCode ?? 'Rol sin código';
    }
    if (s.source === 'RESOURCE') return s.resourceId ? `Recurso ${s.resourceId.slice(0, 8)}…` : 'Recurso sin identificar';
    return 'Sobre la persona';
  }
}

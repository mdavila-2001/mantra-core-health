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
import { catchError, forkJoin, from, map, mergeMap, of, toArray, type Subscription } from 'rxjs';

import { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import type {
  AssignableRole,
  InternalUser,
  PermissionSummary,
} from '../../../../../core/data-access/authz-admin/authz-admin.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { portalUrl } from '../../portal-nav';
import { byName, effectLabel, scopeLabel } from '../permissions-labels';
import { readWholeCatalog } from '../common/permission-catalog-source';

const READ_CONCURRENCY = 4;
const PEOPLE_SHOWN = 5;

/** Un rol que toca el permiso elegido, y quiénes lo tienen. */
export interface WhoCanRow {
  readonly roleId: string;
  readonly roleCode: string;
  readonly roleName: string;
  readonly effect: string;
  readonly scope: string | null;
  /** `null`: la lista de personas de este rol no se pudo leer. */
  readonly people: readonly string[] | null;
}

/**
 * «Quién puede qué»: elegido un permiso, qué roles lo permiten o lo niegan y
 * qué personas internas tienen esos roles. Sale de leer los permisos de cada
 * rol y los usuarios por rol; no es una decisión (para eso está el simulador).
 */
@Component({
  selector: 'app-portal-who-can-panel',
  imports: [Badge, Select, Alert, FormField, DataTable],
  template: `
    <div class="panel" data-testid="portal-who-can">
      <p class="panel__note">
        Elija un permiso para ver qué roles lo permiten o lo niegan y quiénes los tienen. Sólo aparecen las cuentas
        internas (con un rol de plataforma o de ámbito global); las excepciones por persona y los permisos por alcance
        de recurso no se listan acá.
      </p>
      @if (partial() > 0) {
        <app-alert tone="warning" data-testid="portal-who-can-partial">
          No se pudieron leer los permisos de {{ partial() }} {{ partial() === 1 ? 'rol' : 'roles' }}: la lista puede estar
          incompleta.
        </app-alert>
      }
      <app-form-field label="Permiso" [hint]="catalogUnavailable() ? 'No llegó el catálogo de permisos.' : 'El código o el nombre del permiso.'">
        <app-select
          ariaLabel="Permiso"
          placeholder="Elegir un permiso"
          data-testid="portal-who-can-permission"
          [searchable]="true"
          [options]="permissionOptions()"
          [value]="permissionId() || null"
          (valueChange)="permissionChanged.emit($event ?? '')"
        />
      </app-form-field>
      <app-data-table
        data-testid="portal-who-can-table"
        caption="Roles y personas con el permiso elegido"
        [state]="rows()"
        [columns]="columns()"
        [trackBy]="byId"
        [rowLabel]="rowName"
        stackedOnMobile
        fitContainer
        (retry)="reload()"
      />
    </div>
    <ng-template #roleCell let-row>
      <span class="panel__name">{{ row.roleName }}</span>
      <code class="panel__code">{{ row.roleCode }}</code>
    </ng-template>
    <ng-template #effectCell let-row>
      <app-badge size="sm" [variant]="effect(row.effect).tone">{{ effect(row.effect).label }}</app-badge>
      @if (row.scope) {
        <app-badge size="sm" [variant]="scope(row.scope).tone">{{ scope(row.scope).label }}</app-badge>
      }
    </ng-template>
    <ng-template #peopleCell let-row>
      @if (row.people === null) {
        <span class="panel__secondary">No se pudo leer quiénes tienen este rol.</span>
      } @else if (row.people.length === 0) {
        <span class="panel__secondary">Nadie lo tiene hoy entre las cuentas internas.</span>
      } @else {
        <span class="panel__name">{{ preview(row.people) }}</span>
      }
    </ng-template>
  `,
  styleUrl: '../permissions-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhoCanPanel {
  private readonly authz = inject(AuthzAdminClient);

  readonly permissionId = input.required<string>();
  readonly permissionChanged = output<string>();

  protected readonly rows = signal<ViewState<readonly WhoCanRow[]>>(loading());
  protected readonly partial = signal(0);
  protected readonly catalogUnavailable = signal(false);
  protected readonly effect = effectLabel;
  protected readonly scope = scopeLabel;
  private readonly catalog = signal<readonly PermissionSummary[]>([]);
  private readonly roles = signal<readonly AssignableRole[]>([]);

  protected readonly permissionOptions = computed<readonly SelectOption<string>[]>(() =>
    this.catalog().map((p) => ({ value: p.id, label: `${p.name} · ${p.code}` })),
  );

  private readonly roleCell = viewChild.required<TemplateRef<{ $implicit: WhoCanRow }>>('roleCell');
  private readonly effectCell = viewChild.required<TemplateRef<{ $implicit: WhoCanRow }>>('effectCell');
  private readonly peopleCell = viewChild.required<TemplateRef<{ $implicit: WhoCanRow }>>('peopleCell');

  protected readonly columns = computed<readonly ColumnDef<WhoCanRow>[]>(() => [
    { key: 'role', header: 'Rol', priority: 1, cell: this.roleCell() },
    { key: 'effect', header: 'Efecto y ámbito', priority: 1, cell: this.effectCell() },
    { key: 'people', header: 'Personas internas con el rol', priority: 1, cell: this.peopleCell() },
  ]);
  protected readonly byId = (row: WhoCanRow): string => row.roleId;
  protected readonly rowName = (row: WhoCanRow): string => row.roleName;

  private readonly subscriptions: Subscription[] = [];
  private reading: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.subscriptions.forEach((s) => s.unsubscribe());
      this.reading?.unsubscribe();
    });
    this.subscriptions.push(
      readWholeCatalog(this.authz).subscribe({
        next: (read) => this.catalog.set([...read.items].sort((a, b) => a.code.localeCompare(b.code))),
        error: () => this.catalogUnavailable.set(true),
      }),
      this.authz.assignableRoles().subscribe({
        next: (roles) => {
          this.roles.set([...roles].sort(byName));
          this.reload();
        },
        error: (e: unknown) => this.rows.set(errorToViewState<readonly WhoCanRow[]>(e)),
      }),
    );
    effect(() => {
      this.permissionId();
      untracked(() => this.reload());
    });
  }

  protected preview(people: readonly string[]): string {
    const shown = people.slice(0, PEOPLE_SHOWN).join(', ');
    return people.length > PEOPLE_SHOWN ? `${shown} y ${people.length - PEOPLE_SHOWN} más` : shown;
  }

  protected reload(): void {
    this.reading?.unsubscribe();
    const permissionId = this.permissionId();
    const roles = this.roles();
    this.partial.set(0);
    if (permissionId === '') {
      this.rows.set(
        empty(
          { label: 'Simular una decisión', route: portalUrl('governance/who-can') },
          'Elija un permiso para ver qué roles lo tienen y quiénes los tienen.',
        ),
      );
      return;
    }
    if (roles.length === 0) {
      this.rows.set(loading());
      return;
    }
    this.rows.set(loading());
    this.reading = from(roles)
      .pipe(
        mergeMap(
          (role) =>
            this.authz.rolePermissions(role.id).pipe(
              map((body) => ({ role, hit: body.items.find((i) => i.permissionId === permissionId) ?? null, failed: false })),
              catchError(() => of({ role, hit: null, failed: true })),
            ),
          READ_CONCURRENCY,
        ),
        toArray(),
      )
      .subscribe({
        next: (reads) => {
          this.partial.set(reads.filter((r) => r.failed).length);
          const hits = reads.filter((r) => r.hit !== null).sort((a, b) => byName(a.role, b.role));
          if (hits.length === 0) {
            this.rows.set(
              empty(
                { label: 'Editar los roles y permisos', route: portalUrl('governance/roles') },
                'Ningún rol permite ni niega este permiso. Se concede desde «Roles y permisos».',
              ),
            );
            return;
          }
          this.readPeople(hits.map((h) => ({ role: h.role, effect: h.hit!.effect, scope: h.hit!.scope })));
        },
        error: (e: unknown) => this.rows.set(errorToViewState<readonly WhoCanRow[]>(e)),
      });
  }

  private readPeople(hits: readonly { role: AssignableRole; effect: string; scope: string | null }[]): void {
    this.reading = forkJoin(
      hits.map((h) =>
        this.authz.internalUsers({ roleCode: h.role.code, limit: 200 }).pipe(
          map((page): readonly string[] | null => page.items.map((u: InternalUser) => u.displayName)),
          catchError(() => of(null)),
        ),
      ),
    ).subscribe((people) =>
      this.rows.set(
        ready(
          hits.map((h, i) => ({
            roleId: h.role.id,
            roleCode: h.role.code,
            roleName: h.role.name,
            effect: h.effect,
            scope: h.scope,
            people: people[i] ?? null,
          })),
        ),
      ),
    );
  }
}

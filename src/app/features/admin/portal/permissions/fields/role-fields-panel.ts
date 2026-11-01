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
import type { AssignableRole } from '../../../../../core/data-access/authz-admin/authz-admin.types';
import { AuthzGovernanceClient } from '../../../../../core/data-access/authz-governance/authz-governance.client';
import type { FieldPermission } from '../../../../../core/data-access/authz-governance/authz-governance.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { portalUrl } from '../../portal-nav';
import { byName, maskLabel } from '../permissions-labels';
import { FieldRuleDialog } from './field-rule-dialog';

/** Las reglas de campo de un rol: qué columnas lee, cuáles escribe y cómo se le enmascaran. */
@Component({
  selector: 'app-portal-role-fields-panel',
  imports: [AppButton, Badge, Select, Alert, FormField, DataTable, FieldRuleDialog],
  template: `
    <div class="panel" data-testid="portal-role-fields">
      @if (notice(); as message) {
        <app-alert tone="success" dismissible (dismissed)="notice.set(null)">{{ message }}</app-alert>
      }
      <div class="panel__toolbar panel__toolbar--action">
        <app-form-field label="Rol" [errorMessage]="rolesUnavailable() ? 'No llegó la lista de roles.' : ''">
          <app-select
            ariaLabel="Rol"
            placeholder="Elegir un rol"
            data-testid="portal-role-fields-role"
            [options]="roleOptions()"
            [value]="roleId() || null"
            (valueChange)="roleChanged.emit($event ?? '')"
          />
        </app-form-field>
        <div class="panel__actions">
          <button
            app-button
            variant="primary"
            data-testid="portal-role-fields-add"
            [disabled]="roleId() === ''"
            (clicked)="openDialog(null)"
          >
            Agregar una regla
          </button>
        </div>
      </div>
      <p class="panel__note">
        Una columna sin regla se rige por los permisos del rol. Con regla, el rol sólo lee y escribe lo que ella dice y
        el valor se enmascara como se indica.
      </p>
      @if (roleId() === '') {
        <section class="panel__pick" aria-labelledby="fields-pick-title">
          <h2 class="panel__pick-title" id="fields-pick-title">Elija un rol para ver sus reglas de campo.</h2>
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
        <app-data-table
          data-testid="portal-role-fields-table"
          caption="Reglas de campo del rol elegido"
          [state]="rules()"
          [columns]="columns()"
          [trackBy]="byKey"
          [rowLabel]="rowName"
          rowNavigable
          dense
          stackedOnMobile
          fitContainer
          (rowActivated)="openDialog($event)"
          (retry)="reload()"
        />
      }
    </div>

    <ng-template #fieldCell let-row>
      <div class="panel__cell">
        <span class="panel__name">{{ row.columnName }}</span>
        <code class="panel__code">{{ row.entity }}</code>
      </div>
    </ng-template>
    <ng-template #readCell let-row>
      <app-badge size="sm" [variant]="row.canRead ? 'success' : 'error'">{{ row.canRead ? 'Lee' : 'No lee' }}</app-badge>
    </ng-template>
    <ng-template #writeCell let-row>
      <app-badge size="sm" [variant]="row.canWrite ? 'warning' : 'secondary'">{{ row.canWrite ? 'Escribe' : 'No escribe' }}</app-badge>
    </ng-template>
    <ng-template #maskCell let-row>
      <div class="panel__cell">
        @if (row.maskStrategy) {
          <app-badge size="sm" [variant]="mask(row.maskStrategy).tone">{{ mask(row.maskStrategy).label }}</app-badge>
        } @else {
          <span class="panel__secondary">Sin enmascarar</span>
        }
        @if (row.conditionJson) {
          <app-badge size="sm" variant="info">Con condición</app-badge>
        }
      </div>
    </ng-template>

    @if (dialogOpen() && roleId() !== '') {
      <app-portal-field-rule-dialog
        [roleId]="roleId()"
        [roleName]="roleName()"
        [rule]="editing()"
        (savedRule)="saved($event)"
        (closed)="dialogOpen.set(false)"
      />
    }
  `,
  styleUrl: '../permissions-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleFieldsPanel {
  private readonly authz = inject(AuthzAdminClient);
  private readonly governance = inject(AuthzGovernanceClient);

  readonly roleId = input.required<string>();
  readonly roleChanged = output<string>();

  protected readonly rules = signal<ViewState<readonly FieldPermission[]>>(loading());
  protected readonly notice = signal<string | null>(null);
  protected readonly dialogOpen = signal(false);
  protected readonly editing = signal<FieldPermission | null>(null);
  protected readonly rolesUnavailable = signal(false);
  protected readonly mask = maskLabel;
  protected readonly roles = signal<readonly AssignableRole[]>([]);

  protected readonly roleOptions = computed<readonly SelectOption<string>[]>(() =>
    this.roles().map((r) => ({ value: r.id, label: `${r.name} · ${r.code}` })),
  );
  protected readonly roleName = computed(() => this.roles().find((r) => r.id === this.roleId())?.name ?? 'elegido');

  private readonly fieldCell = viewChild.required<TemplateRef<{ $implicit: FieldPermission }>>('fieldCell');
  private readonly readCell = viewChild.required<TemplateRef<{ $implicit: FieldPermission }>>('readCell');
  private readonly writeCell = viewChild.required<TemplateRef<{ $implicit: FieldPermission }>>('writeCell');
  private readonly maskCell = viewChild.required<TemplateRef<{ $implicit: FieldPermission }>>('maskCell');

  protected readonly columns = computed<readonly ColumnDef<FieldPermission>[]>(() => [
    { key: 'columnName', header: 'Campo', priority: 1, cell: this.fieldCell() },
    { key: 'canRead', header: 'Lectura', priority: 1, cell: this.readCell() },
    { key: 'canWrite', header: 'Escritura', priority: 2, cell: this.writeCell() },
    { key: 'maskStrategy', header: 'Enmascaramiento', priority: 1, cell: this.maskCell() },
  ]);
  protected readonly byKey = (row: FieldPermission): string => `${row.entity}.${row.columnName}`;
  protected readonly rowName = (row: FieldPermission): string => `${row.entity}.${row.columnName}`;

  private readonly subscriptions: Subscription[] = [];
  private reading: Subscription | null = null;

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
        this.dialogOpen.set(false);
        this.load(id);
      });
    });
  }

  protected reload(): void {
    this.load(this.roleId());
  }

  protected openDialog(rule: FieldPermission | null): void {
    this.editing.set(rule);
    this.dialogOpen.set(true);
  }

  protected saved(message: string): void {
    this.dialogOpen.set(false);
    this.notice.set(message);
    this.reload();
  }

  private load(id: string): void {
    this.reading?.unsubscribe();
    if (id === '') {
      this.rules.set(empty({ label: 'Ver los roles y permisos', route: portalUrl('governance/roles') }, 'Elija un rol para ver sus reglas de campo.'));
      return;
    }
    this.rules.set(loading());
    this.reading = this.governance.roleFieldPermissions(id).subscribe({
      next: (body) =>
        this.rules.set(
          body.items.length === 0
            ? empty(
                { label: 'Ver los roles y permisos', route: portalUrl('governance/roles') },
                'Este rol no tiene reglas de campo: sus columnas se rigen por sus permisos. Puede agregar una con «Agregar una regla».',
              )
            : ready(body.items),
        ),
      error: (e: unknown) => this.rules.set(errorToViewState<readonly FieldPermission[]>(e)),
    });
  }
}

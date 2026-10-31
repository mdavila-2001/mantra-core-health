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

import { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import type { PermissionSummary } from '../../../../../core/data-access/authz-admin/authz-admin.types';
import { AuthzGovernanceClient } from '../../../../../core/data-access/authz-governance/authz-governance.client';
import type { ResourceScopeGrant } from '../../../../../core/data-access/authz-governance/authz-governance.types';
import { empty } from '../../../../../core/view-state/view-state';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { dateOnly } from '../../governance/governance-labels';
import { pagedList } from '../../support/paged-list';
import { effectLabel, governanceFailure, resourceKindLabel, staleAfter, subjectLabel } from '../permissions-labels';
import { readWholeCatalog } from '../common/permission-catalog-source';
import { ScopeGrantDialog } from './scope-grant-dialog';

const PAGE_SIZE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ANY_PERMISSION = '';

/**
 * Permisos por alcance de recurso: concesiones y negaciones sobre **un**
 * recurso concreto. Se lista por sujeto, recurso o permiso; terminar uno pide
 * confirmación y fija su fin en el momento (la fila queda como historia).
 */
@Component({
  selector: 'app-portal-scope-grants-panel',
  imports: [AppButton, Badge, Input, Select, Alert, FormField, DataTable, ScopeGrantDialog],
  template: `
    <div class="panel" data-testid="portal-scope-grants">
      @if (notice(); as message) {
        <app-alert tone="success" dismissible (dismissed)="notice.set(null)">{{ message }}</app-alert>
      }
      @if (error(); as message) {
        <app-alert tone="error" dismissible (dismissed)="error.set(null)" data-testid="portal-scope-grants-error">{{ message }}</app-alert>
      }
      <app-alert tone="info">
        Las restricciones por dirección IP y por horario existen en el modelo de datos pero la API todavía no las expone:
        no se pueden ver ni editar desde acá.
      </app-alert>
      <div class="panel__toolbar">
        <app-form-field label="Sujeto" [errorMessage]="uuidProblem(subjectId())" hint="UUID de la persona, el rol o el servicio.">
          <app-input ariaLabel="Filtrar por sujeto" data-testid="portal-scope-subject" [(value)]="subjectId" />
        </app-form-field>
        <app-form-field label="Recurso" [errorMessage]="uuidProblem(resourceId())" hint="UUID del recurso concreto.">
          <app-input ariaLabel="Filtrar por recurso" data-testid="portal-scope-resource" [(value)]="resourceId" />
        </app-form-field>
        <app-form-field label="Permiso">
          <app-select
            ariaLabel="Filtrar por permiso"
            [searchable]="true"
            [options]="permissionOptions()"
            [(value)]="permissionId"
          />
        </app-form-field>
      </div>
      <div class="panel__actions">
        <button app-button variant="primary" data-testid="portal-scope-add" (clicked)="creating.set(true)">
          Nuevo permiso por alcance
        </button>
      </div>
      <app-data-table
        data-testid="portal-scope-table"
        caption="Permisos por alcance de recurso"
        [state]="grants.state()"
        [columns]="columns()"
        [trackBy]="byId"
        [rowLabel]="rowName"
        [cursor]="grants.cursor()"
        stackedOnMobile
        fitContainer
        (cursorChanged)="grants.move($event)"
        (retry)="grants.reload()"
      />
    </div>

    <ng-template #subjectCell let-row>
      <app-badge size="sm" variant="secondary">{{ subject(row.subjectType).label }}</app-badge>
      <code class="panel__code" [title]="row.subjectId">{{ short(row.subjectId) }}</code>
    </ng-template>
    <ng-template #permissionCell let-row>
      <span class="panel__name">{{ permissionName(row.permissionId) }}</span>
      <app-badge size="sm" [variant]="effect(row.effect).tone">{{ effect(row.effect).label }}</app-badge>
    </ng-template>
    <ng-template #resourceCell let-row>
      <app-badge size="sm" variant="secondary">{{ kind(row.resourceType).label }}</app-badge>
      <code class="panel__code" [title]="row.resourceId">{{ short(row.resourceId) }}</code>
    </ng-template>
    <ng-template #validityCell let-row>
      <app-badge size="sm" [variant]="row.isEffective ? 'success' : 'secondary'">
        {{ row.isEffective ? 'Vigente' : 'Terminado o aún no vigente' }}
      </app-badge>
      <span class="panel__secondary">
        @if (row.validFrom) { desde {{ day(row.validFrom) }} }
        @if (row.validTo) { hasta {{ day(row.validTo) }} }
        @if (!row.validFrom && !row.validTo) { sin fechas }
      </span>
    </ng-template>
    <ng-template #actionCell let-row>
      @if (row.isEffective) {
        <button
          app-button
          variant="outline"
          size="sm"
          data-testid="portal-scope-end"
          [isLoading]="ending() === row.id"
          [disabled]="ending() !== null"
          (clicked)="end(row)"
        >
          Terminar vigencia
        </button>
      }
    </ng-template>

    @if (creating()) {
      <app-portal-scope-grant-dialog
        [permissions]="catalog()"
        (created)="created($event)"
        (closed)="creating.set(false)"
      />
    }
  `,
  styleUrl: '../permissions-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScopeGrantsPanel {
  private readonly authz = inject(AuthzAdminClient);
  private readonly governance = inject(AuthzGovernanceClient);
  private readonly dialogs = inject(DialogService);

  protected readonly subjectId = signal<string | number | null>('');
  protected readonly resourceId = signal<string | number | null>('');
  protected readonly permissionId = signal<string | null>(ANY_PERMISSION);
  protected readonly creating = signal(false);
  protected readonly ending = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly catalog = signal<readonly PermissionSummary[]>([]);

  protected readonly subject = subjectLabel;
  protected readonly kind = resourceKindLabel;
  protected readonly effect = effectLabel;
  protected readonly day = dateOnly;

  protected readonly permissionOptions = computed<readonly SelectOption<string>[]>(() => [
    { value: ANY_PERMISSION, label: 'Cualquier permiso' },
    ...this.catalog().map((p) => ({ value: p.id, label: `${p.name} · ${p.code}` })),
  ]);

  /** Los filtros que valen: un UUID mal escrito no se manda (la API respondería 400). */
  private readonly filters = computed(
    () => ({
      subjectId: this.validOrEmpty(this.subjectId()),
      resourceId: this.validOrEmpty(this.resourceId()),
      permissionId: this.permissionId() ?? ANY_PERMISSION,
    }),
    { equal: (a, b) => a.subjectId === b.subjectId && a.resourceId === b.resourceId && a.permissionId === b.permissionId },
  );

  protected readonly grants = pagedList<ResourceScopeGrant>(
    (cursor) => {
      const f = this.filters();
      return this.governance.resourceScopeGrants({
        limit: PAGE_SIZE,
        ...(f.subjectId ? { subjectId: f.subjectId } : {}),
        ...(f.resourceId ? { resourceId: f.resourceId } : {}),
        ...(f.permissionId ? { permissionId: f.permissionId } : {}),
        ...(cursor ? { cursor } : {}),
      });
    },
    () =>
      empty(
        { label: 'Nuevo permiso por alcance', queryParams: { view: 'scope' } },
        this.filters().subjectId || this.filters().resourceId || this.filters().permissionId
          ? 'Ningún permiso por alcance coincide con el filtro.'
          : 'Todavía no hay permisos por alcance de recurso. Se crean con «Nuevo permiso por alcance».',
      ),
  );

  private readonly subjectCell = viewChild.required<TemplateRef<{ $implicit: ResourceScopeGrant }>>('subjectCell');
  private readonly permissionCell = viewChild.required<TemplateRef<{ $implicit: ResourceScopeGrant }>>('permissionCell');
  private readonly resourceCell = viewChild.required<TemplateRef<{ $implicit: ResourceScopeGrant }>>('resourceCell');
  private readonly validityCell = viewChild.required<TemplateRef<{ $implicit: ResourceScopeGrant }>>('validityCell');
  private readonly actionCell = viewChild.required<TemplateRef<{ $implicit: ResourceScopeGrant }>>('actionCell');

  protected readonly columns = computed<readonly ColumnDef<ResourceScopeGrant>[]>(() => [
    { key: 'subject', header: 'Sujeto', priority: 1, cell: this.subjectCell() },
    { key: 'permission', header: 'Permiso y efecto', priority: 1, cell: this.permissionCell() },
    { key: 'resource', header: 'Recurso', priority: 2, cell: this.resourceCell() },
    { key: 'validity', header: 'Vigencia', priority: 1, cell: this.validityCell() },
    { key: 'actions', header: 'Acciones', priority: 1, cell: this.actionCell() },
  ]);
  protected readonly byId = (row: ResourceScopeGrant): string => row.id;
  protected readonly rowName = (row: ResourceScopeGrant): string => this.permissionName(row.permissionId);

  constructor() {
    const subscription = readWholeCatalog(this.authz).subscribe({
      next: (read) => this.catalog.set(read.items),
      // Sin catálogo los permisos se muestran por su identificador: la lista sigue sirviendo.
      error: () => this.catalog.set([]),
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
    effect(() => {
      this.filters();
      untracked(() => this.grants.restart());
    });
  }

  protected short(id: string): string {
    return `${id.slice(0, 8)}…`;
  }

  protected permissionName(id: string): string {
    return this.catalog().find((p) => p.id === id)?.name ?? `Permiso ${this.short(id)}`;
  }

  protected uuidProblem(value: string | number | null): string {
    const text = String(value ?? '').trim();
    return text === '' || UUID.test(text) ? '' : 'Escriba un UUID completo para filtrar.';
  }

  protected created(message: string): void {
    this.creating.set(false);
    this.notice.set(message);
    this.grants.restart();
  }

  protected async end(grant: ResourceScopeGrant): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: 'Terminar la vigencia',
      message: `El permiso por alcance sobre ${this.kind(grant.resourceType).label.toLowerCase()} ${this.short(grant.resourceId)} deja de valer desde ahora. La fila queda como historia y queda en la bitácora.`,
      confirmLabel: 'Terminar vigencia',
      cancelLabel: 'Volver',
      destructive: true,
    });
    if (!ok) return;
    this.ending.set(grant.id);
    this.error.set(null);
    this.governance.endResourceScopeGrant(grant.id).subscribe({
      next: () => {
        this.ending.set(null);
        this.notice.set('Terminó la vigencia del permiso por alcance.');
        this.grants.reload();
      },
      error: (e: unknown) => {
        this.ending.set(null);
        this.error.set(governanceFailure(e, 'No se pudo terminar el permiso. Intente de nuevo.'));
        if (staleAfter(e)) this.grants.reload();
      },
    });
  }

  private validOrEmpty(value: string | number | null): string {
    const text = String(value ?? '').trim();
    return UUID.test(text) ? text : '';
  }
}

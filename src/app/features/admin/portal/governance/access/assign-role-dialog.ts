import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { Subscription } from 'rxjs';

import { SessionStore } from '../../../../../core/auth/session.store';
import { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import type { AssignableRole } from '../../../../../core/data-access/authz-admin/authz-admin.types';
import { DirectoryClient } from '../../../../../core/data-access/directory/directory.client';
import type { TenantListItem } from '../../../../../core/data-access/directory/directory.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';
import { assignmentFailure } from './access.model';

/** Cuántas organizaciones se ofrecen para acotar una asignación. */
const TENANT_OPTIONS_LIMIT = 100;
/** «Sin organización»: el rol vale en toda la plataforma. */
const WHOLE_PLATFORM = '';

/**
 * Asigna un rol a una persona, con su alcance y su vigencia. No decide si el
 * rol admite organización: lo decide la API, y si lo rechaza (un rol de ámbito
 * global atado a una organización) el motivo se explica en el formulario.
 */
@Component({
  selector: 'app-portal-assign-role-dialog',
  imports: [ReactiveFormsModule, AppButton, Input, Select, Alert, FormField, ContentDialog],
  template: `
    <app-content-dialog
      heading="Asignar un rol"
      [description]="'A ' + userName() + '. El cambio vale desde la próxima vez que su sesión se renueve.'"
      [dismissible]="!saving()"
      (closed)="closed.emit()"
    >
      @if (error(); as message) {
        <app-alert tone="error" data-testid="assign-role-error">{{ message }}</app-alert>
      }
      @if (rolesUnavailable()) {
        <app-alert tone="warning">No llegó la lista de roles asignables. Cierre y vuelva a intentarlo.</app-alert>
      }
      <form class="assign-form" [formGroup]="form" novalidate (submit)="$event.preventDefault(); save()">
        <app-form-field
          label="Rol"
          [required]="true"
          [errorMessage]="form.controls.roleId.touched && form.controls.roleId.invalid ? 'Elija el rol que va a asignar.' : ''"
        >
          <app-select
            ariaLabel="Rol"
            formControlName="roleId"
            placeholder="Elegir un rol"
            data-testid="assign-role-role"
            [options]="roleOptions()"
          />
        </app-form-field>
        <app-form-field
          label="Alcance"
          hint="Un rol de ámbito global va sin organización. Un rol de una organización vale sólo dentro de ella."
        >
          <app-select
            ariaLabel="Alcance"
            formControlName="tenantId"
            data-testid="assign-role-scope"
            [options]="scopeOptions()"
          />
        </app-form-field>
        <div class="assign-form__dates">
          <app-form-field label="Vale desde" hint="Opcional. Sin fecha, desde ahora.">
            <app-input type="date" formControlName="validFrom" ariaLabel="Vale desde" />
          </app-form-field>
          <app-form-field label="Vale hasta" hint="Opcional. Sin fecha, hasta que se revoque.">
            <app-input type="date" formControlName="validTo" ariaLabel="Vale hasta" />
          </app-form-field>
        </div>
      </form>
      <div dialog-actions class="assign-form__actions">
        <button app-button variant="ghost" [disabled]="saving()" (clicked)="closed.emit()">Cancelar</button>
        <button
          app-button
          variant="primary"
          data-testid="assign-role-save"
          [isLoading]="saving()"
          (clicked)="save()"
        >
          Asignar
        </button>
      </div>
    </app-content-dialog>
  `,
  styles: `
    .assign-form {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }
    .assign-form__dates {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(12rem, 100%), 1fr));
      gap: var(--sp-3);
    }
    .assign-form__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--sp-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignRoleDialog {
  private readonly authz = inject(AuthzAdminClient);
  private readonly directory = inject(DirectoryClient);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly session = inject(SessionStore);

  readonly userId = input.required<string>();
  readonly userName = input.required<string>();
  /** La asignación quedó creada; lleva el aviso para la pantalla. */
  readonly assigned = output<string>();
  readonly closed = output<void>();

  private readonly roles = signal<readonly AssignableRole[]>([]);
  private readonly tenants = signal<readonly TenantListItem[]>([]);
  protected readonly rolesUnavailable = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group({
    roleId: this.fb.control('', [Validators.required]),
    tenantId: this.fb.control(WHOLE_PLATFORM),
    validFrom: this.fb.control(''),
    validTo: this.fb.control(''),
  });

  protected readonly roleOptions = computed<readonly SelectOption<string>[]>(() =>
    this.roles().map((r) => ({ value: r.id, label: `${r.name} · ${r.code}` })),
  );
  /**
   * La organización activa de la sesión va primero: la API compara la
   * organización de la asignación con la que la sesión declara en cada
   * petición, y una distinta la rechaza.
   */
  protected readonly scopeOptions = computed<readonly SelectOption<string>[]>(() => {
    const active = this.session.activeTenantId();
    const named = this.tenants().map((t) => ({
      value: t.id,
      label: t.id === active ? `${t.tradeName ?? t.legalName} (la de su sesión)` : (t.tradeName ?? t.legalName),
    }));
    const own =
      active === null
        ? []
        : (named.filter((o) => o.value === active) as SelectOption<string>[]).concat(
            named.some((o) => o.value === active)
              ? []
              : [{ value: active, label: `${this.session.tenantName(active)} (la de su sesión)` }],
          );
    return [
      { value: WHOLE_PLATFORM, label: 'Toda la plataforma (sin organización)' },
      ...own,
      ...named.filter((o) => o.value !== active),
    ];
  });

  private readonly pending: Subscription[] = [];

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pending.forEach((s) => s.unsubscribe()));
    this.pending.push(
      this.authz.assignableRoles().subscribe({
        next: (roles) => this.roles.set([...roles].sort((a, b) => a.name.localeCompare(b.name, 'es'))),
        error: () => this.rolesUnavailable.set(true),
      }),
      // Sin organizaciones, igual se puede asignar en toda la plataforma: el
      // alcance queda con esa única opción.
      this.directory.searchTenants({ limit: TENANT_OPTIONS_LIMIT }).subscribe({
        next: (page) => this.tenants.set(page.items),
        error: () => this.tenants.set([]),
      }),
    );
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    const role = this.roles().find((r) => r.id === v.roleId);
    this.pending.push(
      this.authz
        .assignRole(this.userId(), {
          roleId: v.roleId,
          ...(v.tenantId !== WHOLE_PLATFORM ? { tenantId: v.tenantId } : {}),
          ...(v.validFrom ? { validFrom: new Date(`${v.validFrom}T00:00:00`).toISOString() } : {}),
          ...(v.validTo ? { validTo: new Date(`${v.validTo}T23:59:59`).toISOString() } : {}),
        })
        .subscribe({
          next: () => {
            this.saving.set(false);
            const who = this.userName().charAt(0).toUpperCase() + this.userName().slice(1);
            this.assigned.emit(role ? `${who} recibió el rol «${role.name}».` : `${who} recibió el rol.`);
          },
          error: (e: unknown) => {
            this.saving.set(false);
            this.error.set(assignmentFailure(e, 'No se pudo asignar el rol. Intente de nuevo.'));
          },
        }),
    );
  }
}

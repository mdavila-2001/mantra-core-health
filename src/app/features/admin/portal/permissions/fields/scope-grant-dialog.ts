import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import type { Subscription } from 'rxjs';

import { AuthzGovernanceClient } from '../../../../../core/data-access/authz-governance/authz-governance.client';
import {
  SCOPE_RESOURCE_TYPES,
  SCOPE_SUBJECT_TYPES,
  type PermissionEffectInput,
  type ResourceScopeGrantInput,
  type ScopeResourceType,
  type ScopeSubjectType,
} from '../../../../../core/data-access/authz-governance/authz-governance.types';
import { fieldErrorsOf } from '../../../../../core/http/api-failure';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';
import { effectLabel, governanceFailure, optionsOf, resourceKindLabel, subjectLabel } from '../permissions-labels';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBJECT_OPTIONS = optionsOf(SCOPE_SUBJECT_TYPES, (c) => subjectLabel(c));
const RESOURCE_OPTIONS = optionsOf(SCOPE_RESOURCE_TYPES, (c) => resourceKindLabel(c));
const EFFECT_OPTIONS = optionsOf(['ALLOW', 'DENY'], (c) => effectLabel(c));

/**
 * Concede o niega un permiso sobre **un** recurso concreto. Termina cuando
 * vence o cuando alguien lo termina desde la lista; no se edita.
 */
@Component({
  selector: 'app-portal-scope-grant-dialog',
  imports: [AppButton, Input, Select, Alert, FormField, ContentDialog],
  template: `
    <app-content-dialog
      heading="Nuevo permiso por alcance"
      description="Concede o niega un permiso sobre un recurso concreto, para una persona, un rol o un servicio."
      [dismissible]="!saving()"
      (closed)="closed.emit()"
    >
      @if (error(); as message) {
        <app-alert tone="error" data-testid="scope-grant-error">{{ message }}</app-alert>
      }
      <form class="panel__form" novalidate (submit)="$event.preventDefault(); save()">
        <div class="panel__pair">
          <app-form-field label="Sujeto" [required]="true">
            <app-select ariaLabel="Tipo de sujeto" [options]="subjectOptions" [(value)]="subjectType" />
          </app-form-field>
          <app-form-field label="Identificador del sujeto" [required]="true" [errorMessage]="problem('subjectId')" hint="UUID de la persona, el rol o el servicio.">
            <app-input ariaLabel="Identificador del sujeto" data-testid="scope-grant-subject" [(value)]="subjectId" />
          </app-form-field>
        </div>
        <app-form-field label="Permiso" [required]="true" [errorMessage]="problem('permissionId')">
          <app-select
            ariaLabel="Permiso"
            placeholder="Elegir un permiso"
            data-testid="scope-grant-permission"
            [searchable]="true"
            [options]="permissionOptions()"
            [(value)]="permissionId"
          />
        </app-form-field>
        <div class="panel__pair">
          <app-form-field label="Tipo de recurso" [required]="true">
            <app-select ariaLabel="Tipo de recurso" [options]="resourceOptions" [(value)]="resourceType" />
          </app-form-field>
          <app-form-field label="Identificador del recurso" [required]="true" [errorMessage]="problem('resourceId')" hint="UUID del recurso concreto.">
            <app-input ariaLabel="Identificador del recurso" data-testid="scope-grant-resource" [(value)]="resourceId" />
          </app-form-field>
        </div>
        <app-form-field label="Efecto" [required]="true" hint="Una negación prevalece sobre un permiso.">
          <app-select ariaLabel="Efecto" [options]="effectOptions" [(value)]="effect" />
        </app-form-field>
        <div class="panel__pair">
          <app-form-field label="Vale desde" hint="Opcional. Sin fecha, desde ahora.">
            <app-input type="date" ariaLabel="Vale desde" [(value)]="validFrom" />
          </app-form-field>
          <app-form-field label="Vale hasta" [errorMessage]="problem('validTo')" hint="Opcional. Sin fecha, hasta que se termine.">
            <app-input type="date" ariaLabel="Vale hasta" [(value)]="validTo" />
          </app-form-field>
        </div>
      </form>
      <div dialog-actions class="panel__actions">
        <button app-button variant="ghost" [disabled]="saving()" (clicked)="closed.emit()">Cancelar</button>
        <button app-button variant="primary" data-testid="scope-grant-save" [isLoading]="saving()" (clicked)="save()">
          Guardar permiso
        </button>
      </div>
    </app-content-dialog>
  `,
  styleUrl: '../permissions-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScopeGrantDialog {
  private readonly governance = inject(AuthzGovernanceClient);

  /** Los permisos del catálogo, ya leídos por la pantalla. */
  readonly permissions = input.required<readonly { readonly id: string; readonly code: string; readonly name: string }[]>();
  readonly created = output<string>();
  readonly closed = output<void>();

  protected readonly subjectOptions = SUBJECT_OPTIONS;
  protected readonly resourceOptions = RESOURCE_OPTIONS;
  protected readonly effectOptions = EFFECT_OPTIONS;
  protected readonly subjectType = signal<string | null>('USER');
  protected readonly subjectId = signal<string | number | null>('');
  protected readonly permissionId = signal<string | null>(null);
  protected readonly resourceType = signal<string | null>('PATIENT');
  protected readonly resourceId = signal<string | number | null>('');
  protected readonly effect = signal<string | null>('DENY');
  protected readonly validFrom = signal<string | number | null>('');
  protected readonly validTo = signal<string | number | null>('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly submitted = signal(false);
  private readonly server = signal<Readonly<Record<string, string>>>({});

  protected readonly permissionOptions = computed<readonly SelectOption<string>[]>(() =>
    this.permissions().map((p) => ({ value: p.id, label: `${p.name} · ${p.code}` })),
  );

  private readonly local = computed<Readonly<Record<string, string>>>(() => {
    const out: Record<string, string> = {};
    if (!UUID.test(String(this.subjectId() ?? '').trim())) out['subjectId'] = 'Escriba un UUID válido.';
    if (!UUID.test(String(this.resourceId() ?? '').trim())) out['resourceId'] = 'Escriba un UUID válido.';
    if (this.permissionId() === null) out['permissionId'] = 'Elija el permiso.';
    const from = String(this.validFrom() ?? '');
    const to = String(this.validTo() ?? '');
    if (from !== '' && to !== '' && from >= to) out['validTo'] = 'Tiene que ser posterior al inicio.';
    return out;
  });

  private subscription: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe());
  }

  protected problem(field: string): string {
    return this.server()[field] ?? (this.submitted() ? (this.local()[field] ?? '') : '');
  }

  protected save(): void {
    this.submitted.set(true);
    this.server.set({});
    if (Object.keys(this.local()).length > 0) return;
    const from = String(this.validFrom() ?? '');
    const to = String(this.validTo() ?? '');
    const input: ResourceScopeGrantInput = {
      subjectType: this.subjectType() as ScopeSubjectType,
      subjectId: String(this.subjectId()).trim(),
      permissionId: this.permissionId()!,
      resourceType: this.resourceType() as ScopeResourceType,
      resourceId: String(this.resourceId()).trim(),
      effect: this.effect() as PermissionEffectInput,
      ...(from ? { validFrom: new Date(`${from}T00:00:00`).toISOString() } : {}),
      ...(to ? { validTo: new Date(`${to}T23:59:59`).toISOString() } : {}),
    };
    this.saving.set(true);
    this.error.set(null);
    this.subscription = this.governance.createResourceScopeGrant(input).subscribe({
      next: () => {
        this.saving.set(false);
        this.created.emit('Se guardó el permiso por alcance.');
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.server.set(fieldErrorsOf(e));
        this.error.set(governanceFailure(e, 'No se pudo guardar el permiso. Lo que escribió sigue acá.'));
      },
    });
  }
}

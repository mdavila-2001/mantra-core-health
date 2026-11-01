import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import type { Subscription } from 'rxjs';

import { SessionStore } from '../../../../../core/auth/session.store';
import { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import type { AssignableRole, InternalUser } from '../../../../../core/data-access/authz-admin/authz-admin.types';
import { AuthzGovernanceClient } from '../../../../../core/data-access/authz-governance/authz-governance.client';
import {
  DECISION_PURPOSES,
  PERMISSION_ACTIONS,
  SCOPE_RESOURCE_TYPES,
  type DecisionPurpose,
  type DecisionRequest,
  type DecisionResult,
  type PermissionActionInput,
  type ScopeResourceType,
} from '../../../../../core/data-access/authz-governance/authz-governance.types';
import { DirectoryClient } from '../../../../../core/data-access/directory/directory.client';
import type { TenantListItem } from '../../../../../core/data-access/directory/directory.types';
import { fieldErrorsOf } from '../../../../../core/http/api-failure';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import {
  actionLabel,
  byName,
  governanceFailure,
  maskLabel,
  optionsOf,
  purposeLabel,
  resourceKindLabel,
} from '../permissions-labels';
import { readWholeCatalog } from '../common/permission-catalog-source';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NONE = '';
const ACTION_OPTIONS = optionsOf(PERMISSION_ACTIONS, (c) => actionLabel(c));
const KIND_OPTIONS: readonly SelectOption<string>[] = [
  { value: NONE, label: 'Sin especificar' },
  ...optionsOf(SCOPE_RESOURCE_TYPES, (c) => resourceKindLabel(c)),
];
const PURPOSE_OPTIONS: readonly SelectOption<string>[] = [
  { value: NONE, label: 'Sin especificar' },
  ...optionsOf(DECISION_PURPOSES, (c) => purposeLabel(c)),
];

/**
 * Simula una decisión del PDP: «¿esta persona puede hacer esto sobre aquello?».
 * No calcula nada en el navegador: llama a `POST /authz/simulations` (la decisión real del PDP, sin conceder nada) y
 * enseña tal cual lo que la API decidió, con los roles que pesaron y los
 * campos que se enmascaran. Cada simulación queda en la bitácora.
 */
@Component({
  selector: 'app-portal-decision-simulator',
  imports: [AppButton, Badge, Input, Select, Alert, FormField],
  template: `
    <div class="panel" data-testid="portal-simulator">
      <p class="panel__note">
        Pregúntele al motor de decisiones real qué haría. La respuesta es la del PDP, no una estimación de esta pantalla,
        y la consulta queda en la bitácora.
      </p>
      @if (error(); as message) {
        <app-alert tone="error" data-testid="portal-simulator-error">{{ message }}</app-alert>
      }
      @if (sourcesUnavailable()) {
        <app-alert tone="warning">
          No llegó alguna de las listas (personas, organizaciones o recursos). Las que faltan se pueden completar a mano
          con su UUID donde el campo lo permite.
        </app-alert>
      }
      <form class="panel__form" novalidate (submit)="$event.preventDefault(); evaluate()">
        <div class="panel__pair">
          <app-form-field label="Persona" [required]="true" [errorMessage]="problem('userId')">
            <app-select
              ariaLabel="Persona"
              placeholder="Elegir una persona"
              data-testid="portal-simulator-user"
              [searchable]="true"
              [options]="userOptions()"
              [(value)]="userId"
            />
          </app-form-field>
          <app-form-field label="Organización" [required]="true" [errorMessage]="problem('tenantId')">
            <app-select
              ariaLabel="Organización"
              placeholder="Elegir una organización"
              data-testid="portal-simulator-tenant"
              [searchable]="true"
              [options]="tenantOptions()"
              [(value)]="tenantId"
            />
          </app-form-field>
        </div>
        <div class="panel__pair">
          <app-form-field label="Acción" [required]="true">
            <app-select ariaLabel="Acción" data-testid="portal-simulator-action" [options]="actionOptions" [(value)]="action" />
          </app-form-field>
          <app-form-field label="Recurso" [required]="true" [errorMessage]="problem('resource')" hint="Tiene que casar con el recurso de un permiso.">
            <app-select
              ariaLabel="Recurso"
              placeholder="Elegir un recurso"
              data-testid="portal-simulator-resource"
              [searchable]="true"
              [options]="resourceOptions()"
              [(value)]="resource"
            />
          </app-form-field>
        </div>
        <details class="simulator__more">
          <summary>Más contexto (opcional)</summary>
          <div class="panel__pair">
            <app-form-field label="Tipo de recurso concreto">
              <app-select ariaLabel="Tipo de recurso concreto" [options]="kindOptions" [(value)]="resourceType" />
            </app-form-field>
            <app-form-field label="Identificador del recurso" [errorMessage]="problem('resourceId')">
              <app-input ariaLabel="Identificador del recurso" [(value)]="resourceId" />
            </app-form-field>
            <app-form-field label="Perfil de paciente" [errorMessage]="problem('patientProfileId')">
              <app-input ariaLabel="Perfil de paciente" [(value)]="patientProfileId" />
            </app-form-field>
            <app-form-field label="Perfil de profesional" [errorMessage]="problem('practitionerProfileId')">
              <app-input ariaLabel="Perfil de profesional" [(value)]="practitionerProfileId" />
            </app-form-field>
            <app-form-field label="Propósito de uso">
              <app-select ariaLabel="Propósito de uso" [options]="purposeOptions" [(value)]="purpose" />
            </app-form-field>
          </div>
        </details>
        <div class="panel__actions">
          <button app-button variant="primary" data-testid="portal-simulator-run" [isLoading]="running()" (clicked)="evaluate()">
            Simular la decisión
          </button>
        </div>
      </form>

      @if (result(); as r) {
        <section class="panel__item" aria-live="polite" data-testid="portal-simulator-result">
          <div class="panel__badges">
            <app-badge [variant]="r.decision === 'PERMIT' ? 'success' : 'error'" data-testid="portal-simulator-decision">
              {{ r.decision === 'PERMIT' ? 'Permitido' : 'Denegado' }}
            </app-badge>
            @if (r.purposeOfUse) {
              <app-badge size="sm" variant="secondary">Propósito: {{ purposeText(r.purposeOfUse) }}</app-badge>
            }
          </div>
          <p class="simulator__reason">{{ r.reason }}</p>
          <h3 class="simulator__title">Roles que pesaron</h3>
          @if (r.effectiveRoleIds.length === 0) {
            <p class="panel__note">Ningún rol efectivo: la persona no tiene un rol vigente en esa organización.</p>
          } @else {
            <ul class="simulator__list">
              @for (id of r.effectiveRoleIds; track id) {
                <li>{{ roleName(id) }}</li>
              }
            </ul>
          }
          <h3 class="simulator__title">Campos enmascarados en la respuesta</h3>
          @if (r.maskedFields.length === 0) {
            <p class="panel__note">Ninguno: todos los campos viajan sin enmascarar.</p>
          } @else {
            <ul class="simulator__list" data-testid="portal-simulator-masked">
              @for (f of r.maskedFields; track f.entity + f.columnName) {
                <li>
                  <code class="panel__code">{{ f.entity }}.{{ f.columnName }}</code>
                  <app-badge size="sm" [variant]="mask(f.strategy).tone">{{ mask(f.strategy).label }}</app-badge>
                </li>
              }
            </ul>
          }
          <p class="panel__secondary">Válida {{ r.ttlSeconds }} s en la caché del PDP.</p>
        </section>
      }
    </div>
  `,
  styleUrl: '../permissions-panel.css',
  styles: `
    .simulator__more {
      border: 1px solid var(--border-default);
      border-radius: var(--r-md);
      padding: var(--sp-3);
    }
    .simulator__more summary {
      cursor: pointer;
      font-weight: 600;
    }
    .simulator__reason {
      margin: 0;
    }
    .simulator__title {
      margin: 0;
      font-size: var(--fs-body);
      font-weight: 600;
    }
    .simulator__list {
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
      margin: 0;
      padding-inline-start: var(--sp-4);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DecisionSimulator {
  private readonly authz = inject(AuthzAdminClient);
  private readonly governance = inject(AuthzGovernanceClient);
  private readonly directory = inject(DirectoryClient);
  private readonly session = inject(SessionStore);

  protected readonly actionOptions = ACTION_OPTIONS;
  protected readonly kindOptions = KIND_OPTIONS;
  protected readonly purposeOptions = PURPOSE_OPTIONS;
  protected readonly userId = signal<string | null>(null);
  protected readonly tenantId = signal<string | null>(null);
  protected readonly action = signal<string | null>('READ');
  protected readonly resource = signal<string | null>(null);
  protected readonly resourceType = signal<string | null>(NONE);
  protected readonly resourceId = signal<string | number | null>('');
  protected readonly patientProfileId = signal<string | number | null>('');
  protected readonly practitionerProfileId = signal<string | number | null>('');
  protected readonly purpose = signal<string | null>(NONE);

  protected readonly running = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<DecisionResult | null>(null);
  protected readonly sourcesUnavailable = signal(false);
  protected readonly mask = maskLabel;

  private readonly users = signal<readonly InternalUser[]>([]);
  private readonly tenants = signal<readonly TenantListItem[]>([]);
  private readonly resources = signal<readonly string[]>([]);
  private readonly roles = signal<readonly AssignableRole[]>([]);
  private readonly submitted = signal(false);
  private readonly server = signal<Readonly<Record<string, string>>>({});

  protected readonly userOptions = computed<readonly SelectOption<string>[]>(() =>
    this.users().map((u) => ({ value: u.id, label: u.displayName })),
  );
  protected readonly tenantOptions = computed<readonly SelectOption<string>[]>(() => {
    const active = this.session.activeTenantId();
    const named = this.tenants().map((t) => ({
      value: t.id,
      label: t.id === active ? `${t.tradeName ?? t.legalName} (la de su sesión)` : (t.tradeName ?? t.legalName),
    }));
    return [...named.filter((o) => o.value === active), ...named.filter((o) => o.value !== active)];
  });
  protected readonly resourceOptions = computed<readonly SelectOption<string>[]>(() =>
    this.resources().map((r) => ({ value: r, label: r })),
  );

  private readonly local = computed<Readonly<Record<string, string>>>(() => {
    const out: Record<string, string> = {};
    if (this.userId() === null) out['userId'] = 'Elija la persona.';
    if (this.tenantId() === null) out['tenantId'] = 'Elija la organización.';
    if (this.resource() === null) out['resource'] = 'Elija el recurso.';
    for (const [key, value] of [
      ['resourceId', this.resourceId()],
      ['patientProfileId', this.patientProfileId()],
      ['practitionerProfileId', this.practitionerProfileId()],
    ] as const) {
      const text = String(value ?? '').trim();
      if (text !== '' && !UUID.test(text)) out[key] = 'Escriba un UUID válido.';
    }
    return out;
  });

  private readonly subscriptions: Subscription[] = [];

  constructor() {
    inject(DestroyRef).onDestroy(() => this.subscriptions.forEach((s) => s.unsubscribe()));
    this.subscriptions.push(
      this.authz.internalUsers({ limit: 200 }).subscribe({
        next: (page) => this.users.set([...page.items].sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))),
        error: () => this.sourcesUnavailable.set(true),
      }),
      this.directory.searchTenants({ limit: 100 }).subscribe({
        next: (page) => {
          this.tenants.set(page.items);
          this.tenantId.update((current) => current ?? this.session.activeTenantId());
        },
        error: () => this.sourcesUnavailable.set(true),
      }),
      readWholeCatalog(this.authz).subscribe({
        next: (read) => this.resources.set([...new Set(read.items.map((p) => p.resource))].sort()),
        error: () => this.sourcesUnavailable.set(true),
      }),
      this.authz.assignableRoles().subscribe({ next: (r) => this.roles.set([...r].sort(byName)), error: () => undefined }),
    );
  }

  protected problem(field: string): string {
    return this.server()[field] ?? (this.submitted() ? (this.local()[field] ?? '') : '');
  }

  protected roleName(id: string): string {
    const role = this.roles().find((r) => r.id === id);
    return role ? `${role.name} · ${role.code}` : `Rol ${id.slice(0, 8)}…`;
  }

  protected purposeText(code: string): string {
    return purposeLabel(code).label;
  }

  protected evaluate(): void {
    this.submitted.set(true);
    this.server.set({});
    if (Object.keys(this.local()).length > 0) return;
    const text = (v: string | number | null): string => String(v ?? '').trim();
    const request: DecisionRequest = {
      userId: this.userId()!,
      tenantId: this.tenantId()!,
      action: this.action() as PermissionActionInput,
      resource: this.resource()!,
      ...(this.resourceType() ? { resourceType: this.resourceType() as ScopeResourceType } : {}),
      ...(text(this.resourceId()) ? { resourceId: text(this.resourceId()) } : {}),
      ...(text(this.patientProfileId()) ? { patientProfileId: text(this.patientProfileId()) } : {}),
      ...(text(this.practitionerProfileId()) ? { practitionerProfileId: text(this.practitionerProfileId()) } : {}),
      ...(this.purpose() ? { purposeOfUse: this.purpose() as DecisionPurpose } : {}),
    };
    this.running.set(true);
    this.error.set(null);
    this.subscriptions.push(
      this.governance.simulate(request).subscribe({
        next: ({ decision }) => {
          this.running.set(false);
          this.result.set(decision);
        },
        // Un resultado viejo junto a un error nuevo se leería como la respuesta a esta pregunta.
        error: (e: unknown) => {
          this.running.set(false);
          this.result.set(null);
          this.server.set(fieldErrorsOf(e));
          this.error.set(governanceFailure(e, 'No se pudo consultar al motor de decisiones. Intente de nuevo.'));
        },
      }),
    );
  }
}

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
} from '@angular/core';
import type { Subscription } from 'rxjs';

import { AuthzGovernanceClient } from '../../../../../core/data-access/authz-governance/authz-governance.client';
import {
  MASK_STRATEGIES,
  type FieldPermission,
  type MaskStrategy,
} from '../../../../../core/data-access/authz-governance/authz-governance.types';
import { fieldErrorsOf } from '../../../../../core/http/api-failure';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';
import { governanceFailure, maskLabel, optionsOf } from '../permissions-labels';

const NO_MASK = '';
const MAX = 150;
const MASK_OPTIONS: readonly SelectOption<string>[] = [
  { value: NO_MASK, label: 'Sin enmascarar' },
  ...optionsOf(MASK_STRATEGIES, (c) => maskLabel(c)),
];

/**
 * Agrega o cambia una regla de campo de un rol (`PUT …/field-permissions` es un
 * upsert por entidad y columna). Escribir exige poder leer: se avisa en el
 * formulario antes de mandarlo, y si aun así la API lo rechaza se explica.
 */
@Component({
  selector: 'app-portal-field-rule-dialog',
  imports: [AppButton, Input, Select, Switch, Alert, FormField, ContentDialog],
  template: `
    <app-content-dialog
      [heading]="editing() ? 'Cambiar la regla de un campo' : 'Agregar la regla de un campo'"
      [description]="'Rol ' + roleName() + '. Si ya hay una regla para esa entidad y columna, se reemplaza.'"
      [dismissible]="!saving()"
      (closed)="closed.emit()"
    >
      @if (error(); as message) {
        <app-alert tone="error" data-testid="field-rule-error">{{ message }}</app-alert>
      }
      <form class="panel__form" novalidate (submit)="$event.preventDefault(); save()">
        <div class="panel__pair">
          <app-form-field label="Entidad" [required]="true" [errorMessage]="problem('entity')" hint="La tabla o recurso, p. ej. patient_profile.">
            <app-input ariaLabel="Entidad" data-testid="field-rule-entity" [readonly]="editing()" [(value)]="entity" />
          </app-form-field>
          <app-form-field label="Columna" [required]="true" [errorMessage]="problem('columnName')" hint="El campo dentro de la entidad.">
            <app-input ariaLabel="Columna" data-testid="field-rule-column" [readonly]="editing()" [(value)]="column" />
          </app-form-field>
        </div>
        <app-switch label="Puede leerlo" [(checked)]="canRead" />
        <app-form-field label="Escritura" [errorMessage]="problem('canWrite')">
          <app-switch label="Puede escribirlo" [(checked)]="canWrite" />
        </app-form-field>
        <app-form-field label="Enmascaramiento" hint="Cómo se le muestra el valor cuando no puede verlo entero.">
          <app-select ariaLabel="Enmascaramiento" [options]="maskOptions" [(value)]="mask" />
        </app-form-field>
      </form>
      <div dialog-actions class="panel__actions">
        <button app-button variant="ghost" [disabled]="saving()" (clicked)="closed.emit()">Cancelar</button>
        <button app-button variant="primary" data-testid="field-rule-save" [isLoading]="saving()" (clicked)="save()">
          Guardar regla
        </button>
      </div>
    </app-content-dialog>
  `,
  styleUrl: '../permissions-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldRuleDialog {
  private readonly governance = inject(AuthzGovernanceClient);

  readonly roleId = input.required<string>();
  readonly roleName = input.required<string>();
  /** La regla que se cambia; sin ella, una nueva. */
  readonly rule = input<FieldPermission | null>(null);
  readonly savedRule = output<string>();
  readonly closed = output<void>();

  protected readonly maskOptions = MASK_OPTIONS;
  protected readonly entity = signal<string | number | null>('');
  protected readonly column = signal<string | number | null>('');
  protected readonly canRead = signal(true);
  protected readonly canWrite = signal(false);
  protected readonly mask = signal<string | null>(NO_MASK);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly submitted = signal(false);
  private readonly server = signal<Readonly<Record<string, string>>>({});
  protected readonly editing = computed(() => this.rule() !== null);

  private readonly local = computed<Readonly<Record<string, string>>>(() => {
    const out: Record<string, string> = {};
    const entity = String(this.entity() ?? '').trim();
    const column = String(this.column() ?? '').trim();
    if (entity === '') out['entity'] = 'Indique la entidad.';
    else if (entity.length > MAX) out['entity'] = `Hasta ${MAX} caracteres.`;
    if (column === '') out['columnName'] = 'Indique la columna.';
    else if (column.length > MAX) out['columnName'] = `Hasta ${MAX} caracteres.`;
    if (this.canWrite() && !this.canRead()) out['canWrite'] = 'Para poder escribir un campo tiene que poder leerlo.';
    return out;
  });

  private subscription: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe());
    // El diálogo se monta con la regla ya elegida: se vuelca una sola vez.
    effect(() => {
      const rule = this.rule();
      if (rule === null) return;
      untracked(() => {
        this.entity.set(rule.entity);
        this.column.set(rule.columnName);
        this.canRead.set(rule.canRead);
        this.canWrite.set(rule.canWrite);
        this.mask.set(rule.maskStrategy ?? NO_MASK);
      });
    });
  }

  /** El aviso de escribir sin leer se da apenas ocurre; el resto, al intentar guardar. */
  protected problem(field: string): string {
    return this.server()[field] ?? (this.submitted() || field === 'canWrite' ? (this.local()[field] ?? '') : '');
  }

  protected save(): void {
    this.submitted.set(true);
    this.server.set({});
    if (Object.keys(this.local()).length > 0) return;
    this.saving.set(true);
    this.error.set(null);
    const mask = this.mask();
    this.subscription = this.governance
      .setFieldPermissions(this.roleId(), [
        {
          entity: String(this.entity()).trim(),
          columnName: String(this.column()).trim(),
          canRead: this.canRead(),
          canWrite: this.canWrite(),
          ...(mask ? { maskStrategy: mask as MaskStrategy } : {}),
        },
      ])
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.savedRule.emit(`Se guardó la regla de ${String(this.entity()).trim()}.${String(this.column()).trim()}.`);
        },
        // Lo escrito se conserva: el diálogo sigue abierto con los mismos valores.
        error: (e: unknown) => {
          this.saving.set(false);
          this.server.set(fieldErrorsOf(e));
          this.error.set(governanceFailure(e, 'No se pudo guardar la regla. Lo que escribió sigue acá.'));
        },
      });
  }
}

import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, model, signal } from '@angular/core';

import { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import type { UiRuleSubjectType } from '../../../../../core/data-access/ui-visibility/ui-visibility.types';
import {
  TENANT_TYPE_CODES,
  TENANT_TYPE_LABELS,
} from '../../../../../core/data-access/directory/directory.types';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { SPECIFICITY_HINT, SUBJECT_TYPES, optionsOf, subjectTypeLabel } from '../visibility-labels';

const TYPE_OPTIONS = optionsOf(SUBJECT_TYPES, (t) => subjectTypeLabel(t).label);

/** Lo que pide el identificador de cada tipo de sujeto, dicho en palabras. */
const ID_COPY: Readonly<Record<Exclude<UiRuleSubjectType, 'ALL'>, { label: string; hint: string }>> = {
  USER: { label: 'Identificador de la persona', hint: 'El id (uuid) de la cuenta, como figura en «Usuarios y roles».' },
  TENANT: { label: 'Identificador de la organización', hint: 'El id (uuid) de la organización.' },
  ROLE: { label: 'Rol', hint: 'El rol activo de la persona. Si tiene varios, «Oculta» de cualquiera gana.' },
  ORG_TYPE: { label: 'Tipo de organización', hint: 'Aplica a toda organización de ese tipo.' },
};

/**
 * A quién se aplica una regla: el tipo de sujeto y, salvo en «Todos», cuál. Rol y tipo de
 * organización se eligen de una lista; persona y organización llevan su identificador.
 * Es presentacional: el tipo y el identificador viven en quien lo usa.
 */
@Component({
  selector: 'app-visibility-subject-fields',
  imports: [Input, Select, FormField],
  template: `
    <div class="vis__pair">
      <app-form-field label="Se aplica a" [required]="true" [hint]="specificity">
        <app-select ariaLabel="Se aplica a" [options]="typeOptions" [value]="type()" (valueChange)="changeType($event)" />
      </app-form-field>
      @if (copy(); as c) {
        <app-form-field [label]="c.label" [required]="true" [hint]="c.hint" [errorMessage]="errorMessage()">
          @if (listed(); as options) {
            <app-select
              [ariaLabel]="c.label"
              [options]="options"
              [value]="subjectId() === '' ? null : subjectId()"
              (valueChange)="subjectId.set($event ?? '')"
            />
          } @else {
            <app-input
              [ariaLabel]="c.label"
              testId="subject-id"
              [value]="subjectId()"
              (valueChange)="subjectId.set(String($event ?? ''))"
            />
          }
        </app-form-field>
      }
    </div>
  `,
  styleUrl: '../visibility-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubjectFields {
  private readonly authz = inject(AuthzAdminClient);

  readonly type = model<string | null>('ALL');
  readonly subjectId = model<string>('');
  readonly errorMessage = input<string>('');

  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly specificity = SPECIFICITY_HINT;
  private readonly roles = signal<readonly SelectOption<string>[] | null>(null);

  protected readonly copy = computed(() => {
    const t = this.type() as UiRuleSubjectType | null;
    return t === null || t === 'ALL' ? null : (ID_COPY[t] ?? null);
  });

  /** Las opciones de un sujeto que se elige de una lista; `null` si se escribe. */
  protected readonly listed = computed<readonly SelectOption<string>[] | null>(() => {
    if (this.type() === 'ORG_TYPE') {
      return optionsOf(TENANT_TYPE_CODES, (c) => `${TENANT_TYPE_LABELS[c]} (${c})`);
    }
    return this.type() === 'ROLE' ? this.roles() : null;
  });

  protected readonly String = String;

  constructor() {
    const subscription = this.authz.assignableRoles().subscribe({
      next: (roles) =>
        this.roles.set(roles.length === 0 ? null : roles.map((r) => ({ value: r.code, label: `${r.name} (${r.code})` }))),
      // Sin lista de roles se escribe el código: la regla igual se puede crear.
      error: () => this.roles.set(null),
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  protected changeType(value: string | null): void {
    this.type.set(value);
    this.subjectId.set('');
  }
}

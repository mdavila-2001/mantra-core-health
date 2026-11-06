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

import { UiVisibilityAdminClient } from '../../../../../core/data-access/ui-visibility/ui-visibility-admin.client';
import type {
  UiRuleEffect,
  UiRuleSubjectType,
  UiVisibilityRule,
} from '../../../../../core/data-access/ui-visibility/ui-visibility.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { UiElementIndex } from '../element-index';
import { dayToIso, visibilityFailure, visibilityFieldErrors } from '../visibility-labels';
import { SubjectFields } from './subject-fields';

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RE_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
export const REASON_MIN = 10;
export const REASON_MAX = 500;

export const EFFECT_OPTIONS: readonly SelectOption<string>[] = [
  { value: 'HIDE', label: 'Ocultar', description: 'Deja de presentarse en la interfaz.' },
  { value: 'SHOW', label: 'Mostrar', description: 'Se presenta aunque una regla menos específica lo oculte.' },
];

/** Los errores locales de un sujeto, con el mismo criterio que la API (422 `UI_RULE_INVALID_SUBJECT`). */
export function subjectProblem(type: string | null, id: string): string {
  if (type === 'ALL') return '';
  const value = id.trim();
  if (value === '') return 'Indique a quién se aplica.';
  if ((type === 'USER' || type === 'TENANT') && !RE_UUID.test(value)) return 'Tiene que ser un identificador válido (uuid).';
  if ((type === 'ROLE' || type === 'ORG_TYPE') && !RE_CODE.test(value)) return 'Tiene que ser un código en mayúsculas, p. ej. PHARMACY_STAFF.';
  return '';
}

/**
 * Crea una regla de visibilidad (`POST /admin/ui-visibility/rules`). El elemento se elige por su
 * ruta jerárquica (no por una clave suelta); el motivo es obligatorio y queda en la auditoría.
 * Valida lo mismo que la API; lo que ella rechaza vuelve al campo que corresponde y lo escrito
 * se conserva. El botón se bloquea mientras envía: no hay doble envío.
 */
@Component({
  selector: 'app-visibility-rule-form',
  imports: [AppButton, Input, Select, Textarea, Alert, FormField, SubjectFields],
  template: `
    @if (index.state().status === 'error') {
      <app-alert tone="error" data-testid="rule-form-index-error">
        No se pudo leer el catálogo de elementos, así que no se puede elegir uno.
        <button alert-actions app-button size="sm" variant="secondary" (clicked)="index.load()">Reintentar</button>
      </app-alert>
    }
    @if (error(); as message) {
      <app-alert tone="error" data-testid="rule-form-error">{{ message }}</app-alert>
    }
    <form class="vis__form" novalidate data-testid="rule-form" (submit)="$event.preventDefault(); save()">
      <app-form-field
        label="Elemento"
        [required]="true"
        [errorMessage]="problem('elementKey')"
        hint="Se muestra con su ruta: módulo › pantalla › elemento. Ocultar un padre oculta a todos sus hijos."
      >
        <app-select
          ariaLabel="Elemento"
          [options]="index.options()"
          [searchable]="true"
          [value]="elementKey()"
          (valueChange)="elementKey.set($event)"
        />
      </app-form-field>
      <app-form-field label="Qué hace" [required]="true" [errorMessage]="problem('effect')">
        <app-select ariaLabel="Qué hace" [options]="effects" [(value)]="effect" />
      </app-form-field>
      <app-visibility-subject-fields
        [(type)]="subjectType"
        [(subjectId)]="subjectId"
        [errorMessage]="problem('subjectId')"
      />
      <div class="vis__pair">
        <app-form-field
          label="Desde"
          [errorMessage]="problem('validFrom')"
          hint="Opcional. Rige desde el comienzo de ese día. Sin fecha, rige ya."
        >
          <app-input type="date" ariaLabel="Desde" testId="rule-form-from" [(value)]="validFrom" />
        </app-form-field>
        <app-form-field
          label="Hasta"
          [errorMessage]="problem('validTo')"
          hint="Opcional. Rige hasta el final de ese día. Sin fecha, rige hasta que se la termine."
        >
          <app-input type="date" ariaLabel="Hasta" testId="rule-form-to" [(value)]="validTo" />
        </app-form-field>
      </div>
      <app-form-field
        label="Motivo"
        [required]="true"
        [errorMessage]="problem('reason')"
        [hint]="'De ' + min + ' a ' + max + ' caracteres. Queda en la auditoría junto a su autor.'"
      >
        <app-textarea [rows]="3" [maxLength]="max" [(value)]="reason" />
      </app-form-field>
      <div class="vis__actions">
        <button app-button variant="ghost" [disabled]="saving()" (clicked)="reset()">Limpiar</button>
        <button app-button variant="primary" type="submit" data-testid="rule-form-save" [isLoading]="saving()" [disabled]="saving()">
          Crear regla
        </button>
      </div>
    </form>
  `,
  styleUrl: '../visibility-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleFormPanel {
  private readonly client = inject(UiVisibilityAdminClient);
  protected readonly index = inject(UiElementIndex);

  /** El elemento con que se abre (viene de «Reglas» del catálogo o de la URL). */
  readonly presetElement = input<string>('');
  readonly created = output<UiVisibilityRule>();

  protected readonly effects = EFFECT_OPTIONS;
  protected readonly min = REASON_MIN;
  protected readonly max = REASON_MAX;
  protected readonly elementKey = signal<string | null>(null);
  protected readonly effect = signal<string | null>('HIDE');
  protected readonly subjectType = signal<string | null>('ALL');
  protected readonly subjectId = signal('');
  protected readonly validFrom = signal<string | number | null>('');
  protected readonly validTo = signal<string | number | null>('');
  protected readonly reason = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly submitted = signal(false);
  private readonly server = signal<Readonly<Record<string, string>>>({});

  private readonly local = computed<Readonly<Record<string, string>>>(() => {
    const out: Record<string, string> = {};
    if (this.elementKey() === null || this.elementKey() === '') out['elementKey'] = 'Elija el elemento.';
    if (this.effect() !== 'HIDE' && this.effect() !== 'SHOW') out['effect'] = 'Elija qué hace la regla.';
    const subject = subjectProblem(this.subjectType(), this.subjectId());
    if (subject !== '') out['subjectId'] = subject;
    const from = String(this.validFrom() ?? '');
    const to = String(this.validTo() ?? '');
    if (from !== '' && dayToIso(from, 'start') === null) out['validFrom'] = 'La fecha no es válida.';
    if (to !== '' && dayToIso(to, 'end') === null) out['validTo'] = 'La fecha no es válida.';
    if (from !== '' && to !== '' && out['validFrom'] === undefined && out['validTo'] === undefined && to < from) {
      out['validTo'] = 'El fin tiene que ser el mismo día del inicio o posterior.';
    }
    const reason = this.reason().trim();
    if (reason.length < REASON_MIN) out['reason'] = `Escriba el motivo (al menos ${REASON_MIN} caracteres).`;
    else if (reason.length > REASON_MAX) out['reason'] = `Hasta ${REASON_MAX} caracteres.`;
    return out;
  });

  private subscription: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe());
    effect(() => {
      const preset = this.presetElement();
      untracked(() => {
        if (preset !== '') this.elementKey.set(preset);
      });
    });
  }

  protected problem(field: string): string {
    return this.server()[field] ?? (this.submitted() ? (this.local()[field] ?? '') : '');
  }

  protected reset(): void {
    this.elementKey.set(this.presetElement() === '' ? null : this.presetElement());
    this.effect.set('HIDE');
    this.subjectType.set('ALL');
    this.subjectId.set('');
    this.validFrom.set('');
    this.validTo.set('');
    this.reason.set('');
    this.submitted.set(false);
    this.server.set({});
    this.error.set(null);
  }

  protected save(): void {
    if (this.saving()) return;
    this.submitted.set(true);
    this.server.set({});
    this.error.set(null);
    if (Object.keys(this.local()).length > 0) return;
    this.saving.set(true);
    const type = this.subjectType() as UiRuleSubjectType;
    const from = String(this.validFrom() ?? '');
    const to = String(this.validTo() ?? '');
    this.subscription = this.client
      .createRule({
        elementKey: this.elementKey()!,
        effect: this.effect() as UiRuleEffect,
        subjectType: type,
        subjectId: type === 'ALL' ? null : this.subjectId().trim(),
        validFrom: from === '' ? null : dayToIso(from, 'start'),
        validTo: to === '' ? null : dayToIso(to, 'end'),
        reason: this.reason().trim(),
      })
      .subscribe({
        next: (rule) => {
          this.saving.set(false);
          this.reset();
          this.created.emit(rule);
        },
        // Lo escrito se conserva: el formulario sigue con los mismos valores.
        error: (e: unknown) => {
          this.saving.set(false);
          this.server.set(visibilityFieldErrors(e));
          this.error.set(visibilityFailure(e, 'No se pudo crear la regla. Lo que escribió sigue acá.'));
        },
      });
  }
}

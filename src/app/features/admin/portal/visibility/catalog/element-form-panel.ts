import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import type { Subscription } from 'rxjs';

import { UiVisibilityAdminClient } from '../../../../../core/data-access/ui-visibility/ui-visibility-admin.client';
import type {
  UiElement,
  UiElementKind,
} from '../../../../../core/data-access/ui-visibility/ui-visibility.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../../../shared/components/atoms/switch/switch';
import { Textarea } from '../../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { UiElementIndex } from '../element-index';
import { KINDS, kindLabel, optionsOf, visibilityFailure, visibilityFieldErrors } from '../visibility-labels';

const RE_KEY = /^[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*$/;
const RE_MODULE = /^[a-z][a-z0-9-]{1,39}$/;
const NO_PARENT = '';
const KIND_OPTIONS = optionsOf(KINDS, (k) => kindLabel(k).label);

/**
 * Alta manual de un elemento del catálogo (`POST /admin/ui-visibility/elements`, queda como
 * `ADMIN`). Valida lo mismo que la API antes de enviar; lo que la API rechaza vuelve al campo
 * que corresponde, y lo escrito se conserva si falla. El botón se bloquea mientras envía.
 */
@Component({
  selector: 'app-visibility-element-form',
  imports: [AppButton, Input, Select, Switch, Textarea, Alert, FormField],
  template: `
    @if (error(); as message) {
      <app-alert tone="error" data-testid="element-form-error">{{ message }}</app-alert>
    }
    <form class="vis__form" novalidate data-testid="element-form" (submit)="$event.preventDefault(); save()">
      <div class="vis__pair">
        <app-form-field
          label="Módulo"
          [required]="true"
          [errorMessage]="problem('moduleCode')"
          hint="Código en minúsculas, p. ej. pharmacy. Es la primera parte de la clave."
        >
          <app-input ariaLabel="Módulo" testId="element-form-module" [(value)]="moduleCode" />
        </app-form-field>
        <app-form-field label="Tipo" [required]="true" [errorMessage]="problem('kind')">
          <app-select ariaLabel="Tipo" [options]="kindOptions" [(value)]="kind" />
        </app-form-field>
      </div>
      <app-form-field
        label="Elemento superior"
        hint="Si lo oculta una regla, este elemento queda oculto también."
        [errorMessage]="problem('parentKey')"
      >
        <app-select
          ariaLabel="Elemento superior"
          [options]="parentOptions()"
          [value]="parentKey()"
          (valueChange)="chooseParent($event)"
        />
      </app-form-field>
      <app-form-field
        label="Clave"
        [required]="true"
        [errorMessage]="problem('key')"
        hint="Minúsculas y puntos: módulo.pantalla.elemento, p. ej. pharmacy.orders.export-button. No cambia nunca."
      >
        <app-input ariaLabel="Clave" testId="element-form-key" [(value)]="key" />
      </app-form-field>
      <app-form-field label="Nombre" [required]="true" [errorMessage]="problem('label')" hint="Lo que verá quien administre las reglas.">
        <app-input ariaLabel="Nombre" testId="element-form-label" [(value)]="label" />
      </app-form-field>
      <app-form-field label="Descripción" [errorMessage]="problem('description')" hint="Opcional. Qué es y qué pasa si se oculta.">
        <app-textarea [rows]="3" [maxLength]="300" [(value)]="description" />
      </app-form-field>
      <app-form-field label="Visibilidad por omisión" [errorMessage]="problem('defaultVisible')">
        <app-switch label="Se muestra si ninguna regla dice lo contrario" [(checked)]="defaultVisible" />
      </app-form-field>
      <div class="vis__actions">
        <button app-button variant="ghost" [disabled]="saving()" (clicked)="reset()">Limpiar</button>
        <button app-button variant="primary" type="submit" data-testid="element-form-save" [isLoading]="saving()" [disabled]="saving()">
          Agregar al catálogo
        </button>
      </div>
    </form>
  `,
  styleUrl: '../visibility-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ElementFormPanel {
  private readonly client = inject(UiVisibilityAdminClient);
  private readonly index = inject(UiElementIndex);
  readonly created = output<UiElement>();

  protected readonly kindOptions = KIND_OPTIONS;
  protected readonly moduleCode = signal<string | number | null>('');
  protected readonly kind = signal<string | null>('SCREEN');
  protected readonly parentKey = signal<string | null>(NO_PARENT);
  protected readonly key = signal<string | number | null>('');
  protected readonly label = signal<string | number | null>('');
  protected readonly description = signal('');
  protected readonly defaultVisible = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly submitted = signal(false);
  private readonly server = signal<Readonly<Record<string, string>>>({});

  protected readonly parentOptions = computed<readonly SelectOption<string>[]>(() => [
    { value: NO_PARENT, label: 'Sin elemento superior (nivel más alto)' },
    ...this.index.options(),
  ]);

  private readonly local = computed<Readonly<Record<string, string>>>(() => {
    const out: Record<string, string> = {};
    const module = String(this.moduleCode() ?? '').trim();
    const key = String(this.key() ?? '').trim();
    const label = String(this.label() ?? '').trim();
    if (!RE_MODULE.test(module)) out['moduleCode'] = 'Use minúsculas, números o guiones (2 a 40 caracteres).';
    if (key === '' || !RE_KEY.test(key) || key.length > 120) {
      out['key'] = 'Use minúsculas y puntos: módulo.pantalla.elemento (hasta 120 caracteres).';
    } else if (RE_MODULE.test(module) && key !== module && !key.startsWith(`${module}.`)) {
      out['key'] = `La clave tiene que empezar por «${module}.».`;
    }
    if (label === '') out['label'] = 'Indique el nombre.';
    else if (label.length > 120) out['label'] = 'Hasta 120 caracteres.';
    if (this.description().length > 300) out['description'] = 'Hasta 300 caracteres.';
    if (!KINDS.includes(this.kind() as UiElementKind)) out['kind'] = 'Elija el tipo.';
    return out;
  });

  private subscription: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe());
  }

  protected problem(field: string): string {
    return this.server()[field] ?? (this.submitted() ? (this.local()[field] ?? '') : '');
  }

  /** Elegir el superior adelanta el módulo y el comienzo de la clave, sin pisar lo ya escrito. */
  protected chooseParent(value: string | null): void {
    const parent = value ?? NO_PARENT;
    this.parentKey.set(parent);
    const element = parent === NO_PARENT ? undefined : this.index.byKey().get(parent);
    if (element === undefined) return;
    if (String(this.moduleCode() ?? '').trim() === '') this.moduleCode.set(element.moduleCode);
    if (String(this.key() ?? '').trim() === '') this.key.set(`${element.key}.`);
  }

  protected reset(): void {
    this.moduleCode.set('');
    this.kind.set('SCREEN');
    this.parentKey.set(NO_PARENT);
    this.key.set('');
    this.label.set('');
    this.description.set('');
    this.defaultVisible.set(true);
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
    const description = this.description().trim();
    this.subscription = this.client
      .createElement({
        key: String(this.key()).trim(),
        kind: this.kind() as UiElementKind,
        moduleCode: String(this.moduleCode()).trim(),
        parentKey: this.parentKey() === NO_PARENT || this.parentKey() === null ? null : this.parentKey(),
        label: String(this.label()).trim(),
        description: description === '' ? null : description,
        defaultVisible: this.defaultVisible(),
      })
      .subscribe({
        next: (element) => {
          this.saving.set(false);
          this.reset();
          this.created.emit(element);
        },
        // Lo escrito se conserva: el formulario sigue con los mismos valores.
        error: (e: unknown) => {
          this.saving.set(false);
          this.server.set(visibilityFieldErrors(e));
          this.error.set(visibilityFailure(e, 'No se pudo agregar el elemento. Lo que escribió sigue acá.'));
        },
      });
  }
}

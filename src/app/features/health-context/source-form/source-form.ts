import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { HealthContextClient } from '../../../core/data-access/health-context/health-context.client';
import type { SourceCreated } from '../../../core/data-access/health-context/health-context.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

/**
 * Alta de una fuente (V44-09, `POST /health-context/sources`).
 *
 * La fuente es de dónde sale el dato, y sus dos campos de gobierno no son
 * decoración: **la confianza gobierna qué se acepta** y **la licencia queda
 * registrada con ella** — sin esas dos cosas no se puede defender de dónde
 * salió un dato ni con qué derecho se usa.
 */
@Component({
  selector: 'app-source-form',
  imports: [
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
    Textarea,
  ],
  templateUrl: './source-form.html',
  styleUrl: '../m44.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SourceForm {
  private readonly client = inject(HealthContextClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    sourceTypeConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    trustTierConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    ownerName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(200)],
    }),
    canonicalUrl: new FormControl('', { nonNullable: true }),
    countryConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
  });

  /** El texto de la licencia puede ser largo: va por señal, como cada textarea. */
  protected readonly licenseText = signal('');

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<SourceCreated | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para registrar fuentes.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    const dueno = valores.ownerName.trim();
    const url = valores.canonicalUrl.trim();
    const pais = valores.countryConceptId.trim();
    const licencia = this.licenseText().trim();

    this.state.set(loading());

    this.client
      .createSource({
        code: valores.code.trim(),
        name: valores.name.trim(),
        sourceTypeConceptId: valores.sourceTypeConceptId.trim(),
        trustTierConceptId: valores.trustTierConceptId.trim(),
        ...(dueno === '' ? {} : { ownerName: dueno }),
        ...(url === '' ? {} : { canonicalUrl: url }),
        ...(pais === '' ? {} : { countryConceptId: pais }),
        ...(licencia === '' ? {} : { licenseText: licencia }),
      })
      .subscribe({
        next: (fuente) => {
          this.state.set(ready(null));
          this.created.set(fuente);
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  protected otraAlta(): void {
    this.form.reset();
    this.licenseText.set('');
    this.created.set(null);
    this.state.set(ready(null));
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { HealthContextClient } from '../../../core/data-access/health-context/health-context.client';
import type {
  QualityReviewRecorded,
  ReviewOutcome,
} from '../../../core/data-access/health-context/health-context.types';
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
import { Radio } from '../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../shared/components/molecules/radio-group/radio-group';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, opcionDe, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

const VEREDICTOS: readonly ReviewOutcome[] = ['APPROVED', 'REJECTED'];

/**
 * Registrar una revisión de calidad (V44-06,
 * `POST /health-context/versions/:id/quality-reviews`).
 *
 * La revisión es la compuerta de la publicación: **solo se publica lo
 * aprobado, y un rechazo la bloquea**. Los problemas encontrados van en un
 * objeto JSON libre — el modelo no les declara esquema, y adivinarles campos
 * sería inventar contrato.
 */
@Component({
  selector: 'app-quality-review-form',
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
    Radio,
    RadioGroup,
    Textarea,
  ],
  templateUrl: './quality-review-form.html',
  styleUrl: '../m44.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QualityReviewForm {
  private readonly client = inject(HealthContextClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    versionId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    reviewTypeConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    reviewerAgentId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
  });

  protected readonly outcome = signal<ReviewOutcome | null>(null);
  protected readonly issuesJson = signal('');
  protected readonly notes = signal('');

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly recorded = signal<QualityReviewRecorded | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para registrar revisiones de calidad.'),
  );

  /** Mismo criterio que el contenido extraído de una observación. */
  protected readonly issuesInvalidos = computed(() => {
    const texto = this.issuesJson().trim();
    if (texto === '') {
      return false;
    }
    try {
      const valor: unknown = JSON.parse(texto);
      return typeof valor !== 'object' || valor === null || Array.isArray(valor);
    } catch {
      return true;
    }
  });

  protected elegirVeredicto(valor: unknown): void {
    this.outcome.set(opcionDe(VEREDICTOS, valor));
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const veredicto = this.outcome();
    if (this.form.invalid || veredicto === null || this.issuesInvalidos()) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    const revisor = valores.reviewerAgentId.trim();
    const problemas = this.issuesJson().trim();
    const notas = this.notes().trim();

    this.state.set(loading());

    this.client
      .recordQualityReview(valores.versionId.trim(), {
        reviewTypeConceptId: valores.reviewTypeConceptId.trim(),
        outcome: veredicto,
        ...(revisor === '' ? {} : { reviewerAgentId: revisor }),
        ...(problemas === ''
          ? {}
          : { issuesJson: JSON.parse(problemas) as Record<string, unknown> }),
        ...(notas === '' ? {} : { notes: notas }),
      })
      .subscribe({
        next: (revision) => {
          this.state.set(ready(null));
          this.recorded.set(revision);
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  protected otraRevision(): void {
    this.form.reset();
    this.outcome.set(null);
    this.issuesJson.set('');
    this.notes.set('');
    this.recorded.set(null);
    this.state.set(ready(null));
  }
}

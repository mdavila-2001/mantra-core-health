import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { IdentityAdminClient } from '../../../core/data-access/identity/identity-admin.client';
import type {
  DecidedManualReview,
  ManualReviewDecision,
  ReviewDecision,
} from '../../../core/data-access/identity/identity-admin.types';
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
import {
  errorMessageOf,
  opcionDe,
  UUID_ERROR,
  UUID_HINT,
  UUID_PATTERN,
} from '../../../shared/forms/form-support';

const DECISIONS: readonly ReviewDecision[] = ['APPROVED', 'REJECTED'];

/** Techo del motivo; el DTO declara `MaxLength(500)`. */
const MAX_REASON = 500;

/**
 * Decidir una revisión manual (V27-13,
 * `POST /identity/manual-review/:id/decision`).
 *
 * El veredicto humano del caso: aprobar o rechazar. Arranca sin elegir — la
 * decisión es la esencia del registro y nadie la toma por el revisor. El
 * motivo es opcional para el contrato, pero un rechazo sin motivo es una
 * decisión difícil de auditar: la ayuda del campo lo recuerda.
 */
@Component({
  selector: 'app-review-decision-form',
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
  templateUrl: './review-decision-form.html',
  styleUrl: '../m27-admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewDecisionForm {
  private readonly client = inject(IdentityAdminClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;
  protected readonly maxReason = MAX_REASON;

  protected readonly form = new FormGroup({
    reviewId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    decisionReason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_REASON)],
    }),
  });

  /** Obligatoria por contrato; arranca sin elegir para no decidir por nadie. */
  protected readonly decision = signal<ReviewDecision | null>(null);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly decided = signal<DecidedManualReview | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para administrar la verificación de identidad.'),
  );

  protected elegirDecision(valor: unknown): void {
    this.decision.set(opcionDe(DECISIONS, valor));
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const datos = this.datos();
    if (this.form.invalid || datos === null) {
      this.form.markAllAsTouched();
      return;
    }

    const { reviewId } = this.form.getRawValue();

    this.state.set(loading());

    this.client.decideManualReview(reviewId.trim(), datos).subscribe({
      next: (review) => {
        this.state.set(ready(null));
        this.decided.set(review);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraDecision(): void {
    this.form.reset();
    this.decision.set(null);
    this.decided.set(null);
    this.state.set(ready(null));
  }

  private datos(): ManualReviewDecision | null {
    const decision = this.decision();
    if (decision === null) {
      return null;
    }

    const motivo = this.form.getRawValue().decisionReason.trim();

    return {
      decision,
      ...(motivo === '' ? {} : { decisionReason: motivo }),
    };
  }
}

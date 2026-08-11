import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { IdentityAdminClient } from '../../../core/data-access/identity/identity-admin.client';
import type {
  NewManualReview,
  OpenedManualReview,
} from '../../../core/data-access/identity/identity-admin.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

/**
 * Escalar un caso a revisión manual (V27-07,
 * `POST /identity/verification-cases/:id/manual-review`).
 *
 * La revisión manual es el desvío humano del ciclo: cuando los checks o las
 * señales de fraude no alcanzan para decidir, una persona toma el caso. Sin
 * revisor asignado, el backend se lo queda el propio actor.
 */
@Component({
  selector: 'app-manual-review-form',
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
  ],
  templateUrl: './manual-review-form.html',
  styleUrl: '../m27-admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualReviewForm {
  private readonly client = inject(IdentityAdminClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    caseId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    reviewReasonConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    assignedToUserId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly opened = signal<OpenedManualReview | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para administrar la verificación de identidad.'),
  );

  constructor() {
    // La cola de revisión enlaza acá con `?caseId=`: es lo que evita que quien
    // revisa tenga que copiar un uuid a mano entre dos pantallas. Se lee una
    // sola vez, en la construcción, porque no se vuelve a esta ruta con otro
    // caso sin reconstruir el componente.
    //
    // Llega como texto de una URL, así que se valida antes de escribirlo: un
    // `?caseId=` inventado dejaría el formulario en un estado inválido sin que
    // nadie haya tipeado nada, y el campo queda editable igual.
    const caseId = inject(ActivatedRoute).snapshot.queryParamMap.get('caseId');
    if (caseId !== null && UUID_PATTERN.test(caseId)) {
      this.form.controls.caseId.setValue(caseId);
    }
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { caseId } = this.form.getRawValue();

    this.state.set(loading());

    this.client.openManualReview(caseId.trim(), this.datos()).subscribe({
      next: (review) => {
        this.state.set(ready(null));
        this.opened.set(review);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraRevision(): void {
    this.form.reset();
    this.opened.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewManualReview {
    const valores = this.form.getRawValue();
    const revisor = valores.assignedToUserId.trim();

    return {
      reviewReasonConceptId: valores.reviewReasonConceptId.trim(),
      ...(revisor === '' ? {} : { assignedToUserId: revisor }),
    };
  }
}

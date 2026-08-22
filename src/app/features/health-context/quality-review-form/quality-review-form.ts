import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

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
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import {
  errorMessageOf,
  objetoJson,
  opcionDe,
  UUID_ERROR,
  UUID_HINT,
  UUID_PATTERN,
} from '../../../shared/forms/form-support';

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
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
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

/**
   * El formulario, servido de a una página.
   *
   * El tope de cuatro y la barra de avance los pone el motor; acá sólo se
   * declara qué campo va en qué sección. Las secciones que no entran en una
   * página se parten conservando su nombre.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'Qué se revisa',
      hint: 'La versión tiene que estar en borrador: lo publicado ya pasó por acá.',
      campos: [
        { key: 'versionId', label: 'Identificador de la versión', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'reviewTypeConceptId', label: 'Tipo de revisión', hint: 'Identificador del concepto de tipo (UUID).', control: 'text', required: true, mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'Veredicto',
      hint: 'Un rechazo bloquea la publicación de la versión; los detalles quedan con la revisión.',
      campos: [
        { key: 'outcome', label: 'Resultado', control: 'radio', options: [{ value: 'APPROVED', label: 'Aprobada' }, { value: 'REJECTED', label: 'Rechazada' }], required: true },
        { key: 'reviewerAgentId', label: 'Revisor automatizado', hint: 'Opcional: el agente que corrió la revisión, si no fue una persona (UUID).', control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'issuesJson', label: 'Problemas encontrados', hint: 'Opcional: un objeto JSON con el detalle de lo que falló.', control: 'textarea', mensajeDeError: 'Tiene que ser un objeto JSON válido, como {&quot;faltantes&quot;: 2}.' },
        { key: 'notes', label: 'Notas', hint: 'Opcional: lo que el detalle estructurado no captura.', control: 'textarea' },
      ],
    },
  ]);

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
    outcome: new FormControl<ReviewOutcome | null>(null, {
      validators: [Validators.required],
    }),
    // Mismo criterio que el contenido extraído de una observación: si viene,
    // tiene que ser un objeto JSON. Ahora que vive en el grupo lo aplica el
    // mismo validador que el resto de los campos JSON del proyecto.
    issuesJson: new FormControl('', { nonNullable: true, validators: [objetoJson] }),
    notes: new FormControl('', { nonNullable: true }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly recorded = signal<QualityReviewRecorded | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para registrar revisiones de calidad.'),
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
    // El grupo ya lo exige; se comprueba contra el contrato porque el tipo del
    // control admite `null` y lo que sale de acá es el cuerpo real.
    const veredicto = opcionDe(VEREDICTOS, valores.outcome);
    if (veredicto === null) {
      return;
    }

    const revisor = valores.reviewerAgentId.trim();
    const problemas = valores.issuesJson.trim();
    const notas = valores.notes.trim();

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
    this.recorded.set(null);
    this.state.set(ready(null));
  }
}

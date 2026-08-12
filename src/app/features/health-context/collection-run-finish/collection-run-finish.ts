import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { HealthContextClient } from '../../../core/data-access/health-context/health-context.client';
import type {
  RunFinished,
  RunOutcome,
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
import {
  errorMessageOf,
  objetoJson,
  opcionDe,
  UUID_ERROR,
  UUID_HINT,
  UUID_PATTERN,
} from '../../../shared/forms/form-support';

const RESULTADOS: readonly RunOutcome[] = ['SUCCEEDED', 'PARTIAL', 'FAILED'];

/**
 * Cerrar una corrida de recolección (V44-01·A,
 * `POST /health-context/collection-runs/:id/finish`).
 *
 * La corrida es un log: **se cierra una vez y no se reabre** — repetir el
 * cierre es un 409. Al cerrarla, los contadores se reconcilian contra la tabla
 * de observaciones; los que la corrida llevaba al vuelo dan progreso visible,
 * pero pueden haberse quedado cortos si algo falló a medias. Por eso la
 * respuesta se muestra entera: es la foto auditada, no la optimista.
 *
 * **Una corrida fallida debe declarar qué salió mal**: con `FAILED` el resumen
 * de error se exige acá, antes de gastar la petición.
 */
@Component({
  selector: 'app-collection-run-finish',
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
  templateUrl: './collection-run-finish.html',
  styleUrl: '../m44.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionRunFinish {
  private readonly client = inject(HealthContextClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    collectionRunId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    /** Cursor de continuación para una corrida parcial. JSON o vacío. */
    continuationCursorJson: new FormControl('', {
      nonNullable: true,
      validators: [objetoJson],
    }),
  });

  protected readonly outcome = signal<RunOutcome | null>(null);
  protected readonly errorSummary = signal('');

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly finished = signal<RunFinished | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para cerrar corridas.'),
  );

  /** La regla del modelo: una corrida fallida declara qué salió mal. */
  protected readonly exigeResumenDeError = computed(() => this.outcome() === 'FAILED');

  protected elegirResultado(valor: unknown): void {
    this.outcome.set(opcionDe(RESULTADOS, valor));
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const resultado = this.outcome();
    const resumen = this.errorSummary().trim();
    const faltaResumen = resultado === 'FAILED' && resumen === '';

    if (this.form.invalid || resultado === null || faltaResumen) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    const cursor = valores.continuationCursorJson.trim();

    this.state.set(loading());

    this.client
      .finishCollectionRun(valores.collectionRunId.trim(), {
        outcome: resultado,
        ...(cursor === ''
          ? {}
          : { continuationCursorJson: JSON.parse(cursor) as Record<string, unknown> }),
        ...(resumen === '' ? {} : { errorSummary: resumen }),
      })
      .subscribe({
        next: (cierre) => {
          this.state.set(ready(null));
          this.finished.set(cierre);
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  protected otroCierre(): void {
    this.form.reset();
    this.outcome.set(null);
    this.errorSummary.set('');
    this.finished.set(null);
    this.state.set(ready(null));
  }
}

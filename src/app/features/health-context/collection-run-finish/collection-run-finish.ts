import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';

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
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
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

/**
   * El formulario, servido de a una página, **con la última pregunta condicionada**.
   *
   * El tope de cuatro y la barra de avance los pone el motor. Lo que decide esta
   * pantalla es que el resumen del error cambia de rótulo y de obligatoriedad
   * según el resultado: en una corrida fallida es lo que permite investigarla
   * después, y en las demás es una nota suelta.
   */
  protected readonly paginas = computed(() =>
    paginarCampos([
      {
        titulo: 'Qué corrida',
        hint: 'Una corrida se cierra una sola vez: es un log, no un estado que va y vuelve.',
        campos: [
          {
            key: 'collectionRunId',
            label: 'Identificador de la corrida',
            hint: UUID_HINT,
            control: 'text' as const,
            required: true,
            mensajeDeError: UUID_ERROR,
          },
        ],
      },
      {
        titulo: 'Cómo terminó',
        hint: 'Una corrida fallida tiene que declarar qué salió mal; sin eso el cierre no se puede investigar.',
        campos: [
          {
            key: 'outcome',
            label: 'Resultado',
            control: 'radio' as const,
            required: true,
            options: [
              { value: 'SUCCEEDED', label: 'Completa' },
              { value: 'PARTIAL', label: 'Parcial: quedó trabajo pendiente' },
              { value: 'FAILED', label: 'Fallida' },
            ],
          },
          this.exigeResumenDeError()
            ? {
                key: 'errorSummary',
                label: 'Qué salió mal',
                hint: 'El resumen queda con la corrida: es lo que permite investigar el fallo después.',
                control: 'textarea' as const,
                required: true,
              }
            : {
                key: 'errorSummary',
                label: 'Nota de error',
                hint: 'Opcional salvo en una corrida fallida.',
                control: 'textarea' as const,
              },
          {
            key: 'continuationCursorJson',
            label: 'Cursor de continuación',
            hint: 'Opcional, para una corrida parcial: JSON con el punto desde donde retomar.',
            control: 'text' as const,
            mensajeDeError: 'Tiene que ser un objeto JSON válido, como {"page": 3}.',
          },
        ],
      },
    ]),
  );

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
    outcome: new FormControl<RunOutcome | null>(null, {
      validators: [Validators.required],
    }),
    /**
     * Obligatorio sólo si la corrida falló: la regla cruza dos campos, así que
     * no se declara en el control y se comprueba al enviar.
     */
    errorSummary: new FormControl('', { nonNullable: true }),
  });


  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly finished = signal<RunFinished | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para cerrar corridas.'),
  );

  /** El resultado, como señal, para que las preguntas reaccionen a él. */
  private readonly resultado = toSignal(this.form.controls.outcome.valueChanges, {
    initialValue: this.form.controls.outcome.value,
  });

  /** La regla del modelo: una corrida fallida declara qué salió mal. */
  protected readonly exigeResumenDeError = computed(() => this.resultado() === 'FAILED');

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const valores = this.form.getRawValue();
    const resultado = opcionDe(RESULTADOS, valores.outcome);
    const resumen = valores.errorSummary.trim();
    const faltaResumen = resultado === 'FAILED' && resumen === '';

    if (this.form.invalid || resultado === null || faltaResumen) {
      this.form.markAllAsTouched();
      return;
    }

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
    this.finished.set(null);
    this.state.set(ready(null));
  }
}

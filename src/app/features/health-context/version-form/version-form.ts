import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { HealthContextClient } from '../../../core/data-access/health-context/health-context.client';
import type {
  ContextFact,
  ContextVersionDrafted,
  FactEvidence,
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
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import {
  errorMessageOf,
  NUMBER_STRING_PATTERN,
  objetoJson,
  UUID_ERROR,
  UUID_HINT,
  UUID_PATTERN,
} from '../../../shared/forms/form-support';

type FilaDeEvidencia = FormGroup<{
  sourceObservationId: FormControl<string>;
  relevanceScore: FormControl<string>;
}>;

type FilaDeHecho = FormGroup<{
  factKey: FormControl<string>;
  valueType: FormControl<string>;
  valueJson: FormControl<string>;
  confidenceScore: FormControl<string>;
  evidencias: FormArray<FilaDeEvidencia>;
}>;

function nuevaEvidencia(): FilaDeEvidencia {
  return new FormGroup({
    sourceObservationId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    relevanceScore: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(NUMBER_STRING_PATTERN)],
    }),
  });
}

function nuevoHecho(): FilaDeHecho {
  return new FormGroup({
    factKey: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    valueType: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    valueJson: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, objetoJson],
    }),
    confidenceScore: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(NUMBER_STRING_PATTERN)],
    }),
    // Un hecho sin evidencia retenida se rechaza: nace con una fila y la
    // última no se puede quitar.
    evidencias: new FormArray<FilaDeEvidencia>([nuevaEvidencia()]),
  });
}

/**
 * Redactar una versión de contexto (V44-04,
 * `POST /health-context/contexts/:id/versions`).
 *
 * La pantalla más compuesta del módulo: hechos con **evidencia anidada**. Las
 * reglas del modelo que encarna, y que se validan acá antes de gastar la
 * petición:
 *
 * - **Un hecho sin evidencia retenida se rechaza.** El valor del módulo es
 *   poder decir de dónde salió cada dato, y un hecho huérfano lo destruye.
 *   Cada hecho nace con una fila de evidencia y la última no se puede quitar.
 * - **La evidencia apunta a observaciones aceptadas de la misma corrida** — eso
 *   lo verifica el backend, que es quien tiene la corrida a mano; acá se
 *   garantiza que al menos haya una.
 * - **La versión nace en borrador y no toca la vigente**: publicar es una
 *   decisión aparte que pasa antes por revisión de calidad.
 *
 * Mismo patrón de repetidor que `set-items-editor`, con un nivel más: el
 * latido de versión cubre los dos arrays, porque cualquiera de los dos puede
 * cambiar de tamaño sin que una señal lo note.
 */
@Component({
  selector: 'app-version-form',
  imports: [
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    Card,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
    Textarea,
  ],
  templateUrl: './version-form.html',
  styleUrl: '../m44.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VersionForm {
  private readonly client = inject(HealthContextClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    contextId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    collectionRunId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    contextPayloadJson: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, objetoJson],
    }),
    summary: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
    schemaVersion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(50)],
    }),
  });

  protected readonly hechos = new FormArray<FilaDeHecho>([nuevoHecho()]);

  /** El latido `OnPush` de los dos niveles de repetidor. */
  protected readonly version = signal(0);

  protected readonly hechosVisibles = computed(() => {
    this.version();
    return this.hechos.controls;
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly drafted = signal<ContextVersionDrafted | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para redactar versiones.'),
  );

  protected agregarHecho(): void {
    this.hechos.push(nuevoHecho());
    this.version.update((v) => v + 1);
  }

  protected quitarHecho(indice: number): void {
    if (this.hechos.length <= 1) {
      return;
    }
    this.hechos.removeAt(indice);
    this.version.update((v) => v + 1);
  }

  protected agregarEvidencia(hecho: FilaDeHecho): void {
    hecho.controls.evidencias.push(nuevaEvidencia());
    this.version.update((v) => v + 1);
  }

  protected quitarEvidencia(hecho: FilaDeHecho, indice: number): void {
    if (hecho.controls.evidencias.length <= 1) {
      return;
    }
    hecho.controls.evidencias.removeAt(indice);
    this.version.update((v) => v + 1);
  }

  /** Las evidencias que pinta la vista, enganchadas al mismo latido. */
  protected evidenciasDe(hecho: FilaDeHecho): readonly FilaDeEvidencia[] {
    this.version();
    return hecho.controls.evidencias.controls;
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid || this.hechos.invalid) {
      this.form.markAllAsTouched();
      this.hechos.markAllAsTouched();
      this.version.update((v) => v + 1);
      return;
    }

    const valores = this.form.getRawValue();
    const resumen = valores.summary.trim();
    const esquema = valores.schemaVersion.trim();

    this.state.set(loading());

    this.client
      .draftVersion(valores.contextId.trim(), {
        collectionRunId: valores.collectionRunId.trim(),
        contextPayloadJson: JSON.parse(valores.contextPayloadJson) as Record<string, unknown>,
        facts: this.hechos.controls.map((hecho) => aHecho(hecho)),
        ...(resumen === '' ? {} : { summary: resumen }),
        ...(esquema === '' ? {} : { schemaVersion: esquema }),
      })
      .subscribe({
        next: (borrador) => {
          this.state.set(ready(null));
          this.drafted.set(borrador);
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  protected otraVersion(): void {
    this.form.reset();
    while (this.hechos.length > 1) {
      this.hechos.removeAt(this.hechos.length - 1);
    }
    this.hechos.clear();
    this.hechos.push(nuevoHecho());
    this.version.update((v) => v + 1);
    this.drafted.set(null);
    this.state.set(ready(null));
  }
}

function aHecho(hecho: FilaDeHecho): ContextFact {
  const valores = hecho.getRawValue();
  const confianza = valores.confidenceScore.trim();

  return {
    factKey: valores.factKey.trim(),
    valueType: valores.valueType.trim(),
    valueJson: JSON.parse(valores.valueJson) as Record<string, unknown>,
    ...(confianza === '' ? {} : { confidenceScore: confianza }),
    evidence: hecho.controls.evidencias.controls.map((evidencia) => aEvidencia(evidencia)),
  };
}

function aEvidencia(evidencia: FilaDeEvidencia): FactEvidence {
  const valores = evidencia.getRawValue();
  const relevancia = valores.relevanceScore.trim();

  return {
    sourceObservationId: valores.sourceObservationId.trim(),
    ...(relevancia === '' ? {} : { relevanceScore: relevancia }),
  };
}

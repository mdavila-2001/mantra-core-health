import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { HealthContextClient } from '../../../core/data-access/health-context/health-context.client';
import type {
  ObservationRecorded,
  ObservationStatus,
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
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import {
  errorMessageOf,
  opcionDe,
  UUID_ERROR,
  UUID_HINT,
  UUID_PATTERN,
} from '../../../shared/forms/form-support';

const ESTADOS: readonly ObservationStatus[] = ['ACCEPTED', 'REJECTED'];

/**
 * Registrar una observación (V44-02,
 * `POST /health-context/collection-runs/:id/observations`).
 *
 * La observación es **inmutable** y se deduplica por hash dentro de la corrida:
 * el mismo documento leído dos veces no cuenta dos veces, y la respuesta lo
 * dice con `duplicate: true` — que no es un error.
 *
 * El estado lo decide la política de confianza de la fuente: una observación
 * rechazada también se registra, porque el rechazo es parte de la historia de
 * la recolección.
 */
@Component({
  selector: 'app-observation-form',
  imports: [
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    DatePicker,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
    Radio,
    RadioGroup,
    Textarea,
  ],
  templateUrl: './observation-form.html',
  styleUrl: '../m44.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObservationForm {
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
    sourceId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    contentHash: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    sourceLocator: new FormControl('', { nonNullable: true }),
    mediaType: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    rawPayloadFileId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
  });

  protected readonly status = signal<ObservationStatus | null>(null);
  protected readonly publishedAt = signal<Date | null>(null);
  protected readonly retrievedAt = signal<Date | null>(null);
  protected readonly extractedPayloadJson = signal('');

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly recorded = signal<ObservationRecorded | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para registrar observaciones.'),
  );

  /**
   * El contenido extraído es opcional, pero si viene tiene que ser un objeto
   * JSON — el backend lo valida con `@IsObject`, que rechaza arrays y
   * primitivos. Vive en una señal y no en el grupo, así que el validador de
   * `form-support` no lo alcanza y la misma regla se pregunta acá.
   */
  protected readonly payloadInvalido = computed(() => {
    const texto = this.extractedPayloadJson().trim();
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

  protected elegirEstado(valor: unknown): void {
    this.status.set(opcionDe(ESTADOS, valor));
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const estado = this.status();
    if (this.form.invalid || estado === null || this.payloadInvalido()) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    const locator = valores.sourceLocator.trim();
    const media = valores.mediaType.trim();
    const archivo = valores.rawPayloadFileId.trim();
    const publicado = this.publishedAt();
    const recuperado = this.retrievedAt();
    const extraido = this.extractedPayloadJson().trim();

    this.state.set(loading());

    this.client
      .recordObservation(valores.collectionRunId.trim(), {
        sourceId: valores.sourceId.trim(),
        contentHash: valores.contentHash.trim(),
        status: estado,
        ...(locator === '' ? {} : { sourceLocator: locator }),
        ...(media === '' ? {} : { mediaType: media }),
        ...(archivo === '' ? {} : { rawPayloadFileId: archivo }),
        ...(publicado === null ? {} : { publishedAt: publicado.toISOString() }),
        ...(recuperado === null ? {} : { retrievedAt: recuperado.toISOString() }),
        ...(extraido === ''
          ? {}
          : { extractedPayloadJson: JSON.parse(extraido) as Record<string, unknown> }),
      })
      .subscribe({
        next: (observacion) => {
          this.state.set(ready(null));
          this.recorded.set(observacion);
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  protected otraObservacion(): void {
    // La corrida se conserva a propósito: lo normal es registrar varias
    // observaciones seguidas de la misma corrida.
    const corrida = this.form.getRawValue().collectionRunId;
    this.form.reset({ collectionRunId: corrida });
    this.status.set(null);
    this.publishedAt.set(null);
    this.retrievedAt.set(null);
    this.extractedPayloadJson.set('');
    this.recorded.set(null);
    this.state.set(ready(null));
  }
}

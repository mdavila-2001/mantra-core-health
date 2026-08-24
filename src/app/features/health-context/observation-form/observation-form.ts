import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

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
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
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

/**
   * El formulario, servido de a una página.
   *
   * El tope de cuatro y la barra de avance los pone el motor; acá sólo se
   * declara qué campo va en qué sección. Las secciones que no entran en una
   * página se parten conservando su nombre.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'De qué corrida y de qué fuente',
      hint: 'La corrida tiene que estar abierta; la fuente declara de dónde salió el dato.',
      campos: [
        { key: 'collectionRunId', label: 'Identificador de la corrida', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'sourceId', label: 'Identificador de la fuente', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'Qué se observó',
      hint: 'El hash identifica el contenido: el mismo documento dos veces se deduplica.',
      campos: [
        { key: 'contentHash', label: 'Hash del contenido', hint: 'La huella del documento leído, como un SHA-256. Máx. 200 caracteres.', control: 'text', required: true, mensajeDeError: 'Escribí el hash del contenido (máx. 200 caracteres).' },
        { key: 'status', label: 'Veredicto', control: 'radio', options: [{ value: 'ACCEPTED', label: 'Aceptada: la fuente merece confianza' }, { value: 'REJECTED', label: 'Rechazada: queda registrada pero no respalda hechos' }], required: true },
      ],
    },
    {
      titulo: 'Rastro',
      hint: 'Opcional: dónde se encontró, cuándo, en qué formato y qué se extrajo.',
      campos: [
        { key: 'sourceLocator', label: 'Dónde se encontró', hint: 'Una URL o una referencia del documento.', control: 'text' },
        { key: 'publishedAt', label: 'Publicado', hint: 'Cuándo lo publicó la fuente.', control: 'datetime' },
        { key: 'retrievedAt', label: 'Recuperado', hint: 'Cuándo lo leyó el agente.', control: 'datetime' },
        { key: 'mediaType', label: 'Tipo de contenido', hint: 'Como application/pdf. Máx. 100 caracteres.', control: 'text' },
        { key: 'rawPayloadFileId', label: 'Archivo crudo', hint: 'Identificador del archivo ya subido con el contenido original (UUID).', control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'extractedPayloadJson', label: 'Contenido extraído', hint: 'Un objeto JSON con lo que el agente extrajo del documento.', control: 'textarea', mensajeDeError: 'Tiene que ser un objeto JSON válido, como {&quot;casos&quot;: 12}.' },
      ],
    },
  ]);

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
    status: new FormControl<ObservationStatus | null>(null, {
      validators: [Validators.required],
    }),
    publishedAt: new FormControl<Date | null>(null),
    retrievedAt: new FormControl<Date | null>(null),
    // El contenido extraído es opcional, pero si viene tiene que ser un objeto
    // JSON — el backend lo valida con `@IsObject`, que rechaza arrays y
    // primitivos. Ahora que vive en el grupo, la regla la aplica el mismo
    // validador que el resto de los campos JSON del proyecto.
    extractedPayloadJson: new FormControl('', {
      nonNullable: true,
      validators: [objetoJson],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly recorded = signal<ObservationRecorded | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para registrar observaciones.'),
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
    const estado = opcionDe(ESTADOS, valores.status);
    if (estado === null) {
      return;
    }
    const locator = valores.sourceLocator.trim();
    const media = valores.mediaType.trim();
    const archivo = valores.rawPayloadFileId.trim();
    const publicado = valores.publishedAt;
    const recuperado = valores.retrievedAt;
    const extraido = valores.extractedPayloadJson.trim();

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
    this.recorded.set(null);
    this.state.set(ready(null));
  }
}

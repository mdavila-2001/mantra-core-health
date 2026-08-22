import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { GeoClient } from '../../../core/data-access/geo/geo.client';
import type { LocationPing } from '../../../core/data-access/geo/geo.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { CampoPersonalizado } from '../../../shared/components/organisms/paginated-form/campo-personalizado';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import { errorMessageOf, NUMBER_STRING_PATTERN, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

/** El `@ArrayMaxSize` del DTO. El editor avisa mucho antes, pero el techo es este. */
const MAX_PINGS = 1000;

type FilaDePing = FormGroup<{
  latitude: FormControl<string>;
  longitude: FormControl<string>;
  accuracyM: FormControl<string>;
  capturedAt: FormControl<string>;
}>;

function nuevaFila(): FilaDePing {
  return new FormGroup({
    latitude: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(NUMBER_STRING_PATTERN)],
    }),
    longitude: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(NUMBER_STRING_PATTERN)],
    }),
    accuracyM: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(NUMBER_STRING_PATTERN)],
    }),
    capturedAt: new FormControl('', { nonNullable: true }),
  });
}

/**
 * Ingesta manual de pings (V13-03, `POST /geo/tracked-subjects/:id/pings`).
 *
 * La ingesta real la hace el dispositivo por lotes; esta pantalla existe para
 * cargar posiciones a mano —una prueba, una corrección, un dispositivo que no
 * reportó—. El lote va de 1 a 1000 puntos y **las coordenadas viajan como
 * número**: la asimetría con la lectura (que las devuelve como texto) es del
 * contrato.
 *
 * Se rechaza con 422 si el sujeto no está activo o no tiene sesión abierta.
 *
 * Mismo patrón de repetidor que `set-items-editor` (V29-08/09): un `FormArray`
 * con un latido de versión para que la vista `OnPush` note los cambios de
 * tamaño.
 */
@Component({
  selector: 'app-ping-ingest',
  imports: [
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    Card,
    FormField,
    Input,
    CampoPersonalizado,
    PageHeader,
    PaginatedForm,
  ],
  templateUrl: './ping-ingest.html',
  styleUrl: '../m13.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PingIngest {
  private readonly client = inject(GeoClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;
  protected readonly maxPings = MAX_PINGS;

  protected readonly form = new FormGroup({
    trackedSubjectId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
  });

  /**
   * Las páginas: el sujeto primero, y los puntos después.
   *
   * Los puntos son un **repetidor** —cada uno es una tarjeta que se agrega a
   * mano—, así que van como campo `custom`: el motor les reserva el sitio y no
   * aprende nada de coordenadas. Lo que gana la pantalla es que el sujeto deja
   * de competir por la atención con la lista, y que la lista no se ve hasta
   * haber dicho de quién son los puntos.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'De quién',
      hint: 'El sujeto tiene que estar activo y con una sesión de rastreo abierta, o la ingesta se rechaza.',
      campos: [
        {
          key: 'trackedSubjectId',
          label: 'Identificador del sujeto rastreado',
          hint: UUID_HINT,
          control: 'text' as const,
          required: true,
          mensajeDeError: UUID_ERROR,
        },
      ],
    },
    {
      titulo: 'Los puntos',
      hint: 'Coordenadas en grados decimales. Sin momento de captura, queda el de la recepción.',
      campos: [{ key: 'puntos', label: 'Posiciones', control: 'custom' as const, required: true }],
    },
  ]);

  protected readonly filas = new FormArray<FilaDePing>([nuevaFila()]);

  /** El latido que le avisa a la vista `OnPush` que el array cambió de tamaño. */
  protected readonly version = signal(0);

  protected readonly filasVisibles = computed(() => {
    this.version();
    return this.filas.controls;
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  /** Cuántos puntos registró el backend, o `null` mientras siga el formulario. */
  protected readonly recorded = signal<number | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para ingerir posiciones.'),
  );

  protected agregarFila(): void {
    if (this.filas.length >= MAX_PINGS) {
      return;
    }
    this.filas.push(nuevaFila());
    this.version.update((v) => v + 1);
  }

  protected quitarFila(indice: number): void {
    if (this.filas.length <= 1) {
      return;
    }
    this.filas.removeAt(indice);
    this.version.update((v) => v + 1);
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid || this.filas.invalid) {
      this.form.markAllAsTouched();
      this.filas.markAllAsTouched();
      this.version.update((v) => v + 1);
      return;
    }

    const pings = this.filas.controls.map((fila) => aPing(fila));

    this.state.set(loading());

    this.client
      .ingestPings(this.form.getRawValue().trackedSubjectId.trim(), { pings })
      .subscribe({
        next: (resultado) => {
          this.state.set(ready(null));
          this.recorded.set(resultado.recorded);
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  protected otraIngesta(): void {
    // El sujeto se conserva: lo normal es seguir cargando puntos del mismo.
    while (this.filas.length > 1) {
      this.filas.removeAt(this.filas.length - 1);
    }
    this.filas.at(0)?.reset();
    this.version.update((v) => v + 1);
    this.recorded.set(null);
    this.state.set(ready(null));
  }
}

/** Las coordenadas viajan como número: es lo que el DTO valida. */
function aPing(fila: FilaDePing): LocationPing {
  const valores = fila.getRawValue();
  const precision = valores.accuracyM.trim();
  const capturado = valores.capturedAt.trim();

  return {
    latitude: Number(valores.latitude.trim()),
    longitude: Number(valores.longitude.trim()),
    ...(precision === '' ? {} : { accuracyM: Number(precision) }),
    ...(capturado === '' ? {} : { capturedAt: new Date(capturado).toISOString() }),
  };
}

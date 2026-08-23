import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { GeoClient } from '../../../core/data-access/geo/geo.client';
import type { GeofenceEvent, GeofenceEventType } from '../../../core/data-access/geo/geo.types';
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
import { errorMessageOf, opcionDe, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

const SENTIDOS: readonly GeofenceEventType[] = ['ENTER', 'EXIT'];

/**
 * Registrar un cruce de geocerca (V13-06, `POST /geo/geofence-events`).
 *
 * El evento es **idempotente por sentido**: dos entradas seguidas del mismo
 * sujeto a la misma geocerca son un 409, porque ya estaba adentro. El mensaje
 * del backend distingue el caso y se muestra tal cual.
 */
@Component({
  selector: 'app-geofence-event-form',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
  ],
  templateUrl: './geofence-event-form.html',
  styleUrl: '../m13.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeofenceEventForm {
  private readonly client = inject(GeoClient);
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
      titulo: 'Qué cruce',
      hint: 'El registro es idempotente por sentido: si el sujeto ya estaba de ese lado, se rechaza.',
      campos: [
        { key: 'geofenceId', label: 'Identificador de la geocerca', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'trackedSubjectId', label: 'Identificador del sujeto rastreado', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'eventType', label: 'Sentido', control: 'radio', options: [{ value: 'ENTER', label: 'Entró al área' }, { value: 'EXIT', label: 'Salió del área' }], required: true },
      ],
    },
    {
      titulo: 'Con qué respaldo',
      hint: 'Opcional: el ping que evidenció el cruce y el momento exacto, si se conocen.',
      campos: [
        { key: 'locationPingId', label: 'Ping de ubicación', hint: UUID_HINT, control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'occurredAt', label: 'Cuándo ocurrió', hint: 'Sin este dato, queda el momento en que se registró.', control: 'datetime' },
      ],
    },
  ]);

  protected readonly form = new FormGroup({
    geofenceId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    trackedSubjectId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    locationPingId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    eventType: new FormControl<GeofenceEventType | null>(null, {
      validators: [Validators.required],
    }),
    /** Cuándo ocurrió, si se conoce; sin él el backend usa el momento del registro. */
    occurredAt: new FormControl<Date | null>(null),
  });

  /** Obligatorio: un cruce sin sentido no dice nada. */

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<GeofenceEvent | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para registrar cruces de geocerca.'),
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
    const sentido = opcionDe(SENTIDOS, valores.eventType);
    if (sentido === null) {
      return;
    }

    const ping = valores.locationPingId.trim();
    const ocurrido = valores.occurredAt;

    this.state.set(loading());

    this.client
      .recordGeofenceEvent({
        geofenceId: valores.geofenceId.trim(),
        trackedSubjectId: valores.trackedSubjectId.trim(),
        eventType: sentido,
        ...(ping === '' ? {} : { locationPingId: ping }),
        ...(ocurrido === null ? {} : { occurredAt: ocurrido.toISOString() }),
      })
      .subscribe({
        next: (evento) => {
          this.state.set(ready(null));
          this.created.set(evento);
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  protected otroCruce(): void {
    this.form.reset();
    this.created.set(null);
    this.state.set(ready(null));
  }
}

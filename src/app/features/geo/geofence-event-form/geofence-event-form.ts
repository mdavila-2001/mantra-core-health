import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { GeoClient } from '../../../core/data-access/geo/geo.client';
import type { GeofenceEvent, GeofenceEventType } from '../../../core/data-access/geo/geo.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../shared/components/molecules/radio-group/radio-group';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
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
  });

  /** Obligatorio: un cruce sin sentido no dice nada. */
  protected readonly eventType = signal<GeofenceEventType | null>(null);

  /** Cuándo ocurrió, si se conoce; sin él el backend usa el momento del registro. */
  protected readonly occurredAt = signal<Date | null>(null);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<GeofenceEvent | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para registrar cruces de geocerca.'),
  );

  protected elegirSentido(valor: unknown): void {
    this.eventType.set(opcionDe(SENTIDOS, valor));
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const sentido = this.eventType();
    if (this.form.invalid || sentido === null) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    const ping = valores.locationPingId.trim();
    const ocurrido = this.occurredAt();

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
    this.eventType.set(null);
    this.occurredAt.set(null);
    this.created.set(null);
    this.state.set(ready(null));
  }
}

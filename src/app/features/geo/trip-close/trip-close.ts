import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { GeoClient } from '../../../core/data-access/geo/geo.client';
import type { Trip, TripClosure } from '../../../core/data-access/geo/geo.types';
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

/** Entero no negativo o vacío: las dos medidas del cierre son opcionales. */
const ENTERO_NO_NEGATIVO = /^\d*$/;

/**
 * Cerrar un viaje (V13-05·A, `POST /geo/trips/:id/close`).
 *
 * Las dos medidas son opcionales y **no negativas**: el backend valida
 * `@Min(0)`, y `durationS` además tiene que ser entero. Se validan acá para no
 * gastar la petición; los campos vacíos se omiten del cuerpo — mandarlos en
 * `null` sería un 400 del `ValidationPipe`.
 */
@Component({
  selector: 'app-trip-close',
  imports: [
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    DatePipe,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
  ],
  templateUrl: './trip-close.html',
  styleUrl: '../m13.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripClose {
  private readonly client = inject(GeoClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    tripId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    distanceM: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(ENTERO_NO_NEGATIVO)],
    }),
    durationS: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(ENTERO_NO_NEGATIVO)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly closed = signal<Trip | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para cerrar viajes.'),
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
    const distancia = valores.distanceM.trim();
    const duracion = valores.durationS.trim();

    const cierre: TripClosure = {
      ...(distancia === '' ? {} : { distanceM: Number(distancia) }),
      ...(duracion === '' ? {} : { durationS: Number(duracion) }),
    };

    this.state.set(loading());

    this.client.closeTrip(valores.tripId.trim(), cierre).subscribe({
      next: (viaje) => {
        this.state.set(ready(null));
        this.closed.set(viaje);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otroCierre(): void {
    this.form.reset();
    this.closed.set(null);
    this.state.set(ready(null));
  }
}

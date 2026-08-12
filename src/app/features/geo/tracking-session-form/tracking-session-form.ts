import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { GeoClient } from '../../../core/data-access/geo/geo.client';
import type { TrackingSession } from '../../../core/data-access/geo/geo.types';
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

/** El `@MaxLength` del DTO para el tipo de recurso relacionado. */
const MAX_TIPO_RECURSO = 100;

/**
 * Abrir una sesión de rastreo (V13-04·F, `POST /geo/tracking-sessions`).
 *
 * Un sujeto tiene **como mucho una sesión abierta** —la segunda es un 409— y
 * tiene que estar activo: sobre uno suspendido la apertura se rechaza. Sin
 * sesión abierta la ingesta de posiciones no entra, así que esta pantalla es el
 * paso previo a la de pings.
 */
@Component({
  selector: 'app-tracking-session-form',
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
  ],
  templateUrl: './tracking-session-form.html',
  styleUrl: '../m13.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackingSessionForm {
  private readonly client = inject(GeoClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;
  protected readonly maxTipoRecurso = MAX_TIPO_RECURSO;

  protected readonly form = new FormGroup({
    trackedSubjectId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    purposeConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    relatedResourceType: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_TIPO_RECURSO)],
    }),
    relatedResourceId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<TrackingSession | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para abrir sesiones de rastreo.'),
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
    const proposito = valores.purposeConceptId.trim();
    const tipoRecurso = valores.relatedResourceType.trim();
    const recurso = valores.relatedResourceId.trim();

    this.state.set(loading());

    this.client
      .startTrackingSession({
        trackedSubjectId: valores.trackedSubjectId.trim(),
        ...(proposito === '' ? {} : { purposeConceptId: proposito }),
        ...(tipoRecurso === '' ? {} : { relatedResourceType: tipoRecurso }),
        ...(recurso === '' ? {} : { relatedResourceId: recurso }),
      })
      .subscribe({
        next: (sesion) => {
          this.state.set(ready(null));
          this.created.set(sesion);
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  protected otraApertura(): void {
    this.form.reset();
    this.created.set(null);
    this.state.set(ready(null));
  }
}

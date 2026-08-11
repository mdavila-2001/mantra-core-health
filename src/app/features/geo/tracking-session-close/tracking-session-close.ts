import { DatePipe } from '@angular/common';
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

/**
 * Cerrar una sesión de rastreo (V13-04·A,
 * `POST /geo/tracking-sessions/:id/close`).
 *
 * El backend rechaza el cierre con 422 si la sesión tiene **viajes en curso**:
 * primero se cierran los viajes, después la sesión. El orden importa y la
 * pantalla lo dice antes de que el error lo diga.
 */
@Component({
  selector: 'app-tracking-session-close',
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
  templateUrl: './tracking-session-close.html',
  styleUrl: '../m13.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackingSessionClose {
  private readonly client = inject(GeoClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    sessionId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly closed = signal<TrackingSession | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para cerrar sesiones de rastreo.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.client.closeTrackingSession(this.form.getRawValue().sessionId.trim()).subscribe({
      next: (sesion) => {
        this.state.set(ready(null));
        this.closed.set(sesion);
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

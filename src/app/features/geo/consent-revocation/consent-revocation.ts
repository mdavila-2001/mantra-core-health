import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { GeoClient } from '../../../core/data-access/geo/geo.client';
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
 * Revocar el consentimiento de rastreo (V13-01·A,
 * `POST /geo/tracked-subjects/:id/revoke-consent`).
 *
 * No es un borrado: el sujeto queda **suspendido** y sus sesiones abiertas se
 * cierran **en cascada** en el mismo acto. Desde ahí la ingesta de pings se
 * rechaza. Re-revocar sobre un sujeto ya suspendido es un 422 — a diferencia de
 * la revocación de delegaciones del M29, acá el backend no la hace idempotente,
 * y el mensaje de ese 422 es la información útil.
 */
@Component({
  selector: 'app-consent-revocation',
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
  templateUrl: './consent-revocation.html',
  styleUrl: '../m13.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsentRevocation {
  private readonly client = inject(GeoClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    trackedSubjectId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  /** El sujeto ya suspendido, o `null` mientras siga el formulario. */
  protected readonly revoked = signal<string | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para revocar consentimientos.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const trackedSubjectId = this.form.getRawValue().trackedSubjectId.trim();

    this.state.set(loading());

    this.client.revokeConsent(trackedSubjectId).subscribe({
      next: () => {
        this.state.set(ready(null));
        this.revoked.set(trackedSubjectId);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraRevocacion(): void {
    this.form.reset();
    this.revoked.set(null);
    this.state.set(ready(null));
  }
}

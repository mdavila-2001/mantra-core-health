import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { DelegatedAccessClient } from '../../../core/data-access/delegated-access/delegated-access.client';
import type {
  CreatedResource,
  NewAccessRequest,
} from '../../../core/data-access/delegated-access/delegated-access.types';
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
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

/** El `@MaxLength` del DTO. */
const MAX_JUSTIFICACION = 1000;

/** Validador de UUID que además acepta el vacío (campos opcionales). */
const UUID_OPCIONAL = Validators.pattern(UUID_PATTERN);

/**
 * Solicitud de acceso delegado con aprobación previa (V29-03,
 * `POST /practitioner-delegates/:id/access-requests`).
 *
 * El backend garantiza unicidad de la solicitud pendiente por (delegación,
 * permiso, paciente/encuentro): repetirla con lo mismo devuelve 409, y ese
 * conflicto se muestra como validación, no como error genérico.
 */
@Component({
  selector: 'app-access-request-form',
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
    Textarea,
  ],
  templateUrl: './access-request-form.html',
  styleUrl: '../m29.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessRequestForm {
  private readonly client = inject(DelegatedAccessClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;
  protected readonly maxJustificacion = MAX_JUSTIFICACION;

  protected readonly form = new FormGroup({
    delegationId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    requestedPermissionId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    patientProfileId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
    encounterId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
  });

  protected readonly reasonText = signal('');

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<CreatedResource | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para solicitar accesos.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { delegationId } = this.form.getRawValue();

    this.state.set(loading());

    this.client.requestDelegatedAccess(delegationId.trim(), this.datos()).subscribe({
      next: (solicitud) => {
        this.state.set(ready(null));
        this.created.set(solicitud);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraSolicitud(): void {
    this.form.reset();
    this.reasonText.set('');
    this.created.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewAccessRequest {
    const { requestedPermissionId, patientProfileId, encounterId } = this.form.getRawValue();
    const paciente = patientProfileId.trim();
    const encuentro = encounterId.trim();
    const justificacion = this.reasonText().trim();

    return {
      requestedPermissionId: requestedPermissionId.trim(),
      ...(paciente === '' ? {} : { patientProfileId: paciente }),
      ...(encuentro === '' ? {} : { encounterId: encuentro }),
      ...(justificacion === '' ? {} : { reasonText: justificacion }),
    };
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { GeoClient } from '../../../core/data-access/geo/geo.client';
import type {
  TrackedSubject,
  TrackedSubjectType,
} from '../../../core/data-access/geo/geo.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Link } from '../../../shared/components/atoms/link/link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../shared/components/molecules/radio-group/radio-group';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, opcionDe, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

const TIPOS: readonly TrackedSubjectType[] = ['PERSON', 'VEHICLE'];

/**
 * Alta de un sujeto rastreado (V13-01·F, `POST /geo/tracked-subjects`).
 *
 * El alta es única: un segundo sujeto activo con el mismo tipo e identificador
 * en la organización es un 409, y el mensaje del backend es el que se muestra.
 *
 * **`tenantId` no se manda a propósito.** Es un campo de propiedad que el
 * backend contrasta con `X-Tenant-Id` —difieren, 403—, y el interceptor ya pone
 * esa cabecera con el tenant activo. Mandarlo también en el cuerpo sería
 * repetir el dato con una segunda oportunidad de que esté mal.
 */
@Component({
  selector: 'app-tracked-subject-form',
  imports: [
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    FormActions,
    FormField,
    FormSection,
    Input,
    Link,
    PageHeader,
    Radio,
    RadioGroup,
  ],
  templateUrl: './tracked-subject-form.html',
  styleUrl: '../m13.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackedSubjectForm {
  private readonly client = inject(GeoClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    subjectId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    deviceId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
  });

  /** `PERSON` por defecto, como el DTO: la mayoría de lo rastreado son personas. */
  protected readonly subjectType = signal<TrackedSubjectType>('PERSON');

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<TrackedSubject | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para dar de alta sujetos rastreados.'),
  );

  protected elegirTipo(valor: unknown): void {
    const tipo = opcionDe(TIPOS, valor);
    if (tipo !== null) {
      this.subjectType.set(tipo);
    }
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    const dispositivo = valores.deviceId.trim();

    this.state.set(loading());

    this.client
      .enrollTrackedSubject({
        subjectId: valores.subjectId.trim(),
        subjectType: this.subjectType(),
        ...(dispositivo === '' ? {} : { deviceId: dispositivo }),
      })
      .subscribe({
        next: (sujeto) => {
          this.state.set(ready(null));
          this.created.set(sujeto);
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  protected otraAlta(): void {
    this.form.reset();
    this.subjectType.set('PERSON');
    this.created.set(null);
    this.state.set(ready(null));
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { DelegatedAccessClient } from '../../../core/data-access/delegated-access/delegated-access.client';
import type {
  CreatedResource,
  GrantResourceType,
  NewGrant,
  PurposeOfUse,
} from '../../../core/data-access/delegated-access/delegated-access.types';
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
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, opcionDe, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

const PURPOSES: readonly PurposeOfUse[] = ['TREATMENT', 'BILLING', 'OPERATIONS'];
const RESOURCE_TYPES: readonly GrantResourceType[] = [
  'CLINICAL_NOTE',
  'APPOINTMENT',
  'PRESCRIPTION',
];

const UUID_OPCIONAL = Validators.pattern(UUID_PATTERN);

/**
 * Grant delegado por propósito y temporal (V29-04,
 * `POST /practitioner-delegates/:id/grants`).
 *
 * `purpose` y `validTo` son obligatorios por contrato: todo grant delegado
 * nace acotado a un propósito y con vencimiento. Sin esas dos elecciones el
 * envío ni se intenta.
 */
@Component({
  selector: 'app-grant-form',
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
  templateUrl: './grant-form.html',
  styleUrl: '../m29.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrantForm {
  private readonly client = inject(DelegatedAccessClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    delegationId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    patientProfileId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
    encounterId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
  });

  /** Obligatorio por contrato; arranca sin elegir para no adivinar por nadie. */
  protected readonly purpose = signal<PurposeOfUse | null>(null);

  /** Obligatorio: todo grant vence. */
  protected readonly validTo = signal<Date | null>(null);

  protected readonly validFrom = signal<Date | null>(null);
  protected readonly resourceType = signal<GrantResourceType | null>(null);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<CreatedResource | null>(null);

  /** Falta alguna de las dos elecciones obligatorias que no viven en el grupo. */
  protected readonly faltanObligatorios = computed(
    () => this.purpose() === null || this.validTo() === null,
  );

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para otorgar concesiones.'),
  );

  protected elegirProposito(valor: unknown): void {
    this.purpose.set(opcionDe(PURPOSES, valor));
  }

  protected elegirRecurso(valor: unknown): void {
    this.resourceType.set(opcionDe(RESOURCE_TYPES, valor));
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid || this.faltanObligatorios()) {
      this.form.markAllAsTouched();
      return;
    }

    const { delegationId } = this.form.getRawValue();
    const datos = this.datos();
    if (datos === null) {
      return;
    }

    this.state.set(loading());

    this.client.issueGrant(delegationId.trim(), datos).subscribe({
      next: (grant) => {
        this.state.set(ready(null));
        this.created.set(grant);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraConcesion(): void {
    this.form.reset();
    this.purpose.set(null);
    this.validTo.set(null);
    this.validFrom.set(null);
    this.resourceType.set(null);
    this.created.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewGrant | null {
    const proposito = this.purpose();
    const vencimiento = this.validTo();
    if (proposito === null || vencimiento === null) {
      return null;
    }

    const { patientProfileId, encounterId } = this.form.getRawValue();
    const paciente = patientProfileId.trim();
    const encuentro = encounterId.trim();
    const inicio = this.validFrom();
    const recurso = this.resourceType();

    return {
      purpose: proposito,
      validTo: vencimiento.toISOString(),
      ...(inicio === null ? {} : { validFrom: inicio.toISOString() }),
      ...(paciente === '' ? {} : { patientProfileId: paciente }),
      ...(encuentro === '' ? {} : { encounterId: encuentro }),
      ...(recurso === null ? {} : { resourceType: recurso }),
    };
  }
}

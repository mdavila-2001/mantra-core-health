import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { DelegatedAccessClient } from '../../../core/data-access/delegated-access/delegated-access.client';
import type {
  AppointmentScope,
  CreatedResource,
  DelegateRole,
  NewPractitionerDelegate,
  PatientScope,
} from '../../../core/data-access/delegated-access/delegated-access.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../shared/components/molecules/radio-group/radio-group';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, opcionDe, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../form-support';

const DELEGATE_ROLES: readonly DelegateRole[] = ['ASSISTANT', 'SECRETARY', 'NURSE'];
const PATIENT_SCOPES: readonly PatientScope[] = ['ASSIGNED', 'ALL'];
const APPOINTMENT_SCOPES: readonly AppointmentScope[] = ['TODAY', 'ALL'];

/**
 * Alta de una delegación de practitioner (V29-02, `POST /practitioner-delegates`).
 *
 * Las tres referencias obligatorias se pegan como UUID: el backend no expone
 * todavía ni listados ni búsqueda sobre las entidades referenciadas, así que
 * un autocompletado no tiene de dónde alimentarse. Cuando existan los `GET`,
 * estos campos pasan a ser buscadores.
 *
 * Lo que **no** está acá tampoco es un olvido: `may_sign_clinical_content` no
 * se delega nunca por este flujo — es invariante del modelo, no hay campo.
 */
@Component({
  selector: 'app-practitioner-delegate-form',
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
    Switch,
  ],
  templateUrl: './practitioner-delegate-form.html',
  styleUrl: '../m29.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerDelegateForm {
  private readonly client = inject(DelegatedAccessClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    practitionerRoleAssignmentId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    delegateUserAssignmentId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    delegatedPermissionSetId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
  });

  /** Opcionales del contrato: `null` significa «no mandar el campo». */
  protected readonly delegateRole = signal<DelegateRole | null>(null);
  protected readonly patientScope = signal<PatientScope | null>(null);
  protected readonly appointmentScope = signal<AppointmentScope | null>(null);

  protected readonly mayViewClinicalContent = signal(false);
  protected readonly mayEditDrafts = signal(false);

  protected readonly validFrom = signal<Date | null>(null);
  protected readonly validTo = signal<Date | null>(null);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  /** La delegación recién creada, o `null` mientras el formulario sigue abierto. */
  protected readonly created = signal<CreatedResource | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para crear delegaciones.'),
  );

  protected elegirRol(valor: unknown): void {
    this.delegateRole.set(opcionDe(DELEGATE_ROLES, valor));
  }

  protected elegirPacientes(valor: unknown): void {
    this.patientScope.set(opcionDe(PATIENT_SCOPES, valor));
  }

  protected elegirCitas(valor: unknown): void {
    this.appointmentScope.set(opcionDe(APPOINTMENT_SCOPES, valor));
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.client.createPractitionerDelegate(this.datos()).subscribe({
      next: (delegacion) => {
        this.state.set(ready(null));
        this.created.set(delegacion);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  /** Deja la pantalla lista para otra delegación. */
  protected altaNueva(): void {
    this.form.reset();
    this.delegateRole.set(null);
    this.patientScope.set(null);
    this.appointmentScope.set(null);
    this.mayViewClinicalContent.set(false);
    this.mayEditDrafts.set(false);
    this.validFrom.set(null);
    this.validTo.set(null);
    this.created.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewPractitionerDelegate {
    const referencias = this.form.getRawValue();
    const rol = this.delegateRole();
    const pacientes = this.patientScope();
    const citas = this.appointmentScope();
    const desde = this.validFrom();
    const hasta = this.validTo();

    return {
      practitionerRoleAssignmentId: referencias.practitionerRoleAssignmentId.trim(),
      delegateUserAssignmentId: referencias.delegateUserAssignmentId.trim(),
      delegatedPermissionSetId: referencias.delegatedPermissionSetId.trim(),
      ...(rol === null ? {} : { delegateRole: rol }),
      ...(pacientes === null ? {} : { patientScope: pacientes }),
      ...(citas === null ? {} : { appointmentScope: citas }),
      // Los switches viajan siempre: apagado es una decisión, no una ausencia.
      mayViewClinicalContent: this.mayViewClinicalContent(),
      mayEditDrafts: this.mayEditDrafts(),
      ...(desde === null ? {} : { validFrom: desde.toISOString() }),
      ...(hasta === null ? {} : { validTo: hasta.toISOString() }),
    };
  }
}

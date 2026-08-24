import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

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
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import { errorMessageOf, opcionDe, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

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
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
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

/**
   * El formulario, servido de a una página.
   *
   * El tope de cuatro y la barra de avance los pone el motor; acá sólo se
   * declara qué campo va en qué sección. Las secciones que no entran en una
   * página se parten conservando su nombre.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'Quién delega y en quién',
      hint: 'Las tres referencias son obligatorias y se pegan como identificador.',
      campos: [
        { key: 'practitionerRoleAssignmentId', label: 'Asignación de rol del profesional', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'delegateUserAssignmentId', label: 'Asignación de usuario del delegado', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'delegatedPermissionSetId', label: 'Set de permisos delegados', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'Alcance',
      hint: 'Qué rol cumple el delegado y hasta dónde llega. Lo que no elijas lo completa el backend.',
      campos: [
        { key: 'delegateRole', label: 'Rol del delegado', control: 'radio', options: [{ value: 'ASSISTANT', label: 'Asistente' }, { value: 'SECRETARY', label: 'Secretaría' }, { value: 'NURSE', label: 'Enfermería' }] },
        { key: 'patientScope', label: 'Alcance de pacientes', control: 'radio', options: [{ value: 'ASSIGNED', label: 'Solo los asignados' }, { value: 'ALL', label: 'Todos' }] },
        { key: 'appointmentScope', label: 'Alcance de citas', control: 'radio', options: [{ value: 'TODAY', label: 'Solo las de hoy' }, { value: 'ALL', label: 'Todas' }] },
        { key: 'mayViewClinicalContent', label: 'Puede ver contenido clínico', control: 'switch' },
        { key: 'mayEditDrafts', label: 'Puede editar borradores', control: 'switch' },
      ],
    },
    {
      titulo: 'Vigencia',
      hint: 'Sin fechas, rige desde ahora y sin vencimiento.',
      campos: [
        { key: 'validFrom', label: 'Inicio de vigencia', control: 'datetime' },
        { key: 'validTo', label: 'Fin de vigencia', control: 'datetime' },
      ],
    },
  ]);

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
    /** Opcionales del contrato: `null` significa «no mandar el campo». */
    delegateRole: new FormControl<DelegateRole | null>(null),
    patientScope: new FormControl<PatientScope | null>(null),
    appointmentScope: new FormControl<AppointmentScope | null>(null),
    mayViewClinicalContent: new FormControl(false, { nonNullable: true }),
    mayEditDrafts: new FormControl(false, { nonNullable: true }),
    validFrom: new FormControl<Date | null>(null),
    validTo: new FormControl<Date | null>(null),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  /** La delegación recién creada, o `null` mientras el formulario sigue abierto. */
  protected readonly created = signal<CreatedResource | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para crear delegaciones.'),
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
    this.created.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewPractitionerDelegate {
    const referencias = this.form.getRawValue();
    // Se vuelven a comprobar contra el contrato: el motor escribe en el control
    // lo que declaran las opciones, y lo que sale de acá es el cuerpo real.
    const rol = opcionDe(DELEGATE_ROLES, referencias.delegateRole);
    const pacientes = opcionDe(PATIENT_SCOPES, referencias.patientScope);
    const citas = opcionDe(APPOINTMENT_SCOPES, referencias.appointmentScope);
    const desde = referencias.validFrom;
    const hasta = referencias.validTo;

    return {
      practitionerRoleAssignmentId: referencias.practitionerRoleAssignmentId.trim(),
      delegateUserAssignmentId: referencias.delegateUserAssignmentId.trim(),
      delegatedPermissionSetId: referencias.delegatedPermissionSetId.trim(),
      ...(rol === null ? {} : { delegateRole: rol }),
      ...(pacientes === null ? {} : { patientScope: pacientes }),
      ...(citas === null ? {} : { appointmentScope: citas }),
      // Los switches viajan siempre: apagado es una decisión, no una ausencia.
      mayViewClinicalContent: referencias.mayViewClinicalContent,
      mayEditDrafts: referencias.mayEditDrafts,
      ...(desde === null ? {} : { validFrom: desde.toISOString() }),
      ...(hasta === null ? {} : { validTo: hasta.toISOString() }),
    };
  }
}

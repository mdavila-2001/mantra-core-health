import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

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
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
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
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
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

/**
   * El formulario, servido de a una página.
   *
   * El tope de cuatro y la barra de avance los pone el motor; acá sólo se
   * declara qué campo va en qué sección. Las secciones que no entran en una
   * página se parten conservando su nombre.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'Sobre qué delegación',
      hint: 'La concesión cuelga de una delegación vigente.',
      campos: [
        { key: 'delegationId', label: 'Identificador de la delegación', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'Propósito y vigencia',
      hint: 'Las dos elecciones obligatorias: para qué se usa y hasta cuándo.',
      campos: [
        { key: 'purpose', label: 'Propósito de uso', control: 'radio', options: [{ value: 'TREATMENT', label: 'Tratamiento' }, { value: 'BILLING', label: 'Facturación' }, { value: 'OPERATIONS', label: 'Operaciones' }], required: true },
        { key: 'validTo', label: 'Fin de vigencia', hint: 'Obligatorio: toda concesión vence.', control: 'datetime', required: true },
        { key: 'validFrom', label: 'Inicio de vigencia', hint: 'Sin fecha, rige desde ahora.', control: 'datetime' },
      ],
    },
    {
      titulo: 'Alcance',
      hint: 'Opcional: acota la concesión a un paciente, un encuentro o un tipo de recurso.',
      campos: [
        { key: 'patientProfileId', label: 'Paciente objetivo', hint: UUID_HINT, control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'encounterId', label: 'Encuentro objetivo', hint: UUID_HINT, control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'resourceType', label: 'Tipo de recurso', control: 'radio', options: [{ value: 'CLINICAL_NOTE', label: 'Nota clínica' }, { value: 'APPOINTMENT', label: 'Cita' }, { value: 'PRESCRIPTION', label: 'Receta' }] },
      ],
    },
  ]);

  /**
   * Todo el formulario en un solo grupo.
   *
   * El propósito, la vigencia y el tipo de recurso vivían en señales sueltas
   * porque la plantilla los dibujaba a mano. El motor escribe siempre en el
   * grupo, así que ahora están donde estaba el resto — y de paso la regla «sin
   * propósito y sin vencimiento no se envía» la hace cumplir un validador en
   * vez de una comprobación aparte que había que acordarse de llamar.
   */
  protected readonly form = new FormGroup({
    delegationId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    purpose: new FormControl<PurposeOfUse | null>(null, {
      validators: [Validators.required],
    }),
    validTo: new FormControl<Date | null>(null, { validators: [Validators.required] }),
    validFrom: new FormControl<Date | null>(null),
    patientProfileId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
    encounterId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
    resourceType: new FormControl<GrantResourceType | null>(null),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<CreatedResource | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para otorgar concesiones.'),
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
    this.created.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewGrant | null {
    const { patientProfileId, encounterId, validFrom, resourceType } =
      this.form.getRawValue();
    // El grupo ya los exige, pero el tipo del control admite `null`: se
    // comprueba acá para que el cuerpo que sale no dependa de esa promesa.
    const proposito = opcionDe(PURPOSES, this.form.getRawValue().purpose);
    const vencimiento = this.form.getRawValue().validTo;
    if (proposito === null || vencimiento === null) {
      return null;
    }

    const paciente = patientProfileId.trim();
    const encuentro = encounterId.trim();
    const inicio = validFrom;
    const recurso = opcionDe(RESOURCE_TYPES, resourceType);

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

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { DelegatedAccessClient } from '../../../core/data-access/delegated-access/delegated-access.client';
import type {
  CreatedResource,
  NewOrgUserAssignment,
  OrgAccessScope,
  OrgAssignmentRole,
} from '../../../core/data-access/delegated-access/delegated-access.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../shared/components/molecules/radio-group/radio-group';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, opcionDe, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../form-support';

const SCOPES: readonly OrgAccessScope[] = ['TENANT', 'PRACTICE', 'SITE', 'UNIT'];

const ROLES: readonly SelectOption<OrgAssignmentRole>[] = [
  { value: 'STAFF', label: 'Staff' },
  { value: 'SECRETARY', label: 'Secretaría' },
  { value: 'ASSISTANT', label: 'Asistente' },
  { value: 'NURSE', label: 'Enfermería' },
  { value: 'BILLING', label: 'Facturación' },
];

const UUID_OPCIONAL = Validators.pattern(UUID_PATTERN);

/** Los seis nodos de alcance del contrato, en el orden de la ficha. */
const NODOS_DE_ALCANCE = [
  { control: 'practiceId', label: 'Práctica' },
  { control: 'practiceSiteId', label: 'Sede de práctica' },
  { control: 'clinicalUnitId', label: 'Unidad clínica' },
  { control: 'careSpaceId', label: 'Espacio de cuidado' },
  { control: 'diagnosticUnitId', label: 'Unidad de diagnóstico' },
  { control: 'pharmacyId', label: 'Farmacia' },
] as const;

type NodoDeAlcance = (typeof NODOS_DE_ALCANCE)[number]['control'];

/**
 * Alta de una asignación de usuario de organización (V29-01,
 * `POST /org/:tenantMembershipId/user-assignments`).
 *
 * Todo el cuerpo es opcional por contrato: una asignación sin elecciones es
 * válida y el backend completa sus defaults. Lo único que la pantalla exige es
 * la membresía sobre la que cuelga, que va en la ruta.
 */
@Component({
  selector: 'app-org-assignment-form',
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
    Select,
  ],
  templateUrl: './org-assignment-form.html',
  styleUrl: '../m29.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrgAssignmentForm {
  private readonly client = inject(DelegatedAccessClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;
  protected readonly roles = ROLES;
  protected readonly nodosDeAlcance = NODOS_DE_ALCANCE;

  protected readonly form = new FormGroup({
    tenantMembershipId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    practiceId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
    practiceSiteId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
    clinicalUnitId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
    careSpaceId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
    diagnosticUnitId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
    pharmacyId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
    supervisorUserId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
  });

  protected readonly role = signal<OrgAssignmentRole | null>(null);
  protected readonly accessScope = signal<OrgAccessScope | null>(null);
  protected readonly validFrom = signal<Date | null>(null);
  protected readonly validTo = signal<Date | null>(null);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<CreatedResource | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para asignar usuarios de organización.'),
  );

  protected elegirAlcance(valor: unknown): void {
    this.accessScope.set(opcionDe(SCOPES, valor));
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { tenantMembershipId } = this.form.getRawValue();

    this.state.set(loading());

    this.client.createOrgUserAssignment(tenantMembershipId.trim(), this.datos()).subscribe({
      next: (assignment) => {
        this.state.set(ready(null));
        this.created.set(assignment);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraAsignacion(): void {
    this.form.reset();
    this.role.set(null);
    this.accessScope.set(null);
    this.validFrom.set(null);
    this.validTo.set(null);
    this.created.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewOrgUserAssignment {
    const valores = this.form.getRawValue();
    const rol = this.role();
    const alcance = this.accessScope();
    const inicio = this.validFrom();
    const fin = this.validTo();
    const supervisor = valores.supervisorUserId.trim();

    return {
      ...(rol === null ? {} : { role: rol }),
      ...(alcance === null ? {} : { accessScope: alcance }),
      ...this.nodosElegidos(valores),
      ...(supervisor === '' ? {} : { supervisorUserId: supervisor }),
      ...(inicio === null ? {} : { validFrom: inicio.toISOString() }),
      ...(fin === null ? {} : { validTo: fin.toISOString() }),
    };
  }

  /** Solo los nodos de alcance con algo pegado; el resto no viaja. */
  private nodosElegidos(valores: Record<NodoDeAlcance, string>): Partial<NewOrgUserAssignment> {
    const elegidos: Partial<Record<NodoDeAlcance, string>> = {};
    for (const nodo of NODOS_DE_ALCANCE) {
      const valor = valores[nodo.control].trim();
      if (valor !== '') {
        elegidos[nodo.control] = valor;
      }
    }
    return elegidos;
  }
}

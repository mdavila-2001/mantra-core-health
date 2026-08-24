import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

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
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import { errorMessageOf, opcionDe, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

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
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
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
    role: new FormControl<OrgAssignmentRole | null>(null),
    accessScope: new FormControl<OrgAccessScope | null>(null),
    validFrom: new FormControl<Date | null>(null),
    validTo: new FormControl<Date | null>(null),
  });

  /**
   * El formulario, servido de a una página.
   *
   * Los seis nodos de alcance se declaran desde {@link NODOS_DE_ALCANCE} en vez
   * de escribirse uno por uno: son la misma pregunta seis veces y la lista ya
   * existía para dibujarlos. El motor los reparte en dos páginas de cuatro y
   * tres, que es más de lo que cabía a la vista.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'Sobre qué membresía',
      hint: 'La asignación cuelga de la membresía de la persona en la organización.',
      campos: [
        {
          key: 'tenantMembershipId',
          label: 'Identificador de la membresía',
          hint: UUID_HINT,
          control: 'text' as const,
          required: true,
          mensajeDeError: UUID_ERROR,
        },
      ],
    },
    {
      titulo: 'Rol y alcance',
      hint: 'Opcional: sin elegir nada, el backend aplica sus valores por defecto.',
      campos: [
        {
          key: 'role',
          label: 'Rol de la asignación',
          control: 'select' as const,
          options: ROLES,
          placeholder: 'Sin rol elegido',
        },
        {
          key: 'accessScope',
          label: 'Alcance de acceso',
          control: 'radio' as const,
          options: [
            { value: 'TENANT', label: 'Toda la organización' },
            { value: 'PRACTICE', label: 'Práctica' },
            { value: 'SITE', label: 'Sede' },
            { value: 'UNIT', label: 'Unidad' },
          ],
        },
      ],
    },
    {
      titulo: 'Nodo de alcance',
      hint: 'Opcional: a qué parte de la organización queda acotada la asignación.',
      campos: NODOS_DE_ALCANCE.map((nodo) => ({
        key: nodo.control,
        label: nodo.label,
        hint: UUID_HINT,
        control: 'text' as const,
        mensajeDeError: UUID_ERROR,
      })),
    },
    {
      titulo: 'Supervisión y vigencia',
      hint: 'Opcional: quién responde por la asignación y en qué ventana rige.',
      campos: [
        {
          key: 'supervisorUserId',
          label: 'Supervisor responsable',
          hint: UUID_HINT,
          control: 'text' as const,
          mensajeDeError: UUID_ERROR,
        },
        {
          key: 'validFrom',
          label: 'Inicio de vigencia',
          hint: 'Sin fecha, rige desde ahora.',
          control: 'datetime' as const,
        },
        {
          key: 'validTo',
          label: 'Fin de vigencia',
          hint: 'Sin fecha, no vence sola.',
          control: 'datetime' as const,
        },
      ],
    },
  ]);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<CreatedResource | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para asignar usuarios de organización.'),
  );

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
    this.created.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewOrgUserAssignment {
    const valores = this.form.getRawValue();
    const rol = opcionDe(ROLES.map((r) => r.value), valores.role);
    const alcance = opcionDe(SCOPES, valores.accessScope);
    const inicio = valores.validFrom;
    const fin = valores.validTo;
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

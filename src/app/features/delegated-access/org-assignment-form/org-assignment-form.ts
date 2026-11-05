import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { startWith } from 'rxjs';

import { DelegatedAccessClient } from '../../../core/data-access/delegated-access/delegated-access.client';
import type {
  CreatedResource,
  NewOrgUserAssignment,
  OrgAccessScope,
  OrgAssignmentRole,
} from '../../../core/data-access/delegated-access/delegated-access.types';
import { MedicalOrganizationClient } from '../../../core/data-access/medical-organization/medical-organization.client';
import type {
  MedicalOrganizationConsole,
  PracticeSummary,
} from '../../../core/data-access/medical-organization/medical-organization.types';
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
import { paginateFields } from '../../../shared/forms/paginated/paginate-fields';
import { errorMessageOf, opcionDe, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

const SCOPES: readonly OrgAccessScope[] = ['TENANT', 'PRACTICE', 'SITE', 'UNIT', 'SPACE'];

const ROLES: readonly SelectOption<OrgAssignmentRole>[] = [
  { value: 'STAFF', label: 'Staff' },
  { value: 'SECRETARY', label: 'Secretaría' },
  { value: 'ASSISTANT', label: 'Asistente' },
  { value: 'NURSE', label: 'Enfermería' },
  { value: 'BILLING', label: 'Facturación' },
  // F5g · roles de la infraestructura hospitalaria (`CONTRATO-F2-F5.md` §0.3).
  { value: 'NURSE_SUPERVISOR', label: 'Supervisión de enfermería' },
  { value: 'ADMISSION', label: 'Admisión' },
  { value: 'HOUSEKEEPING', label: 'Limpieza' },
  { value: 'HOUSEKEEPING_SUPERVISOR', label: 'Supervisión de limpieza' },
  { value: 'MAINTENANCE', label: 'Mantenimiento (incluye biomédica)' },
  { value: 'OR_MANAGER', label: 'Jefatura de quirófano' },
  { value: 'INFECTION_CONTROL', label: 'Control de infecciones' },
  { value: 'UNIT_HEAD', label: 'Jefatura de servicio' },
];

const UUID_OPCIONAL = Validators.pattern(UUID_PATTERN);

/** Ayuda de cada nodo que se elige de una lista. */
const AYUDA_DE_NODO: Readonly<Record<NodoElegible, string>> = {
  practiceId: 'Opcional. Las prácticas de esta organización.',
  practiceSiteId: 'Opcional. Las sedes de la práctica elegida.',
  clinicalUnitId: 'Opcional. Las áreas de la sede elegida (o de toda la práctica).',
  careSpaceId: 'Opcional. Los espacios del área o la sede elegida.',
};

/**
 * Los seis nodos de alcance del contrato, en el orden de la ficha.
 *
 * Los cuatro primeros **se eligen**: salen de `GET /practices` y del árbol de
 * la práctica elegida (`GET /practices/:id/organization`). Antes se pedía
 * pegar el uuid de cada uno, que nadie conoce de memoria. Unidad de
 * diagnóstico y farmacia no tienen todavía un listado de dónde elegirlas, y
 * siguen pegándose.
 */
const NODOS_DE_ALCANCE = [
  { control: 'practiceId', label: 'Práctica', elegible: true },
  { control: 'practiceSiteId', label: 'Sede de práctica', elegible: true },
  { control: 'clinicalUnitId', label: 'Unidad clínica', elegible: true },
  { control: 'careSpaceId', label: 'Espacio de cuidado', elegible: true },
  { control: 'diagnosticUnitId', label: 'Unidad de diagnóstico', elegible: false },
  { control: 'pharmacyId', label: 'Farmacia', elegible: false },
] as const;

type NodoDeAlcance = (typeof NODOS_DE_ALCANCE)[number]['control'];
type NodoElegible = Extract<(typeof NODOS_DE_ALCANCE)[number], { elegible: true }>['control'];

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
  private readonly organizacionMedica = inject(MedicalOrganizationClient);
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
  /** Las prácticas del tenant, para el primer nodo. */
  private readonly practicas = signal<ViewState<readonly PracticeSummary[]>>(loading());

  /** El árbol de la práctica elegida: sedes, áreas y espacios. */
  private readonly arbol = signal<ViewState<MedicalOrganizationConsole> | null>(null);

  private readonly valores = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  /**
   * Por qué un selector está vacío, cuando lo está por un fallo. Un selector
   * vacío sin explicación se lee como «no hay ninguno».
   */
  protected readonly errorDeNodos = computed(() => {
    const practicas = this.practicas();
    if (practicas.status !== 'ready' && practicas.status !== 'loading') {
      return `No pudimos traer las prácticas. ${errorMessageOf(practicas, 'No tiene permiso para ver las prácticas de esta organización.') ?? ''}`.trim();
    }
    const arbol = this.arbol();
    if (arbol !== null && arbol.status !== 'ready' && arbol.status !== 'loading') {
      return `No pudimos traer las sedes de esa práctica. ${errorMessageOf(arbol, 'No tiene permiso para ver cómo está armada esa práctica.') ?? ''}`.trim();
    }
    return null;
  });

  /**
   * Las opciones de cada nodo elegible. Área y espacio se acotan a la sede (y
   * el espacio al área) si ya se eligió: ofrecer el box de otra sede es ofrecer
   * una combinación que el alcance no puede tener.
   */
  protected readonly opcionesDeNodo = computed<Record<NodoElegible, readonly SelectOption<string>[]>>(
    () => {
      const practicas = this.practicas();
      const arbol = this.arbol();
      const consola = arbol?.status === 'ready' ? arbol.data : null;
      const { practiceSiteId: sede, clinicalUnitId: area } = this.valores();
      return {
        practiceId:
          practicas.status === 'ready'
            ? practicas.data.map((p) => ({ value: p.id, label: p.name }))
            : [],
        practiceSiteId: (consola?.sites ?? []).map((s) => ({ value: s.id, label: s.name })),
        clinicalUnitId: (consola?.clinicalUnits ?? [])
          .filter((u) => !sede || u.siteId === sede)
          .map((u) => ({ value: u.id, label: u.name })),
        careSpaceId: (consola?.careSpaces ?? [])
          .filter((e) => (!sede || e.siteId === sede) && (!area || e.clinicalUnitId === area))
          .map((e) => ({ value: e.id, label: e.name })),
      };
    },
  );

  protected readonly paginas = computed(() => paginateFields([
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
            { value: 'SPACE', label: 'Espacio' },
          ],
        },
      ],
    },
    {
      titulo: 'Nodo de alcance',
      hint: 'Opcional: a qué parte de la organización queda acotada la asignación.',
      campos: NODOS_DE_ALCANCE.map((nodo) =>
        nodo.elegible
          ? {
              key: nodo.control,
              label: nodo.label,
              hint: AYUDA_DE_NODO[nodo.control],
              control: 'select' as const,
              options: this.opcionesDeNodo()[nodo.control],
              placeholder: 'Sin acotar',
              testId: `asignacion-nodo-${nodo.control}`,
            }
          : {
              key: nodo.control,
              label: nodo.label,
              hint: UUID_HINT,
              control: 'text' as const,
              mensajeDeError: UUID_ERROR,
            },
      ),
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
  ]));

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<CreatedResource | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tiene permiso para asignar usuarios de organización.'),
  );

  constructor() {
    this.organizacionMedica.listPractices().subscribe({
      next: (items) => this.practicas.set(ready(items)),
      error: (error: unknown) => this.practicas.set(errorToViewState<readonly PracticeSummary[]>(error)),
    });

    // Al cambiar de práctica, las sedes, áreas y espacios elegidos eran de la
    // otra: se sueltan y se lee el árbol de la nueva.
    let practicaAnterior = '';
    this.form.controls.practiceId.valueChanges.subscribe((practiceId) => {
      const id = practiceId ?? '';
      if (id === practicaAnterior) return;
      practicaAnterior = id;
      this.form.patchValue({ practiceSiteId: '', clinicalUnitId: '', careSpaceId: '' });
      this.cargarArbol(id);
    });
  }

  private cargarArbol(practiceId: string): void {
    if (practiceId === '') {
      this.arbol.set(null);
      return;
    }
    this.arbol.set(loading());
    this.organizacionMedica.getConsole(practiceId).subscribe({
      next: (consola) => this.arbol.set(ready(consola)),
      error: (error: unknown) => this.arbol.set(errorToViewState<MedicalOrganizationConsole>(error)),
    });
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

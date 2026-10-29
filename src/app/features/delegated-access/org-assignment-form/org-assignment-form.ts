import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { EMPTY, expand, reduce } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { DelegatedAccessClient } from '../../../core/data-access/delegated-access/delegated-access.client';
import type {
  CreatedResource,
  NewOrgUserAssignment,
  OrgAccessScope,
  OrgAssignmentRole,
} from '../../../core/data-access/delegated-access/delegated-access.types';
import { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import type { MembershipListItem } from '../../../core/data-access/directory/directory.types';
import { MedicalOrganizationClient } from '../../../core/data-access/medical-organization/medical-organization.client';
import type {
  MedicalOrganizationConsole,
  PracticeSummary,
} from '../../../core/data-access/medical-organization/medical-organization.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { crearResolvedorDeNombres } from '../../admin/organizations/person-names';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginateFields } from '../../../shared/forms/paginated/paginate-fields';
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

/** Membresías por página al armar el selector: el tope que admite la API. */
const MEMBRESIAS_POR_PAGINA = 200;

/** Páginas que se recorren como mucho (1000 personas): más que eso es un selector inservible. */
const PAGINAS_MAXIMAS = 5;

/** Cómo se llama una cuenta cuya persona no se pudo leer: nunca el uuid entero como si fuera un nombre. */
const cuentaSinNombre = (userId: string): string => `Cuenta ${userId.slice(0, 8)}`;

/** Los nodos de alcance sin selector posible todavía, con el motivo en la ficha. */
const NODOS_SIN_SELECTOR = [
  { control: 'diagnosticUnitId', label: 'Unidad de diagnóstico' },
  { control: 'pharmacyId', label: 'Farmacia' },
] as const;

type NodoDeAlcance =
  | 'practiceId'
  | 'practiceSiteId'
  | 'clinicalUnitId'
  | 'careSpaceId'
  | (typeof NODOS_SIN_SELECTOR)[number]['control'];

const NODOS_DE_ALCANCE: readonly NodoDeAlcance[] = [
  'practiceId',
  'practiceSiteId',
  'clinicalUnitId',
  'careSpaceId',
  'diagnosticUnitId',
  'pharmacyId',
];

/**
 * Alta de una asignación de usuario de organización (V29-01,
 * `POST /org/:tenantMembershipId/user-assignments`).
 *
 * Todo el cuerpo es opcional por contrato: una asignación sin elecciones es
 * válida y el backend completa sus defaults. Lo único que la pantalla exige es
 * la membresía sobre la que cuelga.
 *
 * ## Se elige, no se pega
 *
 * Esta pantalla pedía seis identificadores escritos a mano: nadie sabe de
 * memoria el uuid de una sede ni de una membresía, y un uuid equivocado pasaba
 * la validación de formato y se descubría recién en el servidor. Ahora:
 *
 * - **Membresía** y **supervisor** se eligen entre las personas de la
 *   organización activa (por su nombre), con las membresías de
 *   `GET /tenants/{id}/memberships`.
 * - **Práctica → sede → unidad → espacio** se eligen en cascada sobre
 *   `GET /practices` y `GET /practices/{id}/organization`; cambiar un nivel
 *   limpia los de abajo, que ya no le pertenecen.
 *
 * ## Lo que todavía se pega a mano, y por qué
 *
 * **Unidad de diagnóstico y farmacia.** No existe un listado propio de la
 * organización: lo único que hay es el directorio público, que mezcla todas las
 * organizaciones, y ofrecerlo acá sería permitir asignar nodos ajenos. Siguen
 * como identificador, con el aviso en pantalla, hasta que la API exponga el
 * listado (issue aparte). La API valida el tenant del nodo igual.
 *
 * El nombre de las personas lo da `GET /iam/users/{id}` (sólo
 * `SECURITY_ADMIN`); sin permiso la opción dice «Cuenta ab12cd34», no un nombre
 * inventado.
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
  private readonly auth = inject(AuthService);
  private readonly directory = inject(DirectoryClient);
  private readonly organizacion = inject(MedicalOrganizationClient);
  private readonly personas = crearResolvedorDeNombres();

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    tenantMembershipId: new FormControl<string | null>(null, {
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    practiceId: new FormControl<string | null>(null, { validators: [UUID_OPCIONAL] }),
    practiceSiteId: new FormControl<string | null>(null, { validators: [UUID_OPCIONAL] }),
    clinicalUnitId: new FormControl<string | null>(null, { validators: [UUID_OPCIONAL] }),
    careSpaceId: new FormControl<string | null>(null, { validators: [UUID_OPCIONAL] }),
    diagnosticUnitId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
    pharmacyId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
    supervisorUserId: new FormControl<string | null>(null, { validators: [UUID_OPCIONAL] }),
    role: new FormControl<OrgAssignmentRole | null>(null),
    accessScope: new FormControl<OrgAccessScope | null>(null),
    validFrom: new FormControl<Date | null>(null),
    validTo: new FormControl<Date | null>(null),
  });

  /* ---- de dónde salen las opciones ------------------------------------- */

  /** La organización activa: las membresías y las prácticas son de ella. */
  protected readonly organizacionActiva = this.auth.activeTenantId;

  /** La plantilla de la organización activa (todas las páginas, hasta el tope). */
  protected readonly membresias = signal<ViewState<readonly MembershipListItem[]>>(loading());
  /** Había más personas que las que se ofrecen: se dice en el campo. */
  protected readonly membresiasTruncadas = signal(false);

  /** Las prácticas de la organización activa. */
  protected readonly practicas = signal<ViewState<readonly PracticeSummary[]>>(loading());

  /** Sedes, áreas y espacios de la práctica elegida. */
  protected readonly estructura = signal<ViewState<MedicalOrganizationConsole> | null>(null);

  private readonly practicaElegida = toSignal(this.form.controls.practiceId.valueChanges, {
    initialValue: null,
  });
  private readonly sedeElegida = toSignal(this.form.controls.practiceSiteId.valueChanges, {
    initialValue: null,
  });
  private readonly unidadElegida = toSignal(this.form.controls.clinicalUnitId.valueChanges, {
    initialValue: null,
  });

  private readonly opcionesDePersona = computed<readonly SelectOption<string>[]>(() => {
    const estado = this.membresias();
    if (estado.status !== 'ready') return [];
    const nombres = this.personas.nombres();
    return estado.data.map((membresia) => ({
      value: membresia.id,
      label: nombres.get(membresia.userId) ?? cuentaSinNombre(membresia.userId),
      description: nombres.has(membresia.userId) ? cuentaSinNombre(membresia.userId) : undefined,
    }));
  });

  /** Quien supervisa también es de la organización, y se guarda por **cuenta**, no por membresía. */
  private readonly opcionesDeSupervisor = computed<readonly SelectOption<string>[]>(() => {
    const estado = this.membresias();
    if (estado.status !== 'ready') return [];
    const nombres = this.personas.nombres();
    return estado.data.map((membresia) => ({
      value: membresia.userId,
      label: nombres.get(membresia.userId) ?? cuentaSinNombre(membresia.userId),
    }));
  });

  private readonly opcionesDePractica = computed<readonly SelectOption<string>[]>(() =>
    (dataOf(this.practicas()) ?? []).map((practica) => ({
      value: practica.id,
      label: `${practica.name} (${practica.code})`,
    })),
  );

  private readonly consola = computed(() => {
    const estado = this.estructura();
    return estado === null ? null : dataOf(estado);
  });

  private readonly opcionesDeSede = computed<readonly SelectOption<string>[]>(() =>
    (this.consola()?.sites ?? []).map((sede) => ({ value: sede.id, label: sede.name })),
  );

  /** Las áreas de la sede elegida; sin sede, todas las de la práctica. */
  private readonly opcionesDeUnidad = computed<readonly SelectOption<string>[]>(() => {
    const sede = this.sedeElegida();
    return (this.consola()?.clinicalUnits ?? [])
      .filter((unidad) => sede === null || unidad.siteId === sede)
      .map((unidad) => ({ value: unidad.id, label: unidad.name }));
  });

  /** Los espacios del área elegida; sin área, los de la sede; sin sede, todos. */
  private readonly opcionesDeEspacio = computed<readonly SelectOption<string>[]>(() => {
    const sede = this.sedeElegida();
    const unidad = this.unidadElegida();
    return (this.consola()?.careSpaces ?? [])
      .filter((espacio) => (unidad === null ? sede === null || espacio.siteId === sede : espacio.clinicalUnitId === unidad))
      .map((espacio) => ({ value: espacio.id, label: espacio.name, description: espacio.code }));
  });

  /** Por qué falló una lectura de opciones, si falló: no se confunde con «no hay opciones». */
  protected readonly errorDeOpciones = computed<string | null>(() => {
    const lecturas: readonly [string, ViewState<unknown> | null][] = [
      ['las personas de la organización', this.membresias()],
      ['las prácticas', this.practicas()],
      ['la estructura de la práctica', this.estructura()],
    ];
    for (const [que, estado] of lecturas) {
      if (estado === null) continue;
      const motivo = errorMessageOf(estado, `No tiene permiso para ver ${que}.`);
      if (motivo !== null) return `No pudimos leer ${que}. ${motivo}`;
    }
    return null;
  });

  /**
   * El formulario, servido de a una página.
   *
   * Es un `computed`: las opciones llegan de la API después de armar la
   * pantalla, y los niveles de la cascada dependen de lo elegido arriba.
   */
  protected readonly paginas = computed(() =>
    paginateFields([
      {
        titulo: 'Sobre qué membresía',
        hint: 'La asignación cuelga de la membresía de la persona en la organización.',
        campos: [
          {
            key: 'tenantMembershipId',
            label: 'Persona',
            hint:
              this.organizacionActiva() === null
                ? 'Elija primero una organización en el selector de arriba.'
                : this.membresiasTruncadas()
                  ? `Se muestran las primeras ${MEMBRESIAS_POR_PAGINA * PAGINAS_MAXIMAS} personas de la organización.`
                  : 'Busque por nombre entre las personas de la organización.',
            control: 'select' as const,
            options: this.opcionesDePersona(),
            searchable: true,
            placeholder: 'Elija a la persona',
            required: true,
            mensajeDeError: 'Elija a quién se le asigna.',
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
        hint: 'Opcional: a qué parte de la organización queda acotada la asignación. Cada nivel se elige dentro del anterior.',
        campos: [
          {
            key: 'practiceId',
            label: 'Práctica',
            control: 'select' as const,
            options: this.opcionesDePractica(),
            searchable: true,
            placeholder: 'Toda la organización',
          },
          {
            key: 'practiceSiteId',
            label: 'Sede de práctica',
            hint: this.practicaElegida() === null ? 'Primero elija la práctica.' : undefined,
            control: 'select' as const,
            options: this.opcionesDeSede(),
            searchable: true,
            placeholder: 'Sin sede',
          },
          {
            key: 'clinicalUnitId',
            label: 'Unidad clínica',
            hint: this.practicaElegida() === null ? 'Primero elija la práctica.' : undefined,
            control: 'select' as const,
            options: this.opcionesDeUnidad(),
            searchable: true,
            placeholder: 'Sin unidad',
          },
          {
            key: 'careSpaceId',
            label: 'Espacio de cuidado',
            hint: this.practicaElegida() === null ? 'Primero elija la práctica.' : undefined,
            control: 'select' as const,
            options: this.opcionesDeEspacio(),
            searchable: true,
            placeholder: 'Sin espacio',
          },
        ],
      },
      {
        titulo: 'Otros nodos',
        hint: 'Opcional. Estos dos todavía se piden por identificador: la organización no tiene un listado propio de unidades de diagnóstico ni de farmacias que ofrecer sin mezclar las de otras.',
        campos: NODOS_SIN_SELECTOR.map((nodo) => ({
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
            hint: 'Una persona de la organización.',
            control: 'select' as const,
            options: this.opcionesDeSupervisor(),
            searchable: true,
            placeholder: 'Sin supervisor',
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
    ]),
  );

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<CreatedResource | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tiene permiso para asignar usuarios de organización.'),
  );

  constructor() {
    const tenantId = this.organizacionActiva();
    if (tenantId !== null) {
      this.cargarOpciones(tenantId);
    }

    // Cada nivel de la cascada limpia los de abajo: una sede de otra práctica
    // no es un valor válido para la práctica nueva. `emitEvent: false` para no
    // encadenar un reinicio dentro de otro.
    this.form.controls.practiceId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((practiceId) => {
        this.limpiar('practiceSiteId', 'clinicalUnitId', 'careSpaceId');
        this.cargarEstructura(practiceId);
      });
    this.form.controls.practiceSiteId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.limpiar('clinicalUnitId', 'careSpaceId'));
    this.form.controls.clinicalUnitId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.limpiar('careSpaceId'));
  }

  /** Reintento de las lecturas de opciones que fallaron. */
  protected recargarOpciones(): void {
    const tenantId = this.organizacionActiva();
    if (tenantId !== null) {
      this.cargarOpciones(tenantId);
    }
    this.cargarEstructura(this.form.controls.practiceId.value);
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
    if (tenantMembershipId === null) {
      return;
    }

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

  private limpiar(...controles: readonly ('practiceSiteId' | 'clinicalUnitId' | 'careSpaceId')[]): void {
    for (const control of controles) {
      this.form.controls[control].setValue(null, { emitEvent: false });
    }
  }

  /** Las personas y las prácticas de la organización activa. */
  private cargarOpciones(tenantId: string): void {
    this.membresias.set(loading());
    this.membresiasTruncadas.set(false);
    let paginas = 1;
    this.directory
      .listMemberships(tenantId, { limit: MEMBRESIAS_POR_PAGINA })
      .pipe(
        expand((pagina) => {
          if (pagina.nextCursor === null) return EMPTY;
          if (paginas >= PAGINAS_MAXIMAS) {
            this.membresiasTruncadas.set(true);
            return EMPTY;
          }
          paginas += 1;
          return this.directory.listMemberships(tenantId, {
            limit: MEMBRESIAS_POR_PAGINA,
            cursor: pagina.nextCursor,
          });
        }),
        reduce((todas, pagina) => [...todas, ...pagina.items], [] as readonly MembershipListItem[]),
      )
      .subscribe({
        next: (todas) => {
          this.membresias.set(ready(todas));
          this.personas.resolver(todas.map((membresia) => membresia.userId));
        },
        error: (error: unknown) =>
          this.membresias.set(errorToViewState<readonly MembershipListItem[]>(error)),
      });

    this.practicas.set(loading());
    this.organizacion.listPractices().subscribe({
      next: (lista) => this.practicas.set(ready(lista)),
      error: (error: unknown) =>
        this.practicas.set(errorToViewState<readonly PracticeSummary[]>(error)),
    });
  }

  /** Sedes, áreas y espacios de la práctica que se eligió; `null` los suelta. */
  private cargarEstructura(practiceId: string | null): void {
    if (practiceId === null || practiceId === '') {
      this.estructura.set(null);
      return;
    }
    this.estructura.set(loading());
    this.organizacion.getConsole(practiceId).subscribe({
      next: (consola) => {
        if (this.form.controls.practiceId.value !== practiceId) return;
        this.estructura.set(ready(consola));
      },
      error: (error: unknown) => {
        if (this.form.controls.practiceId.value !== practiceId) return;
        this.estructura.set(errorToViewState<MedicalOrganizationConsole>(error));
      },
    });
  }

  private datos(): NewOrgUserAssignment {
    const valores = this.form.getRawValue();
    const rol = opcionDe(ROLES.map((r) => r.value), valores.role);
    const alcance = opcionDe(SCOPES, valores.accessScope);
    const inicio = valores.validFrom;
    const fin = valores.validTo;
    const supervisor = (valores.supervisorUserId ?? '').trim();

    return {
      ...(rol === null ? {} : { role: rol }),
      ...(alcance === null ? {} : { accessScope: alcance }),
      ...this.nodosElegidos(valores),
      ...(supervisor === '' ? {} : { supervisorUserId: supervisor }),
      ...(inicio === null ? {} : { validFrom: inicio.toISOString() }),
      ...(fin === null ? {} : { validTo: fin.toISOString() }),
    };
  }

  /** Solo los nodos de alcance con algo elegido o pegado; el resto no viaja. */
  private nodosElegidos(
    valores: Record<NodoDeAlcance, string | null>,
  ): Partial<NewOrgUserAssignment> {
    const elegidos: Partial<Record<NodoDeAlcance, string>> = {};
    for (const nodo of NODOS_DE_ALCANCE) {
      const valor = (valores[nodo] ?? '').trim();
      if (valor !== '') {
        elegidos[nodo] = valor;
      }
    }
    return elegidos;
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import {
  AVAILABILITY_EXCEPTION_TYPES,
  RESOURCE_TYPES,
  type AvailabilityExceptionCreated,
  type ResourceType,
  type ScheduleRule,
  type SlotsGenerated,
} from '../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Stepper } from '../../../shared/components/molecules/stepper/stepper';
import type { StepperStep } from '../../../shared/components/molecules/stepper/stepper.types';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import {
  errorMessageOf,
  UUID_ERROR,
  UUID_PATTERN,
  NUMBER_STRING_ERROR,
  NUMBER_STRING_PATTERN,
} from '../../../shared/forms/form-support';

/** Las cinco fases del alta, en orden. El índice es la fase actual. */
const FASES = [
  { clave: 'recurso', label: 'Recurso' },
  { clave: 'politica', label: 'Política' },
  { clave: 'plantilla', label: 'Plantilla' },
  { clave: 'slots', label: 'Generar cupos' },
  { clave: 'excepcion', label: 'Excepción' },
] as const;

/**
 * Roles que pueden construir una agenda.
 *
 * `PRACTITIONER` entró con el autoservicio: las cinco escrituras del catálogo
 * declaran `@Roles('SCHEDULING_ADMIN', 'PRACTITIONER')`. Mientras esta lista no
 * lo incluyó, el aviso de la agenda invitaba al profesional a «Publicar mi
 * agenda», el enlace abría este asistente y el asistente le respondía que no
 * tenía permiso: un callejón sin salida en el único camino que lo vuelve
 * reservable.
 */
const ROLES_QUE_CREAN = ['SCHEDULING_ADMIN', 'SUPERADMIN', 'PRACTITIONER'];

/** Roles de catálogo: arman la agenda de cualquiera, no sólo la propia. */
const ROLES_DE_CATALOGO = ['SCHEDULING_ADMIN', 'SUPERADMIN'];

/**
 * Tabla del perfil profesional, tal como la nombra `assertPuedeCrearRecurso`.
 *
 * El backend acepta `practitioner_profiles` o `health_practitioner_profiles`;
 * se manda la primera porque es la que declara el modelo para el recurso.
 */
const TABLA_DE_PERFIL_PROFESIONAL = 'practitioner_profiles';

/** Entero positivo o vacío: los numéricos opcionales viajan como texto. */
const ENTERO_POSITIVO = /^\d+$/;

/** Hora `HH:MM` o `HH:MM:SS`, como la valida el DTO de la franja. */
const HORA = /^\d{2}:\d{2}(:\d{2})?$/;

/** Una franja del formulario de plantilla. */
type RuleGroup = FormGroup<{
  dayOfWeek: FormControl<string>;
  startTime: FormControl<string>;
  endTime: FormControl<string>;
  slotMinutes: FormControl<string>;
  capacityPerSlot: FormControl<string>;
}>;

/**
 * **Crear agenda** (M41, UC-41-01 → UC-41-04) — el alta por fases.
 *
 * Cada fase persiste contra su propio endpoint **antes** de avanzar y guarda el
 * identificador que la siguiente necesita: el recurso da el `resourceId` sobre
 * el que cuelgan la plantilla y las excepciones; la política da el `policyId`
 * que la plantilla referencia; la plantilla da el `templateId` que se
 * materializa en cupos. No se acumula nada para guardar al final: si una fase
 * falla, las anteriores ya quedaron firmes y no se rehacen.
 *
 * El estado se conserva entre fases —volver atrás no borra lo cargado— y una
 * fase ya cumplida no se vuelve a enviar: su botón sólo avanza.
 */
@Component({
  selector: 'app-agenda-create',
  imports: [
    ReactiveFormsModule,
    AnnounceOnAppear,
    Alert,
    AppButton,
    DatePicker,
    FormField,
    FormSection,
    Input,
    PageHeader,
    RouterLink,
    Select,
    Stepper,
    Switch,
    Textarea,
  ],
  templateUrl: './agenda-create.html',
  styleUrl: './agenda-create.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaCreate {
  private readonly scheduling = inject(SchedulingClient);
  private readonly auth = inject(AuthService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidError = UUID_ERROR;
  protected readonly numberStringError = NUMBER_STRING_ERROR;

  /** Si la sesión puede construir agenda. El backend manda; esto no ofrece 403. */
  protected readonly puedeCrear = computed(() =>
    ROLES_QUE_CREAN.some((rol) => this.auth.roles().includes(rol)),
  );

  /**
   * Si quien entra sólo puede publicar **su propia** agenda.
   *
   * El backend lo comprueba fila por fila (`assertPuedeCrearRecurso`): a quien
   * no administra el catálogo le exige que el recurso sea de tipo
   * `PRACTITIONER`, que apunte a la tabla del perfil profesional y que el
   * identificador sea el suyo. Son tres datos que el profesional no tiene por
   * qué saber —el tercero es un uuid—, así que la pantalla los aporta en vez de
   * pedirlos: ver {@link identidadDelRecurso}.
   */
  protected readonly publicaSoloLaPropia = computed(() => {
    const roles = this.auth.roles();
    const esCatalogo = ROLES_DE_CATALOGO.some((rol) => roles.includes(rol));
    return !esCatalogo && roles.includes('PRACTITIONER');
  });

  /* -- Recorrido ----------------------------------------------------------- */

  /** Fase actual, 0 a 4. Al finalizar sube a 5 para que el stepper la complete. */
  protected readonly fase = signal(0);
  protected readonly finalizado = signal(false);

  /** El estado de la operación de la fase activa: carga y error viven acá. */
  protected readonly estado = signal<ViewState<null>>(ready(null));
  protected readonly cargando = computed(() => this.estado().status === 'loading');
  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.estado(), 'No tenés permiso para configurar agenda.'),
  );

  /* -- Identificadores que encadenan las fases ----------------------------- */

  protected readonly resourceId = signal<string | null>(null);
  protected readonly resourceName = signal<string>('');
  protected readonly policyId = signal<string | null>(null);
  protected readonly policyCode = signal<string>('');
  protected readonly templateId = signal<string | null>(null);
  protected readonly templateName = signal<string>('');
  protected readonly slotsResultado = signal<SlotsGenerated | null>(null);
  protected readonly excepcionResultado = signal<AvailabilityExceptionCreated | null>(null);

  /* -- El stepper ---------------------------------------------------------- */

  protected readonly pasos = computed<readonly StepperStep[]>(() => {
    const activa = this.finalizado() ? FASES.length : this.fase();
    return FASES.map((f, i) => ({
      label: f.label,
      status: i < activa ? 'complete' : i === activa ? 'current' : 'upcoming',
    }));
  });

  protected readonly tituloDeFase = computed(() => FASES[this.fase()]?.label ?? '');

  /** El rótulo del botón primario cambia con la fase. */
  protected readonly etiquetaPrimaria = computed(() => {
    switch (this.fase()) {
      case 3:
        return 'Generar cupos y continuar';
      case 4:
        return 'Registrar y finalizar';
      default:
        return 'Guardar y continuar';
    }
  });

  /* -- Opciones de los selects -------------------------------------------- */

  protected readonly opcionesTipoRecurso: readonly SelectOption<string>[] = RESOURCE_TYPES.map(
    (tipo) => ({ value: tipo, label: etiquetaTipoRecurso(tipo) }),
  );

  protected readonly opcionesDia: readonly SelectOption<string>[] = [
    { value: '1', label: 'Lunes' },
    { value: '2', label: 'Martes' },
    { value: '3', label: 'Miércoles' },
    { value: '4', label: 'Jueves' },
    { value: '5', label: 'Viernes' },
    { value: '6', label: 'Sábado' },
    { value: '0', label: 'Domingo' },
  ];

  protected readonly opcionesExcepcion: readonly SelectOption<string>[] =
    AVAILABILITY_EXCEPTION_TYPES.map((tipo) => ({ value: tipo, label: etiquetaExcepcion(tipo) }));

  /* -- Fase 1: recurso ----------------------------------------------------- */

  protected readonly formRecurso = new FormGroup({
    resourceType: new FormControl<ResourceType | ''>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    resourceRefType: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    resourceRefId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    practiceId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    timeZone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    capacity: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(ENTERO_POSITIVO)],
    }),
  });

  /**
   * Fija la identidad del recurso cuando el profesional publica la suya.
   *
   * Los tres campos que el backend comprueba dejan de pedirse: el tipo es
   * `PRACTITIONER`, la tabla es la del perfil profesional y el identificador es
   * el de su sesión. Se deshabilitan en vez de ocultarse para que se vea qué
   * agenda se está publicando —es de él, y eso es justamente lo que la pantalla
   * tiene que dejar claro—; `getRawValue()` sigue leyéndolos deshabilitados, así
   * que el envío no cambia.
   *
   * Sin `practitionerProfileId` en la sesión no hay agenda propia que publicar.
   * No se inventa un valor: el campo queda vacío y su `required` frena el envío,
   * que es preferible a mandar un uuid que el backend va a rechazar con 403.
   */
  private readonly identidadDelRecurso = effect(() => {
    if (!this.publicaSoloLaPropia()) return;

    const propio = this.auth.practitionerProfileId();
    this.formRecurso.controls.resourceType.setValue('PRACTITIONER');
    this.formRecurso.controls.resourceRefType.setValue(TABLA_DE_PERFIL_PROFESIONAL);
    if (propio) this.formRecurso.controls.resourceRefId.setValue(propio);

    this.formRecurso.controls.resourceType.disable();
    this.formRecurso.controls.resourceRefType.disable();
    if (propio) this.formRecurso.controls.resourceRefId.disable();
  });

  /** Si la sesión no declara perfil profesional no hay agenda propia que armar. */
  protected readonly sinPerfilProfesional = computed(
    () => this.publicaSoloLaPropia() && this.auth.practitionerProfileId() === null,
  );

  /* -- Fase 2: política ---------------------------------------------------- */

  protected readonly formPolitica = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    practiceId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    minNoticeMinutes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(ENTERO_POSITIVO)],
    }),
    maxAdvanceDays: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(ENTERO_POSITIVO)],
    }),
    cancellationWindowMinutes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(ENTERO_POSITIVO)],
    }),
    noShowFeeAmount: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(NUMBER_STRING_PATTERN)],
    }),
    maxActivePerPatient: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(ENTERO_POSITIVO)],
    }),
    holdTtlSeconds: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(ENTERO_POSITIVO)],
    }),
  });

  /* -- Fase 3: plantilla --------------------------------------------------- */

  protected readonly formPlantilla = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    slotMinutes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(ENTERO_POSITIVO)],
    }),
    rules: new FormArray<RuleGroup>([this.nuevaFranja()]),
  });

  protected readonly validFrom = signal<Date | null>(null);
  protected readonly validTo = signal<Date | null>(null);

  protected get franjas(): FormArray<RuleGroup> {
    return this.formPlantilla.controls.rules;
  }

  /* -- Fase 4: generar cupos ----------------------------------------------- */

  protected readonly desde = signal<Date | null>(null);
  protected readonly hasta = signal<Date | null>(null);
  /** Se levanta al intentar generar sin ventana válida: el date-picker no valida solo. */
  protected readonly ventanaTocada = signal(false);

  protected readonly ventanaInvalida = computed(() => {
    const d = this.desde();
    const h = this.hasta();
    return d === null || h === null || d.getTime() >= h.getTime();
  });

  /* -- Fase 5: excepción --------------------------------------------------- */

  protected readonly formExcepcion = new FormGroup({
    exceptionType: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    isAvailable: new FormControl(false, { nonNullable: true }),
  });

  protected readonly excStart = signal<Date | null>(null);
  protected readonly excEnd = signal<Date | null>(null);
  protected readonly rangoTocado = signal(false);

  protected readonly rangoInvalido = computed(() => {
    const d = this.excStart();
    const h = this.excEnd();
    return d === null || h === null || d.getTime() >= h.getTime();
  });

  /**
   * La organización activa es la **única** fuente del `tenantId`: el recurso y
   * la política se crean en la organización en la que se está trabajando, no en
   * una que se teclee. No se ofrece como campo editable —un UUID a mano es un
   * error esperando pasar, y elegir otra organización es cambiar el contexto de
   * la sesión, no rellenar un input—. Un `SUPERADMIN` que necesite otra usa el
   * selector de organización del encabezado, el mecanismo que ya existe.
   */
  protected readonly organizacion = this.auth.activeTenantId;

  /**
   * Sin organización activa no se puede crear nada: `tenantId` es obligatorio en
   * las dos primeras fases. Se bloquea el recorrido y se explica, en vez de
   * dejar avanzar hasta un 400.
   */
  protected readonly sinOrganizacion = computed(() => this.organizacion() === null);

  /* -- Navegación ---------------------------------------------------------- */

  /** Avanza: si la fase ya está cumplida sólo pasa; si no, la persiste. */
  protected siguiente(): void {
    if (this.cargando()) {
      return;
    }
    switch (this.fase()) {
      case 0:
        this.guardarRecurso();
        break;
      case 1:
        this.guardarPolitica();
        break;
      case 2:
        this.guardarPlantilla();
        break;
      case 3:
        this.generarCupos();
        break;
      case 4:
        this.registrarExcepcion();
        break;
    }
  }

  protected atras(): void {
    if (this.cargando() || this.fase() === 0) {
      return;
    }
    // El error es de la fase que se abandona: al volver no debe seguir gritando.
    this.estado.set(ready(null));
    this.fase.update((f) => f - 1);
  }

  private avanzar(): void {
    this.estado.set(ready(null));
    this.fase.update((f) => f + 1);
  }

  /* -- Fase 1 -------------------------------------------------------------- */

  private guardarRecurso(): void {
    if (this.resourceId() !== null) {
      this.avanzar();
      return;
    }
    if (this.formRecurso.invalid) {
      this.formRecurso.markAllAsTouched();
      return;
    }
    const tenantId = this.organizacion();
    if (tenantId === null) {
      return;
    }
    const v = this.formRecurso.getRawValue();
    this.estado.set(loading());
    this.scheduling
      .createResource({
        tenantId,
        resourceType: v.resourceType as ResourceType,
        resourceRefType: v.resourceRefType.trim(),
        resourceRefId: v.resourceRefId.trim(),
        name: v.name.trim(),
        ...opcTexto('practiceId', v.practiceId),
        ...opcTexto('timeZone', v.timeZone),
        ...opcEntero('capacity', v.capacity),
      })
      .subscribe({
        next: (recurso) => {
          this.resourceId.set(recurso.id);
          this.resourceName.set(recurso.name);
          this.avanzar();
        },
        error: (error: unknown) => this.estado.set(errorToViewState<null>(error)),
      });
  }

  /* -- Fase 2 -------------------------------------------------------------- */

  private guardarPolitica(): void {
    if (this.policyId() !== null) {
      this.avanzar();
      return;
    }
    if (this.formPolitica.invalid) {
      this.formPolitica.markAllAsTouched();
      return;
    }
    const tenantId = this.organizacion();
    if (tenantId === null) {
      return;
    }
    const v = this.formPolitica.getRawValue();
    this.estado.set(loading());
    this.scheduling
      .createPolicy({
        tenantId,
        code: v.code.trim(),
        name: v.name.trim(),
        ...opcTexto('practiceId', v.practiceId),
        ...opcEntero('minNoticeMinutes', v.minNoticeMinutes),
        ...opcEntero('maxAdvanceDays', v.maxAdvanceDays),
        ...opcEntero('cancellationWindowMinutes', v.cancellationWindowMinutes),
        ...opcTexto('noShowFeeAmount', v.noShowFeeAmount),
        ...opcEntero('maxActivePerPatient', v.maxActivePerPatient),
        ...opcEntero('holdTtlSeconds', v.holdTtlSeconds),
      })
      .subscribe({
        next: (politica) => {
          this.policyId.set(politica.id);
          this.policyCode.set(politica.code);
          this.avanzar();
        },
        error: (error: unknown) => this.estado.set(errorToViewState<null>(error)),
      });
  }

  /* -- Fase 3 -------------------------------------------------------------- */

  protected agregarFranja(): void {
    this.franjas.push(this.nuevaFranja());
  }

  protected quitarFranja(indice: number): void {
    // Al menos una: sin franjas no hay plantilla que publicar.
    if (this.franjas.length > 1) {
      this.franjas.removeAt(indice);
    }
  }

  private guardarPlantilla(): void {
    if (this.templateId() !== null) {
      this.avanzar();
      return;
    }
    if (this.formPlantilla.invalid) {
      this.formPlantilla.markAllAsTouched();
      return;
    }
    const resourceId = this.resourceId();
    if (resourceId === null) {
      return;
    }
    const v = this.formPlantilla.getRawValue();
    const rules: ScheduleRule[] = v.rules.map((r) => ({
      dayOfWeek: Number(r.dayOfWeek),
      startTime: r.startTime.trim(),
      endTime: r.endTime.trim(),
      ...opcEntero('slotMinutes', r.slotMinutes),
      ...opcEntero('capacityPerSlot', r.capacityPerSlot),
    })) as ScheduleRule[];

    const policyId = this.policyId();
    this.estado.set(loading());
    this.scheduling
      .createTemplate(resourceId, {
        name: v.name.trim(),
        rules,
        ...opcEntero('slotMinutes', v.slotMinutes),
        ...(policyId === null ? {} : { bookingPolicyId: policyId }),
        ...opcFecha('validFrom', this.validFrom()),
        ...opcFecha('validTo', this.validTo()),
      })
      .subscribe({
        next: (plantilla) => {
          this.templateId.set(plantilla.id);
          this.templateName.set(plantilla.name);
          this.avanzar();
        },
        error: (error: unknown) => this.estado.set(errorToViewState<null>(error)),
      });
  }

  /* -- Fase 4 -------------------------------------------------------------- */

  private generarCupos(): void {
    if (this.slotsResultado() !== null) {
      this.avanzar();
      return;
    }
    this.ventanaTocada.set(true);
    if (this.ventanaInvalida()) {
      return;
    }
    const templateId = this.templateId();
    const desde = this.desde();
    const hasta = this.hasta();
    if (templateId === null || desde === null || hasta === null) {
      return;
    }
    this.estado.set(loading());
    this.scheduling
      .generateSlots(templateId, { from: desde.toISOString(), to: hasta.toISOString() })
      .subscribe({
        next: (resultado) => {
          this.slotsResultado.set(resultado);
          this.avanzar();
        },
        error: (error: unknown) => this.estado.set(errorToViewState<null>(error)),
      });
  }

  /* -- Fase 5 -------------------------------------------------------------- */

  private registrarExcepcion(): void {
    if (this.excepcionResultado() !== null) {
      this.finalizar();
      return;
    }
    this.rangoTocado.set(true);
    if (this.formExcepcion.invalid || this.rangoInvalido()) {
      this.formExcepcion.markAllAsTouched();
      return;
    }
    const resourceId = this.resourceId();
    const inicio = this.excStart();
    const fin = this.excEnd();
    if (resourceId === null || inicio === null || fin === null) {
      return;
    }
    const v = this.formExcepcion.getRawValue();
    this.estado.set(loading());
    this.scheduling
      .createException(resourceId, {
        exceptionType: v.exceptionType as 'ABSENCE' | 'HOLIDAY' | 'EXTRA',
        startAt: inicio.toISOString(),
        endAt: fin.toISOString(),
        ...opcTexto('reason', v.reason),
        ...(v.isAvailable ? { isAvailable: true } : {}),
      })
      .subscribe({
        next: (excepcion) => {
          this.excepcionResultado.set(excepcion);
          this.finalizar();
        },
        error: (error: unknown) => this.estado.set(errorToViewState<null>(error)),
      });
  }

  private finalizar(): void {
    this.estado.set(ready(null));
    this.finalizado.set(true);
    this.fase.set(FASES.length);
  }

  private nuevaFranja(): RuleGroup {
    return new FormGroup({
      dayOfWeek: new FormControl('1', { nonNullable: true, validators: [Validators.required] }),
      startTime: new FormControl('08:00', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(HORA)],
      }),
      endTime: new FormControl('12:00', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(HORA)],
      }),
      slotMinutes: new FormControl('', {
        nonNullable: true,
        validators: [Validators.pattern(ENTERO_POSITIVO)],
      }),
      capacityPerSlot: new FormControl('', {
        nonNullable: true,
        validators: [Validators.pattern(ENTERO_POSITIVO)],
      }),
    });
  }
}

/** El campo de texto, o nada: `''` no viaja, y en `undefined` sería un 400. */
function opcTexto<K extends string>(key: K, value: string): Partial<Record<K, string>> {
  const texto = value.trim();
  return texto === '' ? {} : ({ [key]: texto } as Record<K, string>);
}

/** El campo entero, o nada. Vacío se omite; con valor va como número. */
function opcEntero<K extends string>(key: K, value: string): Partial<Record<K, number>> {
  const texto = value.trim();
  return texto === '' ? {} : ({ [key]: Number(texto) } as Record<K, number>);
}

/** La fecha en ISO, o nada. */
function opcFecha<K extends string>(key: K, value: Date | null): Partial<Record<K, string>> {
  return value === null ? {} : ({ [key]: value.toISOString() } as Record<K, string>);
}

function etiquetaTipoRecurso(tipo: ResourceType): string {
  switch (tipo) {
    case 'PRACTITIONER':
      return 'Profesional';
    case 'ROOM':
      return 'Consultorio o box';
    case 'EQUIPMENT':
      return 'Equipo';
  }
}

function etiquetaExcepcion(tipo: string): string {
  switch (tipo) {
    case 'ABSENCE':
      return 'Ausencia';
    case 'HOLIDAY':
      return 'Feriado';
    case 'EXTRA':
      return 'Disponibilidad extra';
    default:
      return tipo;
  }
}

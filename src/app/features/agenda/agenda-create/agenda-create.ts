import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { MedicalOrganizationClient } from '../../../core/data-access/medical-organization/medical-organization.client';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type {
  ResourceType,
  ScheduleRule,
} from '../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import {
  errorMessageOf,
  UUID_ERROR,
  UUID_PATTERN,
} from '../../../shared/forms/form-support';

/**
 * Roles que pueden construir una agenda.
 *
 * `PRACTITIONER` entró con el autoservicio: las escrituras del catálogo
 * declaran `@Roles('SCHEDULING_ADMIN', 'PRACTITIONER')`.
 */
const ROLES_QUE_CREAN = ['SCHEDULING_ADMIN', 'SUPERADMIN', 'PRACTITIONER'];

/** Roles de catálogo: arman la agenda de cualquiera, no sólo la propia. */
const ROLES_DE_CATALOGO = ['SCHEDULING_ADMIN', 'SUPERADMIN'];

/** Tabla del perfil profesional, tal como la nombra `assertPuedeCrearRecurso`. */
const TABLA_DE_PERFIL_PROFESIONAL = 'practitioner_profiles';

/**
 * Hasta dónde se materializan los cupos, en meses.
 *
 * La ventana `from`/`to` de `generate-slots` era una pregunta de pantalla y no
 * tenía por qué serlo: nadie sabe hasta qué fecha quiere «materializar cupos».
 * Se calcula desde hoy hasta este horizonte, o hasta la fecha de fin si el
 * médico declaró una, lo que llegue antes.
 *
 * Es el parche honesto mientras no exista el horizonte rodante (§6.3 del
 * análisis): cuando el worker lo reemplace, esta constante se va.
 */
const HORIZONTE_MESES = 3;

/** Duraciones ofrecidas como fichas. La séptima opción es escribirla. */
const DURACIONES = [15, 20, 30, 45, 60, 90] as const;

/** Entero positivo o vacío: los numéricos opcionales viajan como texto. */
const ENTERO_POSITIVO = /^\d+$/;

/** Hora `HH:MM` o `HH:MM:SS`, como la valida el DTO de la franja. */
const HORA = /^\d{2}:\d{2}(:\d{2})?$/;

/**
 * Los siete días, en el orden en que se leen.
 *
 * `numero` es el `dayOfWeek` que espera el contrato (0 = domingo), y el orden
 * del arreglo es el de la semana como la lee una persona: el domingo va al
 * final aunque su número sea el más chico.
 */
const DIAS = [
  { numero: 1, corto: 'L', largo: 'Lunes' },
  { numero: 2, corto: 'M', largo: 'Martes' },
  { numero: 3, corto: 'M', largo: 'Miércoles' },
  { numero: 4, corto: 'J', largo: 'Jueves' },
  { numero: 5, corto: 'V', largo: 'Viernes' },
  { numero: 6, corto: 'S', largo: 'Sábado' },
  { numero: 0, corto: 'D', largo: 'Domingo' },
] as const;

/** Una fila de la semana: el día y, si está activo, su horario. */
type DiaGroup = FormGroup<{
  activo: FormControl<boolean>;
  desde: FormControl<string>;
  hasta: FormControl<string>;
  duracion: FormControl<number>;
}>;

/** Lo que se muestra de un día en la semana visual. */
interface DiaVisible {
  readonly indice: number;
  readonly corto: string;
  readonly largo: string;
  readonly activo: boolean;
}

/**
 * **Publicar mi agenda** (M41, UC-41-01 → UC-41-04) — una pantalla, dos decisiones.
 *
 * ## Qué cambió, y qué no
 *
 * **No cambió el contrato.** Se mandan los mismos cuatro POST, en el mismo
 * orden —recurso → [política] → plantilla → generate-slots— con los mismos
 * campos. Lo que cambió es qué se le **pregunta** al médico.
 *
 * Antes eran cinco pasos y veinticinco campos, de los cuales cuatro los sabía
 * el sistema (el tipo de recurso, la tabla del perfil, su propio uuid y la
 * zona), uno no lo volvía a leer nadie (el nombre de la plantilla: no existe
 * `GET` de plantillas, así que era una etiqueta a ciegas), y una fase entera
 * —la excepción— obligaba a inventar una ausencia para poder terminar.
 *
 * Ahora se preguntan dos cosas: **qué días y en qué horario**, y **cuánto dura
 * una consulta**. Todo lo demás se deriva, se autocompleta o se fue a
 * «Opciones avanzadas».
 *
 * ## Por qué las escrituras siguen encadenadas
 *
 * Cada POST guarda su identificador antes del siguiente, igual que antes: si
 * uno falla, los anteriores quedaron firmes y reintentar **no los duplica**
 * —cada paso se saltea si ya tiene su id—. Es lo que hace que un error de red
 * a mitad no obligue a empezar de cero ni deje dos recursos iguales.
 *
 * ## Dónde quedaron las excepciones
 *
 * Fuera. Bloquear un día es algo que se hace sobre una agenda que ya existe,
 * mirando el mes —su casa es «Mi agenda»—, no un trámite para poder publicar.
 */
@Component({
  selector: 'app-agenda-create',
  imports: [
    ReactiveFormsModule,
    AnnounceOnAppear,
    Alert,
    AppButton,
    AppButtonLink,
    DatePicker,
    FormField,
    Input,
    PageHeader,
    RouterLink,
    Select,
  ],
  templateUrl: './agenda-create.html',
  styleUrl: './agenda-create.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaCreate {
  private readonly scheduling = inject(SchedulingClient);
  private readonly organizaciones = inject(MedicalOrganizationClient);
  private readonly auth = inject(AuthService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidError = UUID_ERROR;
  protected readonly dias = DIAS;
  protected readonly duraciones = DURACIONES;

  /** Si la sesión puede construir agenda. El backend manda; esto no ofrece 403. */
  protected readonly puedeCrear = computed(() =>
    ROLES_QUE_CREAN.some((rol) => this.auth.roles().includes(rol)),
  );

  /** Quien administra el catálogo puede publicar la agenda de otro recurso. */
  protected readonly puedePublicarParaOtro = computed(() =>
    ROLES_DE_CATALOGO.some((rol) => this.auth.roles().includes(rol)),
  );

  /**
   * El administrador pidió el formulario técnico, para una agenda ajena.
   *
   * Es opt-in: el camino por defecto —incluso para un admin que además
   * atiende— es publicar la propia sin escribir un identificador.
   */
  protected readonly publicarParaOtro = signal(false);

  /** Si quien entra sólo puede publicar **su propia** agenda. */
  protected readonly publicaSoloLaPropia = computed(() => {
    if (this.publicarParaOtro()) return false;
    return this.auth.practitionerProfileId() !== null;
  });

  /** Si la sesión no declara perfil profesional no hay agenda propia que armar. */
  protected readonly sinPerfilProfesional = computed(
    () => !this.puedePublicarParaOtro() && this.auth.practitionerProfileId() === null,
  );

  /** «Dra. Elena Salas», o vacío si el token no trae nombre. */
  protected readonly nombreDelTitular = computed(() => {
    const nombre = this.auth.displayName();
    return nombre === null || nombre.trim() === '' ? '' : nombre;
  });

  /* -- Estado de la publicación -------------------------------------------- */

  protected readonly estado = signal<ViewState<null>>(ready(null));
  protected readonly cargando = computed(() => this.estado().status === 'loading');
  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.estado(), 'No tenés permiso para configurar agenda.'),
  );
  protected readonly publicado = signal(false);

  /** Identificadores ya obtenidos: reintentar no vuelve a crearlos. */
  private readonly resourceId = signal<string | null>(null);
  private readonly policyId = signal<string | null>(null);
  private readonly templateId = signal<string | null>(null);
  protected readonly cuposCreados = signal<number | null>(null);

  /* -- Avanzadas y sedes ---------------------------------------------------- */

  protected readonly avanzadasAbiertas = signal(false);
  protected readonly usarPolitica = signal(false);
  protected readonly sedes = signal<readonly SelectOption<string>[]>([]);

  /**
   * La organización activa es la **única** fuente del `tenantId`: elegir otra
   * es cambiar el contexto de la sesión, no rellenar un input.
   */
  protected readonly organizacion = this.auth.activeTenantId;
  protected readonly sinOrganizacion = computed(() => this.organizacion() === null);

  /* -- El formulario -------------------------------------------------------- */

  protected readonly semana = new FormArray<DiaGroup>(DIAS.map((dia) => nuevoDia(dia.numero)));

  protected readonly formGeneral = new FormGroup({
    practiceId: new FormControl('', { nonNullable: true }),
    tieneFin: new FormControl<'no' | 'si'>('no', { nonNullable: true }),
    capacidadPorTurno: new FormControl('1', {
      nonNullable: true,
      validators: [Validators.pattern(ENTERO_POSITIVO)],
    }),
    timeZone: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
  });

  /** El formulario técnico, sólo para quien publica una agenda ajena. */
  protected readonly formTecnico = new FormGroup({
    resourceType: new FormControl<ResourceType | ''>('', { nonNullable: true }),
    resourceRefType: new FormControl('', { nonNullable: true }),
    resourceRefId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
  });

  /**
   * La política de reserva: opcional de verdad.
   *
   * `bookingPolicyId` es `@IsOptional()` en el contrato, pero el formulario
   * exigía `code` y `name` — era **más estricto que la API**, y esa exigencia
   * producía la mitad del relleno del alta. Ahora los dos se derivan del nombre
   * del recurso, y la política entera sólo se manda si el médico la abre.
   */
  protected readonly formPolitica = new FormGroup({
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
    maxActivePerPatient: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(ENTERO_POSITIVO)],
    }),
  });

  protected readonly fechaDeFin = signal<Date | null>(null);

  /* -- Derivados ------------------------------------------------------------ */

  /** Los días encendidos, para pintar la semana. */
  protected readonly diasVisibles = computed<readonly DiaVisible[]>(() => {
    this.versionDeLaSemana();
    return DIAS.map((dia, indice) => ({
      indice,
      corto: dia.corto,
      largo: dia.largo,
      activo: this.semana.at(indice).controls.activo.value,
    }));
  });

  protected readonly diasActivos = computed(() =>
    this.diasVisibles().filter((dia) => dia.activo),
  );

  /** Sin un solo día encendido no hay horario que publicar. */
  protected readonly sinDias = computed(() => this.diasActivos().length === 0);

  /**
   * El nombre del recurso, derivado.
   *
   * Antes era un campo obligatorio que el médico rellenaba a ciegas. Es su
   * agenda: el nombre sale de su nombre.
   */
  protected readonly nombreDelRecurso = computed(() => {
    if (!this.publicaSoloLaPropia()) return this.formTecnico.controls.name.value.trim();
    const nombre = this.nombreDelTitular();
    return nombre === '' ? 'Mi agenda' : `Agenda de ${nombre}`;
  });

  /** Un contador que cambia cuando la semana cambia, para que los `computed` la relean. */
  private readonly versionDeLaSemana = signal(0);

  constructor() {
    this.semana.valueChanges.subscribe(() => this.versionDeLaSemana.update((v) => v + 1));
    this.cargarSedes();
  }

  /**
   * Fija la identidad del recurso cuando el profesional publica la suya.
   *
   * Los tres campos que el backend comprueba dejan de existir en la pantalla:
   * el tipo es `PRACTITIONER`, la tabla es la del perfil profesional y el
   * identificador es el de su sesión. No se muestran deshabilitados sino que no
   * se muestran: un campo gris con un uuid adentro sigue siendo un uuid en
   * pantalla, y lo único que comunica es «acá hay algo que no entendés».
   */
  private readonly identidadDelRecurso = effect(() => {
    if (!this.publicaSoloLaPropia()) return;

    const propio = this.auth.practitionerProfileId();
    this.formTecnico.controls.resourceType.setValue('PRACTITIONER');
    this.formTecnico.controls.resourceRefType.setValue(TABLA_DE_PERFIL_PROFESIONAL);
    if (propio) this.formTecnico.controls.resourceRefId.setValue(propio);

    // La zona horaria del navegador: es la de la sede donde va a atender, y
    // equivocarla le mueve todos los horarios.
    if (this.formGeneral.controls.timeZone.value.trim() === '') {
      const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (zona) this.formGeneral.controls.timeZone.setValue(zona);
    }
  });

  /* -- La semana ------------------------------------------------------------ */

  protected alternarDia(indice: number): void {
    const control = this.semana.at(indice).controls.activo;
    control.setValue(!control.value);
  }

  protected grupoDe(indice: number): DiaGroup {
    return this.semana.at(indice);
  }

  protected elegirDuracion(indice: number, minutos: number): void {
    this.semana.at(indice).controls.duracion.setValue(minutos);
  }

  /**
   * Copia el horario del primer día encendido a todos los demás.
   *
   * Casi todas las agendas repiten el mismo horario, y cargarlo cinco veces es
   * el tipo de trabajo que la pantalla tiene que hacer por vos.
   */
  protected repetirElPrimero(): void {
    const primero = this.diasActivos()[0];
    if (primero === undefined) return;

    const modelo = this.semana.at(primero.indice).getRawValue();
    for (const dia of this.diasActivos()) {
      if (dia.indice === primero.indice) continue;
      this.semana.at(dia.indice).patchValue({
        desde: modelo.desde,
        hasta: modelo.hasta,
        duracion: modelo.duracion,
      });
    }
  }

  /* -- Publicar ------------------------------------------------------------- */

  /**
   * Manda los cuatro POST en cadena, salteando los que ya se hicieron.
   *
   * El anidamiento sigue el orden del contrato: cada respuesta aporta el
   * identificador que necesita la siguiente. No hay operadores de RxJS a
   * propósito —el resto del repo tampoco los usa en componentes— y el guardado
   * parcial hace que un reintento retome donde falló.
   */
  protected publicar(): void {
    if (this.cargando()) return;

    this.semana.markAllAsTouched();
    this.formGeneral.markAllAsTouched();
    if (this.sinDias() || this.semana.invalid || this.formGeneral.invalid) return;

    const tenantId = this.organizacion();
    if (tenantId === null) return;

    this.estado.set(loading());
    this.crearRecurso(tenantId);
  }

  private crearRecurso(tenantId: string): void {
    const yaEsta = this.resourceId();
    if (yaEsta !== null) {
      this.crearPolitica(tenantId, yaEsta);
      return;
    }

    const general = this.formGeneral.getRawValue();
    const tecnico = this.formTecnico.getRawValue();

    this.scheduling
      .createResource({
        tenantId,
        resourceType: (tecnico.resourceType || 'PRACTITIONER') as ResourceType,
        resourceRefType: tecnico.resourceRefType.trim() || TABLA_DE_PERFIL_PROFESIONAL,
        resourceRefId: tecnico.resourceRefId.trim(),
        name: this.nombreDelRecurso(),
        ...opcTexto('practiceId', general.practiceId),
        ...opcTexto('timeZone', general.timeZone),
        // La capacidad se pregunta UNA vez: la del recurso y la de cada cupo
        // son el mismo número, y preguntarlo dos veces sólo servía para que no
        // coincidieran.
        ...opcEntero('capacity', general.capacidadPorTurno),
      })
      .subscribe({
        next: (recurso) => {
          this.resourceId.set(recurso.id);
          this.crearPolitica(tenantId, recurso.id);
        },
        error: (error: unknown) => this.fallar(error),
      });
  }

  private crearPolitica(tenantId: string, resourceId: string): void {
    if (!this.usarPolitica() || this.policyId() !== null) {
      this.crearPlantilla(resourceId, this.policyId());
      return;
    }

    const v = this.formPolitica.getRawValue();
    this.scheduling
      .createPolicy({
        tenantId,
        // Derivados: eran dos campos obligatorios que nadie vuelve a leer.
        code: codigoDe(this.nombreDelRecurso()),
        name: `Reglas de ${this.nombreDelRecurso()}`,
        ...opcEntero('minNoticeMinutes', v.minNoticeMinutes),
        ...opcEntero('maxAdvanceDays', v.maxAdvanceDays),
        ...opcEntero('cancellationWindowMinutes', v.cancellationWindowMinutes),
        ...opcEntero('maxActivePerPatient', v.maxActivePerPatient),
      })
      .subscribe({
        next: (politica) => {
          this.policyId.set(politica.id);
          this.crearPlantilla(resourceId, politica.id);
        },
        error: (error: unknown) => this.fallar(error),
      });
  }

  private crearPlantilla(resourceId: string, policyId: string | null): void {
    const yaEsta = this.templateId();
    if (yaEsta !== null) {
      this.generarCupos(yaEsta);
      return;
    }

    const capacidad = this.formGeneral.getRawValue().capacidadPorTurno;
    const rules: ScheduleRule[] = this.diasActivos().map((dia) => {
      const v = this.semana.at(dia.indice).getRawValue();
      return {
        dayOfWeek: DIAS[dia.indice].numero,
        startTime: v.desde.trim(),
        endTime: v.hasta.trim(),
        slotMinutes: v.duracion,
        ...opcEntero('capacityPerSlot', capacidad),
      } as ScheduleRule;
    });

    this.scheduling
      .createTemplate(resourceId, {
        // Derivado: no hay `GET` de plantillas, así que este nombre no lo
        // vuelve a leer nadie. Pedirlo era pedir una etiqueta a ciegas.
        name: `Horario de ${this.nombreDelRecurso()}`,
        rules,
        // El contrato lo pide también a nivel plantilla; va el de la primera
        // franja, que es el que gobierna cuando una regla no trae el suyo.
        slotMinutes: rules[0]?.slotMinutes,
        ...(policyId === null ? {} : { bookingPolicyId: policyId }),
        ...opcFecha('validTo', this.fechaDeFin()),
      })
      .subscribe({
        next: (plantilla) => {
          this.templateId.set(plantilla.id);
          this.generarCupos(plantilla.id);
        },
        error: (error: unknown) => this.fallar(error),
      });
  }

  private generarCupos(templateId: string): void {
    const desde = new Date();
    const horizonte = new Date(desde);
    horizonte.setMonth(horizonte.getMonth() + HORIZONTE_MESES);

    // Hasta el horizonte, o hasta la fecha de fin si llega antes: generar cupos
    // más allá de cuándo el horario deja de valer sería publicar turnos que la
    // plantilla no respalda.
    const fin = this.fechaDeFin();
    const hasta = fin !== null && fin.getTime() < horizonte.getTime() ? fin : horizonte;

    this.scheduling
      .generateSlots(templateId, { from: desde.toISOString(), to: hasta.toISOString() })
      .subscribe({
        next: (resultado) => {
          this.cuposCreados.set(resultado.created);
          this.estado.set(ready(null));
          this.publicado.set(true);
        },
        error: (error: unknown) => this.fallar(error),
      });
  }

  private fallar(error: unknown): void {
    this.estado.set(errorToViewState<null>(error));
  }

  private cargarSedes(): void {
    this.organizaciones.listPractices().subscribe({
      next: (practicas) =>
        this.sedes.set(practicas.map((p) => ({ value: p.id, label: p.name }))),
      // Sin sedes el campo simplemente no se ofrece: `practiceId` es opcional
      // en el contrato y no vale bloquear la publicación por una lectura
      // accesoria.
      error: () => this.sedes.set([]),
    });
  }

  /* -- El resumen, en palabras ---------------------------------------------- */

  /**
   * Lo publicado dicho como se lo contaría a un colega.
   *
   * «Publicaste: lunes y jueves de 9 a 13, consultas de 30 minutos.» Cero
   * uuids: el médico no tiene por qué ver un identificador nunca.
   */
  protected readonly resumen = computed(() => {
    const activos = this.diasActivos();
    if (activos.length === 0) return '';

    const nombres = activos.map((dia) => dia.largo.toLowerCase());
    const dias =
      nombres.length === 1
        ? nombres[0]
        : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;

    const primero = this.semana.at(activos[0].indice).getRawValue();
    const mismoHorario = activos.every((dia) => {
      const v = this.semana.at(dia.indice).getRawValue();
      return v.desde === primero.desde && v.hasta === primero.hasta;
    });

    const horario = mismoHorario
      ? ` de ${enHoras(primero.desde)} a ${enHoras(primero.hasta)}`
      : '';
    return `${dias}${horario}, consultas de ${primero.duracion} minutos`;
  });
}

/** Un día de la semana, apagado y con un horario de mañana por defecto. */
function nuevoDia(_dayOfWeek: number): DiaGroup {
  return new FormGroup({
    activo: new FormControl(false, { nonNullable: true }),
    desde: new FormControl('09:00', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(HORA)],
    }),
    hasta: new FormControl('13:00', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(HORA)],
    }),
    duracion: new FormControl(30, { nonNullable: true, validators: [Validators.required] }),
  });
}

/** `09:00` → `9`, `13:30` → `13:30`: la hora redonda se lee sin los minutos. */
function enHoras(hora: string): string {
  const [h, m] = hora.split(':');
  return m === '00' ? String(Number(h)) : `${Number(h)}:${m}`;
}

/** Un código estable a partir del nombre, para la política derivada. */
function codigoDe(nombre: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toUpperCase()
    .slice(0, 60)
    .replace(/^-|-$/g, '');
  return base === '' ? 'AGENDA' : base;
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

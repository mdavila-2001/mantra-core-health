import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { formatDate, TitleCasePipe } from '@angular/common';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type {
  PublishedRule,
  PublishedTemplate,
  ResourceType,
  ScheduleRule,
} from '../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { AGENDA_ROUTE } from '../agenda.routes';
import type { AgendaResource } from '@core/data-access/scheduling/scheduling.types';
import { agendaResourcesMy } from '../my-resource';
import { ScheduleGrid } from '../my-agenda/schedule-grid/schedule-grid';
import { OrganizationField } from '../organization-field/organization-field';
import { calculateSlots, type Calculation, type CalculatedDay } from './agenda-slots';
import { PublicationAttempt, PublicationPlace, type PublicationTarget } from './publication-target';
import { ScheduleDayRow } from './schedule-day-row/schedule-day-row';
import {
  createScheduleDay,
  DURATION_OPTIONS,
  FLEXIBLE_DAY_FIELDS,
  fixedTurnFields,
  MODE_OPTIONS,
  TIME_STEP_SECONDS,
  YES_NO,
  type ScheduleDayForm,
  type ScheduleDayValue,
} from './schedule-day-row/schedule-day';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Link } from '../../../shared/components/atoms/link/link';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Router } from '@angular/router';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { BlockCancellations } from '../block-cancellations';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import { AccordionPanel } from '../../../shared/components/molecules/accordion/accordion-panel/accordion-panel';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, UUID_ERROR, UUID_PATTERN } from '../../../shared/forms/form-support';

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

/**
 * A cuánto se cae la duración cuando el horario vigente no la declara.
 *
 * Media hora: es la duración más frecuente y la que el propio formulario trae
 * marcada al abrirse en blanco.
 */
const DURACION_POR_OMISION = 30;

/** El almuerzo que se propone al encenderlo: una hora, al mediodía. */
const ALMUERZO_POR_OMISION = { desde: '13:00', hasta: '14:00' } as const;

/** Entero positivo o vacío: los numéricos opcionales viajan como texto. */
const ENTERO_POSITIVO = /^\d+$/;

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

/** Lo que se muestra de un día en la semana visual. */
interface DiaVisible {
  readonly indice: number;
  readonly corto: string;
  readonly largo: string;
  readonly activo: boolean;
  /** La fila entera, para dibujarla (`ScheduleDayRow`). */
  readonly value: ScheduleDayValue;
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
    AccordionPanel,
    Alert,
    AppButton,
    AppButtonLink,
    Link,
    ContentDialog,
    DatePicker,
    FormField,
    Input,
    OrganizationField,
    PageHeader,
    RouterLink,
    ScheduleDayRow,
    ScheduleGrid,
    SegmentedControl,
    Select,
    Switch,
    TitleCasePipe,
  ],
  templateUrl: './agenda-create.html',
  styleUrl: './agenda-create.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaCreate {
  private readonly scheduling = inject(SchedulingClient);
  private readonly dialogs = inject(DialogService);
  private readonly cancellations = inject(BlockCancellations);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly navigation = inject(NavigationService);
  /** El idioma activo, para escribir la vigencia fuera de la plantilla. */
  private readonly idioma = inject(LOCALE_ID);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  /** A dónde vuelven «Ver mi agenda» y «Cancelar»: la agenda, que es de donde se vino. */
  protected readonly rutaDeMiAgenda = AGENDA_ROUTE;

  protected readonly uuidError = UUID_ERROR;
  protected readonly dias = DIAS;

  protected readonly siNo = YES_NO;

  /* -- La tabla, que es la forma que pidió el propietario ------------------- */

  /** El paso de los campos de hora del almuerzo: el mismo de la tabla. */
  protected readonly pasoDeHora = TIME_STEP_SECONDS;

  protected readonly opcionesDeDuracion = DURATION_OPTIONS;

  /** Qué se atiende en cada franja (v4.2.40); la fila lo ofrece en «Atiendo». */
  protected readonly opcionesDeModo = MODE_OPTIONS;

  /** Fija un valor de la fila sin que la plantilla tenga que saber de formularios. */
  protected fijarDeLaFila(indice: number, campo: string, valor: unknown): void {
    if (valor === null || valor === undefined) return;
    this.semana
      .at(indice)
      .get(campo)
      ?.setValue(valor as never);
    this.versionDeLaSemana.update((v) => v + 1);
  }

  /** Si la sesión puede construir agenda. El backend manda; esto no ofrece 403. */
  protected readonly puedeCrear = computed(() =>
    ROLES_QUE_CREAN.some((rol) => this.auth.roles().includes(rol)),
  );

  /** Las agendas de quien publica, en la organización elegida. Más de una = más de una sede. */
  protected readonly misAgendas = signal<readonly AgendaResource[]>([]);

  /**
   * Publicar en una agenda **nueva** en vez de en una que ya existe.
   *
   * Sin esto, quien ya tenía una agenda no podía crear una segunda **nunca**:
   * `crearRecurso` reutiliza el `resourceId` que la pantalla resuelve al
   * cargar, y ese id siempre estaba puesto. La pantalla decía «Publicar mi
   * agenda» y en realidad editaba la única que había.
   *
   * Es lo que faltaba para que «elegir dónde publicar» signifique algo cuando
   * todavía no hay dónde: primero hay que poder crear el otro lado.
   */
  protected readonly agendaNueva = signal(false);

  /**
   * Por qué no se pudo leer la agenda o el horario vigentes. **Con un error acá
   * no se publica**: sin `resourceId` publicar CREA una agenda y duplicaría la
   * que ya existe.
   */
  protected readonly errorDeLectura = signal<string | null>(null);

  /** Cómo se va a llamar la agenda nueva. «Consultorio en la Caja», «Sábados». */
  protected readonly nombreNuevo = signal('');

  /**
   * El bloque «¿En qué agenda publica?» se ofrece con **al menos una** agenda:
   * ahí vive «crear otra agenda». Con cero se crea la primera con el formulario
   * de siempre.
   */
  protected readonly eligeSede = computed(() => this.misAgendas().length > 0);

  protected readonly opcionesDeSede = computed<SelectOption<string>[]>(() =>
    this.misAgendas().map((r) => ({ value: r.id, label: r.name })),
  );

  protected fijarNombreNuevo(valor: string | number | null): void {
    this.nombreNuevo.set(valor === null ? '' : String(valor));
  }

  /**
   * Empieza una agenda nueva en vez de editar una existente.
   *
   * Suelta el `resourceId` —que es lo único que hacía que `crearRecurso`
   * reutilizara la de siempre— y limpia el horario vigente en pantalla: el de
   * la agenda anterior no describe a la que todavía no existe.
   */
  protected empezarAgendaNueva(): void {
    this.agendaNueva.set(true);
    this.resourceId.set(null);
    this.templateId.set(null);
    this.policyId.set(null);
    this.vigente.set(null);
    this.attempt.reset();
  }

  /** Vuelve a publicar sobre una agenda que ya existe. */
  protected volverAAgendaExistente(): void {
    this.agendaNueva.set(false);
    const primera = this.misAgendas()[0];
    if (primera !== undefined) this.elegirSede(primera.id);
  }

  /**
   * Cambia la agenda sobre la que se publica y relee su horario vigente.
   *
   * Releer no es opcional: cada sede tiene su propio horario, y dejar en
   * pantalla el de la anterior haría que alguien publique creyendo que corrige
   * lo que ya tenía. Por lo mismo se suelta lo que el intento hizo sobre la
   * anterior —su retiro, su plantilla—: no vale para ésta.
   */
  protected elegirSede(id: string | null): void {
    if (this.agendaNueva()) this.agendaNueva.set(false);
    if (id === null || id === this.resourceId()) return;
    this.resourceId.set(id);
    this.templateId.set(null);
    this.vigente.set(null);
    this.attempt.reset();
    this.loadCurrentTemplate(id);
  }

  /** Trae el horario vigente de una agenda; si mientras tanto se eligió otra, ya no manda. */
  private loadCurrentTemplate(resourceId: string): void {
    this.scheduling.listTemplates(resourceId, this.place.scope()).subscribe({
      next: (pagina) => {
        if (resourceId !== this.resourceId()) return;
        // La primera es la que gobierna: el servidor las devuelve de la más reciente a la
        // más vieja, y es el mismo criterio que usa «Mi agenda» para decir qué horario tenés.
        const vigente = pagina.items[0];
        if (vigente === undefined) return;
        this.vigente.set(vigente);
        this.cargarSemanaDesde(vigente);
      },
      error: (error: unknown) => {
        if (resourceId !== this.resourceId()) return;
        this.errorDeLectura.set(
          'No pudimos leer el horario que tiene hoy en esta agenda. ' +
            (errorMessageOf(errorToViewState<null>(error), 'No tiene permiso para leerlo.') ?? ''),
        );
      },
    });
  }

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
    errorMessageOf(this.estado(), 'No tiene permiso para configurar agenda.'),
  );
  protected readonly publicado = signal(false);

  /**
   * Si el fallo es el de las citas comprometidas.
   *
   * Se reconoce por el **código** del contrato y no por el texto: el mensaje es
   * del servidor y puede cambiar de redacción sin avisar.
   */
  protected readonly citasQueFrenan = computed(() => {
    const estado = this.estado();
    return estado.status === 'validation' && estado.issues.some((i) => i.code === 'CONFLICT');
  });

  /* -- Cambiar un horario que ya existe (D2 del plan de UX) ---------------- */

  /**
   * El horario vigente, cuando esta pantalla se abre para **cambiarlo**.
   *
   * `null` mientras se lo busca o cuando de verdad no hay ninguno. Que sea no
   * nulo es lo que convierte a esta pantalla de «publicá tu agenda» en «cambiá
   * tu horario»: mismo formulario, otro encabezado y otro aviso.
   */
  protected readonly vigente = signal<PublishedTemplate | null>(null);

  /** Si se está editando un horario ya publicado. */
  protected readonly esCambio = computed(() => this.vigente() !== null);

  /** Identificadores ya obtenidos: reintentar no vuelve a crearlos. */
  protected readonly resourceId = signal<string | null>(null);
  private readonly policyId = signal<string | null>(null);
  private readonly templateId = signal<string | null>(null);
  protected readonly cuposCreados = signal<number | null>(null);

  /* -- Avanzadas ------------------------------------------------------------ */

  protected readonly avanzadasAbiertas = signal(false);

  /* -- Horario flexible y almuerzo (propietario, 18/09) --------------------- */

  /**
   * Toda la semana flexible: se atiende en la franja, pero **sin turnos fijos**.
   *
   * Es el atajo de arriba de la tabla y es `flexibleHours` de la plantilla: con
   * él encendido todos los días lo son, digan lo que digan sus filas —la misma
   * regla que la API (`isFlexibleBand`)— y la tabla no pregunta por turnos.
   * Para que lo sean sólo algunos días, cada fila tiene su interruptor (v4.2.64).
   */
  protected readonly flexible = signal(false);

  /** Si el día se atiende sin turnos fijos: por la semana entera o por su fila. */
  protected isFlexibleDay(index: number): boolean {
    return this.flexible() || this.semana.at(index).controls.flexible.value;
  }

  /** Los días encendidos que se atienden sin turnos fijos. */
  protected readonly flexibleDays = computed(() =>
    this.diasActivos().filter((dia) => this.isFlexibleDay(dia.indice)),
  );

  /** Toda la semana encendida es flexible: lo declara la plantilla, como antes (P36). */
  protected readonly allDaysFlexible = computed(
    () => this.flexible() || (this.diasActivos().length > 0 && this.flexibleDays().length === this.diasActivos().length),
  );

  /** El atajo: «Sí» vuelve flexible toda la semana; «No» devuelve los turnos fijos a todos los días. */
  protected setWeekFlexible(flexible: boolean): void {
    this.flexible.set(flexible);
    if (!flexible) this.semana.controls.forEach((day) => day.controls.flexible.setValue(false));
  }

  /**
   * Cuánto se reserva por paciente en horario flexible (P36).
   *
   * Sin turnos fijos el paciente elige la hora, pero la consulta igual ocupa un
   * rato: es lo que impide que dos pacientes pidan la misma hora. Se pregunta
   * una vez para toda la agenda y viaja como `slotMinutes` de la plantilla.
   */
  protected readonly minutosPorPaciente = signal<number>(DURACION_POR_OMISION);

  protected elegirMinutosPorPaciente(minutos: number | null): void {
    if (minutos !== null) this.minutosPorPaciente.set(minutos);
  }

  /**
   * La hora de almuerzo, una para toda la semana.
   *
   * No es una columna más de la tabla: el almuerzo es de la persona, no del
   * día, y repetirlo en siete filas es la forma de que un día quede distinto
   * sin querer. Sólo corta los días cuya franja lo atraviesa.
   */
  protected readonly conAlmuerzo = signal(false);
  protected readonly almuerzoDesde = signal<string>(ALMUERZO_POR_OMISION.desde);
  protected readonly almuerzoHasta = signal<string>(ALMUERZO_POR_OMISION.hasta);

  /** El almuerzo está al revés o vacío: se avisa y no se publica. */
  protected readonly almuerzoInvalido = computed(() => {
    if (!this.conAlmuerzo()) return false;
    const desde = aMinutos(this.almuerzoDesde());
    const hasta = aMinutos(this.almuerzoHasta());
    return desde === null || hasta === null || hasta <= desde;
  });

  protected fijarAlmuerzo(extremo: 'desde' | 'hasta', valor: string | number | null): void {
    if (valor === null) return;
    (extremo === 'desde' ? this.almuerzoDesde : this.almuerzoHasta).set(String(valor));
  }

  /**
   * Las franjas reales de un día: la del formulario, partida por el almuerzo.
   *
   * El almuerzo no es un campo del contrato y no hace falta que lo sea: un día
   * con almuerzo son **dos franjas** —mañana y tarde— y el generador de la API
   * ya recorre todas las reglas de cada día. Si el almuerzo no cae dentro del
   * horario de ese día, el día queda entero.
   */
  protected franjasDe(indice: number): { desde: string; hasta: string }[] {
    this.versionDeLaSemana();
    const v = this.semana.at(indice).getRawValue();
    const inicio = aMinutos(v.desde);
    const fin = aMinutos(v.hasta);
    const corteDesde = aMinutos(this.almuerzoDesde());
    const corteHasta = aMinutos(this.almuerzoHasta());
    if (
      !this.conAlmuerzo() ||
      this.almuerzoInvalido() ||
      inicio === null ||
      fin === null ||
      corteDesde === null ||
      corteHasta === null ||
      corteHasta <= inicio ||
      corteDesde >= fin
    ) {
      return [{ desde: v.desde, hasta: v.hasta }];
    }
    const partes: { desde: string; hasta: string }[] = [];
    if (corteDesde > inicio) partes.push({ desde: v.desde, hasta: this.almuerzoDesde() });
    if (corteHasta < fin) partes.push({ desde: this.almuerzoHasta(), hasta: v.hasta });
    return partes;
  }

  /** Si el almuerzo corta el horario de este día. */
  protected almuerzaEse(indice: number): boolean {
    const partes = this.franjasDe(indice);
    const v = this.semana.at(indice).getRawValue();
    return partes.length !== 1 || partes[0].desde !== v.desde || partes[0].hasta !== v.hasta;
  }

  /** Un día calculado a partir de sus franjas, sumando lo de cada una. */
  private calcularDia(indice: number, nombre: string): CalculatedDay {
    const v = this.semana.at(indice).getRawValue();
    // Una franja sólo de servicios no se corta en turnos: cada servicio dura lo que
    // declaró su profesional y el turno nace al reservarlo. Un día flexible, tampoco.
    if (v.modo === 'SERVICES' || this.isFlexibleDay(indice))
      return { dia: nombre, turnos: [], resto: 0, restoDesde: null };
    const franjas = this.franjasDe(indice);
    const partes = calculateSlots(
      franjas.map((franja, posicion) => ({
        dia: nombre,
        desde: franja.desde,
        hasta: franja.hasta,
        duracion: v.duracion,
        receso: v.respiro,
        // La mañana no puede estirarse sobre la tarde.
        ...(franjas[posicion + 1] === undefined ? {} : { tope: franjas[posicion + 1].desde }),
      })),
    ).porDia;
    const ultima = partes.at(-1);
    return {
      dia: nombre,
      turnos: partes.flatMap((parte) => parte.turnos),
      resto: ultima?.resto ?? 0,
      restoDesde: ultima?.restoDesde ?? null,
    };
  }
  protected readonly usarPolitica = signal(false);
  // La sede y los pacientes por turno ya no se preguntan (propietario,
  // 18/09): la sede la fija la agenda elegida en el conmutador de organización,
  // y un turno es de un paciente. `practiceId` y `capacidadPorTurno` siguen en
  // el formulario con su valor por omisión —o el del horario que se edita—,
  // así que lo que ya estaba publicado no se pierde al guardar.

  /** La organización activa de la sesión: donde publica «Mi consultorio», como siempre. */
  protected readonly organizacion = this.auth.activeTenantId;
  protected readonly sinOrganizacion = computed(() => this.organizacion() === null);
  /** Dónde se publica: la organización elegida en «¿Dónde publica?» o la de la sesión. */
  protected readonly place = new PublicationPlace(this.organizacion, this.publicaSoloLaPropia);

  /* -- El formulario -------------------------------------------------------- */

  protected readonly semana = new FormArray<ScheduleDayForm>(DIAS.map(() => createScheduleDay()));

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
      value: this.semana.at(indice).getRawValue(),
    }));
  });

  protected readonly diasActivos = computed(() => this.diasVisibles().filter((dia) => dia.activo));

  /** Sin un solo día encendido no hay horario que publicar. */
  protected readonly sinDias = computed(() => this.diasActivos().length === 0);

  /**
   * Los turnos que van a salir, calculados en el navegador.
   *
   * Sin una sola petición: los cupos son una división —{@link calculateSlots}—,
   * y esperarlos del servidor para poder mostrarlos convertiría cada tecla en
   * un viaje de red. El contraste contra lo que el backend generó de verdad se
   * hace después de publicar, en {@link compararConLoGenerado}.
   */
  protected readonly vistaPrevia = computed<Calculation>(() => {
    // El almuerzo vive en señales y la semana en el formulario: se leen las
    // dos para que cambiar cualquiera recalcule. Cada día pasa por
    // `calcularTurnos` franja por franja — el respiro (AG-4) incluido.
    this.conAlmuerzo();
    this.almuerzoDesde();
    this.almuerzoHasta();
    const porDia = this.diasActivos().map((dia) =>
      this.calcularDia(dia.indice, dia.largo.toLowerCase()),
    );
    return { porDia, total: porDia.reduce((suma, dia) => suma + dia.turnos.length, 0) };
  });

  /**
   * El nombre del recurso, derivado.
   *
   * Antes era un campo obligatorio que el médico rellenaba a ciegas. Es su
   * agenda: el nombre sale de su nombre.
   */
  protected readonly nombreDelRecurso = computed(() => {
    if (!this.publicaSoloLaPropia()) return this.formTecnico.controls.name.value.trim();
    // Una agenda nueva se llama como la persona quiera: «Consultorio en la
    // Caja», «Sábados en el centro». Es lo único que la distingue de la otra en
    // todas las listas del producto, así que no se deriva.
    if (this.agendaNueva()) {
      const propio = this.nombreNuevo().trim();
      if (propio !== '') return propio;
    }
    const nombre = this.nombreDelTitular();
    return nombre === '' ? 'Mi agenda' : `Agenda de ${nombre}`;
  });

  /** Un contador que cambia cuando la semana cambia, para que los `computed` la relean. */
  private readonly versionDeLaSemana = signal(0);

  /**
   * La capacidad por turno, espejada como señal.
   *
   * Va aparte de `versionDeLaSemana` porque no es de la semana: sin esto, la
   * grilla de la previa seguiría contando «1 paciente por turno» después de
   * haberlo cambiado a tres, que es peor que no decirlo.
   */
  private readonly capacidadDeclarada = signal(this.formGeneral.getRawValue().capacidadPorTurno);

  constructor() {
    this.semana.valueChanges.subscribe(() => this.versionDeLaSemana.update((v) => v + 1));
    this.formGeneral.controls.capacidadPorTurno.valueChanges.subscribe((valor) =>
      this.capacidadDeclarada.set(valor),
    );
    // El horario vigente se busca donde se publica, y otra vez si eso cambia.
    this.place.watchTenant((tenantId) => this.cargarHorarioVigente(tenantId));
  }

  /**
   * Busca el horario ya publicado y, si lo hay, lo carga en el formulario.
   *
   * ## Por qué esto no es una comodidad, es una corrección
   *
   * «Mi agenda» ofrecía «Cambiar mi horario» y traía acá, a un formulario en
   * blanco que **siempre creaba un recurso nuevo**. Es decir: el médico que
   * quería mover su horario de los martes terminaba con **dos agendas** en la
   * misma organización, y los pacientes viendo los turnos de las dos. Era el
   * pedido de Pablo —«vista de edición de horarios»— y a la vez un defecto.
   *
   * Ahora, si el recurso ya existe, se reusa (`resourceId` queda fijado antes
   * de publicar) y la semanita se rellena con lo que hoy está vigente. La
   * pantalla que se reabre es **reconocible**, que es lo que hace que editar se
   * sienta editar.
   *
   * Un fallo acá **se dice y frena la publicación** (`errorDeLectura`): sin la
   * agenda leída publicar crearía una nueva y duplicaría la existente.
   */
  private cargarHorarioVigente(tenantId: string | null): void {
    const perfil = this.auth.practitionerProfileId();
    // Las agendas de otra organización no son de ésta: se sueltan antes de buscar.
    this.misAgendas.set([]);
    this.resourceId.set(null);
    this.templateId.set(null);
    this.policyId.set(null);
    this.vigente.set(null);
    this.errorDeLectura.set(null);
    this.attempt.reset();
    // Sin rol de agenda tampoco se pregunta: la lectura devolvería 403 y esta
    // pantalla ya le está diciendo a esa sesión que la sección no es suya.
    if (perfil === null || tenantId === null || !this.puedeCrear()) return;

    agendaResourcesMy(this.scheduling, tenantId, perfil, this.place.scope()).subscribe({
      next: (recursos) => {
        if (tenantId !== this.place.tenantId()) return;
        // Todas, no la primera: quien atiende en dos sedes tiene que poder
        // decir en cuál publica. Antes esta lectura hacía `.find()` y la
        // segunda agenda no existía para el producto.
        this.misAgendas.set(recursos);
        // Si ya se pidió empezar una agenda nueva, la lectura no vuelve a
        // apuntar a la vieja: pisarla acá haría que publicar edite la de
        // siempre sin que nadie lo note.
        if (this.agendaNueva()) return;
        const recurso = recursos[0];
        if (recurso === undefined) return;
        this.resourceId.set(recurso.id);
        this.loadCurrentTemplate(recurso.id);
      },
      error: (error: unknown) => {
        if (tenantId !== this.place.tenantId()) return;
        this.errorDeLectura.set(
          'No pudimos leer sus agendas de esta organización. ' +
            (errorMessageOf(errorToViewState<null>(error), 'No tiene permiso para leerlas.') ?? ''),
        );
      },
    });
  }

  protected reintentarLectura(): void {
    this.cargarHorarioVigente(this.place.tenantId());
  }

  /** Vuelca las reglas del horario vigente en la semanita del formulario. */
  private cargarSemanaDesde(plantilla: PublishedTemplate): void {
    for (const indice of DIAS.keys()) {
      this.semana.at(indice).patchValue({ activo: false });
    }
    this.flexible.set(plantilla.flexibleHours === true);
    this.minutosPorPaciente.set(plantilla.slotMinutes ?? DURACION_POR_OMISION);
    this.conAlmuerzo.set(false);
    const conTelemedicina = new Set<number>();
    for (const [indice, dia] of DIAS.entries()) {
      // Un día con almuerzo vuelve como DOS franjas: el horario es de la
      // primera apertura al último cierre, y el hueco entre ellas es el
      // almuerzo que se había declarado.
      const reglas = plantilla.rules
        .filter((regla) => regla.dayOfWeek === dia.numero)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      const primera = reglas[0];
      const ultima = reglas.at(-1);
      if (primera === undefined || ultima === undefined) continue;
      this.semana.at(indice).patchValue({
        activo: true,
        desde: sinSegundos(primera.startTime),
        hasta: sinSegundos(ultima.endTime),
        duracion: primera.slotMinutes ?? plantilla.slotMinutes ?? DURACION_POR_OMISION,
        // `?? 0` acá y no en el envío: leyendo, ausente ES cero; escribiendo,
        // ausente y cero son cosas distintas.
        respiro: primera.gapMinutes ?? 0,
        modo: primera.bookingMode ?? 'CONSULTATIONS',
        telemedicina: primera.telemedicineEnabled === true,
        flexible: primera.flexibleHours === true,
      });
      if (primera.telemedicineEnabled === true) conTelemedicina.add(indice);
      if (reglas.length > 1 && !this.conAlmuerzo()) {
        this.conAlmuerzo.set(true);
        this.almuerzoDesde.set(sinSegundos(primera.endTime));
        this.almuerzoHasta.set(sinSegundos(reglas[1].startTime));
      }
    }
    this.diasConTelemedicinaPublicada.set(conTelemedicina);
    if (plantilla.validTo !== undefined) {
      this.formGeneral.controls.tieneFin.setValue('si');
      this.fechaDeFin.set(new Date(plantilla.validTo));
    }
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

  protected grupoDe(indice: number): ScheduleDayForm {
    return this.semana.at(indice);
  }

  protected elegirDuracion(indice: number, minutos: number): void {
    this.semana.at(indice).controls.duracion.setValue(minutos);
  }

  protected elegirRespiro(indice: number, minutos: number): void {
    this.semana.at(indice).controls.respiro.setValue(minutos);
  }

  /**
   * Cuántos turnos entran en la franja de un día, con el respiro contado.
   *
   * Delega en {@link calculateSlots}, que es el mismo cálculo que alimenta la
   * vista previa de más abajo. **No se reimplementa acá**: dos aritméticas para
   * el mismo número terminan dando dos números, y en esta pantalla los dos se
   * ven a la vez.
   *
   * @param indice - El día de la semana, por su posición.
   */
  protected turnosDelDia(indice: number): number {
    return this.calcularDia(indice, DIAS[indice].largo).turnos.length;
  }

  /**
   * Los días que, en el horario que se está cambiando, ya atendían por
   * telemedicina. Sólo ahí apagarla se escribe como `false`: en un día que
   * nunca la tuvo, «no la activó» es lo mismo que no decir nada.
   */
  private readonly diasConTelemedicinaPublicada = signal<ReadonlySet<number>>(new Set());

  /**
   * El campo `telemedicineEnabled` de las franjas de un día, o nada.
   *
   * Misma convención que `bookingMode` y `gapMinutes`: no se escribe un valor
   * que nadie eligió. `true` cuando el médico la activó; `false` sólo cuando la
   * apaga en un día que la tenía publicada.
   */
  private telemedicinaDe(
    indice: number,
    activa: boolean,
  ): { readonly telemedicineEnabled?: boolean } {
    if (activa) return { telemedicineEnabled: true };
    return this.diasConTelemedicinaPublicada().has(indice) ? { telemedicineEnabled: false } : {};
  }

  /* -- Repetir un horario en los demás días --------------------------------

     Propietario, 04/10/2026: el botón estaba al pie y copiaba el primer día
     sobre todos SIN preguntar. Ahora va arriba de la tabla, abre un modal que
     pregunta y deja elegir qué fila repetir, y copia también el descanso, que
     antes se quedaba atrás. */

  /** Si el modal de repetir está abierto. */
  protected readonly repetirAbierto = signal(false);

  /** La fila que se va a repetir, por índice de día. */
  protected readonly filaARepetir = signal<number | null>(null);

  /** Las filas que se pueden repetir: las de los días encendidos. */
  protected readonly opcionesDeFilaARepetir = computed<readonly SelectOption<number>[]>(() =>
    this.diasActivos().map((dia) => ({ value: dia.indice, label: dia.largo })),
  );

  /** Abre el modal con la primera fila encendida elegida. */
  protected abrirRepetir(): void {
    this.filaARepetir.set(this.diasActivos()[0]?.indice ?? null);
    this.repetirAbierto.set(true);
  }

  protected cerrarRepetir(): void {
    this.repetirAbierto.set(false);
  }

  /** Copia la fila elegida —horas, qué atiende, duración y descanso— en los demás días encendidos. */
  protected repetirFila(): void {
    const origen = this.filaARepetir();
    this.repetirAbierto.set(false);
    if (origen === null) return;
    const modelo = this.semana.at(origen).getRawValue();
    for (const dia of this.diasActivos()) {
      if (dia.indice === origen) continue;
      this.semana.at(dia.indice).patchValue({
        desde: modelo.desde,
        hasta: modelo.hasta,
        duracion: modelo.duracion,
        respiro: modelo.respiro,
        modo: modelo.modo,
        telemedicina: modelo.telemedicina,
        flexible: modelo.flexible,
      });
    }
    this.versionDeLaSemana.update((v) => v + 1);
  }

  /* -- Vista previa --------------------------------------------------------- */

  /** Si el modal de la vista previa está abierto. */
  protected readonly previaAbierta = signal(false);

  /**
   * La semana del formulario dicha como la dice la API, para la grilla.
   *
   * Es la **misma forma** que `ScheduleGrid` recibe en «Mi horario», y se arma
   * con el mismo mapeo que usa `crearPlantilla()`: una regla por franja —con
   * almuerzo, mañana y tarde—, sin duración ni respiro cuando el horario es
   * flexible. Una previa armada con una conversión propia mostraría un horario
   * que no es el que se va a publicar, que es justo lo que una vista previa
   * promete que no pasa.
   */
  protected readonly reglasDeLaPrevia = computed<readonly PublishedRule[]>(() => {
    const capacidad = Number(this.capacidadDeclarada());
    return this.diasActivos().flatMap((dia) => {
      const v = this.semana.at(dia.indice).getRawValue();
      const flexible = this.isFlexibleDay(dia.indice);
      return this.franjasDe(dia.indice).map((franja) => ({
        dayOfWeek: DIAS[dia.indice].numero,
        startTime: franja.desde.trim(),
        endTime: franja.hasta.trim(),
        // Cada día flexible lo dice en su franja, como la devuelve la API ya resuelta.
        ...this.turnFieldsOf(dia.indice, v),
        ...(v.modo === 'CONSULTATIONS' ? {} : { bookingMode: v.modo }),
        ...this.telemedicinaDe(dia.indice, v.telemedicina),
        ...(!flexible && Number.isFinite(capacidad) && capacidad > 0 ? { capacityPerSlot: capacidad } : {}),
      }));
    });
  });

  /** Lo que la franja de un día dice de sus turnos: que es flexible, o su duración y su descanso. */
  private turnFieldsOf(index: number, day: ScheduleDayValue) {
    return this.isFlexibleDay(index) ? FLEXIBLE_DAY_FIELDS : fixedTurnFields(day);
  }

  /** Hasta cuándo va a regir, en una frase, para el globo de la grilla. */
  protected readonly vigenciaDeLaPrevia = computed(() => {
    const fin = this.fechaDeFin();
    return fin === null
      ? 'Sin fecha de fin: rige hasta que lo cambie.'
      : `Rige hasta el ${formatDate(fin, "d 'de' MMMM yyyy", this.idioma)}.`;
  });

  /**
   * «Previsualizar horario» — el modal del pedido original.
   *
   * La vista previa ya vive en línea más arriba, y se deja donde está: mirarla
   * mientras se escribe es mejor que abrir algo para verla. Este botón la trae
   * **al pie**, que es donde uno decide publicar, sin obligar a subir a
   * buscarla.
   *
   * ## Por qué ya no es un `DialogService.confirm()`
   *
   * Porque aquél sólo sabe escribir rótulo y valor, y lo que salía era la
   * semana contada en prosa: «Lunes — 8 turnos · 08:00 · 08:30 · 09:00 · …».
   * Una tira de horas de inicio no se compara entre días, no dice a qué hora
   * cierra el consultorio y no se parece en nada al horario que el médico ve
   * después en «Mi agenda». Era una segunda manera de dibujar lo que ya dibuja
   * `ScheduleGrid`, y dos dibujos del mismo concepto divergen siempre.
   *
   * Ahora el modal es el mismo que «Así era ese horario» del histórico:
   * `ContentDialog` —que sí proyecta contenido— con la grilla real adentro.
   * Previsualizar y mirar el horario publicado dejaron de ser dos pantallas
   * parecidas: son la misma.
   */
  protected abrirVistaPrevia(): void {
    this.previaAbierta.set(true);
  }

  protected cerrarVistaPrevia(): void {
    this.previaAbierta.set(false);
  }

  /**
   * «Limpiar campos» — deja el formulario en blanco.
   *
   * Pide confirmación porque **no hay deshacer**: quien lo toca sin querer
   * pierde la semana que acaba de armar, y armarla es el trabajo entero de esta
   * pantalla.
   *
   * No toca la agenda ya publicada: limpia el formulario, no el horario. Se
   * dice en el mensaje porque «limpiar» a secas asusta justo a quien no debería
   * asustarse.
   */
  protected async limpiarCampos(): Promise<void> {
    const seguro = await this.dialogs.confirm({
      title: 'Limpiar el formulario',
      message:
        'Se borra lo que escribió acá y vuelve a empezar. Su horario ya publicado no se toca.',
      confirmLabel: 'Limpiar',
      cancelLabel: 'Volver',
      destructive: true,
    });
    if (!seguro) return;

    // Se reconstruye cada día con la fábrica en vez de listar los valores acá:
    // duplicar los valores por defecto es garantizar que un día se separen.
    for (let i = 0; i < DIAS.length; i++) {
      this.semana.at(i).reset(createScheduleDay().getRawValue());
    }
    this.formGeneral.reset({
      practiceId: '',
      tieneFin: 'no',
      capacidadPorTurno: '1',
      timeZone: '',
    });
    this.fechaDeFin.set(null);
    this.flexible.set(false);
    this.minutosPorPaciente.set(DURACION_POR_OMISION);
    this.conAlmuerzo.set(false);
    this.almuerzoDesde.set(ALMUERZO_POR_OMISION.desde);
    this.almuerzoHasta.set(ALMUERZO_POR_OMISION.hasta);
    this.versionDeLaSemana.update((v) => v + 1);
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
    // Sin leer las agendas no se sabe si ya existe una: publicar duplicaría.
    if (this.errorDeLectura() !== null) return;

    this.semana.markAllAsTouched();
    this.formGeneral.markAllAsTouched();
    if (this.sinDias() || this.semana.invalid || this.formGeneral.invalid) return;
    if (this.almuerzoInvalido()) return;

    const target = this.place.target();
    if (target === null) return;

    this.estado.set(loading());
    this.attempt.begin(target);
    this.crearRecurso(target);
  }

  private crearRecurso(target: PublicationTarget): void {
    const yaEsta = this.resourceId();
    if (yaEsta !== null) {
      this.crearPolitica(target, yaEsta);
      return;
    }

    const general = this.formGeneral.getRawValue();
    const tecnico = this.formTecnico.getRawValue();

    const newResource = {
      tenantId: target.tenantId,
      resourceType: (tecnico.resourceType || 'PRACTITIONER') as ResourceType,
      resourceRefType: tecnico.resourceRefType.trim() || TABLA_DE_PERFIL_PROFESIONAL,
      resourceRefId: tecnico.resourceRefId.trim(),
      name: this.nombreDelRecurso(),
      ...opcTexto('practiceId', target.practiceId ?? general.practiceId),
      ...opcTexto('timeZone', general.timeZone),
      // La capacidad se pregunta UNA vez: la del recurso y la de cada cupo
      // son el mismo número, y preguntarlo dos veces sólo servía para que no
      // coincidieran.
      ...opcEntero('capacity', general.capacidadPorTurno),
    };
    this.scheduling.createResource(newResource, target.scope).subscribe({
      next: (recurso) => {
        this.resourceId.set(recurso.id);
        this.crearPolitica(target, recurso.id);
      },
      error: (error: unknown) => this.fallar(error),
    });
  }

  private crearPolitica(target: PublicationTarget, resourceId: string): void {
    if (!this.usarPolitica() || this.policyId() !== null) {
      this.retirarVigenteYCrear(resourceId, this.policyId());
      return;
    }

    const v = this.formPolitica.getRawValue();
    const newPolicy = {
      tenantId: target.tenantId,
      // Derivados: eran dos campos obligatorios que nadie vuelve a leer.
      code: codigoDe(this.nombreDelRecurso()),
      name: `Reglas de ${this.nombreDelRecurso()}`,
      ...opcEntero('minNoticeMinutes', v.minNoticeMinutes),
      ...opcEntero('maxAdvanceDays', v.maxAdvanceDays),
      ...opcEntero('cancellationWindowMinutes', v.cancellationWindowMinutes),
      ...opcEntero('maxActivePerPatient', v.maxActivePerPatient),
    };
    this.scheduling.createPolicy(newPolicy, target.scope).subscribe({
      next: (politica) => {
        this.policyId.set(politica.id);
        this.retirarVigenteYCrear(resourceId, politica.id);
      },
      error: (error: unknown) => this.fallar(error),
    });
  }

  /**
   * Retira el horario vigente antes de publicar el nuevo, cuando esto es un
   * cambio y no un alta.
   *
   * ## El defecto que corrige
   *
   * Publicar un cambio creaba una plantilla **más**, sin tocar la anterior, y
   * los cupos viejos seguían publicados. Y `generate-slots` es idempotente
   * **por instante de inicio** —lo dice su propio contrato, y el simulador hace
   * lo mismo—: el cupo de las 08:00 que ya existía se contaba como `skipped`,
   * así que al pasar las consultas de 30 a 45 minutos el turno de las 08:00
   * seguía terminando a las 08:30. La cita no acababa a la hora que decía el
   * horario nuevo, que es exactamente lo que se reportó.
   *
   * Retirar **no borra**: el contrato suelta los cupos libres y conserva,
   * cerrados, los que tienen una cita detrás. Por eso el retiro va primero y la
   * plantilla nueva sólo se crea si aquél salió bien; al revés quedarían dos
   * horarios vigentes sobre la misma agenda.
   *
   * Las citas vivas **no frenan** el cambio (P23): antes de retirar se le
   * pregunta a quien atiende si cancelarlas con aviso o conservarlas, y el
   * horario nuevo no genera turnos encima de las que se conservan. Un error del
   * retiro se muestra tal cual y no se publica nada.
   */
  private retirarVigenteYCrear(resourceId: string, policyId: string | null): void {
    const anterior = this.vigente();
    // `attempt.retirement` y no `vigente === null`: el vigente se conserva porque
    // `esCambio()` cuelga de él —el modal de éxito dice «quedó cambiado»—, y
    // reintentar tras un fallo posterior no debe volver a retirar lo que ya
    // está retirado.
    if (anterior === null || this.attempt.retirement() !== null || this.templateId() !== null) {
      this.crearPlantilla(resourceId, policyId);
      return;
    }

    // Con citas vivas en el horario que se reemplaza, `BlockCancellations`
    // pregunta antes qué hacer con ellas: cancelarlas y avisar a cada
    // paciente, o conservarlas (etapa C, 24/10/2026). Si la persona vuelve
    // atrás, no se publica nada y el formulario queda como estaba.
    this.cancellations.retireTemplate(anterior.id, this.attempt.scope()).subscribe({
      next: (retiro) => {
        if (retiro === null) {
          this.estado.set(ready(null));
          return;
        }
        this.attempt.retirement.set(retiro);
        this.crearPlantilla(resourceId, policyId);
      },
      error: (error: unknown) => this.fallar(error),
    });
  }

  /** Dónde publica este intento y qué ya retiró. Se suelta al cambiar de organización o agenda. */
  private readonly attempt = new PublicationAttempt();

  private crearPlantilla(resourceId: string, policyId: string | null): void {
    const yaEsta = this.templateId();
    if (yaEsta !== null) {
      this.generarCupos(yaEsta);
      return;
    }

    const capacidad = this.formGeneral.getRawValue().capacidadPorTurno;
    const allFlexible = this.allDaysFlexible();
    const rules: ScheduleRule[] = this.diasActivos().flatMap((dia) => {
      const v = this.semana.at(dia.indice).getRawValue();
      const flexible = this.isFlexibleDay(dia.indice);
      // Una regla por franja: con almuerzo, mañana y tarde.
      return this.franjasDe(dia.indice).map(
        (franja) =>
          ({
            dayOfWeek: DIAS[dia.indice].numero,
            startTime: franja.desde.trim(),
            endTime: franja.hasta.trim(),
            // Un día de turnos lleva su duración y su descanso; uno flexible, sólo
            // `flexibleHours` (v4.2.64). Con toda la semana flexible lo declara la
            // plantilla, una vez, y la franja va como antes: sin nada de turnos.
            ...(allFlexible ? {} : this.turnFieldsOf(dia.indice, v)),
            // Sólo si no es lo de siempre: ausente ≡ consultas, y escribir un valor
            // que nadie eligió borraría la diferencia entre «no lo dijo» y «dijo consultas».
            ...(v.modo === 'CONSULTATIONS' ? {} : { bookingMode: v.modo }),
            // Telemedicina: `true` si la activó; `false` sólo si la apaga en una
            // franja que ya la tenía. Ausente ≡ sin telemedicina.
            ...this.telemedicinaDe(dia.indice, v.telemedicina),
            // Ni capacidad: en horario flexible no hay turnos que llenar, y la
            // API rechaza la franja que la declara (P36).
            ...(flexible ? {} : opcEntero('capacityPerSlot', capacidad)),
          }) as ScheduleRule,
      );
    });

    const template = {
      // Derivado: no hay `GET` de plantillas, así que este nombre no lo
      // vuelve a leer nadie. Pedirlo era pedir una etiqueta a ciegas.
      name: `Horario de ${this.nombreDelRecurso()}`,
      rules,
      // El contrato lo pide también a nivel plantilla; va el de la primera
      // franja, que es el que gobierna cuando una regla no trae el suyo. Con
      // algún día flexible, lo que se reserva por paciente esos días (P36).
      slotMinutes: this.flexibleDays().length > 0 ? this.minutosPorPaciente() : rules[0]?.slotMinutes,
      ...(allFlexible ? { flexibleHours: true } : {}),
      ...(policyId === null ? {} : { bookingPolicyId: policyId }),
      ...opcFecha('validTo', this.fechaDeFin()),
    };
    this.scheduling.createTemplate(resourceId, template, this.attempt.scope()).subscribe({
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

    const range = { from: desde.toISOString(), to: hasta.toISOString() };
    this.scheduling.generateSlots(templateId, range, this.attempt.scope()).subscribe({
      next: (resultado) => {
        this.cuposCreados.set(resultado.created);
        this.compararConLoGenerado(resultado.created);
        this.estado.set(ready(null));
        this.publicado.set(true);
        void this.avisarQueQuedoPublicado(resultado.created);
      },
      error: (error: unknown) => this.fallar(error),
    });
  }

  /**
   * El modal de éxito que pide AC-10-7, y por qué además queda la pantalla.
   *
   * El pedido dice «modal de éxito (no una pantalla)». Se hacen las dos cosas y
   * no es indecisión: el modal es el instante —«listo, y esto es lo que se
   * abrió»— y se va cuando lo cerrás; la pantalla de atrás es el registro, que
   * sigue ahí si lo cerraste sin leer o si volvés con el botón de atrás.
   *
   * El botón principal lleva a «Mi agenda» porque la pregunta que sigue a
   * publicar es «¿cómo quedó?», no «¿qué otra cosa hago?». Quien prefiera
   * quedarse cierra el modal y la pantalla de éxito lo espera con el mismo
   * enlace.
   */
  private async avisarQueQuedoPublicado(cupos: number): Promise<void> {
    const retiro = this.attempt.retirement();
    const irAVerla = await this.dialogs.confirm({
      title: this.esCambio()
        ? 'Listo, su horario quedó cambiado'
        : 'Listo, su agenda ya está publicada',
      message: `${this.resumen()}. Los pacientes ya pueden reservar.`,
      details: [
        {
          label: 'Horarios abiertos',
          value: `${cupos} para los próximos meses`,
        },
        // Lo que pasó con el horario anterior, dicho y no callado: los turnos
        // conservados son citas de pacientes que siguen en pie, y quien acaba
        // de cambiar el horario necesita saber que están.
        ...(retiro === null
          ? []
          : [
              {
                label: 'Del horario anterior',
                value: `${retiro.releasedSlots} horarios libres se retiraron; ${retiro.keptSlots} con cita siguen en pie`,
              },
            ]),
      ],
      confirmLabel: 'Ver mi agenda',
      cancelLabel: 'Quedarme acá',
    });

    if (irAVerla) {
      void this.router.navigateByUrl(this.rutaDeMiAgenda);
    }
  }

  /**
   * Detector de deriva entre la vista previa y el backend.
   *
   * La vista previa calcula turnos **por semana**; `generate-slots` los
   * materializa sobre un horizonte de meses, así que los números no son
   * comparables de frente: lo que tiene que cumplirse es que lo generado sea un
   * múltiplo de lo previsto por semana. Si no lo es, alguno de los dos cambió
   * de criterio —el caso temido es que el backend deje de truncar— y conviene
   * enterarse por la consola antes que por un paciente.
   *
   * No bloquea ni molesta al médico: su agenda quedó publicada igual.
   */
  private compararConLoGenerado(generados: number): void {
    const porSemana = this.vistaPrevia().total;
    if (porSemana === 0 || generados === 0) return;
    if (generados % porSemana === 0) return;

    console.warn(
      `[agenda] La vista previa calculó ${porSemana} horarios por semana y el ` +
        `servidor generó ${generados}, que no es múltiplo. Puede haber cambiado ` +
        'la regla del resto: ver calcularTurnos.',
    );
  }

  private fallar(error: unknown): void {
    this.estado.set(errorToViewState<null>(error));
  }

  /* -- El resumen, en palabras ---------------------------------------------- */

  /**
   * Lo publicado dicho como se lo contaría a un colega.
   *
   * «Publicaste: lunes y jueves de 9 a 13, consultas de 30 minutos.» Cero
   * uuids: el médico no tiene por qué ver un identificador nunca.
   */
  protected readonly resumen = computed(() => {
    this.conAlmuerzo();
    this.almuerzoDesde();
    this.almuerzoHasta();
    this.allDaysFlexible();
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

    const horario = mismoHorario ? ` de ${enHoras(primero.desde)} a ${enHoras(primero.hasta)}` : '';
    // El respiro sólo se nombra si lo hay: «con 0 minutos de descanso» sería
    // ruido en la gran mayoría de las agendas, que no declaran ninguno.
    const mismoRespiro = activos.every(
      (dia) => this.semana.at(dia.indice).getRawValue().respiro === primero.respiro,
    );
    const respiro =
      primero.respiro > 0 && mismoRespiro
        ? ` y ${primero.respiro} minutos de descanso entre una y otra`
        : '';
    const almuerzo =
      this.conAlmuerzo() && !this.almuerzoInvalido()
        ? `, almuerzo de ${enHoras(this.almuerzoDesde())} a ${enHoras(this.almuerzoHasta())}`
        : '';
    if (this.allDaysFlexible())
      return `${dias}${horario}${almuerzo}, horario flexible sin citas de duración fija`;
    if (this.flexibleDays().length > 0)
      return `${dias}${horario}${almuerzo}, con turnos fijos y días de horario flexible`;
    // Con franjas de servicios la frase no puede decir «consultas de 30 minutos» de
    // todo el horario: ni todo es consulta, ni los servicios tienen un largo único.
    const hayServicios = activos.some(
      (dia) => this.semana.at(dia.indice).getRawValue().modo !== 'CONSULTATIONS',
    );
    if (hayServicios) return `${dias}${horario}${almuerzo}, con franjas de servicios`;
    return `${dias}${horario}${almuerzo}, consultas de ${primero.duracion} minutos${respiro}`;
  });
}

/** `09:30` → 570; `null` si no es una hora. */
function aMinutos(hora: string): number | null {
  const partes = /^(\d{1,2}):(\d{2})/.exec(hora.trim());
  if (partes === null) return null;
  return Number(partes[1]) * 60 + Number(partes[2]);
}

/** `09:00:00` → `09:00`: los segundos de una regla nunca son distintos de cero. */
function sinSegundos(hora: string): string {
  return hora.slice(0, 5);
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

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { listFreeStarts } from '../../../core/data-access/scheduling/free-starts';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import {
  MODALIDADES,
  type AgendaResource,
  type AgendaSlot,
  type ModalidadDeAtencion,
  type WalkInPatient,
} from '../../../core/data-access/scheduling/scheduling.types';
import { BoDepartmentsCatalog } from '../../../core/data-access/terminology/bo-departments.service';
import {
  BoOccupationsCatalog,
  CODIGO_OCUPACION_OTRA,
} from '../../../core/data-access/terminology/bo-occupations.service';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Input } from '../../../shared/components/atoms/input/input';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { AGENDA_ROUTE } from '../agenda.routes';
import { agendaResourcesMy } from '../my-resource';
import { avisoDeTeleconsulta, rechazoPorTelemedicina } from '../telemedicina';

/**
 * Duraciones ofrecidas, en minutos.
 *
 * Con un horario elegido se ofrecen sólo las que caben en los cupos libres
 * seguidos desde ese horario: lo que pase de ahí cae fuera de lo que el
 * profesional atiende.
 */
const DURACIONES = [15, 20, 30, 45, 60, 90, 120] as const;

/** Duración por omisión: la consulta corriente. */
const DURACION_POR_DEFECTO = 30;

const MS_POR_MINUTO = 60_000;

/** Tope de cupos de un día: de sobra para la agenda más cargada. */
const CUPOS_POR_DIA = 200;

/**
 * Con quién es la cita.
 *
 * `registrado` es el caso de todos los días y sigue siendo el que arranca
 * elegido. `nuevo` es el del mostrador: llegó alguien que no está en el sistema
 * —o que nadie supo identificar— y hay que atenderlo igual.
 */
type ModoDePaciente = 'registrado' | 'nuevo';

/**
 * Cuántos dígitos seguidos hacen que lo tecleado se lea como una cédula.
 *
 * El documento boliviano más corto que circula tiene seis. Por debajo de eso lo
 * escrito es casi siempre el principio de un nombre, y buscar por documento
 * devolvería vacío cuando en realidad falta seguir escribiendo.
 */
const DIGITOS_DE_CEDULA = 6;

/** Lo que la pantalla dice sobre dónde queda la cita. */
interface AppointmentLocation {
  readonly organization: string | null;
  readonly site: string;
  readonly address: string | null;
}

/**
 * Alta de cita del profesional — `/schedule/appointment/new`.
 *
 * ## Por qué no se copió el formulario del paciente
 *
 * Porque no hacen lo mismo. `booking-new` toma un **cupo ya publicado** en dos
 * pasos con vencimiento (`hold` → `confirm`); esto elige también entre los cupos
 * libres del profesional, pero agenda en una sola transacción y **retira** los
 * cupos que pisa. Copiar aquella pantalla habría duplicado por tercera vez lo
 * delicado —la revalidación del cupo y el vencimiento de la retención— para un
 * caso de uso que no lo tiene. Lo que se reusa son las **piezas**: el combobox
 * de paciente, el campo de motivo, el select de modalidad.
 *
 * ## El doctor no se elige
 *
 * No hay campo de profesional, y no es una omisión de la interfaz: la cita
 * nace en la agenda de quien tiene la sesión. El servidor impone lo mismo
 * (`assertRecursoDelActor`), así que forzar el `resourceId` de otra agenda
 * responde 403 — esconder el campo no es la barrera, es la consecuencia.
 *
 * ## La sede se elige eligiendo la agenda
 *
 * Un profesional con dos consultorios tiene dos recursos. Con uno solo la
 * pregunta no aparece: un select de una opción es una decisión que no existe.
 *
 * ## Los choques los decide el servidor
 *
 * La regla madre cruza **todas** las sedes y esta pantalla ve una; su 422
 * llega con qué, cuándo y dónde, y se muestra tal cual porque ese texto ya
 * está escrito para una persona. Acá no se adivina nada antes de guardar.
 */
@Component({
  selector: 'app-appointment-new',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    DatePicker,
    FormField,
    Input,
    NavIcon,
    PageHeader,
    ReferenceCombobox,
    RouterLink,
    Select,
    Tooltip,
  ],
  templateUrl: './appointment-new.html',
  styleUrl: './appointment-new.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentNew {
  private readonly auth = inject(AuthService);
  private readonly scheduling = inject(SchedulingClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly ocupaciones = inject(BoOccupationsCatalog);
  private readonly departamentos = inject(BoDepartmentsCatalog);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly rutaDeMiAgenda = AGENDA_ROUTE;

  /* -- Las agendas de quien tiene la sesión -------------------------------- */

  protected readonly agendas = signal<readonly AgendaResource[]>([]);
  protected readonly agendaElegida = signal<string | null>(null);
  protected readonly cargandoAgendas = signal(true);

  /** Con una sola agenda no se pregunta: no hay decisión que tomar. */
  protected readonly hayQueElegirAgenda = computed(() => this.agendas().length > 1);

  protected readonly opcionesDeAgenda = computed<readonly SelectOption<string>[]>(
    () => this.agendas().map((agenda) => ({ value: agenda.id, label: agenda.name })),
  );

  /**
   * Dónde queda la cita que se está por agendar.
   *
   * La API la ubica por la agenda, sin que nadie elija la organización: la
   * pantalla tiene que decirlo, o quien tiene varias organizaciones agenda en
   * la activa sin enterarse. Cambia con el selector de agenda.
   */
  protected readonly appointmentLocation = computed<AppointmentLocation | null>(() => {
    const agenda = this.agendas().find((a) => a.id === this.agendaElegida());
    if (agenda === undefined) {
      return null;
    }
    const site = agenda.site?.name ?? 'Sin consultorio registrado';
    const organization = this.activeOrganizationName();
    return {
      // Muchas sedes ya llevan el nombre de la organización: «Clínica X · Clínica
      // X · Sede Central» se lee como un error.
      organization: organization !== null && mentions(site, organization) ? null : organization,
      site,
      address: agenda.site?.addressText ?? null,
    };
  });

  /* -- El formulario ------------------------------------------------------- */

  protected readonly paciente = signal<ReferenceOption | null>(null);
  protected readonly candidatos = signal<readonly ReferenceOption[]>([]);
  protected readonly buscando = signal(false);

  /** Lo último que se tecleó en el buscador. Ver {@link registrarPacienteNuevo}. */
  private readonly ultimaBusqueda = signal('');

  /* -- El paciente que no está en el sistema -------------------------------- */

  /**
   * Buscar a alguien registrado o darlo de alta acá mismo.
   *
   * ## Por qué no manda a otra pantalla
   *
   * Porque el que llegó está parado en el mostrador. Salir a
   * `/administration/patients/assisted-registration`, completar el alta, volver
   * y rearmar la cita son cuatro pantallas para una consulta que empieza en dos
   * minutos —y la mitad de las veces la fecha y la hora ya tecleadas se
   * perderían en el camino—.
   *
   * ## Por qué tampoco es un formulario siempre visible
   *
   * Porque el caso raro no puede pagar el caso corriente: casi todas las citas
   * son de gente ya registrada, y once campos de filiación colgando debajo de
   * «¿Con quién?» convertirían el alta de cita en un alta de persona. El bloque
   * entra y sale del DOM en vez de esconderse con CSS, por lo mismo que en el
   * registro del paciente: un campo escondido igual se tabula.
   */
  protected readonly modo = signal<ModoDePaciente>('registrado');

  /**
   * El nombre, en tres casillas más los dos apellidos.
   *
   * Es lo que pide el registro de procesos del cliente (módulo Paciente
   * §1.1.2): «tiene que existir 3 espacios para guardar nombres y otros que
   * indique Apellido paterno y apellido materno». Se declara igual que en el
   * alta del propio paciente para que las dos altas produzcan la misma persona;
   * al enviar, el segundo y el tercero viajan juntos en `middleName`, que es la
   * única columna que la base tiene para los nombres que no son el primero.
   */
  protected readonly nuevoNombre = signal('');
  protected readonly nuevoSegundoNombre = signal('');
  protected readonly nuevoTercerNombre = signal('');
  protected readonly nuevoApellidoPaterno = signal('');
  protected readonly nuevoApellidoMaterno = signal('');
  /** Los nombres agregados con «+ Agregar otro nombre», en el orden en que se escriben. */
  protected readonly nuevosNombresExtra = signal<readonly string[]>([]);

  /**
   * La cédula y el departamento que la expidió.
   *
   * Van juntas y el departamento se elige de una lista porque el cliente lo
   * pidió por su motivo (§1.1.4): «colocando con esto solo el número de su
   * cedula … evitamos duplicidad o error del Departamento de la emisión». Dos
   * personas distintas pueden compartir el número; el par no se repite.
   */
  protected readonly nuevoDocumento = signal('');
  protected readonly nuevoDepartamentoDelDocumento = signal<string | null>(null);
  protected readonly opcionesDeDepartamento = signal<readonly SelectOption<string>[]>([]);

  protected readonly nuevoNacimiento = signal<Date | null>(null);
  protected readonly nuevoCelular = signal('');

  /** Quién responde por el paciente, si no puede hacerlo él (§1.1.11). */
  protected readonly nuevoTutorNombre = signal('');
  protected readonly nuevoTutorCelular = signal('');

  /* -- La ocupación, con su lupa (§1.1.6–1.1.8) ----------------------------- */

  protected readonly opcionesDeOcupacion = signal<
    readonly { readonly value: string; readonly label: string; readonly code: string }[]
  >([]);
  protected readonly busquedaDeOcupacion = signal('');
  protected readonly ocupacionElegida = signal<ReferenceOption | null>(null);
  protected readonly otraOcupacion = signal('');
  protected readonly catalogoDeOcupacionesCaido = signal(false);

  /**
   * Las ocupaciones que quedan para lo tecleado en la lupa.
   *
   * El filtrado es en memoria y no otra consulta: el catálogo entero ya llegó,
   * y volver a la red por cada tecla sería pagar dos veces la misma lista.
   */
  protected readonly ocupacionesFiltradas = computed<readonly ReferenceOption[]>(() => {
    const busqueda = this.busquedaDeOcupacion().trim().toLowerCase();
    const todas = this.opcionesDeOcupacion();
    const elegidas = busqueda
      ? todas.filter((opcion) => opcion.label.toLowerCase().includes(busqueda))
      : todas;
    return elegidas.map((opcion) => ({ value: opcion.value, label: opcion.label }));
  });

  /**
   * Si lo elegido es «Otra ocupación», la salida del catálogo.
   *
   * Es lo que destraba el «¿cuál?» escrito a mano que pide el registro del
   * cliente (§1.1.7) para el oficio que no está en la lista. Se reconoce por el
   * `code` del concepto y no por su texto visible.
   */
  protected readonly ocupacionEsOtra = computed(() => {
    const elegida = this.ocupacionElegida();
    if (elegida === null) return false;
    return (
      this.opcionesDeOcupacion().find((opcion) => opcion.value === elegida.value)?.code ===
      CODIGO_OCUPACION_OTRA
    );
  });

  /**
   * La edad que sale de la fecha de nacimiento.
   *
   * «La app tiene que arrojar de manera automática la edad del paciente con la
   * fecha de nacimiento ingresada» (§1.1.9): es un dato derivado, no una
   * pregunta más —preguntar las dos cosas es invitar a que no coincidan—.
   */
  protected readonly edadDelNuevo = computed<number | null>(() => {
    const nacimiento = this.nuevoNacimiento();
    if (nacimiento === null) return null;
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    // Todavía no cumplió este año: el mes que viene, o este mismo mes más
    // adelante. Sin esta corrección la edad se adelanta hasta doce meses.
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad -= 1;
    return edad >= 0 ? edad : null;
  });

  /** Lo que dice el campo de nacimiento debajo: la edad, en cuanto se puede. */
  protected readonly pieDeNacimiento = computed(() => {
    const edad = this.edadDelNuevo();
    if (edad === null) return 'La edad la calculamos nosotros.';
    return edad === 1 ? '1 año' : `${edad} años`;
  });

  /**
   * Lo mínimo para dar de alta a alguien en el mostrador.
   *
   * Nombre, apellido paterno, cédula y celular. La cédula porque el cliente la
   * exige (§1.1.3) y porque sin ella el próximo que lo busque lo vuelve a dar
   * de alta; el celular porque es por donde se lo contacta —y hoy es el único
   * dato de contacto que el mostrador consigue seguro—. Lo demás se completa
   * después, en su ficha.
   */
  protected readonly pacienteNuevoListo = computed(
    () =>
      this.nuevoNombre().trim() !== '' &&
      this.nuevoApellidoPaterno().trim() !== '' &&
      this.nuevoDocumento().trim() !== '' &&
      this.nuevoCelular().trim() !== '',
  );

  /** Agrega una casilla de nombre, en blanco. */
  protected agregarNombre(): void {
    this.nuevosNombresExtra.update((actuales) => [...actuales, '']);
  }

  /** Quita una de las casillas agregadas (`indice` empieza en 0). */
  protected quitarNombre(indice: number): void {
    this.nuevosNombresExtra.update((actuales) => actuales.filter((_, i) => i !== indice));
  }

  /** Escribe en una de las casillas agregadas (`indice` empieza en 0). */
  protected escribirNombreExtra(indice: number, valor: string | number | null): void {
    const texto = valor === null ? '' : String(valor);
    this.nuevosNombresExtra.update((actuales) =>
      actuales.map((nombre, i) => (i === indice ? texto : nombre)),
    );
  }

  /** El nombre del paciente nuevo tal como se va a ver escrito. */
  protected readonly nombreDelNuevo = computed(() =>
    [
      this.nuevoNombre(),
      this.nuevoSegundoNombre(),
      this.nuevoTercerNombre(),
      ...this.nuevosNombresExtra(),
      this.nuevoApellidoPaterno(),
      this.nuevoApellidoMaterno(),
    ]
      .map((parte) => parte.trim())
      .filter((parte) => parte !== '')
      .join(' '),
  );

  /**
   * El día de la cita.
   *
   * `Date` y no cadena: el organismo de fecha ya trabaja con `Date`, y pasar
   * por texto obligaría a parsear un formato en el medio — que es donde
   * aparecen las citas adelantadas un día.
   */
  protected readonly dia = signal<Date | null>(null);

  /** Hoy, a medianoche: no se agenda para atrás. */
  protected readonly hoy = new Date(new Date().setHours(0, 0, 0, 0));

  /** La hora elegida, `HH:mm`. Sólo vale si es uno de los cupos del día. */
  protected readonly hora = signal('');

  /* -- Los horarios libres del día ------------------------------------------ */

  protected readonly cupos = signal<readonly AgendaSlot[]>([]);
  protected readonly cargandoCupos = signal(false);
  protected readonly cuposCaidos = signal(false);
  private readonly lecturaDeCupos = signal(0);

  /** Un horario por hora de inicio: dos cupos a la misma hora son una sola opción. */
  protected readonly opcionesDeHora = computed<readonly SelectOption<string>[]>(() => {
    const vistas = new Set<string>();
    const opciones: SelectOption<string>[] = [];
    for (const cupo of this.cupos()) {
      const inicio = horaDe(cupo.startAt);
      if (vistas.has(inicio)) continue;
      vistas.add(inicio);
      opciones.push({ value: inicio, label: `${inicio} a ${horaDe(cupo.endAt)}` });
    }
    return opciones;
  });

  private readonly cupoElegido = computed(
    () => this.cupos().find((cupo) => horaDe(cupo.startAt) === this.hora()) ?? null,
  );

  protected readonly marcadorDeHora = computed(() => {
    if (this.dia() === null) return 'Elija primero el día';
    if (this.cargandoCupos()) return 'Buscando horarios…';
    return this.opcionesDeHora().length === 0 ? 'Sin horarios libres' : 'Elija un horario';
  });

  protected readonly pieDeHora = computed(() => {
    if (this.dia() === null || this.cargandoCupos()) return 'Sólo aparecen sus horarios libres.';
    return this.opcionesDeHora().length === 0
      ? 'No tiene horarios libres ese día. Elija otro o revise su horario en Mi agenda.'
      : 'Sólo aparecen sus horarios libres.';
  });

  /**
   * Cuántos minutos libres seguidos hay desde el horario elegido.
   *
   * Se cuentan cupos pegados: un hueco en la agenda o el fin de la franja
   * cortan la cuenta, y una cita más larga caería fuera de lo que atiende.
   */
  private readonly minutosDisponibles = computed<number | null>(() => {
    const elegido = this.cupoElegido();
    if (elegido === null) return null;
    let fin = elegido.endAt.getTime();
    const siguientes = this.cupos()
      .filter((cupo) => cupo.startAt.getTime() > elegido.startAt.getTime())
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    // `<=` y no `===`: las horas de un horario flexible (P36) arrancan cada
    // 15 min y se pisan entre sí; una seguida de otra sigue siendo tiempo libre.
    for (const cupo of siguientes) {
      if (cupo.startAt.getTime() > fin) break;
      fin = Math.max(fin, cupo.endAt.getTime());
    }
    return (fin - elegido.startAt.getTime()) / MS_POR_MINUTO;
  });
  protected readonly duracion = signal(String(DURACION_POR_DEFECTO));
  protected readonly motivo = signal('');

  /**
   * Por qué medio se atiende.
   *
   * Arranca en presencial porque es lo que pasa casi siempre, y **se guarda
   * igual**: «nadie lo dijo» y «dijeron que es presencial» son cosas distintas
   * en la historia del paciente, y el contrato distingue las dos —omitirla
   * deja la columna en nulo—.
   */
  protected readonly modalidad = signal<ModalidadDeAtencion>('PRESENCIAL');
  protected readonly opcionesDeModalidad: readonly SelectOption<ModalidadDeAtencion>[] =
    MODALIDADES.map((opcion) => ({ value: opcion.valor, label: opcion.nombre }));

  protected readonly opcionesDeDuracion = computed<readonly SelectOption<string>[]>(() => {
    const elegido = this.cupoElegido();
    const tope = this.minutosDisponibles();
    if (elegido === null || tope === null) return DURACIONES.map(opcionDeDuracion);
    const propia = minutosDeCupo(elegido);
    const caben = DURACIONES.filter((minutos) => minutos <= tope && minutos !== propia);
    return [propia, ...caben].sort((a, b) => a - b).map(opcionDeDuracion);
  });

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.cargarAgendas();
    effect((onCleanup) => {
      this.lecturaDeCupos();
      const agenda = this.agendaElegida();
      const dia = this.dia();
      this.cupos.set([]);
      this.cuposCaidos.set(false);
      if (agenda === null || dia === null) {
        this.cargandoCupos.set(false);
        return;
      }
      this.cargandoCupos.set(true);
      const lectura = this.leerCupos(agenda, dia).subscribe({
        next: (libres) => {
          this.cargandoCupos.set(false);
          this.cupos.set(libres);
        },
        error: () => {
          this.cargandoCupos.set(false);
          this.cuposCaidos.set(true);
        },
      });
      onCleanup(() => lectura.unsubscribe());
    });
  }

  private leerCupos(resourceId: string, dia: Date) {
    const inicio = new Date(dia);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 1);
    // Cupos fijos y horas del horario flexible: un día «Horario flexible» no
    // tiene cupos y antes salía «Sin horarios libres» aunque atendiera.
    return listFreeStarts(this.scheduling, {
      resourceId,
      // Nunca antes de ahora: un cupo de esta mañana ya pasó.
      from: new Date(Math.max(inicio.getTime(), Date.now())),
      to: fin,
      limit: CUPOS_POR_DIA,
    });
  }

  /** Cambiar el día deja sin efecto la hora: era un cupo de otro día. */
  protected elegirDia(dia: Date | null): void {
    this.dia.set(dia);
    this.hora.set('');
  }

  /** Cambiar la agenda también: cada sede tiene sus propios cupos. */
  protected elegirAgenda(agenda: string | null): void {
    this.agendaElegida.set(agenda);
    this.hora.set('');
  }

  /** La duración arranca en la del cupo elegido, que es la que el horario declara. */
  protected elegirHora(hora: string | null): void {
    this.hora.set(hora ?? '');
    const elegido = this.cupoElegido();
    if (elegido !== null) this.duracion.set(String(minutosDeCupo(elegido)));
  }

  protected reintentarCupos(): void {
    this.lecturaDeCupos.update((veces) => veces + 1);
  }

  /** Cuándo empieza la cita: el inicio del cupo elegido, o `null` si no hay. */
  protected readonly comienza = computed<Date | null>(
    () => this.cupoElegido()?.startAt ?? null,
  );

  /** Los minutos que dura, o `null` si lo escrito no es un número positivo. */
  protected readonly minutos = computed<number | null>(() => {
    const valor = Number(this.duracion());
    return Number.isInteger(valor) && valor > 0 ? valor : null;
  });

  /** Si ya se sabe con quién es la cita, sea de la lista o del mostrador. */
  protected readonly hayPaciente = computed(() =>
    this.modo() === 'registrado' ? this.paciente() !== null : this.pacienteNuevoListo(),
  );

  /** Cómo termina la frase de confirmación, para decir qué va a pasar. */
  protected readonly queVaAPasar = computed<string | null>(() => {
    if (!this.hayPaciente()) return null;
    const porVideo = this.modalidad() === 'TELECONSULTA';
    const aDomicilio = this.modalidad() === 'DOMICILIO';
    const donde = porVideo
      ? ' Va por videollamada.'
      : aDomicilio
        ? ' Va a su domicilio.'
        : '';
    // Con un paciente nuevo pasan dos cosas y no una, así que se dicen las dos.
    // «Le avisamos al paciente» sería mentira acá: todavía no tiene cuenta por
    // donde recibir el aviso — lo que tiene es una ficha para completar.
    if (this.modo() === 'nuevo') {
      return `Lo damos de alta con estos datos y agendamos la cita.${donde} Su ficha queda para completar.`;
    }
    return `Se agenda la cita y le avisamos al paciente. No tiene que confirmar nada.${donde}`;
  });

  /** El aviso de teleconsulta fuera de franja; sólo la cita directa la valida la API. */
  protected readonly sinTelemedicina = avisoDeTeleconsulta(
    this.scheduling,
    this.agendaElegida,
    this.comienza,
    () => this.modo() === 'registrado' && this.modalidad() === 'TELECONSULTA',
  );

  protected readonly puedeGuardar = computed(
    () =>
      !this.guardando() &&
      this.hayPaciente() &&
      this.comienza() !== null &&
      this.minutos() !== null &&
      this.agendaElegida() !== null &&
      this.sinTelemedicina() === null,
  );

  /**
   * Busca pacientes por nombre, código o cédula. La molécula ya espera antes de
   * emitir.
   *
   * ## Por qué lo que son puros dígitos va por `nationalId`
   *
   * Porque `query` es texto libre **sobre el código de paciente y el nombre**,
   * no sobre el documento: tecleada una cédula, la búsqueda por nombre no
   * encuentra a nadie y la pantalla concluye que hay que darlo de alta —cuando
   * la persona ya estaba—. El listado acepta el documento por su propio
   * parámetro, que es exacto, y es la forma de evitar el duplicado que el
   * cliente pide evitar (§1.1.4).
   */
  protected buscarPaciente(texto: string): void {
    const limpio = texto.trim();
    this.ultimaBusqueda.set(limpio);
    if (limpio === '') {
      this.candidatos.set([]);
      return;
    }
    this.buscando.set(true);
    this.profiles
      .searchPatients(
        esDocumento(limpio) ? { nationalId: limpio, limit: 10 } : { query: limpio, limit: 10 },
      )
      .subscribe({
        next: (pagina) => {
          this.buscando.set(false);
          this.candidatos.set(
            pagina.items.map((item) => ({
              value: item.profileId,
              label: item.displayName ?? item.patientCode,
              // El código clínico como pista: distingue a dos personas con el
              // mismo nombre sin mostrar ningún uuid.
              hint: item.displayName === undefined ? undefined : item.patientCode,
            })),
          );
        },
        error: () => {
          this.buscando.set(false);
          this.candidatos.set([]);
        },
      });
  }

  /**
   * Pasa a dar de alta a alguien que no está en el sistema.
   *
   * Suelta al paciente elegido: si quedara seleccionado, «¿con quién?» tendría
   * dos respuestas a la vez y sólo una de las dos se vería en pantalla. Los
   * catálogos se piden **acá** y no al abrir la pantalla, porque casi todas las
   * citas son de gente ya registrada y ninguna de ellas necesita la lista de
   * ocupaciones de Bolivia.
   */
  protected registrarPacienteNuevo(): void {
    this.modo.set('nuevo');
    this.paciente.set(null);
    this.candidatos.set([]);
    // Si lo que se buscó era una cédula, ya está escrita: pedirla de nuevo dos
    // renglones más abajo es hacer teclear dos veces el mismo número, que es
    // además donde aparecen los documentos con un dígito cambiado.
    const buscado = this.ultimaBusqueda();
    if (this.nuevoDocumento() === '' && esDocumento(buscado)) this.nuevoDocumento.set(buscado);
    this.cargarCatalogos();
  }

  /**
   * Vuelve a buscar en la lista.
   *
   * Lo escrito del paciente nuevo **no se borra**: quien se equivocó de botón
   * —o quiso comprobar una vez más que no estaba— vuelve y sigue donde iba.
   */
  protected buscarRegistrado(): void {
    this.modo.set('registrado');
  }

  /**
   * Guarda la ocupación elegida en la lupa.
   *
   * @param opcion - La ocupación elegida, o `null` si la limpió.
   */
  protected elegirOcupacion(opcion: ReferenceOption | null): void {
    this.ocupacionElegida.set(opcion);
    // Al dejar de ser «Otra ocupación» se borra lo escrito a mano, para que no
    // viaje un oficio que ya no describe a nadie.
    if (!this.ocupacionEsOtra()) this.otraOcupacion.set('');
  }

  /** Reintento explícito del catálogo de ocupaciones tras un fallo. */
  protected reintentarOcupaciones(): void {
    this.ocupaciones.forget();
    this.cargarOcupaciones();
  }

  /**
   * Trae los dos catálogos del alta: departamentos y ocupaciones.
   *
   * Se piden una sola vez —los servicios cachean— y ninguno de los dos frena el
   * alta si falla: el departamento del documento y la ocupación son opcionales,
   * y lo que no puede faltar es la persona que está esperando.
   */
  private cargarCatalogos(): void {
    if (this.opcionesDeDepartamento().length === 0) {
      this.departamentos.listar().subscribe({
        next: (opciones) =>
          this.opcionesDeDepartamento.set(
            opciones.map((opcion) => ({ value: opcion.conceptId, label: opcion.display })),
          ),
        error: () => this.opcionesDeDepartamento.set([]),
      });
    }
    if (this.opcionesDeOcupacion().length === 0) this.cargarOcupaciones();
  }

  private cargarOcupaciones(): void {
    this.ocupaciones.list().subscribe({
      next: (opciones) => {
        this.catalogoDeOcupacionesCaido.set(false);
        // El `code` viaja además del identificador: es lo que reconoce a la
        // salida «Otra ocupación» sin atarse a su texto visible.
        this.opcionesDeOcupacion.set(
          opciones.map((opcion) => ({
            value: opcion.conceptId,
            label: opcion.display,
            code: opcion.code,
          })),
        );
      },
      error: () => {
        this.opcionesDeOcupacion.set([]);
        this.catalogoDeOcupacionesCaido.set(true);
      },
    });
  }

  /**
   * Guarda lo que se completó: una cita, o un alta de paciente y su cita.
   *
   * La bifurcación mira el **modo**, no si hay alguien elegido en la lista: con
   * un paciente ya seleccionado, pasar a «paciente nuevo» y guardar habría
   * agendado con el de antes.
   */
  protected guardar(): void {
    const comienza = this.comienza();
    const minutos = this.minutos();
    const resourceId = this.agendaElegida();
    if (!this.puedeGuardar() || comienza === null || minutos === null || resourceId === null) {
      return;
    }

    this.guardando.set(true);
    this.error.set(null);

    if (this.modo() === 'registrado') {
      const paciente = this.paciente();
      if (paciente === null) {
        this.guardando.set(false);
        return;
      }
      this.agendar(paciente.value, comienza, minutos, resourceId);
      return;
    }

    this.darDeAltaYAgendar(comienza, minutos, resourceId);
  }

  /**
   * Da de alta al paciente del mostrador **y** agenda, en una sola llamada.
   *
   * ## Una petición, una transacción — P22 cerrado
   *
   * Esto eran dos peticiones: `POST /profiles/patients` y después la cita. Y
   * no era sólo feo, estaba **roto**: `CreatePatientDto` no declara cédula,
   * celular, ocupación ni tutor, así que `forbidNonWhitelisted` rechazaba la
   * petición entera con 400 y el alta de mostrador no funcionaba ni una vez
   * contra la API real. Lo que sí funcionaba —en la maqueta, con sus datos
   * simulados— dejaba además una persona registrada sin cita cuando la
   * segunda llamada fallaba.
   *
   * `POST /scheduling/appointments/walk-in` recibe el bloque de filiación
   * entero y crea persona, perfil, identificador, teléfono, tutor y reserva en
   * una sola transacción. Esta pantalla agenda, no atiende: va con
   * `startAttention: false` para que la cita quede confirmada para su hora, sin
   * una atención abierta hoy. El mostrador es `walk-in-form`.
   *
   * El 409 —«ese documento ya está registrado»— se traduce, porque su salida
   * no está en el mensaje sino en la pantalla: hay que volver a buscar a esa
   * persona en la lista de arriba.
   */
  private darDeAltaYAgendar(comienza: Date, minutos: number, resourceId: string): void {
    this.scheduling
      .createWalkInAppointment({
        patient: this.datosDelPacienteNuevo(),
        resourceId,
        startAt: comienza.toISOString(),
        durationMinutes: minutos,
        ...(this.motivo().trim() === '' ? {} : { reasonText: this.motivo().trim() }),
        channel: this.modalidad(),
        startAttention: false,
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.toasts.success(
            'Quedó registrado y con la cita agendada. Su ficha queda para completar.',
            'Paciente registrado y cita agendada',
          );
          void this.router.navigate([AGENDA_ROUTE]);
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.error.set(
              'Ese documento ya está registrado. Búsquelo arriba por su cédula y agéndele el turno.',
            );
            return;
          }
          this.error.set(
            this.mensajeDeError(errorToViewState<never>(error), 'No pudimos registrar al paciente.'),
          );
        },
      });
  }

  /**
   * Crea la cita.
   *
   * El 422 del servidor —la regla madre, con qué, cuándo y dónde— se muestra
   * **tal cual**: ese mensaje ya está redactado para una persona, y
   * reescribirlo acá sólo podría empeorarlo o mentir.
   */
  private agendar(
    patientProfileId: string,
    comienza: Date,
    minutos: number,
    resourceId: string,
  ): void {
    this.scheduling
      .createDirectAppointment({
        patientProfileId,
        resourceId,
        startAt: comienza.toISOString(),
        durationMinutes: minutos,
        ...(this.motivo().trim() === '' ? {} : { reasonText: this.motivo().trim() }),
        channel: this.modalidad(),
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.toasts.success('Le avisamos al paciente. No tiene que confirmar nada.', 'Cita agendada');
          void this.router.navigate([AGENDA_ROUTE]);
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          const estado = errorToViewState<never>(error);
          this.error.set(rechazoPorTelemedicina(error) ?? this.mensajeDeError(estado));
        },
      });
  }

  /**
   * La filiación del paciente del mostrador, tal como la recibe el walk-in.
   *
   * Los opcionales vacíos **no se mandan**: el backend valida con
   * `forbidNonWhitelisted` y una cadena vacía no es «sin dato», es un dato
   * vacío. El segundo y el tercer nombre viajan juntos en `middleName` porque
   * es la única columna que la base tiene para los nombres que no son el
   * primero — el mismo criterio que el alta del propio paciente.
   *
   * **Sin `displayName`.** `WalkInPatientDto` no lo declara —lo compone el
   * servidor con las partes del nombre, que es donde tiene que decidirse— y
   * mandarlo haría rebotar la petición entera con 400.
   */
  private datosDelPacienteNuevo(): WalkInPatient {
    const otrosNombres = [
      this.nuevoSegundoNombre(),
      this.nuevoTercerNombre(),
      ...this.nuevosNombresExtra(),
    ]
      .map((parte) => parte.trim())
      .filter((parte) => parte !== '')
      .join(' ');
    const nacimiento = this.nuevoNacimiento();
    const ocupacion = this.ocupacionElegida();
    const materno = this.nuevoApellidoMaterno().trim();
    const departamento = this.nuevoDepartamentoDelDocumento();
    const tutorNombre = this.nuevoTutorNombre().trim();
    const tutorCelular = this.nuevoTutorCelular().trim();
    const otroOficio = this.ocupacionEsOtra() ? this.otraOcupacion().trim() : '';

    return {
      name: this.nuevoNombre().trim(),
      lastName: this.nuevoApellidoPaterno().trim(),
      nationalId: this.nuevoDocumento().trim(),
      phone: this.nuevoCelular().trim(),
      ...(otrosNombres === '' ? {} : { middleName: otrosNombres }),
      ...(materno === '' ? {} : { motherLastName: materno }),
      ...(departamento === null ? {} : { issuerAdministrativeAreaConceptId: departamento }),
      ...(nacimiento === null ? {} : { birthDate: fechaIso(nacimiento) }),
      // El catálogo gana sobre el texto libre, igual que en el alta del propio
      // paciente: el oficio a mano sólo tenía sentido para quien no encontró el
      // suyo en la lista.
      ...(ocupacion === null || this.ocupacionEsOtra()
        ? {}
        : { occupationConceptId: ocupacion.value }),
      ...(otroOficio === '' ? {} : { occupationFreeText: otroOficio }),
      ...(tutorNombre === '' ? {} : { guardianName: tutorNombre }),
      // El teléfono del tutor sin su nombre lo rechaza el alta: no se manda
      // suelto, porque el rechazo llegaría sin señalar qué falta.
      ...(tutorNombre === '' || tutorCelular === '' ? {} : { guardianPhone: tutorCelular }),
    };
  }

  /**
   * Saca el texto de un fallo, tal como lo redactó el servidor.
   *
   * ## El defecto que corrige
   *
   * `validation()` (S4 del M34) **nunca** trae `message` en el nivel de arriba
   * — sólo en cada `issues[].message`, `ValidationViewState` no declara ese
   * campo. La regla madre de choque (`assertRangoLibre`) y el choque del
   * paciente llegan como **`CONFLICT`**, que `errorToViewState` convierte
   * justamente en ese estado. Leer `estado.message` acá siempre daba
   * `undefined` y la pantalla mostraba el genérico «No pudimos agendar la
   * cita.» en vez del texto con qué, cuándo y dónde que pide AC-14-7 — el 422
   * nunca llegaba a verse, ni una vez.
   */
  private mensajeDeError(
    estado: ViewState<never>,
    generico = 'No pudimos agendar la cita.',
  ): string {
    if (estado.status === 'validation') {
      return estado.issues[0]?.message ?? generico;
    }
    if ('message' in estado && typeof estado.message === 'string' && estado.message !== '') {
      return estado.message;
    }
    return generico;
  }

  /**
   * El nombre de la organización activa, o `null` si el token no lo trae:
   * `tenantName` cae al id, y un uuid no le dice nada a quien agenda.
   */
  private activeOrganizationName(): string | null {
    const tenantId = this.auth.activeTenantId();
    if (tenantId === null) {
      return null;
    }
    const name = this.auth.tenantName(tenantId);
    return name === tenantId ? null : name;
  }

  /**
   * Trae las agendas del profesional de la sesión.
   *
   * Se busca por el **perfil profesional**, que es el mismo criterio con el
   * que el servidor decide si la agenda es suya: preguntarlo de otra forma
   * daría una respuesta que después se contradice con un 403.
   */
  private cargarAgendas(): void {
    const perfil = this.auth.practitionerProfileId();
    const tenantId = this.auth.activeTenantId();
    if (perfil === null || tenantId === null) {
      this.cargandoAgendas.set(false);
      return;
    }

    agendaResourcesMy(this.scheduling, tenantId, perfil).subscribe({
      next: (recursos) => {
        this.cargandoAgendas.set(false);
        this.agendas.set(recursos);
        // Con una sola, se elige sola: preguntar por algo que no tiene
        // alternativa es un paso de más.
        this.agendaElegida.set(recursos[0]?.id ?? null);
      },
      error: () => {
        this.cargandoAgendas.set(false);
        this.agendas.set([]);
      },
    });
  }
}

/** La hora local del instante, `HH:mm`. */
function horaDe(instante: Date): string {
  const horas = String(instante.getHours()).padStart(2, '0');
  const minutos = String(instante.getMinutes()).padStart(2, '0');
  return `${horas}:${minutos}`;
}

function minutosDeCupo(cupo: AgendaSlot): number {
  return (cupo.endAt.getTime() - cupo.startAt.getTime()) / MS_POR_MINUTO;
}

function opcionDeDuracion(minutos: number): SelectOption<string> {
  const label =
    minutos < 60 ? `${minutos} minutos` : minutos === 60 ? '1 hora' : `${minutos / 60} horas`;
  return { value: String(minutos), label };
}

/** Si un nombre ya incluye a otro, sin distinguir mayúsculas. */
function mentions(name: string, sought: string): boolean {
  return name.toLocaleLowerCase('es').includes(sought.toLocaleLowerCase('es'));
}

/** Si lo tecleado se lee como una cédula y no como el principio de un nombre. */
function esDocumento(texto: string): boolean {
  return new RegExp(`^\\d{${DIGITOS_DE_CEDULA},}$`).test(texto);
}

/**
 * La fecha en `YYYY-MM-DD`, **en hora local**.
 *
 * `toISOString()` convierte a UTC antes de recortar, así que una fecha elegida
 * como 1 de enero en un huso al oeste de Greenwich se enviaría como 31 de
 * diciembre. En una fecha de nacimiento eso es un día de diferencia en el
 * registro civil de alguien.
 */
function fechaIso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

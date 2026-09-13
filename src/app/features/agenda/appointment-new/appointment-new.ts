import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type {
  AgendaResource,
  WalkInPatient,
} from '../../../core/data-access/scheduling/scheduling.types';
import {
  MODALIDADES,
  type ModalidadDeAtencion,
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
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { AGENDA_ROUTE } from '../agenda.routes';
import { misRecursosDeAgenda } from '../mi-recurso';

/**
 * Duraciones ofrecidas, en minutos.
 *
 * Son atajos, **no un tope**: el campo admite escribir cualquier número porque
 * «la cirugía de tres horas y la consulta de cuarenta y cinco conviven», y
 * acotar la duración a la del turno publicado convertiría esta pantalla en el
 * formulario del paciente, que es justo lo que no es.
 */
const DURACIONES = [15, 20, 30, 45, 60, 90, 120] as const;

/** Duración por omisión: la consulta corriente. */
const DURACION_POR_DEFECTO = 30;

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

/**
 * Alta de cita del profesional — `/schedule/appointment/new`.
 *
 * ## Por qué no se copió el formulario del paciente
 *
 * Porque no hacen lo mismo. `booking-new` parte de un **cupo ya publicado** y
 * lo toma en dos pasos con vencimiento (`hold` → `confirm`); esto parte de un
 * **rato cualquiera**, en una sola transacción, y **retira** los cupos libres
 * que pisa. Copiar aquella pantalla habría duplicado por tercera vez lo
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
    PageHeader,
    ReferenceCombobox,
    RouterLink,
    Select,
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

  /** El nombre del paciente nuevo tal como se va a ver escrito. */
  protected readonly nombreDelNuevo = computed(() =>
    [
      this.nuevoNombre(),
      this.nuevoSegundoNombre(),
      this.nuevoTercerNombre(),
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

  protected readonly hora = signal('');
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

  protected readonly opcionesDeDuracion: readonly SelectOption<string>[] =
    DURACIONES.map((minutos) => ({
      value: String(minutos),
      label: minutos < 60
        ? `${minutos} minutos`
        : minutos === 60
          ? '1 hora'
          : `${minutos / 60} horas`,
    }));

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.cargarAgendas();
  }

  /**
   * Cuándo empieza la cita, o `null` si falta o no es una fecha.
   *
   * La hora se valida acá y no en el campo: `09:30` es válido, `9:5` no, y un
   * texto libre que llega mal armado produce una cita en un instante que nadie
   * eligió.
   */
  protected readonly comienza = computed<Date | null>(() => {
    const dia = this.dia();
    const hora = this.hora().trim();
    if (dia === null || !/^\d{1,2}:\d{2}$/.test(hora)) return null;

    const [hh, mm] = hora.split(':').map(Number);
    if (hh > 23 || mm > 59) return null;

    // Se compone sobre el día elegido, en hora local. Armarlo desde una
    // cadena ISO sin zona lo interpretaría en UTC en algunos navegadores y
    // adelantaría la cita cuatro horas en Bolivia.
    const cuando = new Date(dia);
    cuando.setHours(hh, mm, 0, 0);
    return cuando;
  });

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
        ? ' Vas a su domicilio.'
        : '';
    // Con un paciente nuevo pasan dos cosas y no una, así que se dicen las dos.
    // «Le avisamos al paciente» sería mentira acá: todavía no tiene cuenta por
    // donde recibir el aviso — lo que tiene es una ficha para completar.
    if (this.modo() === 'nuevo') {
      return `Lo damos de alta con estos datos y agendamos la cita.${donde} Su ficha queda para completar.`;
    }
    return `Se agenda la cita y le avisamos al paciente. No tiene que confirmar nada.${donde}`;
  });

  protected readonly puedeGuardar = computed(
    () =>
      !this.guardando() &&
      this.hayPaciente() &&
      this.comienza() !== null &&
      this.minutos() !== null &&
      this.agendaElegida() !== null,
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
    this.ocupaciones.olvidar();
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
    this.ocupaciones.listar().subscribe({
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
   * `POST /scheduling/appointments/walk-in` es el endpoint que P22 pedía y que
   * el backend mergeó: recibe el bloque de filiación entero, crea persona,
   * perfil, identificador, teléfono y tutor, reserva, **abre el encuentro** y
   * arranca la atención en una sola transacción. La reserva nace
   * `IN_PROGRESS`, no `CONFIRMED`: quien llegó al mostrador ya está ahí.
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
      })
      .subscribe({
        next: (creado) => {
          this.guardando.set(false);
          const quitados =
            creado.retractedSlots > 0
              ? ` Esto quitó ${creado.retractedSlots} ${
                  creado.retractedSlots === 1 ? 'horario disponible' : 'horarios disponibles'
                }.`
              : '';
          this.toasts.success(
            `Quedó registrado con el código ${creado.patientCode} y la atención ya está abierta.${quitados}`,
            'Paciente registrado y atención abierta',
          );
          void this.router.navigate([AGENDA_ROUTE]);
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.error.set(
              'Ese documento ya está registrado. Buscalo arriba por su cédula y agendale el turno.',
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
    esAltaNueva = false,
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
        next: (creada) => {
          this.guardando.set(false);
          const quitados =
            creada.retractedSlots > 0
              ? ` Esto quitó ${creada.retractedSlots} ${
                  creada.retractedSlots === 1 ? 'horario disponible' : 'horarios disponibles'
                }.`
              : '';
          this.toasts.success(
            esAltaNueva
              ? `Quedó registrado y con la cita agendada.${quitados}`
              : `Le avisamos al paciente. No tiene que confirmar nada.${quitados}`,
            esAltaNueva ? 'Paciente registrado y cita agendada' : 'Cita agendada',
          );
          void this.router.navigate([AGENDA_ROUTE]);
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          this.error.set(this.mensajeDeError(errorToViewState<never>(error)));
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
    const otrosNombres = [this.nuevoSegundoNombre(), this.nuevoTercerNombre()]
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

    misRecursosDeAgenda(this.scheduling, tenantId, perfil).subscribe({
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

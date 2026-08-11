import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../../core/auth/auth.service';
import { patientChartRoute } from '../clinical-record/clinical-record.routes';
import { SchedulingClient } from '../../core/data-access/scheduling/scheduling.client';
import type {
  AgendaResource,
  AgendaSlot,
  Booking,
} from '../../core/data-access/scheduling/scheduling.types';
import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../shared/components/atoms/button/button-link';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { Link } from '../../shared/components/atoms/link/link';
import { Select } from '../../shared/components/atoms/select/select';
import type { SelectOption } from '../../shared/components/atoms/select/select.types';
import { Switch } from '../../shared/components/atoms/switch/switch';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { DialogService } from '../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { bookingNewRoute } from './agenda.routes';

/**
 * Las ventanas que se ofrecen, en días.
 *
 * Presets y no un par de calendarios porque la pregunta real de una agenda es
 * «qué tengo hoy» y «qué viene»: elegir dos fechas exactas es la excepción, y
 * cobrarle ese costo a todo el mundo para servir a la excepción es al revés.
 */
const VENTANAS = [
  { clave: 'hoy', etiqueta: 'Hoy', dias: 1 },
  { clave: 'semana', etiqueta: 'Próximos 7 días', dias: 7 },
  { clave: 'mes', etiqueta: 'Próximos 30 días', dias: 30 },
] as const;

/** La clave de una ventana; es lo que viaja en la URL. */
export type VentanaClave = (typeof VENTANAS)[number]['clave'];

const VENTANA_POR_DEFECTO: VentanaClave = 'semana';

/** Tope de filas por lectura. La API admite hasta 500 en cupos y 100 en citas. */
const TOPE = 100;

/** Lo que se muestra cuando el registro no trae ese dato. */
const SIN_DATO = 'Sin registrar';

/** Roles que sí pueden abrir la ficha de un paciente (`GET /profiles/patients/:id`). */
const ROLES_CON_FICHA = ['SECURITY_ADMIN', 'SUPERADMIN'];

/**
 * Roles que sí pueden abrir el expediente clínico.
 *
 * Los declara el backend a nivel de controlador en las dos lecturas del
 * expediente (`GET /clinical/patients/:id/summary` y
 * `GET /charts/patients/:id/chart`). `SUPERADMIN` entra por lo mismo que en la
 * ficha: el `RolesGuard` lo trata como comodín, y esconderle el enlace lo
 * escondería a alguien a quien la API sí le responde.
 */
const ROLES_CON_EXPEDIENTE = ['CLINICIAN', 'PRACTITIONER', 'SUPERADMIN'];

/**
 * Roles que operan citas (`check-in`, `cancel`). Del backend: los dos
 * endpoints declaran `SCHEDULING_ADMIN`/`SCHEDULING_AGENT`, y `SUPERADMIN` es
 * el comodín de su `RolesGuard`.
 */
const ROLES_QUE_OPERAN_CITAS = ['SCHEDULING_ADMIN', 'SCHEDULING_AGENT', 'SUPERADMIN'];

/** Roles que pueden retener y confirmar un cupo. `PATIENT` reserva para sí. */
const ROLES_QUE_RESERVAN = [...ROLES_QUE_OPERAN_CITAS, 'PATIENT'];

/** Una cita ya lista para pintar: sin uuid, con el recurso y el estado resueltos. */
export interface CitaVisible {
  readonly id: string;
  readonly cuando: Date | null;
  readonly hasta: Date | null;
  readonly recurso: string;
  readonly estado: string;
  readonly motivo: string;
  readonly patientProfileId: string | null;
  readonly rutaPaciente: string | null;
  /** El expediente clínico de la persona citada, si la sesión puede abrirlo. */
  readonly rutaExpediente: string | null;
  /**
   * El motivo tal cual vino, sin el relleno de ausencia.
   *
   * Viaja al expediente como parámetro para precargar el motivo de consulta del
   * encuentro: quien atiende no debería volver a teclear lo que la cita ya dice.
   */
  readonly motivoCrudo: string | null;
  /** Con la llegada ya registrada, el check-in no se vuelve a ofrecer. */
  readonly llegadaRegistrada: boolean;
}

/** Un cupo listo para pintar. */
export interface CupoVisible {
  readonly id: string;
  /** Para armar el enlace de reserva: la pantalla de reserva lo relee. */
  readonly resourceId: string;
  readonly desde: Date;
  readonly hasta: Date;
  readonly recurso: string;
  readonly estado: string;
  readonly capacidad: number;
  readonly libres: number;
  readonly disponible: boolean;
  /** «2 de 4 libres», ya con la concordancia resuelta. */
  readonly disponibilidad: string;
}

/**
 * **Agenda** (M41) — la sección que hasta ahora era un cartel.
 *
 * ## Por qué deja de ser un placeholder
 *
 * `APP_SECTIONS` la declaraba `planificada` con el motivo general del vault: el
 * backend no exponía el `GET` de colección. Para agenda **ya lo expone**: el
 * módulo se había construido entero de escritura —se generaban cupos y se
 * confirmaban citas, pero no había forma de verlos— y esa mitad que faltaba se
 * abrió con `GET /scheduling/resources`, `/slots` y `/bookings`.
 *
 * ## Qué muestra y por qué en dos pestañas
 *
 * **Citas** es lo comprometido; **Cupos** es lo que queda por ofrecer. Son dos
 * preguntas distintas —«qué tengo» y «qué puedo dar»— y mezclarlas en una tabla
 * obliga a leer una columna para saber qué se está mirando. Las pestañas también
 * evitan la lectura que no se pidió: el panel inactivo no existe en el DOM.
 *
 * ## Los identificadores que sí se muestran
 *
 * El de un cupo, y a propósito: es el que exige `POST /scheduling/slots/{id}/holds`
 * para reservar. Mismo criterio que el catálogo de terminología — se muestra el
 * dato que se vino a buscar, no se esconde por ser técnico.
 *
 * El del paciente **no** se muestra suelto. Se convierte en un enlace a su ficha
 * cuando la sesión puede abrirla, y en nada cuando no: `GET /profiles/patients/:id`
 * pide `SECURITY_ADMIN`, así que ofrecerle el enlace a quien agenda sería
 * ofrecerle un 403.
 *
 * ## Sin organización elegida no se pide nada
 *
 * `GET /scheduling/resources` exige `tenantId`. Pedirlo con la organización
 * todavía sin resolver daría un 400 que se leería como «la agenda falló», cuando
 * lo que falta es un paso previo que la propia aplicación resuelve.
 */
@Component({
  selector: 'app-agenda',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    DataTable,
    DatePipe,
    FormField,
    Link,
    PageHeader,
    RouterLink,
    Select,
    Switch,
    Tab,
    Tabs,
  ],
  templateUrl: './agenda.html',
  styleUrl: './agenda.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Agenda {
  private readonly scheduling = inject(SchedulingClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly celdaCuando =
    viewChild.required<TemplateRef<{ $implicit: CitaVisible }>>('celdaCuando');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: CitaVisible }>>('celdaEstado');
  private readonly celdaPaciente =
    viewChild.required<TemplateRef<{ $implicit: CitaVisible }>>('celdaPaciente');
  private readonly celdaFranja =
    viewChild.required<TemplateRef<{ $implicit: CupoVisible }>>('celdaFranja');
  private readonly celdaDisponibilidad =
    viewChild.required<TemplateRef<{ $implicit: CupoVisible }>>('celdaDisponibilidad');
  private readonly celdaCupoId =
    viewChild.required<TemplateRef<{ $implicit: CupoVisible }>>('celdaCupoId');
  private readonly celdaAccionesCita =
    viewChild.required<TemplateRef<{ $implicit: CitaVisible }>>('celdaAccionesCita');
  private readonly celdaReservar =
    viewChild.required<TemplateRef<{ $implicit: CupoVisible }>>('celdaReservar');

  /* -- Estado de la pantalla ---------------------------------------------- */

  private readonly recursos = signal<readonly AgendaResource[]>([]);
  private readonly etiquetas = signal<ConceptLabels>(new Map());

  protected readonly citas = signal<ViewState<readonly CitaVisible[]>>(loading());
  protected readonly cupos = signal<ViewState<readonly CupoVisible[]>>(loading());

  /** Qué bloques llegaron recortados por el tope, para decirlo en pantalla. */
  protected readonly citasRecortadas = signal(false);
  protected readonly cuposRecortados = signal(false);

  protected readonly ventanas = VENTANAS;
  protected readonly tope = TOPE;

  /* -- Filtros, que viven en la URL ---------------------------------------
     Igual que el buscador de pacientes y el de terminología, y por las mismas
     razones: el enlace se comparte con el filtro puesto y «atrás» lo deshace. */

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: null });

  /** El recurso que la URL pide, tal cual, sin resolver. */
  private readonly recursoPedido = computed(() => this.params()?.get('recurso') ?? null);

  /**
   * El recurso que se está mirando. **Siempre hay uno** (o no hay ninguno que
   * mirar).
   *
   * No existe «todos los recursos», y no es una decisión de diseño: el backend
   * responde `422 PRECONDITION_FAILED — «Indique al menos patientProfileId o
   * resourceId para listar citas»` a `GET /scheduling/bookings` sin acotar. Una
   * agenda de la organización entera no se puede pedir, así que ofrecerla en el
   * selector sería ofrecer un botón que devuelve un error.
   *
   * Sin recurso en la URL se toma el primero de la lista: entrar a la agenda y
   * encontrarla vacía hasta elegir algo es peor que entrar y ver una agenda —
   * cuál se está mirando lo dice el selector, que queda marcado.
   */
  protected readonly recursoElegido = computed(() => {
    const pedido = this.recursoPedido();
    const disponibles = this.recursos();
    if (pedido !== null && disponibles.some((recurso) => recurso.id === pedido)) {
      return pedido;
    }
    // `.at(0)` y no `[0]`: el proyecto no usa `noUncheckedIndexedAccess`, así
    // que el índice se tipa como si siempre hubiera elemento y el compilador
    // daba por imposible el `null` que en tiempo de ejecución sí ocurre —una
    // organización sin recursos—. `.at()` sí declara el `undefined`.
    return disponibles.at(0)?.id ?? null;
  });

  /**
   * Si la URL pide un recurso que la organización no tiene.
   *
   * Pasa con un enlace viejo o con un recurso dado de baja. Se cae al primero
   * —la agenda igual sirve— pero callarlo haría creer que se está mirando el
   * recurso del enlace.
   */
  protected readonly recursoInexistente = computed(() => {
    const pedido = this.recursoPedido();
    return (
      pedido !== null &&
      this.recursos().length > 0 &&
      !this.recursos().some((recurso) => recurso.id === pedido)
    );
  });

  /** Si los recursos ya se leyeron. Sin esto, «no hay» y «todavía no» se mezclan. */
  private readonly recursosLeidos = signal(false);

  /**
   * El error de la lectura de recursos, si lo hubo.
   *
   * Se guarda en vez de tragarse porque **`403` no es «no hay»**: a un
   * profesional sin rol de agenda el backend le niega la lista, y decirle que la
   * organización no tiene recursos lo manda a buscar un problema que no existe.
   */
  private readonly falloDeRecursos = signal<unknown>(null);

  /**
   * La organización no tiene ningún recurso agendable cargado.
   *
   * **Vacío de verdad**, no fallo: con un error la pantalla lo cuenta en las
   * tablas —con el estado que corresponda— y este aviso no aparece.
   */
  protected readonly sinRecursos = computed(
    () => this.recursosLeidos() && this.falloDeRecursos() === null && this.recursos().length === 0,
  );

  /** El nombre del recurso que se está mirando, para decirlo en pantalla. */
  protected readonly nombreDelRecurso = computed(() => {
    const id = this.recursoElegido();
    return id === null ? '' : (this.recursos().find((r) => r.id === id)?.name ?? '');
  });

  protected readonly ventanaElegida = computed<VentanaClave>(() => {
    const pedida = this.params()?.get('rango');
    return VENTANAS.some((v) => v.clave === pedida)
      ? (pedida as VentanaClave)
      : VENTANA_POR_DEFECTO;
  });

  /** Pestaña visible. En la URL para que un enlace pueda apuntar a los cupos. */
  protected readonly pestana = computed(() => (this.params()?.get('vista') === 'cupos' ? 1 : 0));

  protected readonly incluirCanceladas = computed(() => this.params()?.get('canceladas') === 'si');

  /* -- Derivados ----------------------------------------------------------- */

  protected readonly organizacion = this.auth.activeTenantId;

  /** Sin organización no hay agenda que pedir: `tenantId` es obligatorio. */
  protected readonly sinOrganizacion = computed(() => this.organizacion() === null);

  protected readonly opcionesDeRecurso = computed<readonly SelectOption<string>[]>(() =>
    this.recursos().map((recurso) => ({ value: recurso.id, label: recurso.name })),
  );

  protected readonly opcionesDeVentana = computed<readonly SelectOption<string>[]>(() =>
    VENTANAS.map((ventana) => ({ value: ventana.clave, label: ventana.etiqueta })),
  );

  protected readonly resumenDeVentana = computed(() => {
    const ventana = VENTANAS.find((v) => v.clave === this.ventanaElegida());
    return ventana === undefined ? '' : ventana.etiqueta.toLowerCase();
  });

  /**
   * Los rótulos de las pestañas, con el conteo cuando ya se sabe.
   *
   * El conteo está en la pestaña y no adentro porque es la única forma de ver
   * cuánto hay del otro lado sin cambiar de panel: el panel inactivo no se
   * renderiza, así que un contador dentro del panel no se lee hasta abrirlo.
   */
  protected readonly rotuloDeCitas = computed(() => rotulo('Citas', cuenta(this.citas())));
  protected readonly rotuloDeCupos = computed(() => rotulo('Cupos', cuenta(this.cupos())));

  /** Si la sesión puede registrar llegadas y cancelar. Roles de los endpoints. */
  protected readonly puedeOperarCitas = computed(() => {
    const roles = this.auth.roles();
    return ROLES_QUE_OPERAN_CITAS.some((rol) => roles.includes(rol));
  });

  /** Si la sesión puede retener y confirmar un cupo. */
  protected readonly puedeReservar = computed(() => {
    const roles = this.auth.roles();
    return ROLES_QUE_RESERVAN.some((rol) => roles.includes(rol));
  });

  protected readonly columnasDeCitas = computed<readonly ColumnDef<CitaVisible>[]>(() => [
    { key: 'cuando', header: 'Fecha y hora', priority: 1, cell: this.celdaCuando() },
    { key: 'recurso', header: 'Recurso', priority: 1 },
    { key: 'estado', header: 'Estado', priority: 1, cell: this.celdaEstado() },
    { key: 'paciente', header: 'Paciente', priority: 2, cell: this.celdaPaciente() },
    { key: 'motivo', header: 'Motivo', priority: 3 },
    // La columna sólo existe para quien puede ejecutar las acciones: ofrecer
    // botones que la API va a rechazar con 403 es ofrecer un error.
    ...(this.puedeOperarCitas()
      ? [
          {
            key: 'acciones',
            header: 'Acciones',
            priority: 1,
            cell: this.celdaAccionesCita(),
          } satisfies ColumnDef<CitaVisible>,
        ]
      : []),
  ]);

  protected readonly columnasDeCupos = computed<readonly ColumnDef<CupoVisible>[]>(() => [
    { key: 'franja', header: 'Franja', priority: 1, cell: this.celdaFranja() },
    { key: 'recurso', header: 'Recurso', priority: 1 },
    {
      key: 'disponibilidad',
      header: 'Disponibilidad',
      priority: 1,
      cell: this.celdaDisponibilidad(),
    },
    { key: 'estado', header: 'Estado', priority: 2 },
    // Se muestra por lo mismo que el catálogo muestra el `conceptId`: es el
    // valor que hay que mandar para reservar, no ruido técnico.
    { key: 'id', header: 'Identificador del cupo', priority: 3, cell: this.celdaCupoId() },
    ...(this.puedeReservar()
      ? [
          {
            key: 'reservar',
            header: 'Reservar',
            priority: 1,
            cell: this.celdaReservar(),
          } satisfies ColumnDef<CupoVisible>,
        ]
      : []),
  ]);

  protected readonly porCita = (fila: CitaVisible): string => fila.id;
  protected readonly porCupo = (fila: CupoVisible): string => fila.id;

  constructor() {
    // Los recursos se leen una vez por organización: son el catálogo de la
    // agenda, no el contenido. Cambiar de ventana no debería volver a pedirlos.
    effect(() => {
      this.organizacion();
      untracked(() => this.cargarRecursos());
    });

    effect(() => {
      this.organizacion();
      this.recursoElegido();
      this.ventanaElegida();
      this.incluirCanceladas();
      // Se depende también de que los recursos ya se hayan leído: con una
      // organización sin ninguno, `recursoElegido()` se queda en `null` de
      // punta a punta y sin esta dependencia la pantalla no saldría nunca del
      // esqueleto de carga.
      this.recursosLeidos();
      untracked(() => this.cargarAgenda());
    });
  }

  /* -- Acciones ------------------------------------------------------------ */

  protected elegirRecurso(recursoId: string | null): void {
    if (recursoId === null || recursoId === '') {
      return;
    }
    this.publicar({ recurso: recursoId });
  }

  protected elegirVentana(clave: string | null): void {
    this.publicar({ rango: clave === VENTANA_POR_DEFECTO ? null : clave });
  }

  protected alternarCanceladas(incluir: boolean): void {
    this.publicar({ canceladas: incluir ? 'si' : null });
  }

  protected elegirPestana(indice: number): void {
    this.publicar({ vista: indice === 1 ? 'cupos' : null });
  }

  protected recargar(): void {
    this.cargarAgenda();
  }

  /* -- Acciones sobre una cita (UC-41-09 y UC-41-10) ----------------------- */

  /** La cita sobre la que hay una operación en vuelo, para frenar el doble clic. */
  protected readonly operando = signal<string | null>(null);

  /**
   * Registra la llegada. Sin diálogo: no es destructivo y se hace decenas de
   * veces por día — la fricción del mostrador es un costo real.
   */
  protected registrarLlegada(cita: CitaVisible): void {
    if (this.operando() !== null) {
      return;
    }
    this.operando.set(cita.id);

    this.scheduling.checkInBooking(cita.id).subscribe({
      next: () => {
        this.operando.set(null);
        this.toast.success('La llegada quedó registrada.', 'Check-in');
        this.cargarAgenda();
      },
      error: (error: unknown) => {
        this.operando.set(null);
        this.avisarFallo(error, 'No se pudo registrar la llegada.');
      },
    });
  }

  /**
   * Cancela con confirmación explícita — regla del M34 para acciones
   * destructivas. `cancelledBy: 'PROVIDER'`: desde esta pantalla cancela la
   * organización; la cancelación del propio paciente entra con su vista.
   */
  protected async cancelarCita(cita: CitaVisible): Promise<void> {
    if (this.operando() !== null) {
      return;
    }

    const confirmado = await this.dialogs.confirm({
      title: 'Cancelar la cita',
      message:
        'La cita se cancela y el cupo vuelve a la agenda. La cancelación queda auditada.',
      confirmLabel: 'Cancelar la cita',
      cancelLabel: 'Volver',
      destructive: true,
    });
    if (!confirmado) {
      return;
    }

    this.operando.set(cita.id);
    this.scheduling.cancelBooking(cita.id, { cancelledBy: 'PROVIDER' }).subscribe({
      next: (resultado) => {
        this.operando.set(null);
        this.toast.success(
          resultado.capacityReleased
            ? 'La cita se canceló y el cupo volvió a la agenda.'
            : 'La cita se canceló.',
          'Cancelación',
        );
        this.cargarAgenda();
      },
      error: (error: unknown) => {
        this.operando.set(null);
        this.avisarFallo(error, 'No se pudo cancelar la cita.');
      },
    });
  }

  /** El destino del enlace «Reservar» de un cupo. */
  protected rutaDeReserva(cupo: CupoVisible): string {
    return bookingNewRoute(cupo.id);
  }

  /**
   * La franja viaja con el enlace: la pantalla de reserva no puede leer un
   * cupo por id —no existe ese GET— y con esto lo reencuentra y revalida.
   */
  protected paramsDeReserva(cupo: CupoVisible): Record<string, string> {
    return {
      recurso: cupo.resourceId,
      desde: cupo.desde.toISOString(),
      hasta: cupo.hasta.toISOString(),
    };
  }

  /**
   * El fallo de una acción de fila sale por toast, no pisando la tabla: la
   * agenda que sí se leyó sigue siendo cierta aunque un botón haya fallado.
   */
  private avisarFallo(error: unknown, generico: string): void {
    const estado = errorToViewState<null>(error);
    const detalle =
      estado.status === 'validation'
        ? estado.issues.map((issue) => issue.message).join(' ')
        : estado.status === 'forbidden' || estado.status === 'error'
          ? (estado.message ?? '')
          : '';
    this.toast.error(detalle === '' ? generico : `${generico} ${detalle}`, 'Agenda');
  }

  /**
   * Escribe los filtros en la URL conservando los demás.
   *
   * `null` borra la clave en vez de dejarla vacía: `?recurso=` no significa lo
   * mismo que ausente para nadie que lea la dirección, y una URL con claves
   * huérfanas es una URL que no se puede comparar entre dos sesiones.
   */
  private publicar(cambios: Readonly<Record<string, string | null>>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: cambios,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /* -- Lecturas ------------------------------------------------------------ */

  /**
   * Los recursos de la organización.
   *
   * Son la **precondición** de la agenda, no un adorno: sin un recurso no se
   * pueden pedir las citas, porque `GET /scheduling/bookings` sin acotar
   * responde `422`. Por eso su fallo deja la pantalla sin agenda y lo dice, en
   * vez de degradar los nombres y seguir como si nada.
   */
  private cargarRecursos(): void {
    const tenantId = this.organizacion();
    this.recursosLeidos.set(false);
    this.falloDeRecursos.set(null);

    if (tenantId === null) {
      this.recursos.set([]);
      return;
    }

    this.scheduling.listResources({ tenantId }).subscribe({
      next: (pagina) => {
        this.recursos.set(pagina.items);
        this.recursosLeidos.set(true);
      },
      error: (error: unknown) => {
        // **Se guarda el error, no se traga.** Antes se caía a una lista vacía y
        // la pantalla decía «esta organización todavía no tiene recursos
        // agendables» — que es lo que ve un profesional recién registrado, a
        // quien `GET /scheduling/resources` le responde `403` por rol. Confundir
        // «no hay» con «no podés ver» es exactamente lo que el M34 separa en S3
        // y S5, y en una agenda manda a buscar un problema que no existe.
        this.recursos.set([]);
        this.falloDeRecursos.set(error);
        this.recursosLeidos.set(true);
      },
    });
  }

  /**
   * Citas y cupos de la ventana, en paralelo.
   *
   * En paralelo y no encadenado porque no dependen entre sí, y con `forkJoin`
   * en vez de dos suscripciones porque las etiquetas de estado se piden una vez
   * para los dos bloques: son el mismo catálogo.
   */
  private cargarAgenda(): void {
    const tenantId = this.organizacion();
    if (tenantId === null) {
      // No es un error ni un vacío: es un paso previo. Que la pantalla lo diga
      // con su propio aviso y no con un estado de fallo es la diferencia entre
      // «elegí una organización» y «la agenda no anda».
      this.citas.set(ready([]));
      this.cupos.set(ready([]));
      return;
    }

    const recursoId = this.recursoElegido();
    if (recursoId === null) {
      // Sin recurso no hay nada que pedir, y pedirlo igual daría el `422` del
      // backend. Mientras los recursos no se hayan leído se queda en carga: un
      // vacío antes de preguntar afirmaría que la organización no tiene agenda.
      const fallo = this.falloDeRecursos();
      const espera: ViewState<never[]> =
        fallo !== null
          ? // Un `403` sale como S5 con su propia explicación; el resto, como lo
            // que sea. Traducirlo es de `errorToViewState`, no de acá.
            errorToViewState<never[]>(fallo)
          : this.recursosLeidos()
            ? empty(
                { label: 'Volver al panel', route: '/panel' },
                'Esta organización todavía no tiene recursos agendables cargados.',
              )
            : loading();
      this.citas.set(espera);
      this.cupos.set(espera);
      return;
    }

    this.citas.set(loading());
    this.cupos.set(loading());
    this.citasRecortadas.set(false);
    this.cuposRecortados.set(false);

    const { desde, hasta } = this.ventana();
    const recurso = { resourceId: recursoId };

    forkJoin({
      citas: this.scheduling
        .searchBookings({
          ...recurso,
          from: desde,
          to: hasta,
          includeCancelled: this.incluirCanceladas(),
          limit: TOPE,
        })
        .pipe(catchError((error: unknown) => of({ error }))),
      cupos: this.scheduling
        .listSlots({ ...recurso, from: desde, to: hasta, limit: TOPE })
        .pipe(catchError((error: unknown) => of({ error }))),
    }).subscribe(({ citas, cupos }) => {
      const conceptos = [
        ...('error' in citas ? [] : citas.items.map((cita) => cita.statusConceptId)),
        ...('error' in cupos ? [] : cupos.items.map((cupo) => cupo.statusConceptId)),
      ];

      this.terminology
        .readConceptLabels(conceptos)
        .pipe(catchError(() => of<ConceptLabels>(new Map())))
        .subscribe((etiquetas) => {
          this.etiquetas.set(etiquetas);
          this.aplicarCitas(citas);
          this.aplicarCupos(cupos);
        });
    });
  }

  private aplicarCitas(
    resultado: { error: unknown } | { items: readonly Booking[]; truncated: boolean },
  ): void {
    if ('error' in resultado) {
      this.citas.set(errorToViewState<readonly CitaVisible[]>(resultado.error));
      return;
    }

    this.citasRecortadas.set(resultado.truncated);

    if (resultado.items.length === 0) {
      this.citas.set(
        empty(
          { label: 'Ver los cupos libres', route: '/agenda' },
          `No hay citas ${this.resumenDeVentana()} con los filtros puestos.`,
        ),
      );
      return;
    }

    this.citas.set(ready(resultado.items.map((cita) => this.aCitaVisible(cita))));
  }

  private aplicarCupos(
    resultado: { error: unknown } | { items: readonly AgendaSlot[]; truncated: boolean },
  ): void {
    if ('error' in resultado) {
      this.cupos.set(errorToViewState<readonly CupoVisible[]>(resultado.error));
      return;
    }

    this.cuposRecortados.set(resultado.truncated);

    if (resultado.items.length === 0) {
      this.cupos.set(
        empty(
          { label: 'Ampliar a 30 días', route: '/agenda' },
          `No hay cupos generados ${this.resumenDeVentana()} para lo que estás mirando.`,
        ),
      );
      return;
    }

    this.cupos.set(ready(resultado.items.map((cupo) => this.aCupoVisible(cupo))));
  }

  /* -- Traducciones -------------------------------------------------------- */

  private aCitaVisible(cita: Booking): CitaVisible {
    const paciente = cita.patientProfileId ?? null;
    return {
      id: cita.id,
      cuando: cita.startAt ?? null,
      hasta: cita.endAt ?? null,
      recurso: this.nombreDeRecurso(cita.resourceId),
      estado: this.label(cita.statusConceptId),
      motivo: cita.reasonText ?? SIN_DATO,
      patientProfileId: paciente,
      rutaPaciente:
        paciente !== null && this.puedeVerFichas() ? `/administracion/pacientes/${paciente}` : null,
      rutaExpediente:
        paciente !== null && this.puedeVerExpedientes() ? patientChartRoute(paciente) : null,
      motivoCrudo: cita.reasonText ?? null,
      llegadaRegistrada: cita.checkedInAt !== undefined,
    };
  }

  private aCupoVisible(cupo: AgendaSlot): CupoVisible {
    return {
      id: cupo.id,
      resourceId: cupo.resourceId,
      desde: cupo.startAt,
      hasta: cupo.endAt,
      recurso: this.nombreDeRecurso(cupo.resourceId),
      estado: this.label(cupo.statusConceptId),
      capacidad: cupo.capacity,
      libres: cupo.remainingCapacity,
      // Derivado del contrato, no del estado: `remainingCapacity` no exige
      // resolver terminología para saber si queda lugar.
      disponible: cupo.remainingCapacity > 0,
      disponibilidad: `${cupo.remainingCapacity} de ${cupo.capacity} ${
        cupo.remainingCapacity === 1 ? 'libre' : 'libres'
      }`,
    };
  }

  /** El nombre del recurso, o el texto de ausencia. Nunca el uuid. */
  private nombreDeRecurso(resourceId: string | undefined): string {
    if (resourceId === undefined) {
      return SIN_DATO;
    }
    return this.recursos().find((recurso) => recurso.id === resourceId)?.name ?? SIN_DATO;
  }

  private label(conceptId: string | undefined): string {
    if (conceptId === undefined) {
      return SIN_DATO;
    }
    return this.etiquetas().get(conceptId)?.display ?? SIN_DATO;
  }

  /**
   * Si la sesión puede abrir la ficha de un paciente.
   *
   * `SUPERADMIN` entra porque el `RolesGuard` del backend lo trata como comodín:
   * si acá no figurara, el enlace se escondería para alguien a quien la API sí
   * le responde.
   */
  private puedeVerFichas(): boolean {
    const roles = this.auth.roles();
    return ROLES_CON_FICHA.some((rol) => roles.includes(rol));
  }

  /**
   * Si la sesión puede abrir el expediente clínico de la persona citada.
   *
   * Es el enlace que cierra el recorrido —del turno a la historia de quien
   * llega— y el que quien atiende sí tiene: `CLINICIAN` y `PRACTITIONER` no
   * pueden abrir la ficha de filiación (`SECURITY_ADMIN`), así que sin este
   * enlace la agenda del médico terminaba en un callejón.
   */
  private puedeVerExpedientes(): boolean {
    const roles = this.auth.roles();
    return ROLES_CON_EXPEDIENTE.some((rol) => roles.includes(rol));
  }

  /**
   * La ventana consultada, desde el arranque del día de hoy.
   *
   * Arranca hoy y no «ahora» a propósito: una cita de las nueve de la mañana no
   * debería desaparecer de la agenda a las nueve y cinco.
   */
  private ventana(): { desde: Date; hasta: Date } {
    const dias = VENTANAS.find((v) => v.clave === this.ventanaElegida())?.dias ?? 7;
    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    const hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + dias);
    return { desde, hasta };
  }
}

/** Cuántas filas transporta un estado, o `null` si todavía no transporta ninguna. */
function cuenta<T>(estado: ViewState<readonly T[]>): number | null {
  if (estado.status === 'ready' || estado.status === 'stale') {
    return estado.data.length;
  }
  return estado.status === 'empty' ? 0 : null;
}

/**
 * El rótulo de una pestaña con su conteo.
 *
 * Sin conteo se devuelve el nombre pelado, no «Citas (…)»: un paréntesis vacío
 * mientras carga se lee como un dato, y el dato todavía no existe.
 */
function rotulo(nombre: string, total: number | null): string {
  return total === null ? nombre : `${nombre} (${total})`;
}

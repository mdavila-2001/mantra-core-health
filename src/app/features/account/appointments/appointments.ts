import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type {
  AgendaResource,
  AgendaSlot,
  Booking,
} from '../../../core/data-access/scheduling/scheduling.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type {
  ConceptLabels,
  ValueSetOption,
} from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { reservaDelPortalRoute } from './appointments.routes';
import { toBookingStatusPresentation } from './booking-status';

/**
 * Cuántos días hacia adelante se ofrecen.
 *
 * Dos semanas y no un calendario abierto porque la pregunta de quien pide un
 * turno es «cuándo puedo ir», no «qué hay dentro de tres meses»; y porque
 * `GET /scheduling/slots` rechaza con 422 las ventanas de más de 92 días.
 */
const DIAS_DE_BUSQUEDA = 14;

/** Tope de horarios que se listan. El backend admite hasta 500. */
const TOPE_DE_HORARIOS = 100;

/** Tope de turnos propios que se traen. Nadie tiene cien turnos a la vez. */
const TOPE_DE_TURNOS = 50;

/**
 * Los códigos de estado en los que el backend acepta cancelar una reserva.
 *
 * Allowlist a propósito, no denylist: el catálogo mezcla convenciones
 * —`BOOKING_CONFIRMED` a secas y `scheduling:BOOKING_REQUESTED` con prefijo— y
 * «completada» aparece con más de un código (`EV_BOOKING_DONE`), así que
 * enumerar lo cancelable es más seguro que enumerar lo que no lo es: un estado
 * nuevo o desconocido no ofrece el botón. El backend sigue siendo la última
 * palabra —un 409/422 se trata con aviso amable—, pero no se ofrece una acción
 * que casi seguro va a fallar.
 *
 * Verificado contra la API viva (2026-08-12): los reservables presentes en datos
 * llegan como `BOOKING_CONFIRMED` y `BOOKING_CHECKED_IN`; `REQUESTED` y
 * `PENDING_CONFIRMATION` existen en el catálogo con prefijo de módulo.
 */
const CODIGOS_CANCELABLES: ReadonlySet<string> = new Set([
  'BOOKING_REQUESTED',
  'BOOKING_PENDING_CONFIRMATION',
  'BOOKING_CONFIRMED',
  'BOOKING_CHECKED_IN',
]);

/**
 * El sufijo del código, sin el prefijo de módulo.
 *
 * El catálogo no es consistente (`BOOKING_CONFIRMED` vs
 * `scheduling:BOOKING_REQUESTED`); comparar el segmento posterior al último `:`
 * funciona con las dos formas. Mismo criterio que `agenda/booking-status.ts`,
 * replicado local para no acoplar este portal a esa pantalla (una feature no
 * debería depender de otra por una función de tres líneas).
 */
function sufijoDeCodigo(code: string): string {
  return code.includes(':') ? code.slice(code.lastIndexOf(':') + 1) : code;
}

/** Un turno propio, ya listo para mostrarse. */
interface TurnoVisible {
  readonly id: string;
  readonly cuando: Date | null;
  readonly hasta: Date | null;
  /** El uuid del catálogo. Se conserva para poder reetiquetar cuando llegue. */
  readonly statusConceptId: string;
  /** El código del catálogo ya resuelto. `''` hasta que terminología llegue. */
  readonly codigo: string;
  readonly estado: string;
  /** El tono del badge, que sale del mismo código que la palabra. */
  readonly tono: BadgeVariant;
  /** La agenda del turno. Se conserva el id para reetiquetar cuando llegue. */
  readonly resourceId: string;
  /** Con quién es el turno, en palabras. Vacío mientras no se sepa. */
  readonly agenda: string;
  readonly motivo: string;
}

/** Un horario que se puede pedir. */
interface HorarioVisible {
  readonly id: string;
  readonly desde: Date;
  readonly hasta: Date;
  readonly resourceId: string;
  readonly lugaresLibres: number;
}

/**
 * El portal de turnos del paciente (las vistas `PATIENT` de M41).
 *
 * Responde las dos preguntas que tiene quien entra: **qué turnos tengo** y
 * **cuándo puedo ir**. La segunda termina en la pantalla de reserva, que es la
 * misma del mostrador con la otra entrada.
 *
 * ## Por qué no reusa la pantalla de agenda
 *
 * La agenda de la organización existe y funciona, pero mira los datos desde el
 * otro lado: elige un recurso y muestra TODAS sus citas, de todos los
 * pacientes. Acá el eje es la persona —sus turnos— y el recurso es apenas el
 * filtro para encontrar hueco. Además su sección exige roles de agenda, que un
 * paciente no tiene ni debería tener.
 *
 * ## Los estados salen de terminología, no de un mapa en el código
 *
 * `statusConceptId` es un uuid de catálogo. Se traduce con
 * `TerminologyClient.readConceptLabels`, igual que la ficha de paciente: un
 * mapa de uuid a etiqueta escrito acá se desactualiza en silencio el día que el
 * catálogo cambia, y nadie se entera hasta que un socio ve un uuid en pantalla.
 */
@Component({
  selector: 'app-appointments',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    DatePipe,
    FormField,
    PageHeader,
    RouterLink,
    Select,
  ],
  templateUrl: './appointments.html',
  styleUrl: './appointments.css',
  // `DatePipe` inyectable para nombrar el turno concreto en la confirmación de
  // cancelación (mismo locale es-BO que la plantilla).
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Appointments {
  private readonly scheduling = inject(SchedulingClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly fecha = inject(DatePipe);

  /** Quién es el titular. Sin esto no hay turnos propios que pedir ni mostrar. */
  private readonly perfil = this.auth.patientProfileId();

  /**
   * La cuenta no es de un paciente.
   *
   * No es un error ni una falta de permisos: el personal de salud tiene sesión
   * válida y ninguna razón para tener turnos propios acá.
   */
  protected readonly sinPerfilDePaciente = this.perfil === null;

  /** La organización, que `GET /scheduling/resources` exige explícita. */
  protected readonly organizacion = this.auth.activeTenantId;

  /** Etiquetas de los conceptos de estado, para no mostrar uuid. */
  private readonly etiquetas = signal<ConceptLabels>(new Map());

  /* ---- mis turnos --------------------------------------------------------- */

  protected readonly turnos = signal<ViewState<readonly TurnoVisible[]>>(loading());

  /** El turno que se está cancelando, para el `[isLoading]` del botón. `null` = ninguno. */
  protected readonly operando = signal<string | null>(null);

  /* ---- pedir un turno ----------------------------------------------------- */

  protected readonly recursos = signal<readonly AgendaResource[]>([]);
  protected readonly recursoElegido = signal<string | null>(null);

  protected readonly opcionesDeRecurso = computed<readonly SelectOption<string>[]>(() =>
    this.recursos().map((recurso) => ({ value: recurso.id, label: recurso.name })),
  );

  /** La organización todavía no cargó ninguna agenda que ofrecer. */
  protected readonly sinRecursos = signal(false);

  /**
   * La próxima acción de todo vacío de esta pantalla es la misma: elegir una
   * agenda. No lleva `route` porque el control ya está acá arriba, en la misma
   * vista: mandar a otra ruta para volver al mismo lugar sería un rodeo.
   */
  private readonly elegirAgenda = { label: 'Elegí una agenda' } as const;

  protected readonly horarios = signal<ViewState<readonly HorarioVisible[]>>(
    empty(this.elegirAgenda, 'Elegí con quién te querés atender para ver los horarios libres.'),
  );

  /** El mensaje del vacío, que la plantilla no puede sacar del estado tipada. */
  protected readonly mensajeDeHorariosVacios = computed(() => {
    const estado = this.horarios();
    return estado.status === 'empty' ? (estado.message ?? '') : '';
  });

  protected readonly turnosListos = computed<readonly TurnoVisible[]>(() => {
    const estado = this.turnos();
    return estado.status === 'ready' ? estado.data : [];
  });

  protected readonly horariosListos = computed<readonly HorarioVisible[]>(() => {
    const estado = this.horarios();
    return estado.status === 'ready' ? estado.data : [];
  });

  constructor() {
    if (this.perfil !== null) {
      this.cargarTurnos();
      this.cargarRecursos();
    }
  }

  /* ---- lecturas ----------------------------------------------------------- */

  /** Los turnos del titular. El backend filtra por perfil, no por organización. */
  protected cargarTurnos(): void {
    const perfil = this.perfil;
    if (perfil === null) {
      return;
    }

    this.turnos.set(loading());
    // `includeCancelled: true` a propósito: tras cancelar, el turno tiene que
    // seguir viéndose —como cancelado— y no desaparecer. El backend lo oculta por
    // omisión; acá se quiere el historial reciente, no solo lo vigente.
    this.scheduling
      .searchBookings({ patientProfileId: perfil, includeCancelled: true, limit: TOPE_DE_TURNOS })
      .subscribe({
        next: (pagina) => {
          if (pagina.items.length === 0) {
            this.turnos.set(
              empty(this.elegirAgenda, 'Todavía no pediste ningún turno.'),
            );
            return;
          }
          this.traducirEstados(pagina.items);
          this.turnos.set(ready(pagina.items.map((cita) => this.aTurnoVisible(cita))));
        },
        error: (error: unknown) =>
          this.turnos.set(errorToViewState<readonly TurnoVisible[]>(error)),
      });
  }

  /**
   * Las agendas de la organización.
   *
   * `tenantId` va explícito porque el contrato lo exige en la query, y tiene
   * que ser el mismo que viaja en `X-Tenant-Id`: si difieren, el interceptor de
   * tenant responde 403 antes de llegar al handler.
   */
  private cargarRecursos(): void {
    const tenantId = this.organizacion();
    if (tenantId === null) {
      return;
    }

    this.scheduling.listResources({ tenantId }).subscribe({
      next: (pagina) => {
        this.recursos.set(pagina.items);
        this.sinRecursos.set(pagina.items.length === 0);
        // Los turnos pueden haberse pintado antes que esto: las dos lecturas
        // del arranque salen a la vez. Se rehacen para que tomen el nombre de
        // su agenda, igual que con las etiquetas de estado.
        this.reetiquetarTurnos();
      },
      // Un fallo acá no se cuenta como «no hay agendas»: eso mandaría a la
      // persona a esperar a que la organización cargue algo que quizá ya tiene.
      error: () => this.sinRecursos.set(false),
    });
  }

  /**
   * El `Select` emite `null` cuando se vuelve al placeholder. Eso no es elegir
   * una agenda: se vuelve al estado inicial en vez de pedir horarios de nadie.
   */
  protected elegirRecurso(id: string | null): void {
    this.recursoElegido.set(id);
    if (id === null) {
      this.horarios.set(
        empty(this.elegirAgenda, 'Elegí con quién te querés atender para ver los horarios libres.'),
      );
      return;
    }
    this.cargarHorarios();
  }

  /** Los huecos de las próximas dos semanas del recurso elegido. */
  protected cargarHorarios(): void {
    const resourceId = this.recursoElegido();
    if (resourceId === null) {
      return;
    }

    const desde = new Date();
    const hasta = new Date(desde.getTime() + DIAS_DE_BUSQUEDA * 24 * 60 * 60 * 1000);

    this.horarios.set(loading());
    this.scheduling
      .listSlots({
        resourceId,
        from: desde,
        to: hasta,
        onlyAvailable: true,
        limit: TOPE_DE_HORARIOS,
      })
      .subscribe({
        next: (pagina) => {
          const libres = pagina.items.filter((cupo) => cupo.remainingCapacity > 0);
          if (libres.length === 0) {
            this.horarios.set(
              empty(
                { label: 'Probá con otra agenda' },
                'No hay horarios libres en las próximas dos semanas.',
              ),
            );
            return;
          }
          this.horarios.set(ready(libres.map((cupo) => this.aHorarioVisible(cupo))));
        },
        error: (error: unknown) =>
          this.horarios.set(errorToViewState<readonly HorarioVisible[]>(error)),
      });
  }

  /* ---- cancelar ----------------------------------------------------------- */

  /**
   * Si el turno admite cancelarse, por su código de estado.
   *
   * Allowlist sobre el sufijo del código (ver {@link CODIGOS_CANCELABLES}): un
   * estado fuera de la lista —cancelado, atendido, completado o desconocido— no
   * ofrece el botón. Mientras el código no se resolvió (`''`) tampoco: nunca se
   * ofrece cancelar sobre un estado que no se conoce.
   */
  protected esCancelable(turno: TurnoVisible): boolean {
    return turno.codigo !== '' && CODIGOS_CANCELABLES.has(sufijoDeCodigo(turno.codigo));
  }

  /**
   * Cancela el turno propio, con confirmación previa.
   *
   * Es una acción destructiva, así que pide confirmación nombrando el turno. El
   * tono es calmo, no de alarma: cancelar un turno propio es corriente, no una
   * baja de la que haya que disuadir.
   */
  protected async cancelarTurno(turno: TurnoVisible): Promise<void> {
    if (this.operando() !== null) {
      return;
    }

    const confirmado = await this.dialogs.confirm({
      title: 'Cancelar el turno',
      message: `Vas a cancelar ${this.nombreDelTurno(turno)}. El horario queda libre para otra persona.`,
      confirmLabel: 'Cancelar el turno',
      cancelLabel: 'Volver',
    });
    if (!confirmado) {
      return;
    }

    this.operando.set(turno.id);
    this.scheduling.cancelBooking(turno.id, { cancelledBy: 'PATIENT' }).subscribe({
      next: () => {
        this.operando.set(null);
        this.toast.success('Cancelamos tu turno y liberamos el horario.', 'Turno cancelado');
        // El servidor es la verdad: se relee en vez de tachar la fila y devolver
        // el cupo a mano. El turno reaparece como cancelado (por `includeCancelled`)
        // y el horario vuelve a ofrecerse.
        this.recargar();
      },
      error: (error: unknown) => {
        this.operando.set(null);
        this.avisarFalloCancelacion(error);
      },
    });
  }

  /** Cómo nombrar el turno en la confirmación: por su fecha, o genérico. */
  private nombreDelTurno(turno: TurnoVisible): string {
    if (turno.cuando === null) {
      return 'este turno';
    }
    const cuando = this.fecha.transform(turno.cuando, "EEEE d 'de' MMM 'a las' HH:mm");
    return cuando === null ? 'este turno' : `el turno del ${cuando}`;
  }

  /**
   * Traduce el fallo de cancelar a un aviso, sin pintar de rojo lo que no es un
   * error del titular.
   *
   * - **409 `CONFLICT`** (ya estaba cancelado, p. ej. desde la agenda del médico)
   *   y **422 / precondición** (la transición ya no está disponible) son estados
   *   esperados: aviso neutro y se relee, porque el mundo cambió mientras la
   *   pantalla estaba abierta y la lista tiene que ponerse al día.
   * - Cualquier otro fallo sigue el patrón del repo y **no** destruye la lista:
   *   la que se leyó sigue siendo cierta aunque un botón haya fallado.
   */
  private avisarFalloCancelacion(error: unknown): void {
    const estado = errorToViewState<null>(error);
    const codigos =
      estado.status === 'validation' ? estado.issues.map((issue) => issue.code) : [];

    if (codigos.includes('CONFLICT')) {
      this.toast.info('Este turno ya estaba cancelado. Actualizamos tu lista.', 'Turno');
      this.recargar();
      return;
    }
    if (estado.status === 'validation') {
      this.toast.info('Este turno ya no se puede cancelar. Actualizamos tu lista.', 'Turno');
      this.recargar();
      return;
    }

    const detalle =
      estado.status === 'forbidden' || estado.status === 'error' ? (estado.message ?? '') : '';
    this.toast.error(
      detalle === '' ? 'No pudimos cancelar el turno. Reintentá en un momento.' : detalle,
      'Turno',
    );
  }

  /** Relee lo que la cancelación cambió: los turnos y los horarios ofrecidos. */
  private recargar(): void {
    this.cargarTurnos();
    this.cargarHorarios();
  }

  /**
   * Pide las etiquetas de los estados que aparecieron.
   *
   * Se traducen los que hay, no un catálogo entero: la lista de estados posibles
   * es del backend, y adivinarla acá sería inventar el catálogo.
   */
  private traducirEstados(citas: readonly Booking[]): void {
    const ids = [...new Set(citas.map((cita) => cita.statusConceptId))];
    if (ids.length === 0) {
      return;
    }

    this.terminology
      .readConceptLabels(ids)
      // Si el catálogo no responde, los turnos igual se muestran: el estado
      // cae a su texto neutro. Perder la etiqueta no justifica perder la lista.
      .pipe(catchError(() => of(new Map<string, ValueSetOption>())))
      .subscribe((etiquetas) => {
        this.etiquetas.set(new Map([...this.etiquetas(), ...etiquetas]));
        // La lista ya está pintada con el texto neutro: hay que rehacerla para
        // que tome las etiquetas que acaban de llegar.
        this.reetiquetarTurnos();
      });
  }

  /**
   * Rehace la lista ya pintada con lo que se sepa ahora.
   *
   * La pantalla arranca tres lecturas que terminan en cualquier orden —los
   * turnos, las agendas y el catálogo de estados— y las dos últimas aportan
   * texto a la primera. En vez de esperar a todas para pintar algo, se pinta lo
   * que hay y se rehace cuando llega el resto.
   */
  private reetiquetarTurnos(): void {
    const estado = this.turnos();
    if (estado.status === 'ready') {
      this.turnos.set(ready(estado.data.map((turno) => this.conEtiqueta(turno))));
    }
  }

  /* ---- destinos ----------------------------------------------------------- */

  protected rutaDeReserva(horario: HorarioVisible): string {
    return reservaDelPortalRoute(horario.id);
  }

  /**
   * La franja viaja con el enlace: la pantalla de reserva no puede leer un cupo
   * por id —no existe ese GET— y con esto lo reencuentra y revalida.
   */
  protected paramsDeReserva(horario: HorarioVisible): Record<string, string> {
    return {
      recurso: horario.resourceId,
      desde: horario.desde.toISOString(),
      hasta: horario.hasta.toISOString(),
    };
  }

  /* ---- mapeos ------------------------------------------------------------- */

  private aTurnoVisible(cita: Booking): TurnoVisible {
    const estado = this.presentacionDelEstado(cita.statusConceptId);
    const resourceId = cita.resourceId ?? '';
    return {
      id: cita.id,
      cuando: cita.startAt ?? null,
      hasta: cita.endAt ?? null,
      statusConceptId: cita.statusConceptId,
      codigo: this.codigoDelEstado(cita.statusConceptId),
      estado: estado.label,
      tono: estado.tone,
      resourceId,
      agenda: this.nombreDeLaAgenda(resourceId),
      motivo: cita.reasonText ?? '',
    };
  }

  /** Reetiqueta un turno con lo que el catálogo haya traído desde entonces. */
  private conEtiqueta(turno: TurnoVisible): TurnoVisible {
    const estado = this.presentacionDelEstado(turno.statusConceptId);
    return {
      ...turno,
      codigo: this.codigoDelEstado(turno.statusConceptId),
      estado: estado.label,
      tono: estado.tone,
      agenda: this.nombreDeLaAgenda(turno.resourceId),
    };
  }

  /** El código del estado, o `''` si el catálogo todavía no lo resolvió. */
  private codigoDelEstado(conceptId: string): string {
    return this.etiquetas().get(conceptId)?.code ?? '';
  }

  /**
   * Con quién es el turno.
   *
   * Sale de las agendas que la pantalla ya cargó para el selector, así que no
   * cuesta una petición más. Devuelve vacío mientras no se sepa —las dos
   * lecturas del arranque corren en paralelo y los turnos pueden llegar
   * primero—, y la plantilla omite la línea en vez de mostrar un hueco o, peor,
   * el identificador del recurso.
   */
  private nombreDeLaAgenda(resourceId: string): string {
    if (resourceId === '') {
      return '';
    }
    return this.recursos().find((recurso) => recurso.id === resourceId)?.name ?? '';
  }

  /**
   * Cómo se muestra el estado: la palabra y el tono.
   *
   * El catálogo resuelve el uuid a un **código**, y el código decide las dos
   * cosas. Ni el uuid ni el `display` en inglés del catálogo llegan a la
   * pantalla: el primero no le dice nada a nadie —es justo lo que la regla del
   * M34 pide evitar— y el segundo es una etiqueta de API en otro idioma.
   */
  private presentacionDelEstado(conceptId: string) {
    return toBookingStatusPresentation(this.etiquetas().get(conceptId));
  }

  private aHorarioVisible(cupo: AgendaSlot): HorarioVisible {
    return {
      id: cupo.id,
      desde: cupo.startAt,
      hasta: cupo.endAt,
      resourceId: cupo.resourceId,
      lugaresLibres: cupo.remainingCapacity,
    };
  }
}

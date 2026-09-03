import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { formatDate } from '@angular/common';
import { calcularTurnos } from '../agenda-create/agenda-turnos';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type {
  AgendaResource,
  AgendaSlot,
  ActivityTypeOption,
  AvailabilityExceptionTypeOption,
  Booking,
  PublishedTemplate,
} from '../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import type { BloqueDelDia } from './day-view/day-view';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import type { DialogDetail } from '../../../shared/components/molecules/dialog/dialog.types';
import { patientChartRoute } from '../../clinical-record/clinical-record.routes';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { primerDiaDelMes, sumarMeses } from '../../../shared/date/calendario-mes';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import { BlockForm, aMedianoche, conHora, type BloqueoPedido } from './block-form/block-form';
import {
  DayView,
  type EstadoResuelto,
  type PedidoDeAccion,
  type RatoTocado,
} from './day-view/day-view';
import { TarjetaDelDia, type RatoDelDia } from './tarjeta-del-dia/tarjeta-del-dia';
import { MonthView, type BloqueoDelMes } from './month-view/month-view';
import { WeekView, lunesDe } from './week-view/week-view';
import { ScheduleGrid } from './schedule-grid/schedule-grid';
import { AGENDA_CREATE_ROUTE } from '../agenda.routes';

/** Los días de la semana en el orden en que se leen; el índice es `dayOfWeek`. */
const NOMBRE_DEL_DIA = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

/** El orden visual: el domingo va último aunque su número sea el más chico. */
const ORDEN_VISUAL = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * A partir de cuántos días de cupos por delante deja de avisarse.
 *
 * Menos que esto y la agenda se está por vaciar: hay que generar el período
 * siguiente. Es el parche manual del horizonte rodante (§6.3) mientras no
 * exista el worker que lo haga solo.
 */
const DIAS_DE_MARGEN = 30;

/**
 * Lo más lejos que se puede mirar de una sola vez.
 *
 * `GET /scheduling/slots` rechaza con 422 cualquier ventana mayor —«La ventana
 * no puede superar 92 días»—, así que pedir un año devuelve un error en vez de
 * una respuesta larga. Alcanza y sobra: el alta materializa tres meses, que
 * entran justo, y lo único que hace falta saber es si quedan menos de treinta
 * días por delante.
 */
const VENTANA_MAXIMA_DIAS = 92;

/**
 * El vacío de esta pantalla, con su salida.
 *
 * El M34 lo llama «Empty **with next action**»: un vacío sin salida es un
 * callejón. Acá la salida es la única que tiene sentido — publicar el horario.
 */
const SIN_AGENDA = empty(
  { label: 'Publicar mi agenda', route: AGENDA_CREATE_ROUTE },
  'Todavía no publicaste tu horario. Cuando lo hagas, vas a verlo acá y los pacientes van a poder pedirte turno.',
);

/** Un día de la semanita, ya resuelto para pintar. */
interface DiaDelPatron {
  readonly numero: number;
  readonly corto: string;
  readonly largo: string;
  readonly activo: boolean;
}

/** Una franja dicha en palabras. */
interface FranjaVisible {
  readonly texto: string;
}

/** Lo que la tarjeta necesita saber del horario publicado. */
interface Patron {
  readonly semana: readonly DiaDelPatron[];
  readonly franjas: readonly FranjaVisible[];
  readonly vigencia: string | null;
  /**
   * Si el horario no tiene fecha de fin.
   *
   * El propietario lo pidió como etiqueta y con esas palabras —`HORARIO
   * PERMANENTE`, punto 5—: es un estado del horario, y tiene que leerse de un
   * vistazo junto al resto, no escondido en una frase.
   */
  readonly permanente: boolean;
}

/**
 * **Mi agenda** — «¿qué horario tengo?».
 *
 * ## Por qué es una tarjeta y no un calendario
 *
 * Lo que el médico publica es un **patrón semanal**: «los martes de nueve a
 * una». Pintarlo como un calendario obligaría a elegir una semana concreta y a
 * repetir la misma información cuatro veces, cuando el dato cabe en dos
 * renglones. El calendario tiene sentido para la **ocupación** —cuántos turnos
 * tomados tiene cada día—, y ésa es la solapa del mes (MAC-5).
 *
 * ## Por qué recién ahora existe
 *
 * Porque hasta MAC-4 no había `GET` de plantillas: `scheduling` sólo exponía
 * los dos POST, así que publicar un horario era escribirlo y no poder volver a
 * leerlo. Es literalmente la primera vez que un médico ve su propio horario
 * después de publicarlo.
 */
/** Lo que se muestra cuando un dato no está. */
const SIN_DATO = 'Sin registrar';

@Component({
  selector: 'app-my-agenda',
  imports: [
    Alert,
    Badge,
    AppButton,
    AppButtonLink,
    Tooltip,
    BlockForm,
    DayView,
    TarjetaDelDia,
    MonthView,
    WeekView,
    ScheduleGrid,
    PageHeader,
    RouterLink,
    ViewStateHost,
  ],
  templateUrl: './my-agenda.html',
  styleUrl: './my-agenda.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyAgenda {
  private readonly scheduling = inject(SchedulingClient);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);
  /** El idioma activo, para formatear fechas fuera de la plantilla. */
  private readonly idioma = inject(LOCALE_ID);
  private readonly terminology = inject(TerminologyClient);
  private readonly toast = inject(ToastService);

  protected readonly rutaDePublicar = AGENDA_CREATE_ROUTE;

  /** El recurso del profesional; sin él no hay agenda que mostrar. */
  protected readonly recurso = signal<AgendaResource | null>(null);

  protected readonly estado = signal<ViewState<PublishedTemplate>>(loading());

  /** Hasta cuándo llegan los cupos ya materializados. */
  /**
   * Los horarios ya retirados (TAREA-10, punto 2).
   *
   * No es decoración: un médico que cambió su horario tres veces necesita ver
   * cuáles rigieron antes, sobre todo si todavía hay pacientes citados en ellos.
   */
  protected readonly historicos = signal<readonly PublishedTemplate[]>([]);

  /** El horario que se está retirando, para el `[isLoading]` del botón. */
  protected readonly retirando = signal(false);

  protected readonly cuposHasta = signal<Date | null>(null);
  protected readonly generando = signal(false);

  /* -- La solapa del mes ---------------------------------------------------- */

  /** Qué se está mirando: el patrón o la ocupación. */
  protected readonly solapa = signal<'patron' | 'mes'>('patron');

  /** El mes visible; siempre su día 1. */
  protected readonly mesVisible = signal(primerDiaDelMes(new Date()));

  /**
   * Si se mira el mes o la semana — «un botón para ver la semana y otro para
   * ver el mes» del pedido original.
   *
   * Son dos preguntas distintas: el mes responde «¿cuándo tengo hueco?», la
   * semana responde «¿cómo viene esto?». Por eso conviven en vez de que una
   * reemplace a la otra.
   */
  protected readonly vista = signal<'mes' | 'semana'>('mes');

  /** Cualquier día de la semana mirada; el lunes lo calcula la vista. */
  protected readonly semanaVisible = signal(lunesDe(new Date()));

  protected verMes(): void {
    this.vista.set('mes');
  }

  protected verSemana(): void {
    this.vista.set('semana');
    // Se abre en la semana del mes que se está mirando, no en la de hoy: venir
    // de octubre y aterrizar en septiembre se lee como un error.
    const mes = this.mesVisible();
    const hoy = new Date();
    this.semanaVisible.set(
      mes.getMonth() === hoy.getMonth() && mes.getFullYear() === hoy.getFullYear()
        ? lunesDe(hoy)
        : lunesDe(mes),
    );
  }

  /**
   * Cambia de semana, y **recarga el mes si hace falta**.
   *
   * Los cupos y los bloqueos que la vista usa son los del mes cargado. Sin
   * esto, la semana que cruza de mes se vería medio vacía — y esa mitad vacía
   * no sería una agenda libre, sería un dato que no se pidió.
   */
  protected cambiarSemana(nueva: Date): void {
    this.semanaVisible.set(nueva);
    const mes = this.mesVisible();
    const finDeSemana = new Date(nueva.getFullYear(), nueva.getMonth(), nueva.getDate() + 6);
    const cruza =
      nueva.getMonth() !== mes.getMonth() ||
      nueva.getFullYear() !== mes.getFullYear() ||
      finDeSemana.getMonth() !== mes.getMonth();
    if (cruza) {
      this.mesVisible.set(primerDiaDelMes(nueva));
      this.cargarMes();
    }
  }

  protected readonly cuposDelMes = signal<readonly AgendaSlot[]>([]);
  protected readonly bloqueosDelMes = signal<readonly BloqueoDelMes[]>([]);

  /**
   * Las tipologías de actividad, para pintar el día.
   *
   * Se piden una vez al cargar la pantalla. Si la lectura falla, la lista queda
   * vacía y el día se ve como antes: un catálogo que no cargó no puede dejar la
   * agenda en blanco.
   */
  protected readonly tipologias = signal<readonly ActivityTypeOption[]>([]);
  protected readonly cargandoMes = signal(false);

  /** Si el panel de bloqueo está abierto (D4/D5 del plan de UX). */
  protected readonly bloqueoAbierto = signal(false);

  /**
   * El catálogo de motivos, cargado la primera vez que se abre el panel.
   *
   * No se pide al entrar a la pantalla porque la mayoría de las visitas es
   * para mirar el mes, no para bloquear. Y no se recarga después: es un
   * catálogo, no datos que cambien mientras uno decide sus vacaciones.
   */
  protected readonly motivosDeBloqueo = signal<readonly AvailabilityExceptionTypeOption[]>([]);

  /** Un bloqueo en curso: evita el doble envío de un rango largo. */
  protected readonly bloqueando = signal(false);

  /* -- La vista del día ------------------------------------------------------ */

  /** El día abierto, o `null` si se está mirando el mes. */
  protected readonly diaAbierto = signal<Date | null>(null);
  protected readonly cuposDelDia = signal<readonly AgendaSlot[]>([]);
  protected readonly citasDelDia = signal<readonly Booking[]>([]);

  /**
   * Los estados del catálogo, ya resueltos.
   *
   * `statusConceptId` es un uuid: traducirlo con un `switch` en la pantalla
   * sería inventar el catálogo, que es del backend. Se piden **los que
   * aparecieron**, no la tabla entera.
   */
  protected readonly estadosResueltos = signal<ReadonlyMap<string, EstadoResuelto>>(new Map());

  /**
   * Si la sesión puede registrar la llegada de un paciente.
   *
   * `POST /scheduling/bookings/:id/check-in` declara
   * `@Roles('SCHEDULING_ADMIN', 'SCHEDULING_AGENT')` — **no** `PRACTITIONER`.
   * Un médico solo, sin mostrador, hoy no puede marcarla; se le esconde el
   * botón en vez de ofrecerle uno que devuelve «Rol insuficiente».
   */
  protected readonly puedeRegistrarLlegada = computed(() => {
    const roles = this.auth.roles();
    return roles.includes('SCHEDULING_ADMIN') || roles.includes('SCHEDULING_AGENT');
  });

  /**
   * El horario, dicho en palabras.
   *
   * De todas las plantillas se toma la primera —el servidor las devuelve de la
   * más reciente a la más vieja—, que es la que gobierna hoy.
   */
  protected readonly patron = computed<Patron | null>(() => {
    const actual = this.estado();
    if (actual.status !== 'ready') return null;

    const plantilla = actual.data;
    const activos = new Set(plantilla.rules.map((regla) => regla.dayOfWeek));

    const semana = ORDEN_VISUAL.map((numero) => ({
      numero,
      corto: NOMBRE_DEL_DIA[numero].slice(0, 1),
      largo: NOMBRE_DEL_DIA[numero],
      activo: activos.has(numero),
    }));

    // Se agrupan las franjas idénticas: «lunes y jueves de 9:00 a 13:00» en vez
    // de dos renglones que dicen lo mismo.
    const porHorario = new Map<string, number[]>();
    for (const regla of plantilla.rules) {
      const clave = `${regla.startTime}|${regla.endTime}|${regla.slotMinutes ?? plantilla.slotMinutes ?? ''}`;
      porHorario.set(clave, [...(porHorario.get(clave) ?? []), regla.dayOfWeek]);
    }

    const franjas = [...porHorario.entries()].map(([clave, dias]) => {
      const [desde, hasta, minutos] = clave.split('|');
      const nombres = ORDEN_VISUAL.filter((n) => dias.includes(n)).map((n) => NOMBRE_DEL_DIA[n]);
      const cuando =
        nombres.length === 1
          ? nombres[0]
          : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
      const duracion = minutos === '' ? '' : ` · consultas de ${minutos} min`;
      return { texto: `${cuando} de ${sinSegundos(desde)} a ${sinSegundos(hasta)}${duracion}` };
    });

    return {
      semana,
      franjas,
      vigencia:
        plantilla.validTo === undefined
          ? null
          : `Hasta el ${new Date(plantilla.validTo).toLocaleDateString('es')}`,
      // El propietario lo pidió con esas palabras y en mayúsculas (punto 5).
      // Es una etiqueta y no prosa: un horario sin fecha de fin es un estado
      // del horario, y tiene que leerse de un vistazo junto al resto.
      permanente: plantilla.validTo === undefined,
    };
  });

  /**
   * Los cupos publicados se están por agotar.
   *
   * Nadie regenera cupos todavía (§13.3), así que una agenda se vacía en
   * silencio: la plantilla sigue ahí, pero no hay huecos que ofrecer. Este
   * aviso es el parche manual hasta que exista el worker del horizonte rodante.
   */
  protected readonly seAgotan = computed(() => {
    const hasta = this.cuposHasta();
    if (hasta === null) return false;
    const margen = new Date();
    margen.setDate(margen.getDate() + DIAS_DE_MARGEN);
    return hasta.getTime() < margen.getTime();
  });

  protected readonly cuposHastaTexto = computed(() => {
    const hasta = this.cuposHasta();
    return hasta === null ? '' : hasta.toLocaleDateString('es');
  });

  constructor() {
    this.cargar();
  }

  private cargarTipologias(): void {
    this.scheduling.listActivityTypes().subscribe({
      next: (catalogo) => this.tipologias.set(catalogo.items),
      error: () => this.tipologias.set([]),
    });
  }

  protected cargar(): void {
    const perfil = this.auth.practitionerProfileId();
    const tenantId = this.auth.activeTenantId();
    if (perfil === null || tenantId === null) {
      this.estado.set(SIN_AGENDA);
      return;
    }

    // Después de la guarda, no antes: una sesión sin perfil profesional no va a
    // ver ningún día, así que pedirle el catálogo al servidor es una consulta
    // para nada. Lo fija una prueba que dice, con esas palabras, que esa cuenta
    // «no pide nada al servidor».
    this.cargarTipologias();

    this.estado.set(loading());
    // El recurso se busca por el perfil: es el mismo criterio con el que el
    // backend decide si la agenda es suya (`assertRecursoDelActor`).
    this.scheduling.listResources({ tenantId }).subscribe({
      next: (pagina) => {
        const propio = pagina.items.find((r) => r.resourceRefId === perfil) ?? null;
        this.recurso.set(propio);
        if (propio === null) {
          this.estado.set(SIN_AGENDA);
          return;
        }
        this.leerPlantilla(propio.id);
      },
      error: (error: unknown) => this.estado.set(errorToViewState<PublishedTemplate>(error)),
    });
  }

  private leerPlantilla(resourceId: string): void {
    this.scheduling.listTemplates(resourceId).subscribe({
      next: (pagina) => {
        // El listado trae TODAS las plantillas del recurso, retiradas
        // incluidas, ordenadas por creación. Tomar `items[0]` a secas mostraba
        // un horario retirado como si fuera el vigente —basta con que sea el
        // más reciente— y el médico que acababa de retirarlo veía que seguía
        // atendiendo.
        const vigente = pagina.items.find((plantilla) => !plantilla.retired);
        this.historicos.set(pagina.items.filter((p) => p.retired));

        // Sin plantillas no es un fallo: el recurso existe y todavía no publicó
        // horario. Es el estado de quien creó la agenda y no la completó.
        if (vigente === undefined) {
          this.estado.set(SIN_AGENDA);
          return;
        }
        this.estado.set(ready(vigente));
        // Los cupos se leen sólo si hay horario: sin plantilla no puede haber
        // ninguno, y preguntarlo sería un viaje para confirmar un cero.
        this.leerHastaCuandoHayCupos(resourceId);
      },
      error: (error: unknown) => this.estado.set(errorToViewState<PublishedTemplate>(error)),
    });
  }

  private leerHastaCuandoHayCupos(resourceId: string): void {
    const desde = new Date();
    const hasta = new Date();
    hasta.setDate(hasta.getDate() + VENTANA_MAXIMA_DIAS);

    this.scheduling
      .listSlots({ resourceId, from: desde, to: hasta, onlyAvailable: true, limit: 500 })
      .subscribe({
        next: (pagina) => {
          const ultimo = pagina.items[pagina.items.length - 1];
          this.cuposHasta.set(ultimo === undefined ? null : new Date(ultimo.startAt));
        },
        // Saber hasta cuándo llegan los cupos es un extra: si falla, la tarjeta
        // sigue sirviendo y simplemente no avisa. Ojo con esta indulgencia: se
        // tragó en silencio el 422 de la ventana de un año hasta que se miró la
        // pestaña de red — por eso el tope vive en una constante con su porqué.
        error: () => this.cuposHasta.set(null),
      });
  }

  /**
   * Genera el período siguiente de cupos.
   *
   * Es el botón del aviso: extiende tres meses más desde donde terminan los
   * actuales. Sustituye al worker que todavía no existe.
   */
  /**
   * Bloquea un rango de días, o una franja de cada uno de esos días.
   *
   * D4 del plan de UX del 22/08/2026: bloquear dos semanas de vacaciones eran
   * catorce viajes de mes → día → confirmar, y una tarde suelta no se podía
   * bloquear en absoluto.
   *
   * ## Por qué una excepción por día cuando es una franja
   *
   * Porque `POST /exceptions` bloquea **el intervalo continuo** entre sus dos
   * instantes. «Las tardes del 10 al 24» mandado de una sola vez sería «del 10
   * a las 14:00 al 24 a las 18:00», que además de las tardes se lleva puestas
   * las noches y las mañanas del medio. Los días enteros sí son un intervalo
   * continuo y van en una sola llamada.
   *
   * Las llamadas van **en paralelo y se espera a todas**: si una falla, el
   * profesional tiene que enterarse de que su bloqueo quedó a medias en vez de
   * ver un mes que parece correcto.
   */
  /**
   * Abre el panel y, la primera vez, trae los motivos.
   *
   * **Si el catálogo falla, el panel se abre igual.** Un bloqueo con el motivo
   * por defecto sigue siendo el comportamiento que la pantalla tuvo siempre;
   * negarle a alguien bloquear su agenda porque no cargó una lista de siete
   * etiquetas sería cambiar un defecto de datos por uno de disponibilidad.
   */
  protected abrirBloqueo(): void {
    this.bloqueoAbierto.set(true);
    if (this.motivosDeBloqueo().length > 0) {
      return;
    }
    this.scheduling.listExceptionTypes().subscribe({
      next: (catalogo) => this.motivosDeBloqueo.set(catalogo.items),
      error: () => this.motivosDeBloqueo.set([]),
    });
  }

  protected bloquearRango(pedido: BloqueoPedido): void {
    const recurso = this.recurso();
    if (recurso === null || this.bloqueando()) {
      return;
    }

    const intervalos = pedido.franjaHoraria
      ? franjasPorDia(pedido)
      : [{ startAt: pedido.desde, endAt: pedido.hasta }];

    this.bloqueando.set(true);
    forkJoin(
      intervalos.map((intervalo) =>
        this.scheduling.createException(recurso.id, {
          exceptionType: pedido.exceptionType,
          startAt: intervalo.startAt.toISOString(),
          endAt: intervalo.endAt.toISOString(),
          reason: pedido.motivo,
        }),
      ),
    ).subscribe({
      next: (resultados) => {
        this.bloqueando.set(false);
        this.bloqueoAbierto.set(false);
        const cerrados = resultados.reduce((suma, r) => suma + r.blockedSlots, 0);
        this.toast.success(
          cerrados === 0
            ? 'No había turnos libres que cerrar en ese período.'
            : `Se cerraron ${cerrados} ${cerrados === 1 ? 'turno libre' : 'turnos libres'}.`,
          `Bloqueaste ${pedido.dias} ${pedido.dias === 1 ? 'día' : 'días'}`,
        );
        this.cargarMes();
      },
      error: (error: unknown) => {
        this.bloqueando.set(false);
        this.avisarFallo(error, 'bloquear ese período');
        // Se recarga igual: si alguna de las llamadas entró antes del fallo, el
        // mes tiene que mostrarlo. Un bloqueo a medias que no se ve es peor que
        // uno que se ve y se corrige.
        this.cargarMes();
      },
    });
  }

  /**
   * Bloquea un día desde el calendario.
   *
   * Es la fase 5 del alta vieja en su casa natural: bloquear un día se decide
   * mirando el mes, no rellenando un formulario para poder terminar de
   * publicar. El motivo es obligatorio porque es lo único que después
   * distingue el día bloqueado del día en que sencillamente no atiende.
   *
   * El bloqueo va de medianoche a medianoche: la API cierra los cupos libres
   * que se solapan y **no toca las citas ya reservadas** —eso lo decide el
   * profesional una por una, no un bloqueo masivo—.
   */
  protected async bloquearDia(fecha: Date): Promise<void> {
    const recurso = this.recurso();
    if (recurso === null) return;

    const cuando = fecha.toLocaleDateString('es-BO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    const motivo = await this.dialogs.confirmWithReason(
      {
        title: `Bloquear el ${cuando}`,
        message:
          'Los turnos libres de ese día dejan de ofrecerse. Las citas ya reservadas no se tocan: ' +
          'si querés cancelarlas, hacelo una por una.',
        confirmLabel: 'Bloquear el día',
      },
      {
        label: '¿Por qué?',
        placeholder: 'Congreso, vacaciones, trámite…',
        hint: 'Lo ves sólo vos, para acordarte cuando mires el mes.',
        minLength: 3,
        maxLength: 200,
      },
    );
    if (motivo === null) return;

    const desde = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + 1);

    this.scheduling
      .createException(recurso.id, {
        // Este atajo pide **texto libre** y nada más, así que su motivo es
        // literalmente «Otro»: mandarlo como `ABSENCE` etiquetaría de
        // «Ausencia» algo que la persona escribió a mano, y el paciente vería
        // una etiqueta que nadie eligió.
        exceptionType: 'OTHER',
        startAt: desde.toISOString(),
        endAt: hasta.toISOString(),
        reason: motivo,
      })
      .subscribe({
        // Se recarga el mes entero y no se agrega el bloqueo a mano: la API
        // además cerró cupos, así que la ocupación cambió y no sólo la lista.
        next: () => this.cargarMes(),
        error: (error: unknown) => this.estado.set(errorToViewState<PublishedTemplate>(error)),
      });
  }

  /* -- El mes ---------------------------------------------------------------- */

  /** Cambia de solapa; la del mes carga sus datos la primera vez. */
  protected verSolapa(cual: 'patron' | 'mes'): void {
    this.solapa.set(cual);
    if (cual === 'mes' && this.cuposDelMes().length === 0) {
      this.cargarMes();
    }
  }

  protected cambiarMes(nuevo: Date): void {
    this.mesVisible.set(nuevo);
    this.cargarMes();
  }

  /**
   * Los cupos y los bloqueos del mes visible, en dos llamadas.
   *
   * Una por mes y no una por día: agrupar en el cliente es barato y pedir
   * treinta veces lo mismo no lo es. La ventana de un mes entra holgada en el
   * tope de 92 días de la API.
   */
  private cargarMes(): void {
    const recurso = this.recurso();
    if (recurso === null) return;

    const desde = this.mesVisible();
    const hasta = sumarMeses(desde, 1);
    this.cargandoMes.set(true);

    this.scheduling
      .listSlots({ resourceId: recurso.id, from: desde, to: hasta, limit: 500 })
      .subscribe({
        next: (pagina) => {
          this.cuposDelMes.set(pagina.items);
          this.cargandoMes.set(false);
        },
        error: () => {
          this.cuposDelMes.set([]);
          this.cargandoMes.set(false);
        },
      });

    this.scheduling.listExceptions(recurso.id, { from: desde, to: hasta }).subscribe({
      next: (pagina) =>
        this.bloqueosDelMes.set(
          pagina.items
            // Las excepciones que ABREN disponibilidad no son bloqueos: pintarlas
            // grises diría lo contrario de lo que pasa.
            .filter((e) => e.isAvailable !== true)
            .map((e) => ({
              desde: new Date(e.startAt),
              hasta: new Date(e.endAt),
              motivo: e.reason ?? null,
            })),
        ),
      // Sin los bloqueos el mes sigue sirviendo: muestra la ocupación y los
      // bloqueados se ven como sin agenda. Peor sería no mostrar nada.
      error: () => this.bloqueosDelMes.set([]),
    });
  }

  /**
   * Abre el día que se tocó en el mes.
   *
   * El mes emite el día; qué hacer con él lo decide esta pantalla, que es la
   * que sabe si existe una vista de día a la que ir.
   */
  protected abrirDia(fecha: Date): void {
    this.diaAbierto.set(fecha);
    this.cargarDia(fecha);
  }

  /** El rato tocado para crear algo, o `null` con la tarjeta cerrada. */
  protected readonly ratoParaCrear = signal<RatoTocado | null>(null);

  /**
   * Lo que el día ya tiene tomado, para que la tarjeta avise el choque ANTES
   * de guardar — con lo que la pantalla ya sabe, sin viaje extra. El servidor
   * cruza además las otras sedes al guardar: esto es aviso temprano, no regla.
   */
  protected readonly ratosTomadosDelDia = computed<readonly RatoDelDia[]>(() => {
    const porSlot = new Map(this.citasDelDia().map((c) => [c.bookableSlotId, c]));
    const deCitas = this.cuposDelDia()
      .filter((cupo) => porSlot.has(cupo.id))
      .map((cupo) => ({
        desde: cupo.startAt,
        hasta: cupo.endAt ?? cupo.startAt,
        rotulo: `la cita de ${porSlot.get(cupo.id)?.patientName ?? 'un paciente'}`,
      }));
    const deOcupados = this.bloqueosDelMes().map((b) => ({
      desde: b.desde,
      hasta: b.hasta,
      rotulo: b.motivo === null ? 'un rato ocupado' : `«${b.motivo}»`,
    }));
    return [...deCitas, ...deOcupados];
  });

  /** Abre la tarjeta con el rato tocado ya puesto. */
  protected abrirTarjeta(rato: RatoTocado): void {
    this.ratoParaCrear.set(rato);
  }

  /** La tarjeta creó algo: se cierra y el día se relee del servidor. */
  protected tarjetaCreo(dia: Date): void {
    this.ratoParaCrear.set(null);
    this.cargarDia(dia);
    // El mes también: una cita nueva cambia la ocupación que el mes pinta.
    this.cargarMes();
  }

  /**
   * Quita un tiempo ocupado desde el día.
   *
   * Sin confirmación previa: quitar una reunión propia no cierra ni sella
   * nada, y el que borra por error la vuelve a crear en dos toques. Los cupos
   * que la excepción retiró NO resucitan — la semántica declarada del DELETE.
   */
  protected quitarOcupado(exceptionId: string): void {
    const dia = this.diaAbierto();
    this.scheduling.deleteException(exceptionId).subscribe({
      next: () => {
        this.toast.success(
          'Los horarios que retiró no vuelven solos: se regeneran con tu plantilla.',
          'Rato ocupado quitado',
        );
        if (dia !== null) this.cargarDia(dia);
        this.cargarMes();
      },
      error: (error: unknown) => this.avisarFallo(error, 'quitar ese rato ocupado'),
    });
  }

  /**
   * Va al día siguiente o al anterior sin volver al mes.
   *
   * Si el día nuevo cae en otro mes, **se recarga el mes**: los cupos y los
   * bloqueos que la vista usa son los del mes cargado, y sin esto el 1 de
   * febrero se vería vacío viniendo del 31 de enero.
   */
  protected moverDia(desplazamiento: number): void {
    const actual = this.diaAbierto();
    if (actual === null) return;

    const nuevo = new Date(actual);
    nuevo.setDate(nuevo.getDate() + desplazamiento);
    this.diaAbierto.set(nuevo);

    if (nuevo.getMonth() !== actual.getMonth() || nuevo.getFullYear() !== actual.getFullYear()) {
      this.mesVisible.set(primerDiaDelMes(nuevo));
      this.cargarMes();
    }
    this.cargarDia(nuevo);
  }

  /**
   * El modal de detalle de una actividad — corazón del pedido del carril 12.
   *
   * «Cards al estilo de Google Calendar que son cliqueables que abren un modal
   * con todo el detalle de la actividad. Debe tener un botón que lleve a la
   * vista correspondiente además del botón de cerrar.»
   *
   * **El botón que lleva a la vista correspondiente cambia según qué sea.** Una
   * cita lleva al expediente de quien viene; un rato ocupado no lleva a ningún
   * lado, y entonces no se ofrece: un botón que no va a ninguna parte es peor
   * que ninguno.
   */
  protected async verDetalleDelBloque(bloque: BloqueDelDia): Promise<void> {
    const hora = (valor: Date): string => formatDate(valor, 'HH:mm', this.idioma);
    const detalles: DialogDetail[] = [
      { label: 'Cuándo', value: `${hora(bloque.desde)} – ${hora(bloque.hasta)}` },
      { label: 'Qué es', value: bloque.tipo === 'cita' ? 'Cita' : 'Tiempo ocupado' },
    ];

    if (bloque.tipo === 'cita') {
      detalles.push({ label: 'Estado', value: bloque.estado });
      detalles.push({ label: 'Paciente', value: bloque.paciente || SIN_DATO });
      if (bloque.cita?.reasonText !== undefined) {
        detalles.push({ label: 'Motivo', value: bloque.cita.reasonText });
      }
    } else if (bloque.motivo !== null) {
      detalles.push({ label: 'Motivo', value: bloque.motivo });
    }

    const perfil = bloque.cita?.patientProfileId;
    const puedeAbrirExpediente = bloque.tipo === 'cita' && perfil !== undefined;

    const ir = await this.dialogs.confirm({
      title: bloque.tipo === 'cita' ? 'Detalle de la cita' : 'Detalle del rato ocupado',
      message: formatDate(bloque.desde, "EEEE d 'de' MMMM", this.idioma),
      details: detalles,
      confirmLabel: puedeAbrirExpediente ? 'Abrir expediente' : 'Cerrar',
      cancelLabel: puedeAbrirExpediente ? 'Cerrar' : 'Volver',
    });

    if (ir && puedeAbrirExpediente && perfil !== undefined) {
      void this.router.navigate([patientChartRoute(perfil)]);
    }
  }

  /**
   * «Cómo se veía antes ese horario» — punto 3 del carril 10.
   *
   * El pedido pide un modal con **el mismo organismo que el oficial**. Se
   * resuelve con el mismo `calcularTurnos` que usa la pantalla de publicar: no
   * hay dos maneras de contar los turnos de una franja, y tener dos sería
   * garantizar que un día digan cosas distintas sobre el mismo horario.
   *
   * No hace falta pedir nada al servidor: la lectura de plantillas **ya trae
   * las reglas** de cada una, retiradas incluidas.
   */
  protected async verHorarioViejo(plantilla: PublishedTemplate): Promise<void> {
    const calculo = calcularTurnos(
      [...plantilla.rules]
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
        .map((regla) => ({
          dia: NOMBRE_DEL_DIA[regla.dayOfWeek] ?? `Día ${regla.dayOfWeek}`,
          desde: regla.startTime.slice(0, 5),
          hasta: regla.endTime.slice(0, 5),
          duracion: regla.slotMinutes ?? plantilla.slotMinutes ?? 30,
          receso: regla.gapMinutes ?? 0,
        })),
    );

    const detalles: DialogDetail[] = calculo.porDia.map((dia) => ({
      label: dia.dia.charAt(0).toUpperCase() + dia.dia.slice(1),
      value:
        dia.turnos.length === 0
          ? 'Sin turnos'
          : `${dia.turnos[0].desde} a ${dia.turnos[dia.turnos.length - 1].hasta} · ` +
            `${dia.turnos.length} ${dia.turnos.length === 1 ? 'turno' : 'turnos'}`,
    }));

    // La vigencia, que es lo que uno viene a mirar en un horario viejo.
    if (plantilla.validFrom !== undefined) {
      detalles.unshift({
        label: 'Rigió desde',
        value: formatDate(plantilla.validFrom, "d 'de' MMMM yyyy", this.idioma),
      });
    }
    if (plantilla.validTo !== undefined) {
      detalles.unshift({
        label: 'Hasta',
        value: formatDate(plantilla.validTo, "d 'de' MMMM yyyy", this.idioma),
      });
    }

    await this.dialogs.confirm({
      title: `Así era «${plantilla.name}»`,
      message:
        calculo.total === 0
          ? 'Este horario no llegó a tener turnos.'
          : `${calculo.total} ${calculo.total === 1 ? 'turno' : 'turnos'} por semana.`,
      details: detalles,
      confirmLabel: 'Cerrar',
      cancelLabel: 'Volver',
    });
  }

  /**
   * Vuelve a activar un horario pausado — «volví del viaje».
   *
   * **Avisa que faltan los cupos**, porque el servidor lo dice y porque sin eso
   * el horario queda vigente y sin ofrecer un solo turno: quien lo reactivó
   * vería su agenda «publicada» y vacía, sin ninguna pista de por qué.
   *
   * No genera los cupos por su cuenta: la ventana la elige el profesional, y
   * materializar los del mes pasado abriría turnos en fechas que ya pasaron.
   */
  protected reactivarHorario(plantilla: PublishedTemplate): void {
    if (this.operandoHorario() !== null) return;
    this.operandoHorario.set(plantilla.id);

    this.scheduling.reactivateTemplate(plantilla.id).subscribe({
      next: (res) => {
        this.operandoHorario.set(null);
        this.toast.success(
          res.slotsPendientes
            ? 'Volvé a publicarlo para abrir los turnos: reactivar no los repone.'
            : 'Ya estaba vigente.',
          `«${plantilla.name}» volvió a estar vigente`,
        );
        this.cargar();
      },
      error: (error: unknown) => {
        this.operandoHorario.set(null);
        this.avisarFallo(error, 'No se pudo reactivar el horario.');
      },
    });
  }

  /** A dónde lleva «Cambiar»: la ruta propia que la bitácora pide para editar. */
  /**
   * Las reglas del horario vigente, para la grilla por horas.
   *
   * Salen de la plantilla que ya se lee; no hay consulta nueva. Vacías cuando
   * todavía no publicó nada, que es lo que la grilla muestra como «todavía no
   * publicaste horarios».
   */
  protected readonly reglasVigentes = computed(() => {
    const e = this.estado();
    return e.status === 'ready' || e.status === 'stale' ? (e.data?.rules ?? []) : [];
  });

  protected readonly rutaEditarHorario = '/schedule/edit';

  /** Los bloqueos, que desde el carril 11 tienen su propio flujo. */
  protected readonly rutaBloqueos = '/schedule/blocks';

  /** El horario sobre el que hay una operación en vuelo. */
  protected readonly operandoHorario = signal<string | null>(null);

  /**
   * Corre la agenda del día N minutos — «mover horario» del carril 12.
   *
   * **La ventana es el día abierto**, no el mes: mover se decide mirando un día
   * y ensancharlo de más correría turnos que nadie miró. Si se pidió «de acá en
   * adelante», la ventana arranca en ese rato.
   *
   * No pide confirmación con un diálogo porque el panel **ya es** la
   * confirmación: dice qué va a pasar y hay que elegir cuántos minutos.
   */
  protected moverHorario(pedido: { minutos: number; desde: Date | null }): void {
    const recurso = this.recurso();
    const dia = this.diaAbierto();
    if (recurso === null || dia === null || this.operandoHorario() !== null) return;

    const desde = pedido.desde ?? new Date(dia.getFullYear(), dia.getMonth(), dia.getDate());
    const hasta = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() + 1);

    this.operandoHorario.set('mover');
    this.scheduling
      .shiftSlots(recurso.id, {
        shiftMinutes: pedido.minutos,
        from: desde.toISOString(),
        to: hasta.toISOString(),
      })
      .subscribe({
        next: (res) => {
          this.operandoHorario.set(null);
          this.toast.success(
            res.notified === 0
              ? 'No había pacientes a quienes avisar.'
              : `Se le avisó a ${res.notified} ${res.notified === 1 ? 'persona' : 'personas'}.`,
            `${res.movedSlots} ${res.movedSlots === 1 ? 'turno movido' : 'turnos movidos'}`,
          );
          this.cargarMes();
          this.cargarDia(dia);
        },
        error: (error: unknown) => {
          this.operandoHorario.set(null);
          // El 409 del servidor es el choque con otra cita, y es lo único que
          // esta pantalla no puede resolver sola: se dice tal cual.
          this.avisarFallo(error, 'mover el horario');
        },
      });
  }

  /**
   * Cierra un rato libre, con el bloqueo que impide que vuelva.
   *
   * Pide el motivo porque el servidor lo exige —es el mismo catálogo que los
   * bloqueos— y porque **ese motivo lo ve el paciente**: cerrar un rato sin
   * decir por qué deja a quien mira la agenda sin saber si puede pedir turno
   * más tarde.
   */
  protected async cerrarRato(bloque: BloqueDelDia): Promise<void> {
    const recurso = this.recurso();
    const dia = this.diaAbierto();
    if (recurso === null || dia === null || this.operandoHorario() !== null) return;

    const seguro = await this.dialogs.confirm({
      title: 'Cerrar este rato',
      message:
        'Deja de ofrecerse, y no vuelve aunque republiques el horario. ' +
        'Podés reabrirlo quitando el bloqueo desde «Ver mis bloqueos».',
      details: [
        {
          label: 'Cuándo',
          value: `${formatDate(bloque.desde, 'HH:mm', this.idioma)} – ${formatDate(bloque.hasta, 'HH:mm', this.idioma)}`,
        },
      ],
      confirmLabel: 'Cerrar el rato',
      cancelLabel: 'Volver',
      destructive: true,
    });
    if (!seguro) return;

    this.operandoHorario.set(bloque.clave);
    this.scheduling
      .closeSlots(recurso.id, { exceptionType: 'ERRAND', slotIds: [bloque.clave] })
      .subscribe({
        next: (res) => {
          this.operandoHorario.set(null);
          this.toast.success(
            'No vuelve aunque republiques el horario.',
            `${res.closedSlots} ${res.closedSlots === 1 ? 'rato cerrado' : 'ratos cerrados'}`,
          );
          this.cargarMes();
          this.cargarDia(dia);
        },
        error: (error: unknown) => {
          this.operandoHorario.set(null);
          this.avisarFallo(error, 'cerrar ese rato');
        },
      });
  }

  protected volverAlMes(): void {
    this.diaAbierto.set(null);
  }

  /**
   * Los cupos y las citas de un día.
   *
   * Las citas se piden **acotadas por recurso**: sin filtro la API contesta 422
   * —verificado en la auditoría TJ-4—, y es justo lo que esta pantalla necesita.
   */
  private cargarDia(fecha: Date): void {
    const recurso = this.recurso();
    if (recurso === null) return;

    const desde = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + 1);

    this.scheduling
      .listSlots({ resourceId: recurso.id, from: desde, to: hasta, limit: 100 })
      .subscribe({
        next: (pagina) => this.cuposDelDia.set(pagina.items),
        error: () => this.cuposDelDia.set([]),
      });

    this.scheduling
      .searchBookings({ resourceId: recurso.id, from: desde, to: hasta, limit: 100 })
      .subscribe({
        next: (pagina: { items: readonly Booking[] }) => {
          this.citasDelDia.set(pagina.items);
          this.traducirEstados(pagina.items);
        },
        error: () => this.citasDelDia.set([]),
      });
  }

  /** Pide las etiquetas de los estados que aparecieron, y sólo de ésos. */
  private traducirEstados(citas: readonly Booking[]): void {
    const ids = [...new Set(citas.map((cita) => cita.statusConceptId))];
    if (ids.length === 0) return;

    this.terminology.readConceptLabels(ids).subscribe({
      next: (etiquetas) =>
        this.estadosResueltos.set(
          new Map(
            [...etiquetas].map(([id, opcion]) => [
              id,
              { code: opcion.code, display: opcion.display },
            ]),
          ),
        ),
      // Si el catálogo no responde, las filas igual se muestran con su texto
      // neutro: perder la etiqueta no justifica perder la agenda del día.
      error: () => this.estadosResueltos.set(new Map()),
    });
  }

  /**
   * Ejecuta lo que se pidió desde una fila del día.
   *
   * Las tres acciones ya existen en la API; acá sólo se consumen. Cancelar y
   * avisar demora piden texto porque el que lo recibe es el paciente: un aviso
   * sin explicación es peor que ninguno.
   */
  protected async ejecutar(pedido: PedidoDeAccion): Promise<void> {
    const dia = this.diaAbierto();
    if (dia === null) return;

    if (pedido.accion === 'llegó') {
      this.scheduling.checkInBooking(pedido.bookingId).subscribe({
        next: () => this.cargarDia(dia),
        error: (error: unknown) => this.avisarFallo(error, 'registrar la llegada'),
      });
      return;
    }

    if (pedido.accion === 'demora') {
      const mensaje = await this.dialogs.confirmWithReason(
        {
          title: 'Avisar una demora',
          message: 'El paciente recibe el aviso en sus notificaciones.',
          confirmLabel: 'Avisar',
        },
        {
          label: '¿Qué le decimos?',
          placeholder: 'Voy con unos minutos de retraso…',
          hint: 'Lo lee el paciente, así que escribilo como se lo dirías.',
          minLength: 3,
          maxLength: 200,
        },
      );
      if (mensaje === null) return;

      this.scheduling
        .delayBooking(pedido.bookingId, { delayMinutes: 15, message: mensaje })
        .subscribe({
          next: () => {
            this.toast.success('Le avisamos al paciente.', 'Demora');
            this.cargarDia(dia);
          },
          error: (error: unknown) => this.avisarFallo(error, 'avisar la demora'),
        });
      return;
    }

    const motivo = await this.dialogs.confirmWithReason(
      {
        title: 'Cancelar este turno',
        message: 'El paciente recibe el aviso con el motivo que escribas.',
        confirmLabel: 'Cancelar el turno',
        cancelLabel: 'No, volver',
      },
      {
        label: '¿Por qué?',
        placeholder: 'Una urgencia, un imprevisto…',
        hint: 'Lo lee el paciente. Un turno cancelado sin explicación se siente como un plantón.',
        minLength: 3,
        maxLength: 200,
      },
    );
    if (motivo === null) return;

    this.scheduling
      .cancelBooking(pedido.bookingId, { cancelledBy: 'PROVIDER', reasonText: motivo })
      .subscribe({
        next: () => {
          this.toast.success('El paciente recibe el aviso.', 'Turno cancelado');
          this.cargarDia(dia);
        },
        error: (error: unknown) => this.avisarFallo(error, 'cancelar el turno'),
      });
  }

  /**
   * Un fallo de una acción avisa, pero **no** destruye la agenda del día.
   *
   * Lo que se leyó sigue siendo cierto aunque un botón haya fallado: reemplazar
   * la pantalla entera por un cartel de error deja al profesional sin ver a
   * quién tiene esperando. Es el mismo patrón que «Mis turnos».
   */
  private avisarFallo(error: unknown, queSeIntentaba: string): void {
    const estado = errorToViewState<null>(error);
    const mensaje =
      estado.status === 'validation'
        ? estado.issues.map((i) => i.message).join(' ')
        : estado.status === 'forbidden'
          ? 'No tenés permiso para esta operación.'
          : '';
    this.toast.error(mensaje === '' ? `No pudimos ${queSeIntentaba}.` : mensaje, 'No se pudo');
  }

  /**
   * Retira el horario publicado (TAREA-10, punto 6).
   *
   * ## Por qué el botón dice «Retirar» y no «Borrar»
   *
   * Porque eso es lo que pasa. `audit.schedule_templates_history` referencia
   * toda plantilla publicada, así que **ninguna se puede borrar nunca**: el
   * horario deja de publicarse, se sueltan los cupos que nadie reservó y se
   * conservan los que tienen una cita detrás. Un botón que dijera «Borrar»
   * prometería algo que el sistema no hace.
   *
   * ## Por qué pregunta antes
   *
   * Retirar no se deshace desde la pantalla: para volver atrás hay que publicar
   * el horario de nuevo. Y aunque no haya citas comprometidas —el servidor lo
   * rechaza con 409 si las hay—, se sueltan cupos que ya estaban ofrecidos.
   */
  protected async retirarHorario(): Promise<void> {
    const actual = this.estado();
    if (actual.status !== 'ready' || this.retirando()) return;

    const confirmado = await this.dialogs.confirm({
      title: 'Retirar este horario',
      message:
        'Deja de publicarse y los turnos que nadie reservó se dan de baja. Los que ya tienen paciente se conservan. Para volver atrás hay que publicarlo de nuevo.',
      confirmLabel: 'Retirar horario',
      destructive: true,
    });
    if (!confirmado) return;

    this.retirando.set(true);
    this.scheduling.retireTemplate(actual.data.id).subscribe({
      next: (retiro) => {
        this.retirando.set(false);
        // Se dice cuántos se conservaron y no sólo cuántos se soltaron: un
        // número distinto de cero significa que hay pacientes citados en un
        // horario que el médico acaba de retirar, y eso tiene que verlo.
        this.toast.success(
          retiro.keptSlots > 0
            ? `Se dieron de baja ${retiro.releasedSlots} turnos libres. Quedan ${retiro.keptSlots} con paciente: seguí atendiéndolos.`
            : `Se dieron de baja ${retiro.releasedSlots} turnos libres.`,
          'Horario retirado',
        );
        this.cargar();
      },
      error: (error: unknown) => {
        this.retirando.set(false);
        this.avisarFallo(error, 'retirar el horario');
      },
    });
  }

  protected generarSiguientePeriodo(): void {
    const actual = this.estado();
    const hasta = this.cuposHasta();
    if (actual.status !== 'ready' || hasta === null || this.generando()) return;

    const fin = new Date(hasta);
    fin.setMonth(fin.getMonth() + 3);

    this.generando.set(true);
    this.scheduling
      .generateSlots(actual.data.id, { from: hasta.toISOString(), to: fin.toISOString() })
      .subscribe({
        next: () => {
          this.generando.set(false);
          this.cargar();
        },
        error: (error: unknown) => {
          this.generando.set(false);
          this.estado.set(errorToViewState<PublishedTemplate>(error));
        },
      });
  }
}

/**
 * Una franja horaria por cada día del rango.
 *
 * `pedido.desde` y `pedido.hasta` traen ya la hora de inicio y la de fin de la
 * franja; lo que falta es repetirla día por día. Se recorre por fecha local y
 * no sumando 24 horas en milisegundos: en un cambio de horario de verano un día
 * dura 23 o 25, y sumar 86 400 000 correría la franja una hora a partir de ahí.
 */
export function franjasPorDia(pedido: BloqueoPedido): readonly { startAt: Date; endAt: Date }[] {
  const horaDesde = `${dosDigitos(pedido.desde.getHours())}:${dosDigitos(pedido.desde.getMinutes())}`;
  const horaHasta = `${dosDigitos(pedido.hasta.getHours())}:${dosDigitos(pedido.hasta.getMinutes())}`;

  const intervalos: { startAt: Date; endAt: Date }[] = [];
  const ultimo = aMedianoche(pedido.hasta);
  for (let dia = aMedianoche(pedido.desde); dia <= ultimo; dia = siguienteDia(dia)) {
    intervalos.push({ startAt: conHora(dia, horaDesde), endAt: conHora(dia, horaHasta) });
  }
  return intervalos;
}

function siguienteDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + 1);
}

function dosDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

/** `09:00:00` → `09:00`: los segundos de una regla nunca son distintos de cero. */
function sinSegundos(hora: string): string {
  return hora.slice(0, 5);
}

import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of, type Observable } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../../core/auth/auth.service';
import { SchedulingClient } from '../../../../core/data-access/scheduling/scheduling.client';
import {
  motivoDeReconsulta,
  type AgendaResource,
  type AgendaSlot,
  type Booking,
} from '../../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../../shared/components/molecules/radio-group/radio-group';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { mensajeDeFalloDeEscritura } from '../../mensaje-de-escritura';

/** Cuántos días adelante se puede citar de nuevo a alguien. */
const DIAS_DE_HORIZONTE = 90;

const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** Cuánto dura una reconsulta cuando el cupo elegido no dice otra cosa. */
const MINUTOS_POR_OMISION = 30;

/** Dónde se ve la cita ya agendada. */
const RUTA_DE_CONSULTAS = '/schedule';

/**
 * La consulta de la que sale la reconsulta, ya resuelta para la pantalla.
 *
 * Se arma con **una sola lectura** (`GET /scheduling/bookings/:id`) más el
 * catálogo de recursos, que la pantalla ya necesita para nombrar la sede.
 */
interface ConsultaDeOrigen {
  readonly bookingId: string;
  readonly patientProfileId: string;
  readonly resourceId: string;
  readonly cuando: Date | null;
  readonly motivo: string;
  /** La agenda donde ocurrió, con su sede, o `null` si no se pudo resolver. */
  readonly recurso: AgendaResource | null;
  /** La reconsulta que ya salió de esta consulta, si alguien la agendó. */
  readonly yaAgendada: Booking | null;
}

/** Un cupo libre, listo para ofrecerse como opción. */
export interface CupoOfrecido {
  readonly id: string;
  readonly desde: Date;
  readonly hasta: Date;
  /** «08:30 – 09:00 · Clínica Los Olivos». */
  readonly etiqueta: string;
}

/** Los cupos de un día, partidos en las dos mitades en que se piensa la jornada. */
export interface FranjasDelDia {
  readonly manana: readonly CupoOfrecido[];
  readonly tarde: readonly CupoOfrecido[];
}

/** La hora a partir de la cual un cupo es «de la tarde». */
const PRIMERA_HORA_DE_LA_TARDE = 12;

/**
 * **Reconsulta** — «volvé el jueves a las 10», pero como una cita de verdad.
 *
 * ## Qué problema resuelve
 *
 * Citar de nuevo a alguien era, hasta ahora, una frase dicha en el consultorio
 * y anotada en ningún lado: ni el paciente la veía en «Mis citas» ni el
 * profesional la veía en su agenda. Este bloque la convierte en una **cita
 * real** —con su cupo, su estado y su lugar en las dos pantallas— que además
 * **recuerda de qué consulta salió**, que es lo que permite decir «de la cita
 * del 12 de septiembre» en vez de dejar un turno suelto que nadie sabe
 * explicar.
 *
 * ## Se agenda desde una cita, no desde el expediente
 *
 * Sin `bookingId` el bloque no ofrece nada y lo dice: una reconsulta sin
 * consulta de origen no es una reconsulta, es una cita puntual, y para eso
 * está la agenda. Es el mismo criterio con el que la internación exige
 * encuentro.
 *
 * ## Una por consulta
 *
 * El servidor responde **409** ante la segunda, y el bloque no lo esconde: lo
 * cuenta en ámbar y muestra cuál es la que ya está. No es un fallo de la
 * pantalla; es la regla del negocio diciendo que no hacen falta dos.
 *
 * ## Los cupos salen de la agenda, no de un calendario propio
 *
 * El día se elige con `app-date-picker` —desde mañana y hasta noventa días— y
 * los horarios con los cupos **libres** que devuelve `GET /scheduling/slots`
 * para la agenda de esa consulta. Ofrecer un rato que no existe en la agenda
 * sería prometer un turno que después nadie puede honrar.
 */
@Component({
  selector: 'app-follow-up-block',
  imports: [
    Alert,
    AppButton,
    Card,
    DatePicker,
    DatePipe,
    FormField,
    Radio,
    RadioGroup,
    RouterLink,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './follow-up-block.html',
  styleUrl: './follow-up-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FollowUpBlock {
  private readonly agenda = inject(SchedulingClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  /** La persona de la ficha. */
  readonly patientProfileId = input.required<string>();

  /**
   * La cita desde la que se abrió la consulta.
   *
   * `null` cuando se entró por el expediente y no por «Iniciar la consulta»:
   * ahí no hay de qué colgar la reconsulta y el bloque lo explica en vez de
   * ofrecer un formulario que va a fallar.
   */
  readonly bookingId = input<string | null>(null);

  /**
   * El encuentro en curso, si lo hay.
   *
   * Viaja con la reconsulta para poder decir después de qué atención salió.
   * No es obligatorio: se puede citar de nuevo desde una cita que todavía no
   * abrió su encuentro.
   */
  readonly encounterId = input<string | null>(null);

  /** Se agendó algo y el expediente tiene que releerse. */
  readonly cambio = output<void>();

  /** Reintento manual y relectura después de agendar. */
  private readonly intento = signal(0);

  private readonly pedido = computed(() => ({
    bookingId: this.bookingId(),
    tenantId: this.auth.activeTenantId(),
    intento: this.intento(),
  }));

  /** La consulta de origen, o `null` cuando no se abrió desde una cita. */
  protected readonly origen = toSignal(
    toObservable(this.pedido).pipe(
      switchMap(({ bookingId, tenantId }): Observable<ViewState<ConsultaDeOrigen | null>> => {
        if (bookingId === null || bookingId === '') {
          return of(ready(null));
        }
        return this.agenda.getBooking(bookingId).pipe(
          switchMap((cita) => this.conRecursoYReconsulta(cita, tenantId)),
          startWith(loading()),
          catchError((error: unknown) => of(errorToViewState<ConsultaDeOrigen | null>(error))),
        );
      }),
    ),
    { initialValue: loading() as ViewState<ConsultaDeOrigen | null> },
  );

  protected readonly consulta = computed(() => dataOf(this.origen()) ?? null);

  /** Sin cita de origen no hay reconsulta que agendar. */
  protected readonly sinCitaDeOrigen = computed(
    () => this.origen().status === 'ready' && this.consulta() === null,
  );

  protected readonly yaAgendada = computed(() => this.consulta()?.yaAgendada ?? null);

  /* -- El formulario ------------------------------------------------------- */

  /** Desde mañana: hoy ya se está atendiendo. */
  protected readonly primerDia = new Date(Date.now() + UN_DIA_MS);

  protected readonly ultimoDia = new Date(Date.now() + DIAS_DE_HORIZONTE * UN_DIA_MS);

  protected readonly dia = signal<Date | null>(null);

  protected readonly cupoElegido = signal<string | null>(null);

  /**
   * El motivo, con el de la consulta de origen ya puesto.
   *
   * `null` significa «la persona todavía no escribió nada», y entonces vale el
   * heredado. En cuanto escribe —aunque sea para borrarlo— manda lo suyo: un
   * campo que se repisa solo al recargar los cupos sería un campo que borra lo
   * que alguien acaba de tipear.
   */
  private readonly motivoEscrito = signal<string | null>(null);

  protected readonly motivo = computed(
    () => this.motivoEscrito() ?? motivoDeReconsulta(this.consulta()?.motivo),
  );

  protected escribirMotivo(texto: string): void {
    this.motivoEscrito.set(texto);
  }

  /** Los cupos libres del día elegido, ya partidos en mañana y tarde. */
  protected readonly cupos = toSignal(
    toObservable(
      computed(() => ({
        dia: this.dia(),
        resourceId: this.consulta()?.resourceId ?? null,
        recurso: this.consulta()?.recurso ?? null,
        yaAgendada: this.yaAgendada(),
      })),
    ).pipe(
      switchMap(({ dia, resourceId, recurso, yaAgendada }): Observable<ViewState<FranjasDelDia>> => {
        // Con la reconsulta ya agendada no hay formulario que llenar: pedir los
        // cupos igual sería una petición cuyo resultado nadie va a ver.
        if (dia === null || resourceId === null || yaAgendada !== null) {
          return of(ready(SIN_FRANJAS));
        }
        return this.agenda
          .listSlots({
            resourceId,
            from: comienzoDelDia(dia),
            to: comienzoDelDia(new Date(dia.getTime() + UN_DIA_MS)),
            onlyAvailable: true,
          })
          .pipe(
            map((pagina) => ready(enFranjas(pagina.items, recurso))),
            startWith(loading()),
            catchError((error: unknown) => of(errorToViewState<FranjasDelDia>(error))),
          );
      }),
    ),
    { initialValue: ready(SIN_FRANJAS) as ViewState<FranjasDelDia> },
  );

  protected readonly franjas = computed(() => dataOf(this.cupos()) ?? SIN_FRANJAS);

  protected readonly sinCupos = computed(
    () =>
      this.dia() !== null &&
      this.cupos().status === 'ready' &&
      this.franjas().manana.length === 0 &&
      this.franjas().tarde.length === 0,
  );

  private readonly todosLosCupos = computed<readonly CupoOfrecido[]>(() => [
    ...this.franjas().manana,
    ...this.franjas().tarde,
  ]);

  protected readonly cupo = computed<CupoOfrecido | null>(
    () => this.todosLosCupos().find((c) => c.id === this.cupoElegido()) ?? null,
  );

  /* -- La escritura -------------------------------------------------------- */

  protected readonly agendando = signal(false);

  protected readonly registro = signal<ViewState<null>>(ready(null));

  /** La reconsulta recién agendada, para el aviso de éxito. */
  protected readonly agendadaAhora = signal<CupoOfrecido | null>(null);

  protected readonly puedeAgendar = computed(
    () =>
      this.consulta() !== null &&
      this.yaAgendada() === null &&
      this.cupo() !== null &&
      !this.agendando(),
  );

  /**
   * El 409, que no es un fallo: es que esa consulta ya tiene su reconsulta.
   *
   * Se separa del error por la misma razón que en el bloque de internación: la
   * salida no es reintentar, es mirar la que ya está —y está acá arriba—.
   */
  protected readonly avisoDeDuplicado = computed<string | null>(() => {
    const state = this.registro();
    if (state.status === 'validation' && state.issues.some((issue) => issue.code === 'CONFLICT')) {
      return 'Esta consulta ya tiene una reconsulta agendada. No hace falta otra: si la fecha ya no sirve, reprogramá la que está.';
    }
    return null;
  });

  protected readonly errorDelRegistro = computed<string | null>(() => {
    if (this.avisoDeDuplicado() !== null) {
      return null;
    }
    const state = this.registro();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    return mensajeDeFalloDeEscritura(state, {
      accion: 'agendar reconsultas',
      sinPermiso: 'La reconsulta se agenda en tu propia agenda: ésta es de otro profesional.',
    });
  });

  protected readonly rutaDeConsultas = RUTA_DE_CONSULTAS;

  protected recargar(): void {
    this.intento.update((n) => n + 1);
  }

  /** Agenda la reconsulta (C4 · `POST /scheduling/appointments/direct`). */
  protected agendar(): void {
    const consulta = this.consulta();
    const cupo = this.cupo();
    if (!this.puedeAgendar() || consulta === null || cupo === null) {
      return;
    }

    this.agendando.set(true);
    this.registro.set(loading());
    this.agendadaAhora.set(null);

    this.agenda
      .createDirectAppointment({
        patientProfileId: consulta.patientProfileId,
        resourceId: consulta.resourceId,
        startAt: cupo.desde.toISOString(),
        durationMinutes: duracionEnMinutos(cupo),
        reasonText: this.motivo().trim(),
        followUpOf: { bookingId: consulta.bookingId, encounterId: this.encounterId() },
      })
      .subscribe({
        next: () => {
          this.agendando.set(false);
          this.registro.set(ready(null));
          this.agendadaAhora.set(cupo);
          this.cupoElegido.set(null);
          this.toasts.success(
            'La persona la ve en «Mis citas» y vos en Consultas médicas.',
            'Reconsulta agendada',
          );
          // Relee la consulta de origen: desde ahora tiene reconsulta, y esa
          // verdad tiene que venir del servidor y no de que la pintemos.
          this.recargar();
          this.cambio.emit();
        },
        error: (error: unknown) => {
          this.agendando.set(false);
          this.registro.set(errorToViewState<null>(error));
        },
      });
  }

  /**
   * Completa la cita de origen con su agenda y con la reconsulta que ya tenga.
   *
   * El nombre de la sede sale del catálogo de recursos, que es donde vive: la
   * cita sólo trae el `resourceId`. Si el catálogo no se puede leer —o la
   * organización no está elegida— se sigue sin él: quedarse sin poder agendar
   * por no saber el nombre de un consultorio sería peor.
   */
  private conRecursoYReconsulta(
    cita: Booking,
    tenantId: string | null,
  ): Observable<ViewState<ConsultaDeOrigen | null>> {
    const resourceId = cita.resourceId ?? '';
    const armar = (recurso: AgendaResource | null, reconsulta: Booking | null) =>
      ready<ConsultaDeOrigen | null>({
        bookingId: cita.id,
        patientProfileId: cita.patientProfileId ?? this.patientProfileId(),
        resourceId,
        cuando: cita.startAt ?? null,
        motivo: cita.reasonText ?? '',
        recurso,
        yaAgendada: reconsulta,
      });

    const recursos$: Observable<AgendaResource | null> =
      tenantId === null
        ? of(null)
        : this.agenda.listResources({ tenantId }).pipe(
            map((pagina) => pagina.items.find((r) => r.id === resourceId) ?? null),
            catchError(() => of(null)),
          );

    const reconsulta$: Observable<Booking | null> =
      cita.followUpBookingId === undefined || cita.followUpBookingId === null
        ? of(null)
        : this.agenda.getBooking(cita.followUpBookingId).pipe(catchError(() => of(null)));

    return recursos$.pipe(
      switchMap((recurso) => reconsulta$.pipe(map((reconsulta) => armar(recurso, reconsulta)))),
    );
  }
}

const SIN_FRANJAS: FranjasDelDia = { manana: [], tarde: [] };

/** El comienzo del día local de una fecha. */
function comienzoDelDia(dia: Date): Date {
  const inicio = new Date(dia);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

/**
 * Cuánto dura el cupo elegido, en minutos.
 *
 * Sale del propio cupo y no de una constante: una agenda de veinte minutos y
 * una de treinta conviven en la misma maqueta, y mandar media hora fija haría
 * que la cita pisara la siguiente.
 */
function duracionEnMinutos(cupo: CupoOfrecido): number {
  const minutos = Math.round((cupo.hasta.getTime() - cupo.desde.getTime()) / 60_000);
  return minutos > 0 ? minutos : MINUTOS_POR_OMISION;
}

/**
 * Los cupos libres partidos en mañana y tarde.
 *
 * La división es por la **hora local del cupo**, no por una cadena de texto: el
 * recurso puede estar en otra zona y comparar `'12:00'` contra el ISO daría la
 * mitad de la agenda del lado equivocado.
 */
export function enFranjas(
  cupos: readonly AgendaSlot[],
  recurso: AgendaResource | null,
): FranjasDelDia {
  const sede = recurso?.site?.name ?? recurso?.name ?? '';
  const ofrecidos = cupos
    .filter((cupo) => cupo.remainingCapacity > 0)
    .filter((cupo) => cupo.startAt.getTime() > Date.now())
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    .map(
      (cupo): CupoOfrecido => ({
        id: cupo.id,
        desde: cupo.startAt,
        hasta: cupo.endAt,
        etiqueta: `${hora(cupo.startAt)} – ${hora(cupo.endAt)}${sede === '' ? '' : ` · ${sede}`}`,
      }),
    );

  return {
    manana: ofrecidos.filter((cupo) => cupo.desde.getHours() < PRIMERA_HORA_DE_LA_TARDE),
    tarde: ofrecidos.filter((cupo) => cupo.desde.getHours() >= PRIMERA_HORA_DE_LA_TARDE),
  };
}

function hora(instante: Date): string {
  return `${String(instante.getHours()).padStart(2, '0')}:${String(instante.getMinutes()).padStart(2, '0')}`;
}

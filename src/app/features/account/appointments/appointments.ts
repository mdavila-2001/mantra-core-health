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
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { reservaDelPortalRoute } from './appointments.routes';

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

/** Un turno propio, ya listo para mostrarse. */
interface TurnoVisible {
  readonly id: string;
  readonly cuando: Date | null;
  readonly hasta: Date | null;
  /** El uuid del catálogo. Se conserva para poder reetiquetar cuando llegue. */
  readonly statusConceptId: string;
  readonly estado: string;
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Appointments {
  private readonly scheduling = inject(SchedulingClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly auth = inject(AuthService);

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
    this.scheduling
      .searchBookings({ patientProfileId: perfil, limit: TOPE_DE_TURNOS })
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
        const estado = this.turnos();
        if (estado.status === 'ready') {
          this.turnos.set(ready(estado.data.map((turno) => this.conEtiqueta(turno))));
        }
      });
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
    return {
      id: cita.id,
      cuando: cita.startAt ?? null,
      hasta: cita.endAt ?? null,
      statusConceptId: cita.statusConceptId,
      estado: this.nombreDelEstado(cita.statusConceptId),
      motivo: cita.reasonText ?? '',
    };
  }

  /** Reetiqueta un turno con lo que el catálogo haya traído desde entonces. */
  private conEtiqueta(turno: TurnoVisible): TurnoVisible {
    return { ...turno, estado: this.nombreDelEstado(turno.statusConceptId) };
  }

  /**
   * El nombre del estado.
   *
   * Mientras la etiqueta no llegue se dice «Sin confirmar el estado», no el
   * uuid: un identificador en pantalla no le dice nada a nadie, y es
   * exactamente lo que la regla del M34 pide evitar.
   */
  private nombreDelEstado(conceptId: string): string {
    return this.etiquetas().get(conceptId)?.display ?? 'Sin confirmar el estado';
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

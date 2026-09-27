import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, type Observable } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type {
  AgendaResource,
  AgendaSlot,
} from '../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Spinner } from '../../../shared/components/atoms/spinner/spinner';
import { Card } from '../../../shared/components/molecules/card/card';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { reservaDelPortalRoute } from '../../account/appointments/appointments.routes';

/** Milisegundos de un día. */
const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** Cuántas semanas se puede navegar hacia adelante. */
const SEMANAS_ADELANTE = 2;

/**
 * Hasta dónde se busca el próximo hueco cuando la semana visible está vacía.
 *
 * Dos meses: más allá, «el próximo turno es en marzo» deja de ser un dato útil
 * y pasa a ser una forma larga de decir que no hay agenda.
 */
const HORIZONTE_PROXIMO_MS = 60 * UN_DIA_MS;

/**
 * El tope de filas que acepta `GET /scheduling/slots` (`AGENDA_MAX_LIMIT` de la
 * API). La lectura única por sede cubre la semana visible **y** el horizonte del
 * próximo hueco; como la API devuelve los cupos ordenados por inicio, los de la
 * semana visible llegan primero y el tope sólo puede recortar el horizonte.
 */
const TOPE_DE_CUPOS = 500;

/** Las dos formas de `resourceRefType` que apuntan a un perfil profesional. */
const TABLAS_DE_PERFIL_PROFESIONAL: readonly string[] = [
  'practitioner_profiles',
  'health_practitioner_profiles',
];

/** Los cupos de una sede para la semana visible. */
interface CuposDeSede {
  /** Los cupos libres de la semana visible, en orden. */
  readonly cupos: readonly AgendaSlot[];
  /**
   * El primer hueco después de la semana visible, si la semana quedó vacía.
   *
   * `null` cuando hay cupos esta semana —no hace falta— o cuando no hay
   * ninguno en el horizonte.
   */
  readonly proximo: AgendaSlot | null;
}

/**
 * Una sede con el estado de su propia lectura (H2.S2.M4).
 *
 * Cada sede carga por separado: la que respondió ya muestra sus cupos mientras
 * otra sigue «Buscando turnos…», en vez de esperar a la más lenta.
 */
interface SedeConCupos {
  /** El recurso agendable, que es lo que en pantalla se llama «sede». */
  readonly recurso: AgendaResource;
  /** El estado de la lectura de cupos de esta sede. */
  readonly cupos: ViewState<CuposDeSede>;
}

/**
 * La mini-disponibilidad del profesional, sede por sede (TP-4).
 *
 * ## Qué resuelve
 *
 * La ficha decía si el profesional atiende y en qué sedes, pero para saber
 * **cuándo** había que salir de la ficha, entrar a la reserva, elegirlo de una
 * lista y recién ahí ver los horarios. Quien compara dos profesionales hacía
 * ese viaje dos veces. Acá los huecos están donde se toma la decisión.
 *
 * ## Una sede es un recurso agendable
 *
 * En el modelo no hay «las sedes de un médico»: hay recursos agendables que
 * apuntan a su perfil, y cada uno vive en un lugar con su propia zona horaria.
 * Eso es exactamente una sede a los fines de esta pantalla, y por eso el
 * componente pide los recursos del profesional y no las sedes de una práctica.
 *
 * ## Una lectura por sede, y el «próximo hueco» sale de la misma (R-02)
 *
 * `GET /scheduling/slots` no admite filtro por profesional ni varios
 * `resourceId` (Q-J3: la API y el doble aceptan uno solo), así que la unidad
 * mínima es una lectura **por sede**, y las de todas las sedes salen en
 * paralelo. Antes, con la semana vacía, cada sede hacía una segunda lectura
 * **después** de la primera para buscar el próximo hueco: hasta 2N peticiones y
 * dos esperas en serie. Ahora la única lectura cubre la semana visible más el
 * horizonte del próximo hueco (67 días, dentro de los 92 que admite la API): los
 * cupos anteriores al fin de semana son los de la grilla, y el primero posterior
 * sólo se usa cuando la grilla quedó vacía.
 *
 * ## Sin sesión
 *
 * `GET /scheduling/slots` exige sesión, así que sin ella no hay grilla que
 * mostrar: se ofrece entrar. Prometer horarios y que la llamada vuelva 401
 * sería peor que decirlo de entrada.
 */
@Component({
  selector: 'app-practitioner-availability',
  imports: [AppButton, Card, DatePipe, EmptyState, Spinner, ViewStateHost],
  templateUrl: './practitioner-availability.html',
  styleUrl: './practitioner-availability.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerAvailability {
  private readonly scheduling = inject(SchedulingClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** El profesional cuya disponibilidad se muestra. */
  readonly practitionerProfileId = input.required<string>();

  /** La organización en cuyo contexto se mira. */
  readonly tenantId = input.required<string | null>();

  /**
   * A qué tablas apunta un recurso «de este dueño». Por omisión, las del perfil
   * profesional; Cotizaciones la usa con `diagnostic_units` para abrir la agenda
   * de un laboratorio o centro de imagen con **la misma** grilla y la misma
   * reserva que una cita con un profesional, y entonces `practitionerProfileId`
   * lleva el id del centro.
   */
  readonly resourceRefTypes = input<readonly string[]>(TABLAS_DE_PERFIL_PROFESIONAL);

  /**
   * El motivo con el que la reserva arranca escrito (p. ej. el estudio que se
   * cotizó). Viaja por query string, como el resto del contexto del cupo, y la
   * persona lo puede cambiar antes de confirmar.
   */
  readonly motivo = input<string | null>(null);

  /** Qué decir cuando no hay agenda publicada. Cambia según de quién sea. */
  readonly sinAgenda = input(
    'Este profesional aún no abrió su agenda. Volvé a mirar más adelante.',
  );

  protected readonly estado = signal<ViewState<readonly SedeConCupos[]>>(loading());

  /** Cuántas semanas hacia adelante respecto de la actual. */
  protected readonly semana = signal(0);

  /** El cupo cuya navegación a reserva sigue en curso, si hay uno. */
  protected readonly reservaPendienteId = signal<string | null>(null);

  protected readonly haySesion = computed(() => this.auth.isAuthenticated());

  protected readonly sedes = computed<readonly SedeConCupos[]>(() => {
    const actual = this.estado();
    return actual.status === 'ready' ? actual.data : [];
  });

  /**
   * El número de la carga vigente. Cambiar de semana rápido deja lecturas en
   * vuelo: la que vuelve tarde no puede pisar la grilla de la semana nueva.
   */
  private cargaVigente = 0;

  /** Lunes de la semana visible, a medianoche. */
  protected readonly desde = computed(() => {
    const hoy = new Date();
    const lunes = new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate() - ((hoy.getDay() + 6) % 7),
    );
    return new Date(lunes.getTime() + this.semana() * 7 * UN_DIA_MS);
  });

  protected readonly hasta = computed(() => new Date(this.desde().getTime() + 7 * UN_DIA_MS));

  /**
   * No se navega al pasado: un cupo de ayer no se puede reservar, y ofrecer
   * llegar hasta él es ofrecer una pantalla que siempre estará vacía.
   */
  protected readonly puedeRetroceder = computed(() => this.semana() > 0);

  protected readonly puedeAvanzar = computed(() => this.semana() < SEMANAS_ADELANTE);

  constructor() {
    // `effect` y no el constructor: los inputs todavía no tienen valor cuando
    // el componente se construye, y la semana cambia mientras está en pantalla.
    effect(() => {
      const profileId = this.practitionerProfileId();
      const tenantId = this.tenantId();
      this.semana();
      if (profileId === '' || tenantId === null || !this.haySesion()) return;
      void this.cargar(profileId, tenantId);
    });
  }

  protected retroceder(): void {
    if (this.puedeRetroceder()) this.semana.update((n) => n - 1);
  }

  protected avanzar(): void {
    if (this.puedeAvanzar()) this.semana.update((n) => n + 1);
  }

  protected recargar(): void {
    // Volver a poner la misma semana no dispara el efecto; se fuerza tocando la
    // señal con su propio valor a través de una actualización real.
    this.semana.update((n) => n);
    const profileId = this.practitionerProfileId();
    const tenantId = this.tenantId();
    if (profileId !== '' && tenantId !== null) {
      void this.cargar(profileId, tenantId);
    }
  }

  /**
   * Abre la reserva con la sede y el cupo ya elegidos.
   *
   * Ruta del **portal** (`reservaDelPortalRoute`) y no la del mostrador
   * (`bookingNewRoute`): quien mira esta ficha es siempre un paciente —la
   * sección hereda esa restricción de la Guía—, y `/schedule/book/:slotId`
   * está reservada a `SCHEDULING_ADMIN/AGENT/PRACTITIONER`. Usar la del
   * mostrador acá hacía que `seccionRolesGuard` rechazara al paciente y lo
   * mandara a `/dashboard` en cuanto tocaba un cupo.
   *
   * Los tres datos que la reserva necesita para reencontrar el cupo al
   * recargar viajan por query string, que es el contrato que
   * `appointments.routes` documenta: no existe `GET /scheduling/slots/:id`.
   */
  protected reservar(sede: SedeConCupos, cupo: AgendaSlot): void {
    if (this.reservaPendienteId() !== null) {
      return;
    }
    this.reservaPendienteId.set(cupo.id);
    void this.router
      .navigate([reservaDelPortalRoute(cupo.id)], {
        queryParams: {
          recurso: sede.recurso.id,
          desde: cupo.startAt.toISOString(),
          hasta: cupo.endAt.toISOString(),
          ...(this.motivo() ? { motivo: this.motivo() } : {}),
        },
      })
      .finally(() => this.reservaPendienteId.set(null));
  }

  private async cargar(profileId: string, tenantId: string): Promise<void> {
    const carga = ++this.cargaVigente;
    this.estado.set(loading());
    let suyos: readonly AgendaResource[];
    try {
      const pagina = await this.esperar(this.scheduling.listResources({ tenantId }));

      // Del catálogo del tenant, sólo los que son de este profesional. El
      // filtro es acá y no en la consulta porque el endpoint no acepta
      // `resourceRefId`: pedirlo sería agregar un parámetro a la API para
      // ahorrarse un `filter` sobre una lista que ya es del tamaño de una
      // organización.
      const tablas = this.resourceRefTypes();
      suyos = pagina.items.filter(
        (recurso) =>
          tablas.includes(recurso.resourceRefType) && recurso.resourceRefId === profileId,
      );
    } catch (error) {
      if (carga === this.cargaVigente) {
        this.estado.set(errorToViewState<readonly SedeConCupos[]>(error));
      }
      return;
    }
    if (carga !== this.cargaVigente) return;

    // Las sedes se muestran ya, cada una con su propia carga: la que responde
    // primero no espera a la más lenta.
    this.estado.set(ready(suyos.map((recurso) => ({ recurso, cupos: loading() }))));
    await Promise.all(suyos.map((recurso) => this.cargarSede(recurso, carga)));
  }

  /** Los cupos de una sede, si su lectura ya volvió bien. */
  protected datosDe(sede: SedeConCupos): CuposDeSede | null {
    return sede.cupos.status === 'ready' ? sede.cupos.data : null;
  }

  /** Vuelve a leer una sola sede, la que falló. */
  protected reintentarSede(recurso: AgendaResource): void {
    this.ponerCupos(recurso.id, loading(), this.cargaVigente);
    void this.cargarSede(recurso, this.cargaVigente);
  }

  private async cargarSede(recurso: AgendaResource, carga: number): Promise<void> {
    try {
      const cupos = await this.cuposDe(recurso);
      this.ponerCupos(recurso.id, ready(cupos), carga);
    } catch (error) {
      this.ponerCupos(recurso.id, errorToViewState<CuposDeSede>(error), carga);
    }
  }

  private ponerCupos(recursoId: string, cupos: ViewState<CuposDeSede>, carga: number): void {
    if (carga !== this.cargaVigente) return;
    this.estado.update((actual) =>
      actual.status === 'ready'
        ? ready(
            actual.data.map((sede) => (sede.recurso.id === recursoId ? { ...sede, cupos } : sede)),
          )
        : actual,
    );
  }

  private async cuposDe(recurso: AgendaResource): Promise<CuposDeSede> {
    const ahora = new Date();
    // Nunca antes de ahora: un cupo de esta mañana ya pasó, y ofrecerlo sólo
    // sirve para que la reserva lo rechace.
    const desde = new Date(Math.max(this.desde().getTime(), ahora.getTime()));
    const finDeSemana = this.hasta().getTime();

    const pagina = await this.esperar(
      this.scheduling.listSlots({
        resourceId: recurso.id,
        from: desde,
        to: new Date(finDeSemana + HORIZONTE_PROXIMO_MS),
        onlyAvailable: true,
        limit: TOPE_DE_CUPOS,
      }),
    );

    const cupos = pagina.items.filter((cupo) => cupo.startAt.getTime() < finDeSemana);
    if (cupos.length > 0) {
      return { cupos, proximo: null };
    }
    // Sólo con la semana vacía se ofrece el próximo: es el caso en que la
    // persona se queda sin saber qué hacer.
    const proximo = pagina.items.find((cupo) => cupo.startAt.getTime() >= finDeSemana) ?? null;
    return { cupos: [], proximo };
  }

  /**
   * Un `Observable` de una sola emisión, como promesa.
   *
   * Las lecturas de esta pantalla son varias en paralelo —una por sede— y
   * componerlas con `subscribe` anidados dejaría un árbol de callbacks donde lo
   * único que hace falta es esperar a que todas vuelvan.
   */
  private esperar<T>(fuente: Observable<T>): Promise<T> {
    return firstValueFrom(fuente);
  }
}

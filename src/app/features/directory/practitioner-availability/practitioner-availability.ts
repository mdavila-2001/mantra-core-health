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

/** Las dos formas de `resourceRefType` que apuntan a un perfil profesional. */
const TABLAS_DE_PERFIL_PROFESIONAL: readonly string[] = [
  'practitioner_profiles',
  'health_practitioner_profiles',
];

/** Una sede con sus cupos de la semana visible. */
interface SedeConCupos {
  /** El recurso agendable, que es lo que en pantalla se llama «sede». */
  readonly recurso: AgendaResource;
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
 * ## Por qué el «próximo hueco» se busca aparte
 *
 * Porque sólo hace falta cuando la semana visible está vacía, que es
 * justamente cuando la persona se queda sin saber qué hacer. Pedirlo siempre
 * sería una segunda consulta por sede en el caso normal —el que sí tiene
 * huecos— para un dato que no se muestra.
 *
 * ## Sin sesión
 *
 * `GET /scheduling/slots` exige sesión, así que sin ella no hay grilla que
 * mostrar: se ofrece entrar. Prometer horarios y que la llamada vuelva 401
 * sería peor que decirlo de entrada.
 */
@Component({
  selector: 'app-practitioner-availability',
  imports: [AppButton, Card, DatePipe, EmptyState, ViewStateHost],
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
        },
      })
      .finally(() => this.reservaPendienteId.set(null));
  }

  private async cargar(profileId: string, tenantId: string): Promise<void> {
    this.estado.set(loading());
    try {
      const pagina = await this.esperar(this.scheduling.listResources({ tenantId }));

      // Del catálogo del tenant, sólo los que son de este profesional. El
      // filtro es acá y no en la consulta porque el endpoint no acepta
      // `resourceRefId`: pedirlo sería agregar un parámetro a la API para
      // ahorrarse un `filter` sobre una lista que ya es del tamaño de una
      // organización.
      const suyos = pagina.items.filter(
        (recurso) =>
          TABLAS_DE_PERFIL_PROFESIONAL.includes(recurso.resourceRefType) &&
          recurso.resourceRefId === profileId,
      );

      const sedes = await Promise.all(suyos.map((recurso) => this.cuposDe(recurso)));
      this.estado.set(ready(sedes));
    } catch (error) {
      this.estado.set(errorToViewState<readonly SedeConCupos[]>(error));
    }
  }

  private async cuposDe(recurso: AgendaResource): Promise<SedeConCupos> {
    const ahora = new Date();
    // Nunca antes de ahora: un cupo de esta mañana ya pasó, y ofrecerlo sólo
    // sirve para que la reserva lo rechace.
    const desde = new Date(Math.max(this.desde().getTime(), ahora.getTime()));

    const pagina = await this.esperar(
      this.scheduling.listSlots({
        resourceId: recurso.id,
        from: desde,
        to: this.hasta(),
        onlyAvailable: true,
      }),
    );

    if (pagina.items.length > 0) {
      return { recurso, cupos: pagina.items, proximo: null };
    }

    // Sólo con la semana vacía se pregunta por el próximo: es el caso en que la
    // persona se queda sin saber qué hacer.
    const siguiente = await this.esperar(
      this.scheduling.listSlots({
        resourceId: recurso.id,
        from: this.hasta(),
        to: new Date(this.hasta().getTime() + HORIZONTE_PROXIMO_MS),
        onlyAvailable: true,
        limit: 1,
      }),
    );

    return { recurso, cupos: [], proximo: siguiente.items[0] ?? null };
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

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type {
  AgendaResource,
  PublishedTemplate,
} from '../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
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
@Component({
  selector: 'app-my-agenda',
  imports: [Alert, AppButton, AppButtonLink, PageHeader, RouterLink, ViewStateHost],
  templateUrl: './my-agenda.html',
  styleUrl: './my-agenda.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyAgenda {
  private readonly scheduling = inject(SchedulingClient);
  private readonly auth = inject(AuthService);

  protected readonly rutaDePublicar = AGENDA_CREATE_ROUTE;

  /** El recurso del profesional; sin él no hay agenda que mostrar. */
  protected readonly recurso = signal<AgendaResource | null>(null);

  protected readonly estado = signal<ViewState<PublishedTemplate>>(loading());

  /** Hasta cuándo llegan los cupos ya materializados. */
  protected readonly cuposHasta = signal<Date | null>(null);
  protected readonly generando = signal(false);

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

  protected cargar(): void {
    const perfil = this.auth.practitionerProfileId();
    const tenantId = this.auth.activeTenantId();
    if (perfil === null || tenantId === null) {
      this.estado.set(SIN_AGENDA);
      return;
    }

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
        const vigente = pagina.items[0];
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

/** `09:00:00` → `09:00`: los segundos de una regla nunca son distintos de cero. */
function sinSegundos(hora: string): string {
  return hora.slice(0, 5);
}

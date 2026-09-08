import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { SchedulingClient } from '@core/data-access/scheduling/scheduling.client';
import type { AgendaResource, Booking } from '@core/data-access/scheduling/scheduling.types';
import { TerminologyClient } from '@core/data-access/terminology/terminology.client';
import { errorToViewState } from '@core/http/error-to-view-state';
import { empty, loading, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { AppButtonLink } from '@shared/components/atoms/button/button-link';
import { Card } from '@shared/components/molecules/card/card';
import { PageHeader } from '@shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';

import { AGENDA_CREATE_ROUTE, AGENDA_MINE_ROUTE } from '../agenda/agenda.routes';
import { miRecursoDeAgenda } from '../agenda/mi-recurso';
import {
  CITA_QUERY_PARAM,
  MOTIVO_QUERY_PARAM,
  patientChartRoute,
} from '../clinical-record/clinical-record.routes';
import { CONSULTATION_WALK_IN_ROUTE } from './consultation.routes';

/** Una cita de hoy, ya resuelta para pintar. */
export interface CitaDeHoy {
  readonly id: string;
  readonly desde: Date | null;
  readonly hasta: Date | null;
  readonly paciente: string;
  readonly motivo: string | null;
  readonly estado: string;
  readonly llego: boolean;
  /** `null` cuando la reserva no trae el perfil: sin él no hay consulta que abrir. */
  readonly ruta: string | null;
  readonly params: Readonly<Record<string, string>>;
}

/**
 * **Consulta médica** — la primera de las ocho opciones del panel del médico
 * (§4.H del plan de UX del 22/08/2026).
 *
 * ## Qué problema resuelve, que no es «falta una pantalla»
 *
 * El encuentro clínico ya se podía hacer, y bien: se abre el expediente del
 * paciente y ahí se escribe. Lo que no había era **la puerta con el nombre de
 * lo que uno viene a hacer**. Para empezar a atender había que acordarse de
 * entrar por «Archivo clínico» —que suena a lo que se consulta después— o de
 * abrir la agenda y buscar el turno. Es el síntoma 1 del plan: la aplicación no
 * se explica sola.
 *
 * ## Por qué son los turnos de hoy y no un buscador de pacientes
 *
 * Porque el buscador de pacientes le responde **403 a un médico**:
 * `GET /profiles/patients` pide `SECURITY_ADMIN`, el padrón es de
 * administración. El camino real de quien atiende ya existía y estaba escrito
 * en el propio Archivo clínico: «la cita de tu agenda trae el identificador».
 * Esta pantalla es ese camino, dicho de frente — la lista de a quién tenés que
 * atender hoy, con el botón que abre su consulta.
 *
 * El enlace se arma igual que en la agenda, con el motivo y el `appointmentId`
 * en la URL, así que el expediente se abre con el motivo ya cargado y el
 * encuentro atado a su turno. **No es una segunda implementación**: es la misma
 * ruta y los mismos parámetros.
 *
 * ## Y por qué conserva «atender sin turno»
 *
 * Porque no todo lo que se atiende tiene turno: una urgencia, alguien que
 * llegó sin cita, una interconsulta. Sin esa salida, la pantalla sería más
 * ordenada y menos útil. Vive en su propia vista (`walk-in`), por fases:
 * paciente, consultorio si hay más de uno, horario.
 */
@Component({
  selector: 'app-consultation',
  imports: [AppButtonLink, Card, DatePipe, PageHeader, RouterLink, ViewStateHost],
  templateUrl: './consultation.html',
  styleUrl: './consultation.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Consultation {
  private readonly scheduling = inject(SchedulingClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly auth = inject(AuthService);

  protected readonly rutaSinTurno = CONSULTATION_WALK_IN_ROUTE;
  protected readonly rutaDePublicar = AGENDA_CREATE_ROUTE;
  protected readonly rutaDeMiAgenda = AGENDA_MINE_ROUTE;

  /**
   * Si hay un horario publicado. `null` mientras no se sabe.
   *
   * Decide una sola cosa: si la tarjeta de horarios dice «Publicar mi
   * horario» (no hay ninguno) o «Editar horarios de atención» (ya hay). Las
   * dos a la vez serían mentira en uno de los dos casos.
   */
  protected readonly tieneAgenda = signal<boolean | null>(null);

  /**
   * El estado de la lectura, con las citas **crudas**.
   *
   * Las filas que se pintan son un `computed` sobre esto y sobre las etiquetas:
   * así, cuando el catálogo de terminología contesta —siempre después—, los
   * estados se actualizan solos. Guardar las filas ya traducidas obligaría a
   * volver a mapearlas a mano, que es la clase de recálculo que las señales
   * existen para evitar.
   */
  protected readonly estado = signal<ViewState<readonly Booking[]>>(loading());

  /** Las etiquetas de los estados que aparecieron, y sólo de ésos. */
  private readonly etiquetas = signal<ReadonlyMap<string, string>>(new Map());

  /** Las citas de hoy, ya resueltas para pintar. */
  protected readonly citas = computed<readonly CitaDeHoy[]>(() => {
    const actual = this.estado();
    if (actual.status !== 'ready') {
      return [];
    }
    const etiquetas = this.etiquetas();
    return actual.data.map((cita) => aCitaDeHoy(cita, etiquetas));
  });

  protected readonly hoy = new Date();

  /**
   * Cuántas de las citas de hoy ya llegaron.
   *
   * Es el dato que un médico mira primero al volver de una consulta: quién está
   * esperando. Se cuenta acá y no en la plantilla para que el encabezado pueda
   * decirlo en una línea.
   */
  protected readonly resumen = computed(() => {
    if (this.estado().status !== 'ready') {
      return null;
    }
    const citas = this.citas();
    const total = citas.length;
    const esperando = citas.filter((cita) => cita.llego).length;
    if (esperando === 0) {
      return `${total} ${total === 1 ? 'turno' : 'turnos'} para hoy.`;
    }
    return `${total} ${total === 1 ? 'turno' : 'turnos'} para hoy · ${esperando} ${
      esperando === 1 ? 'persona esperando' : 'personas esperando'
    }.`;
  });

  /** El vacío que se pinta dentro de una tarjeta, y no como texto suelto. */
  protected readonly vacio = computed(() => {
    const actual = this.estado();
    return actual.status === 'empty' ? actual : null;
  });

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    const perfil = this.auth.practitionerProfileId();
    const tenantId = this.auth.activeTenantId();
    if (perfil === null || tenantId === null) {
      this.tieneAgenda.set(false);
      this.estado.set(SIN_AGENDA);
      return;
    }

    this.tieneAgenda.set(null);
    this.estado.set(loading());
    miRecursoDeAgenda(this.scheduling, tenantId, perfil).subscribe({
      next: (propio) => {
        if (propio === null) {
          this.tieneAgenda.set(false);
          this.estado.set(SIN_AGENDA);
          return;
        }
        this.tieneAgenda.set(true);
        this.leerCitasDeHoy(propio);
      },
      error: (error: unknown) => this.estado.set(errorToViewState<readonly Booking[]>(error)),
    });
  }

  /**
   * Las citas de hoy de ese recurso.
   *
   * Acotadas **por recurso a propósito**: sin filtro la API contesta 422
   * —verificado en la auditoría TJ-4— y además es justo lo que esta pantalla
   * necesita.
   */
  private leerCitasDeHoy(recurso: AgendaResource): void {
    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    const hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + 1);

    this.scheduling
      .searchBookings({ resourceId: recurso.id, from: desde, to: hasta, limit: 100 })
      .subscribe({
        next: (pagina) => {
          if (pagina.items.length === 0) {
            this.estado.set(
              empty(
                { label: 'Ver mi agenda', route: AGENDA_MINE_ROUTE },
                'No tenés turnos para hoy. Si vas a atender a alguien sin turno, usá el botón de acá abajo.',
              ),
            );
            return;
          }
          this.estado.set(ready(pagina.items));
          this.traducirEstados(pagina.items);
        },
        error: (error: unknown) => this.estado.set(errorToViewState<readonly Booking[]>(error)),
      });
  }

  /** Pide las etiquetas de los estados que aparecieron, y sólo de ésos. */
  private traducirEstados(citas: readonly Booking[]): void {
    const ids = [...new Set(citas.map((cita) => cita.statusConceptId))];
    if (ids.length === 0) {
      return;
    }
    this.terminology.readConceptLabels(ids).subscribe({
      next: (etiquetas) =>
        this.etiquetas.set(new Map([...etiquetas].map(([id, o]) => [id, o.display]))),
      // Si el catálogo no responde, las filas siguen en pantalla con su texto
      // neutro: perder la etiqueta no justifica perder la lista de a quién hay
      // que atender.
      error: () => this.etiquetas.set(new Map()),
    });
  }
}

/** Traduce una reserva a la fila que la pantalla pinta. */
function aCitaDeHoy(cita: Booking, etiquetas: ReadonlyMap<string, string>): CitaDeHoy {
  const paciente = cita.patientProfileId ?? null;
  return {
    id: cita.id,
    desde: cita.startAt ?? null,
    hasta: cita.endAt ?? null,
    // Ausente no significa «sin nombre»: significa «no te corresponde verlo».
    // Ver el contrato de `Booking.patientName`.
    paciente: cita.patientName ?? 'Paciente',
    motivo: cita.reasonText ?? null,
    estado: etiquetas.get(cita.statusConceptId) ?? 'Reservado',
    llego: cita.checkedInAt !== undefined,
    ruta: paciente === null ? null : patientChartRoute(paciente),
    params: {
      ...(cita.reasonText === undefined ? {} : { [MOTIVO_QUERY_PARAM]: cita.reasonText }),
      ...(cita.appointmentId === undefined || cita.appointmentId === null
        ? {}
        : { [CITA_QUERY_PARAM]: cita.appointmentId }),
    },
  };
}

/**
 * El vacío de quien todavía no publicó horario.
 *
 * Con su salida, como pide el M34: el callejón sería decirle que no tiene
 * turnos sin decirle que primero hay que publicar la agenda.
 */
const SIN_AGENDA = empty(
  { label: 'Publicar mi horario', route: AGENDA_CREATE_ROUTE },
  'Todavía no tenés agenda publicada, así que nadie puede pedirte turno. Igual podés atender a alguien sin turno con el botón de acá abajo.',
);

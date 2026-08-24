import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { SchedulingClient } from '@core/data-access/scheduling/scheduling.client';
import type { AgendaResource, Booking } from '@core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '@core/http/error-to-view-state';
import { empty, loading, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { AppButton } from '@shared/components/atoms/button/button';
import { AppButtonLink } from '@shared/components/atoms/button/button-link';
import { Alert } from '@shared/components/molecules/alert/alert';
import { Card } from '@shared/components/molecules/card/card';
import { PageHeader } from '@shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';

import { miRecursoDeAgenda } from '../agenda/mi-recurso';
import { patientChartRoute } from '../clinical-record/clinical-record.routes';

/**
 * Cuántos días hacia atrás se mira.
 *
 * Treinta y no noventa: la pregunta que trae acá es «¿qué vengo escribiendo?»,
 * y a los tres meses eso ya no se contesta con una lista — se contesta abriendo
 * el expediente de quien uno se acuerda. Además, `GET /scheduling/bookings`
 * comparte el tope de ventana de 92 días con los cupos, así que treinta entra
 * holgado.
 */
const DIAS_HACIA_ATRAS = 30;

/** Una persona atendida, con cuándo fue la última vez. */
export interface PersonaAtendida {
  readonly profileId: string;
  readonly nombre: string;
  readonly ultima: Date;
  readonly cuantas: number;
  readonly motivo: string | null;
  readonly ruta: string;
}

/**
 * **Evoluciones** — la sexta de las ocho opciones del panel del médico (§4.H
 * del plan de UX del 22/08/2026).
 *
 * ## Qué contesta, y por qué es una sección y no una pestaña
 *
 * «¿A quién vengo atendiendo y dónde sigo escribiendo?». Esa pregunta es
 * **transversal a los pacientes**, y por eso no puede vivir dentro del Archivo
 * clínico: ahí se entra *por persona*, así que para repasar las últimas cinco
 * evoluciones habría que acordarse antes de las cinco personas. Es la misma
 * razón por la que «Mis turnos» no vive dentro de cada paciente.
 *
 * ## Lo que esta pantalla NO es todavía, dicho de frente
 *
 * **No es la lista de las notas.** `M15 chart` expone `POST /charts/notes` y
 * `PUT /charts/notes/:id/versions` —se escriben y se versionan— pero **no tiene
 * ninguna lectura de colección**: no existe `GET /charts/notes`, ni por
 * profesional ni por fecha. Inventar acá una lista de notas exigiría pedir el
 * expediente completo de cada paciente y quedarse con la última, que son N
 * peticiones de datos clínicos enteros para pintar N renglones.
 *
 * Así que lo que se lista es lo que sí se puede leer y sí contesta la pregunta:
 * **a quién atendiste**, desde `GET /scheduling/bookings`, con el enlace a su
 * expediente, que es donde la evolución vive. El rótulo de la pantalla dice
 * exactamente eso y no promete un listado de notas que no hay.
 *
 * Cuando la API exponga la lectura de notas, esta pantalla pasa a listarlas y
 * conserva su lugar en el menú. Queda anotado en `PENDIENTES-BACKEND.md`.
 */
@Component({
  selector: 'app-progress-notes',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Card,
    DatePipe,
    PageHeader,
    RouterLink,
    ViewStateHost,
  ],
  templateUrl: './progress-notes.html',
  styleUrl: './progress-notes.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressNotes {
  private readonly scheduling = inject(SchedulingClient);
  private readonly auth = inject(AuthService);

  protected readonly estado = signal<ViewState<readonly PersonaAtendida[]>>(loading());

  protected readonly dias = DIAS_HACIA_ATRAS;

  /** Las filas a pintar. Vacío en cualquier estado que no sea `ready`. */
  protected readonly personas = computed<readonly PersonaAtendida[]>(() => {
    const actual = this.estado();
    return actual.status === 'ready' ? actual.data : [];
  });

  protected readonly resumen = computed(() => {
    const actual = this.estado();
    if (actual.status !== 'ready') {
      return null;
    }
    const cuantas = actual.data.length;
    return `${cuantas} ${cuantas === 1 ? 'persona atendida' : 'personas atendidas'} en los últimos ${DIAS_HACIA_ATRAS} días.`;
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
    miRecursoDeAgenda(this.scheduling, tenantId, perfil).subscribe({
      next: (propio) => {
        if (propio === null) {
          this.estado.set(SIN_AGENDA);
          return;
        }
        this.leerAtendidos(propio);
      },
      error: (error: unknown) =>
        this.estado.set(errorToViewState<readonly PersonaAtendida[]>(error)),
    });
  }

  private leerAtendidos(recurso: AgendaResource): void {
    const hasta = new Date();
    const desde = new Date();
    desde.setDate(desde.getDate() - DIAS_HACIA_ATRAS);
    desde.setHours(0, 0, 0, 0);

    this.scheduling
      .searchBookings({ resourceId: recurso.id, from: desde, to: hasta, limit: 200 })
      .subscribe({
        next: (pagina) => {
          const personas = agruparPorPaciente(pagina.items);
          this.estado.set(
            personas.length === 0
              ? empty(
                  { label: 'Ir a Consulta médica', route: '/consultation' },
                  `No registrás atenciones en los últimos ${DIAS_HACIA_ATRAS} días.`,
                )
              : ready(personas),
          );
        },
        error: (error: unknown) =>
          this.estado.set(errorToViewState<readonly PersonaAtendida[]>(error)),
      });
  }
}

/**
 * De las reservas del período a una fila por persona.
 *
 * **Una fila por paciente y no una por turno**: la pregunta es «a quién vengo
 * atendiendo», y alguien con control semanal ocuparía cuatro renglones que
 * llevan todos al mismo expediente. Se cuenta cuántas veces vino, que es el
 * dato que esos cuatro renglones aportaban de verdad.
 *
 * Sólo entran las que **ocurrieron**: una reserva futura o cancelada no es una
 * atención, y listarla acá diría que se escribió una evolución que no existe.
 * El criterio es `checkedInAt` —llegó— o que la hora de fin ya haya pasado.
 */
export function agruparPorPaciente(citas: readonly Booking[]): readonly PersonaAtendida[] {
  const ahora = Date.now();
  const porPaciente = new Map<string, PersonaAtendida>();

  for (const cita of citas) {
    const profileId = cita.patientProfileId;
    const cuando = cita.startAt;
    if (profileId === undefined || cuando === undefined) {
      continue;
    }
    const ocurrio = cita.checkedInAt !== undefined || (cita.endAt?.getTime() ?? 0) <= ahora;
    if (!ocurrio) {
      continue;
    }

    const previa = porPaciente.get(profileId);
    const esMasReciente = previa === undefined || cuando.getTime() > previa.ultima.getTime();
    porPaciente.set(profileId, {
      profileId,
      // Ausente no significa «sin nombre»: significa «no te corresponde
      // verlo». Ver el contrato de `Booking.patientName`.
      nombre: (esMasReciente ? cita.patientName : previa?.nombre) ?? 'Paciente',
      ultima: esMasReciente ? cuando : (previa?.ultima ?? cuando),
      cuantas: (previa?.cuantas ?? 0) + 1,
      motivo: (esMasReciente ? (cita.reasonText ?? null) : (previa?.motivo ?? null)),
      ruta: patientChartRoute(profileId),
    });
  }

  return [...porPaciente.values()].sort((a, b) => b.ultima.getTime() - a.ultima.getTime());
}

const SIN_AGENDA = empty(
  { label: 'Publicar mi horario', route: '/schedule/new' },
  'Todavía no tenés agenda publicada, así que no hay atenciones registradas para listar.',
);

import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { SchedulingClient } from '@core/data-access/scheduling/scheduling.client';
import type { AgendaResource, Booking } from '@core/data-access/scheduling/scheduling.types';
import { TerminologyClient } from '@core/data-access/terminology/terminology.client';
import { errorToViewState } from '@core/http/error-to-view-state';
import { empty, loading, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { AppButton } from '@shared/components/atoms/button/button';
import { AppButtonLink } from '@shared/components/atoms/button/button-link';
import { Input } from '@shared/components/atoms/input/input';
import { Card } from '@shared/components/molecules/card/card';
import { FormField } from '@shared/components/molecules/form-field/form-field';
import { PageHeader } from '@shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';

import { miRecursoDeAgenda } from '../agenda/mi-recurso';
import {
  CITA_QUERY_PARAM,
  CLINICAL_RECORD_ROUTE,
  MOTIVO_QUERY_PARAM,
  patientChartRoute,
} from '../clinical-record/clinical-record.routes';

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
 * ## Y por qué conserva «abrir por identificador»
 *
 * Porque no todo lo que se atiende tiene turno: una urgencia, alguien que
 * llegó sin cita, una interconsulta. Sin esa salida, la pantalla sería más
 * ordenada y menos útil.
 */
@Component({
  selector: 'app-consultation',
  imports: [
    AppButton,
    AppButtonLink,
    Card,
    DatePipe,
    FormField,
    Input,
    PageHeader,
    RouterLink,
    ViewStateHost,
  ],
  templateUrl: './consultation.html',
  styleUrl: './consultation.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Consultation {
  private readonly scheduling = inject(SchedulingClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly rutaDelArchivo = CLINICAL_RECORD_ROUTE;

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

  /** Lo tecleado en «abrir por identificador». No viaja a la URL: es de un uso. */
  protected readonly identificador = signal('');

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

  constructor() {
    this.cargar();
  }

  protected fijarIdentificador(valor: string | number | null): void {
    this.identificador.set(valor === null ? '' : String(valor));
  }

  /**
   * Abre la consulta de alguien por su identificador.
   *
   * Sin validar la forma del uuid a mano, por lo mismo que el Archivo clínico:
   * el backend responde 400 a uno mal formado y 404 a uno que no existe, y el
   * expediente muestra los dos como corresponde. Repetir la validación acá sólo
   * agregaría un segundo lugar donde equivocarse.
   */
  protected abrirPorIdentificador(): void {
    const id = this.identificador().trim();
    if (id === '') {
      return;
    }
    void this.router.navigateByUrl(patientChartRoute(encodeURIComponent(id)));
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
                { label: 'Ver mi agenda', route: '/schedule/mine' },
                'No tenés turnos para hoy. Si vas a atender a alguien sin turno, abrí su consulta por identificador acá abajo.',
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
  { label: 'Publicar mi horario', route: '/schedule/new' },
  'Todavía no tenés agenda publicada, así que nadie puede pedirte turno. Igual podés abrir la consulta de alguien por su identificador.',
);

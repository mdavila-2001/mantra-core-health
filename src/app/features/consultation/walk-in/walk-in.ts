import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { ProfilesClient } from '@core/data-access/profiles/profiles.client';
import { SchedulingClient } from '@core/data-access/scheduling/scheduling.client';
import type { AgendaResource, AgendaSlot } from '@core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '@core/http/error-to-view-state';
import { NavigationService } from '@core/navigation/navigation.service';
import { loading, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { AnnounceOnAppear } from '@shared/a11y/announce-on-appear';
import { AppButton } from '@shared/components/atoms/button/button';
import { AppButtonLink } from '@shared/components/atoms/button/button-link';
import { Input } from '@shared/components/atoms/input/input';
import { Alert } from '@shared/components/molecules/alert/alert';
import type { BreadcrumbItem } from '@shared/components/molecules/breadcrumb/breadcrumb.types';
import { Card } from '@shared/components/molecules/card/card';
import { FormField } from '@shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '@shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '@shared/components/molecules/reference-combobox/reference-combobox.types';
import { ToastService } from '@shared/components/molecules/toast/toast.service';
import { PageHeader } from '@shared/components/organisms/page-header/page-header';

import { AGENDA_CREATE_ROUTE } from '../../agenda/agenda.routes';
import {
  CITA_QUERY_PARAM,
  MOTIVO_QUERY_PARAM,
  patientChartRoute,
} from '../../clinical-record/clinical-record.routes';
import { CONSULTATION_ROUTE } from '../consultation.routes';

/** Las fases del asistente, en el orden en que se recorren. */
export type Fase = 'paciente' | 'consultorio' | 'horario';

/** Un día con sus cupos libres, ya agrupado para pintar. */
export interface DiaConCupos {
  readonly clave: string;
  readonly fecha: Date;
  readonly cupos: readonly AgendaSlot[];
}

const CANDIDATOS_POR_BUSQUEDA = 10;
const DIAS_HACIA_ADELANTE = 14;
const MAX_CUPOS = 200;

/**
 * **Atender a alguien sin turno** — el asistente por fases de la consulta.
 *
 * ## Qué problema resuelve
 *
 * «Consulta médica» lista los turnos de hoy. Pero no todo lo que se atiende
 * tiene turno: una urgencia, alguien que llegó sin cita, una interconsulta.
 * Antes ese camino era «pegá el identificador del paciente», que le sirve a
 * quien lo tiene a mano y a nadie más. Esta pantalla lo convierte en tres
 * preguntas, de a una: **¿a quién?**, **¿dónde?**, **¿cuándo?**.
 *
 * ## Por qué el consultorio va antes que el horario
 *
 * Porque los cupos son del recurso: un profesional con dos consultorios tiene
 * dos agendas, y no se puede listar «los horarios libres» sin saber de cuál.
 * Si tiene uno solo, la fase no se muestra: se elige por él y se pasa directo
 * al horario («si tiene uno solo, ese por defecto»).
 *
 * ## Por qué reserva un cupo real y no «abre la consulta» a secas
 *
 * Porque el expediente ata el encuentro al turno (`cita` en la URL) y así el
 * paciente sin cita queda en la agenda como cualquier otro: figura en «hoy»,
 * cuenta para el resumen y no desaparece al cerrar la pestaña. Es el mismo
 * ciclo hold → confirm que usa la reserva de mostrador; no una segunda forma
 * de reservar.
 */
@Component({
  selector: 'app-consultation-walk-in',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    AppButtonLink,
    Card,
    DatePipe,
    FormField,
    Input,
    PageHeader,
    ReferenceCombobox,
    RouterLink,
  ],
  templateUrl: './walk-in.html',
  styleUrl: './walk-in.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultationWalkIn {
  private readonly scheduling = inject(SchedulingClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly auth = inject(AuthService);
  private readonly navigation = inject(NavigationService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly rutaDeVuelta = CONSULTATION_ROUTE;
  protected readonly rutaDePublicar = AGENDA_CREATE_ROUTE;

  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => {
    const base = this.navigation.breadcrumbs();
    const ultimo = base.at(-1);
    if (ultimo === undefined) {
      return [];
    }
    return [
      ...base.slice(0, -1),
      { label: ultimo.label, routerLink: this.rutaDeVuelta },
      { label: 'Atender sin turno' },
    ];
  });

  /* ---- fase 1 · el paciente ------------------------------------------------ */

  protected readonly paciente = signal<ReferenceOption | null>(null);
  protected readonly candidatos = signal<readonly ReferenceOption[]>([]);
  protected readonly buscando = signal(false);
  /** El buscador respondió 403: al médico no le muestran el padrón. */
  protected readonly buscadorVedado = signal(false);
  /** Lo tecleado en «pegar el identificador». */
  protected readonly identificador = signal('');

  /* ---- fase 2 · el consultorio ---------------------------------------------- */

  protected readonly consultorios = signal<ViewState<readonly AgendaResource[]>>(loading());
  protected readonly consultorio = signal<AgendaResource | null>(null);
  protected readonly listaDeConsultorios = computed<readonly AgendaResource[]>(() => {
    const estado = this.consultorios();
    return estado.status === 'ready' ? estado.data : [];
  });
  /** La fase «consultorio» sólo existe si hay más de uno entre los que elegir. */
  protected readonly hayQueElegirConsultorio = computed(
    () => this.listaDeConsultorios().length > 1,
  );
  /** Sin recurso propio no hay cupos que ofrecer: la salida es publicar agenda. */
  protected readonly sinAgenda = computed(
    () => this.consultorios().status === 'ready' && this.listaDeConsultorios().length === 0,
  );

  /* ---- fase 3 · el horario --------------------------------------------------- */

  protected readonly cupos = signal<ViewState<readonly AgendaSlot[]>>(ready([]));
  protected readonly cupo = signal<AgendaSlot | null>(null);
  protected readonly dias = computed<readonly DiaConCupos[]>(() => {
    const estado = this.cupos();
    return estado.status === 'ready' ? agruparPorDia(estado.data) : [];
  });

  /* ---- el recorrido ---------------------------------------------------------- */

  protected readonly fase = signal<Fase>('paciente');
  /** Las fases que se recorren de verdad, para el indicador de arriba. */
  protected readonly fases = computed<readonly { readonly id: Fase; readonly label: string }[]>(
    () => [
      { id: 'paciente', label: 'Paciente' },
      ...(this.hayQueElegirConsultorio()
        ? [{ id: 'consultorio' as const, label: 'Consultorio' }]
        : []),
      { id: 'horario', label: 'Horario' },
    ],
  );
  protected readonly numeroDeFase = computed(
    () => this.fases().findIndex((f) => f.id === this.fase()) + 1,
  );

  private readonly intentado = signal(false);
  protected readonly pacienteFaltante = computed(
    () => this.intentado() && this.paciente() === null && this.identificador().trim() === '',
  );
  /** Cómo se llama a quien se va a atender, para el resumen de la última fase. */
  protected readonly nombreDelPaciente = computed(() => this.perfilElegido()?.nombre ?? '');

  protected readonly envio = signal<ViewState<null>>(ready(null));
  protected readonly enviando = computed(() => this.envio().status === 'loading');
  protected readonly errorDeEnvio = computed<string | null>(() => {
    const estado = this.envio();
    if (estado.status === 'validation') {
      return estado.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (estado.status === 'forbidden') {
      return estado.message ?? 'Tu rol no puede reservar turnos.';
    }
    if (estado.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (estado.status === 'error') {
      return `${estado.message || 'Ocurrió un error inesperado.'} (${estado.requestId})`;
    }
    return null;
  });

  constructor() {
    this.cargarConsultorios();
  }

  /* ---- fase 1 ---------------------------------------------------------------- */

  protected buscarPaciente(texto: string): void {
    if (texto === '') {
      this.candidatos.set([]);
      return;
    }
    this.buscando.set(true);
    this.profiles.searchPatients({ query: texto, limit: CANDIDATOS_POR_BUSQUEDA }).subscribe({
      next: (pagina) => {
        this.candidatos.set(
          pagina.items.map((p) => ({
            value: p.profileId,
            label: p.displayName ?? `Sin nombre · ${p.patientCode}`,
            hint: p.patientCode,
          })),
        );
        this.buscando.set(false);
      },
      error: (error: unknown) => {
        // `GET /profiles/patients` pide SECURITY_ADMIN: a un médico le contesta
        // 403. No es un error de la pantalla, es que su camino es el otro campo.
        this.buscadorVedado.set(errorToViewState<null>(error).status === 'forbidden');
        this.candidatos.set([]);
        this.buscando.set(false);
      },
    });
  }

  protected fijarIdentificador(valor: string | number | null): void {
    this.identificador.set(valor === null ? '' : String(valor));
  }

  /** El perfil elegido, venga del buscador o del identificador pegado. */
  private perfilElegido(): { readonly id: string; readonly nombre: string } | null {
    const elegido = this.paciente();
    if (elegido !== null) {
      return { id: elegido.value, nombre: elegido.label };
    }
    const id = this.identificador().trim();
    return id === '' ? null : { id, nombre: 'Paciente' };
  }

  protected confirmarPaciente(): void {
    this.intentado.set(true);
    if (this.perfilElegido() === null) {
      return;
    }
    this.intentado.set(false);
    if (this.hayQueElegirConsultorio()) {
      this.fase.set('consultorio');
      return;
    }
    this.irAlHorario();
  }

  /* ---- fase 2 ---------------------------------------------------------------- */

  private cargarConsultorios(): void {
    const perfil = this.auth.practitionerProfileId();
    const tenantId = this.auth.activeTenantId();
    if (perfil === null || tenantId === null) {
      this.consultorios.set(ready([]));
      return;
    }
    this.consultorios.set(loading());
    this.scheduling.listResources({ tenantId }).subscribe({
      next: (pagina) => {
        const mios = pagina.items.filter((r) => r.resourceRefId === perfil);
        this.consultorios.set(ready(mios));
        // Con uno solo no se pregunta: se elige por el médico.
        this.consultorio.set(mios.length === 1 ? mios[0] : null);
      },
      error: (error: unknown) =>
        this.consultorios.set(errorToViewState<readonly AgendaResource[]>(error)),
    });
  }

  protected elegirConsultorio(recurso: AgendaResource): void {
    this.consultorio.set(recurso);
  }

  protected confirmarConsultorio(): void {
    if (this.consultorio() === null) {
      return;
    }
    this.irAlHorario();
  }

  /** Cómo se nombra un consultorio: la sede si la tiene, el recurso si no. */
  protected nombreDe(recurso: AgendaResource): string {
    return recurso.site?.name ?? recurso.name;
  }

  /* ---- fase 3 ---------------------------------------------------------------- */

  private irAlHorario(): void {
    this.fase.set('horario');
    this.cargarCupos();
  }

  protected cargarCupos(): void {
    const recurso = this.consultorio();
    if (recurso === null) {
      this.cupos.set(ready([]));
      return;
    }
    const desde = new Date();
    const hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + DIAS_HACIA_ADELANTE);
    this.cupo.set(null);
    this.cupos.set(loading());
    this.scheduling
      .listSlots({
        resourceId: recurso.id,
        from: desde,
        to: hasta,
        onlyAvailable: true,
        limit: MAX_CUPOS,
      })
      .subscribe({
        next: (pagina) =>
          this.cupos.set(
            ready(
              [...pagina.items]
                .filter((s) => s.remainingCapacity > 0)
                .sort((a, b) => a.startAt.getTime() - b.startAt.getTime()),
            ),
          ),
        error: (error: unknown) => this.cupos.set(errorToViewState<readonly AgendaSlot[]>(error)),
      });
  }

  protected elegirCupo(cupo: AgendaSlot): void {
    this.cupo.set(cupo);
  }

  /**
   * Retiene el cupo, lo confirma a nombre del paciente y abre su consulta.
   *
   * Tres llamadas encadenadas y no una: es el contrato de la agenda
   * (hold → confirm), y la tercera —releer la reserva— es para llevarse el
   * `appointmentId`, que es lo que el expediente usa para atar el encuentro al
   * turno. Sin él la consulta se abre igual, sólo que suelta.
   */
  protected atender(): void {
    const paciente = this.perfilElegido();
    const cupo = this.cupo();
    const tenantId = this.auth.activeTenantId();
    if (this.enviando() || paciente === null || cupo === null || tenantId === null) {
      return;
    }
    this.envio.set(loading());
    this.scheduling
      .placeHold(cupo.id, { patientProfileId: paciente.id })
      .pipe(
        switchMap((retencion) =>
          this.scheduling.confirmHold(retencion.holdToken, {
            tenantId,
            patientProfileId: paciente.id,
            channel: 'DESK',
          }),
        ),
        switchMap((confirmada) => this.scheduling.getBooking(confirmada.id)),
      )
      .subscribe({
        next: (reserva) => {
          this.envio.set(ready(null));
          this.toast.success(
            `El turno de ${paciente.nombre} quedó en tu agenda.`,
            'Turno reservado',
          );
          const params: Record<string, string> = {};
          if (reserva.reasonText !== undefined) {
            params[MOTIVO_QUERY_PARAM] = reserva.reasonText;
          }
          if (reserva.appointmentId !== undefined && reserva.appointmentId !== null) {
            params[CITA_QUERY_PARAM] = reserva.appointmentId;
          }
          void this.router.navigate([patientChartRoute(encodeURIComponent(paciente.id))], {
            queryParams: params,
          });
        },
        error: (error: unknown) => {
          const estado = errorToViewState<null>(error);
          if (estado.status === 'validation' || estado.status === 'not-found') {
            // Alguien tomó el cupo entre que se listó y se retuvo: se relee la
            // lista y se pide elegir otro, en vez de mostrar un 404 críptico.
            this.envio.set(ready(null));
            this.toast.warning('Ese horario ya no está libre. Elegí otro.', 'Cupo tomado');
            this.cargarCupos();
            return;
          }
          this.envio.set(estado);
        },
      });
  }

  /* ---- navegación entre fases ------------------------------------------------- */

  protected volver(): void {
    const actual = this.fase();
    if (actual === 'horario') {
      this.fase.set(this.hayQueElegirConsultorio() ? 'consultorio' : 'paciente');
      return;
    }
    if (actual === 'consultorio') {
      this.fase.set('paciente');
      return;
    }
    void this.router.navigateByUrl(this.rutaDeVuelta);
  }
}

/** Agrupa los cupos por día calendario, en el orden en que vienen. */
export function agruparPorDia(cupos: readonly AgendaSlot[]): readonly DiaConCupos[] {
  const porDia = new Map<string, { fecha: Date; cupos: AgendaSlot[] }>();
  for (const cupo of cupos) {
    const fecha = new Date(cupo.startAt);
    fecha.setHours(0, 0, 0, 0);
    const clave = fecha.toISOString();
    const dia = porDia.get(clave);
    if (dia === undefined) {
      porDia.set(clave, { fecha, cupos: [cupo] });
    } else {
      dia.cupos.push(cupo);
    }
  }
  return [...porDia].map(([clave, dia]) => ({ clave, fecha: dia.fecha, cupos: dia.cupos }));
}

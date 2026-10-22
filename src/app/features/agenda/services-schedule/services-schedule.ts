import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  output,
  signal,
  untracked,
  type TemplateRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type {
  AgendaResource,
  Booking,
  PublishedRule,
  PublishedTemplate,
  ServiceOffering,
} from '../../../core/data-access/scheduling/scheduling.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { withDisplayCurrency } from '../../../core/money/display-currency';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { AGENDA_CREATE_ROUTE, AGENDA_ROUTE } from '../agenda.routes';
import { toBookingStatusPresentation, type BookingStatusPresentation } from '../booking-status';
import { awaitsResponse, loadServiceBookings, SERVICE_BOOKINGS_WEEKS } from './service-bookings';
import { ScheduleGrid } from '../my-agenda/schedule-grid/schedule-grid';

/** Donde se marca qué atiende cada franja: la columna «Atiendo» del horario. */
export const SCHEDULE_EDIT_ROUTE = `${AGENDA_ROUTE}/edit`;

/** Las franjas de otros servicios de una sede, listas para la grilla. */
export interface ServicesSite {
  readonly resource: AgendaResource;
  /** Sólo `SERVICES` y `MIXED`, de todas las plantillas vigentes de la sede. */
  readonly rules: readonly PublishedRule[];
  /** Los nombres de las plantillas que aportan esas franjas, para el globo. */
  readonly templateNames: string | null;
}

const NO_RESOURCE = empty(
  { label: 'Publicar mi agenda', route: AGENDA_CREATE_ROUTE },
  'Todavía no publicó su horario. Primero publíquelo; después marca qué franjas son para otros servicios.',
);

const NO_SERVICE_HOURS = empty(
  { label: 'Cambiar mi horario', route: SCHEDULE_EDIT_ROUTE },
  'Todavía no declaró horarios para otros servicios. En «Cambiar mi horario», elija «Servicios» o «Ambos» en la columna «Atiendo» de cada franja.',
);

/** Si la franja admite servicios: `SERVICES` o `MIXED`. Sin modo es sólo consultas. */
export function admitsServices(rule: PublishedRule): boolean {
  return rule.bookingMode === 'SERVICES' || rule.bookingMode === 'MIXED';
}

/**
 * Las franjas de otros servicios de una sede, juntando **todas** sus plantillas
 * vigentes.
 *
 * Una sede puede tener más de una plantilla publicada a la vez —en la maqueta,
 * «Mañanas en la clínica» y «Estudios en la clínica»—, y «Mis horarios» sólo
 * dibuja la primera. Si esta pestaña hiciera lo mismo, las tardes de estudios
 * no aparecerían en ninguna pantalla, que es exactamente lo que el propietario
 * reclamaba. Cada regla se lleva el tamaño de turno de su plantilla, porque la
 * grilla recibe uno solo y aquí se mezclan varias.
 */
export function servicesRulesOf(templates: readonly PublishedTemplate[]): {
  readonly rules: readonly PublishedRule[];
  readonly templateNames: string | null;
} {
  const live = templates.filter((t) => !t.retired);
  const rules: PublishedRule[] = [];
  const names: string[] = [];
  for (const template of live) {
    const own = template.rules.filter(admitsServices);
    if (own.length === 0) continue;
    names.push(template.name);
    for (const rule of own) {
      rules.push(
        rule.slotMinutes === undefined && template.slotMinutes !== undefined
          ? { ...rule, slotMinutes: template.slotMinutes }
          : rule,
      );
    }
  }
  return { rules, templateNames: names.length > 0 ? names.join(' · ') : null };
}

/**
 * **Horarios de otros servicios** — la pestaña de `/schedule` que separa los
 * horarios de estudios, procedimientos y demás servicios de los de consulta.
 *
 * ## Qué no hace
 *
 * No edita: el horario de cada servicio se marca en «Cambiar mi horario»
 * (columna «Atiendo»), que ya existe y es la única fuente. Esta pestaña lo
 * muestra junto con los servicios que se ofrecen en esas franjas.
 */
@Component({
  selector: 'app-services-schedule',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Card,
    DatePipe,
    NgTemplateOutlet,
    RouterLink,
    ScheduleGrid,
    StatusSeal,
    ViewStateHost,
  ],
  templateUrl: './services-schedule.html',
  styleUrl: './services-schedule.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesSchedule implements OnInit {
  private readonly scheduling = inject(SchedulingClient);
  private readonly auth = inject(AuthService);

  private readonly terminology = inject(TerminologyClient);

  /**
   * Las acciones de cada reserva (aceptar, rechazar, mover, cancelar…), dibujadas
   * por `/schedule`. Es la MISMA plantilla que usa el calendario: una solicitud
   * de servicio se gestiona igual que una de consulta, y no hay una segunda
   * copia de esas reglas que se desfase.
   */
  readonly appointmentActions = input<TemplateRef<{
    $implicit: Booking;
    inline?: boolean;
  }> | null>(null);

  /** Cambia cuando `/schedule` operó una reserva: hay que releer la lista. */
  readonly reloadToken = input(0);

  /**
   * Las etiquetas de estado que se resolvieron acá. `/schedule` las necesita
   * para decidir qué acciones ofrece cada fila: sólo conoce las de la ventana
   * que está mirando, y una solicitud del jueves que viene no está en ella.
   */
  readonly statusLabels = output<ConceptLabels>();

  /** Cuántas solicitudes esperan respuesta, para el número de la pestaña. */
  readonly pendingCount = output<number>();

  protected readonly weeks = SERVICE_BOOKINGS_WEEKS;
  protected readonly editRoute = SCHEDULE_EDIT_ROUTE;

  protected readonly bookings = signal<ViewState<readonly Booking[]>>(loading());
  private readonly labels = signal<ConceptLabels>(new Map());

  /** Las que esperan que aceptes o rechaces, primero: son las que tienen apuro. */
  protected readonly awaiting = computed<readonly Booking[]>(() => {
    const b = this.bookings();
    return b.status === 'ready' ? b.data.filter((x) => awaitsResponse(x, this.labels())) : [];
  });

  /** El resto: confirmadas o en curso, en orden de fecha. */
  protected readonly upcoming = computed<readonly Booking[]>(() => {
    const b = this.bookings();
    return b.status === 'ready' ? b.data.filter((x) => !awaitsResponse(x, this.labels())) : [];
  });

  private readonly reloadOnAction = effect(() => {
    if (this.reloadToken() === 0) return;
    untracked(() => this.loadBookings());
  });

  protected readonly state = signal<ViewState<readonly ServicesSite[]>>(loading());
  protected readonly offerings = signal<ViewState<readonly ServiceOffering[]>>(loading());

  /** Sólo las sedes que tienen alguna franja de servicios. */
  protected readonly sites = computed<readonly ServicesSite[]>(() => {
    const s = this.state();
    return s.status === 'ready' || s.status === 'stale' ? s.data : [];
  });

  protected readonly activeOfferings = computed<readonly ServiceOffering[]>(() => {
    const o = this.offerings();
    return o.status === 'ready' ? o.data.filter((x) => x.isActive) : [];
  });

  ngOnInit(): void {
    this.load();
    this.loadBookings();
  }

  protected loadBookings(): void {
    const profileId = this.auth.practitionerProfileId();
    const tenantId = this.auth.activeTenantId();
    if (profileId === null || tenantId === null) {
      this.bookings.set(ready([]));
      return;
    }
    this.bookings.set(loading());
    loadServiceBookings(this.scheduling, this.terminology, tenantId, profileId).subscribe({
      next: ({ bookings, labels }) => {
        // Primero las etiquetas, después la lista: así, cuando la fila pide sus
        // acciones a `/schedule`, éste ya sabe en qué estado está cada reserva.
        this.statusLabels.emit(labels);
        this.labels.set(labels);
        this.bookings.set(ready(bookings));
        this.pendingCount.emit(bookings.filter((b) => awaitsResponse(b, labels)).length);
      },
      error: (error: unknown) => this.bookings.set(errorToViewState<readonly Booking[]>(error)),
    });
  }

  protected statusOf(booking: Booking): BookingStatusPresentation {
    return toBookingStatusPresentation(this.labels().get(booking.statusConceptId), 'Sin dato');
  }

  /** «Ecografía abdominal · 250,00 Bs», o sólo el nombre si no hay precio. */
  protected serviceLine(booking: Booking): string {
    const service = booking.service;
    if (service === undefined || service === null) return 'Servicio';
    return service.price ? `${service.name} · ${withDisplayCurrency(service.price)}` : service.name;
  }

  /**
   * El motivo que escribió el paciente, si dice algo más que el servicio.
   * Repetir «Holter de 24 horas» debajo de «Holter de 24 horas» no informa.
   */
  protected reasonOf(booking: Booking): string | null {
    const reason = booking.reasonText?.trim();
    if (!reason) return null;
    return reason.toLocaleLowerCase('es') === booking.service?.name.toLocaleLowerCase('es') ? null : reason;
  }

  protected siteOf(booking: Booking): string | null {
    const s = this.state();
    if (s.status !== 'ready' && s.status !== 'stale') return null;
    const site = s.data.find((x) => x.resource.id === booking.resourceId);
    return site === undefined ? null : this.siteName(site);
  }

  protected load(): void {
    const profileId = this.auth.practitionerProfileId();
    const tenantId = this.auth.activeTenantId();
    if (profileId === null || tenantId === null) {
      this.state.set(NO_RESOURCE);
      this.offerings.set(ready([]));
      return;
    }
    this.loadOfferings(profileId);
    this.state.set(loading());
    // El recurso se busca por el perfil, igual que «Mis horarios» (es el
    // criterio con que el backend decide si la agenda es propia). A diferencia
    // de allá, se toman TODAS las sedes: los estudios suelen ser en una sola.
    this.scheduling.listResources({ tenantId }).subscribe({
      next: (page) => {
        const own = page.items.filter((r) => r.resourceRefId === profileId);
        if (own.length === 0) {
          this.state.set(NO_RESOURCE);
          return;
        }
        forkJoin(own.map((r) => this.scheduling.listTemplates(r.id))).subscribe({
          next: (pages) => {
            const sites = own
              .map((resource, i) => ({ resource, ...servicesRulesOf(pages[i]?.items ?? []) }))
              .filter((site) => site.rules.length > 0);
            this.state.set(sites.length === 0 ? NO_SERVICE_HOURS : ready(sites));
          },
          error: (error: unknown) =>
            this.state.set(errorToViewState<readonly ServicesSite[]>(error)),
        });
      },
      error: (error: unknown) => this.state.set(errorToViewState<readonly ServicesSite[]>(error)),
    });
  }

  protected reloadOfferings(): void {
    const profileId = this.auth.practitionerProfileId();
    if (profileId !== null) this.loadOfferings(profileId);
  }

  /** «30–45 min», o «20 min» cuando el mínimo y el máximo coinciden. */
  protected duration(offering: ServiceOffering): string {
    return offering.minDurationMinutes === offering.maxDurationMinutes
      ? `${offering.maxDurationMinutes} min`
      : `${offering.minDurationMinutes}–${offering.maxDurationMinutes} min`;
  }

  protected price(offering: ServiceOffering): string {
    return withDisplayCurrency(offering.price);
  }

  protected siteName(site: ServicesSite): string {
    return site.resource.site?.name ?? site.resource.name;
  }

  private loadOfferings(profileId: string): void {
    this.offerings.set(loading());
    this.scheduling.listServiceOfferings(profileId).subscribe({
      next: (list) => this.offerings.set(ready(list)),
      error: (error: unknown) =>
        this.offerings.set(errorToViewState<readonly ServiceOffering[]>(error)),
    });
  }
}

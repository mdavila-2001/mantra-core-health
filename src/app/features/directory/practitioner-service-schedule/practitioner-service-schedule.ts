import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type {
  AgendaResource,
  ServiceOffering,
  ServiceStart,
} from '../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { withDisplayCurrency } from '../../../core/money/display-currency';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Card } from '../../../shared/components/molecules/card/card';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import {
  reservaDelPortalRoute,
  SERVICE_BOOKING_SLOT,
} from '../../account/appointments/appointments.routes';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Las mismas dos semanas hacia adelante que la pestaña de consultas. */
const WEEKS_AHEAD = 2;

/** Tope de inicios por sede y semana: más no se lee en un teléfono. */
const MAX_STARTS_PER_SITE = 40;

/** Las tablas cuyo id es un perfil profesional (igual que la disponibilidad). */
const PRACTITIONER_PROFILE_TABLES: readonly string[] = [
  'practitioner_profiles',
  'health_practitioner_profiles',
];

/** Los inicios posibles de un servicio en una sede, para la semana visible. */
export interface SiteServiceStarts {
  readonly resource: AgendaResource;
  readonly starts: ViewState<readonly ServiceStart[]>;
}

/**
 * **Otros servicios** — la pestaña de «Sedes y horarios» en la ficha de un
 * profesional que muestra cuándo se puede pedir cada estudio o procedimiento.
 *
 * ## Por qué existe
 *
 * El propietario pidió los horarios de otros servicios en una pestaña propia,
 * también del lado del paciente. Hasta acá, el paciente sólo veía esos
 * horarios si entraba a «Agendar una cita» y elegía el servicio en una lista;
 * en la ficha no aparecían.
 *
 * ## Qué hace
 *
 * Elegido un servicio, pide `GET /scheduling/service-availability` sede por
 * sede para la semana visible y dibuja cada inicio posible como un botón. El
 * botón lleva a la confirmación de reserva con el mismo contrato que usa
 * «Agendar una cita» para un servicio (`recurso`, `desde`, `hasta`, `oferta`).
 */
@Component({
  selector: 'app-practitioner-service-schedule',
  imports: [
    AppButton,
    AppButtonLink,
    Card,
    DatePipe,
    EmptyState,
    FormField,
    RouterLink,
    Select,
    ViewStateHost,
  ],
  templateUrl: './practitioner-service-schedule.html',
  styleUrl: './practitioner-service-schedule.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerServiceSchedule {
  private readonly scheduling = inject(SchedulingClient);
  private readonly auth = inject(AuthService);

  readonly practitionerProfileId = input.required<string>();
  readonly tenantId = input.required<string | null>();

  protected readonly hasSession = computed(() => this.auth.isAuthenticated());

  protected readonly offerings = signal<ViewState<readonly ServiceOffering[]>>(loading());
  protected readonly selectedOfferingId = signal<string | null>(null);
  protected readonly week = signal(0);
  protected readonly sites = signal<ViewState<readonly SiteServiceStarts[]>>(loading());

  protected readonly bookable = computed<readonly ServiceOffering[]>(() => {
    const o = this.offerings();
    return o.status === 'ready' ? o.data.filter((x) => x.isActive && x.isPatientBookable) : [];
  });

  protected readonly offeringOptions = computed<readonly SelectOption<string>[]>(() =>
    this.bookable().map((o) => ({ value: o.id, label: `${o.serviceName} · ${this.duration(o)}` })),
  );

  protected readonly selected = computed<ServiceOffering | null>(
    () => this.bookable().find((o) => o.id === this.selectedOfferingId()) ?? null,
  );

  /** Lunes de la semana visible, a medianoche. */
  protected readonly from = computed(() => {
    const today = new Date();
    const monday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - ((today.getDay() + 6) % 7),
    );
    return new Date(monday.getTime() + this.week() * 7 * ONE_DAY_MS);
  });

  protected readonly to = computed(() => new Date(this.from().getTime() + 7 * ONE_DAY_MS));
  protected readonly canGoBack = computed(() => this.week() > 0);
  protected readonly canGoForward = computed(() => this.week() < WEEKS_AHEAD);

  protected readonly siteList = computed<readonly SiteServiceStarts[]>(() => {
    const s = this.sites();
    return s.status === 'ready' ? s.data : [];
  });

  /** Lecturas en vuelo de una semana o servicio anterior no pisan la actual. */
  private currentLoad = 0;

  constructor() {
    effect(() => {
      const profileId = this.practitionerProfileId();
      if (profileId === '' || !this.hasSession()) return;
      untracked(() => this.loadOfferings(profileId));
    });

    effect(() => {
      const offering = this.selected();
      const tenantId = this.tenantId();
      const from = this.from();
      const to = this.to();
      if (offering === null || tenantId === null) return;
      untracked(() => this.loadStarts(offering, tenantId, from, to));
    });
  }

  protected chooseOffering(id: string | null): void {
    this.selectedOfferingId.set(id);
  }

  protected goBack(): void {
    if (this.canGoBack()) this.week.update((n) => n - 1);
  }

  protected goForward(): void {
    if (this.canGoForward()) this.week.update((n) => n + 1);
  }

  protected retryOfferings(): void {
    const profileId = this.practitionerProfileId();
    if (profileId !== '') this.loadOfferings(profileId);
  }

  protected retryStarts(): void {
    const offering = this.selected();
    const tenantId = this.tenantId();
    if (offering !== null && tenantId !== null) {
      this.loadStarts(offering, tenantId, this.from(), this.to());
    }
  }

  protected duration(offering: ServiceOffering): string {
    return offering.minDurationMinutes === offering.maxDurationMinutes
      ? `${offering.maxDurationMinutes} min`
      : `${offering.minDurationMinutes}–${offering.maxDurationMinutes} min`;
  }

  protected price(offering: ServiceOffering): string {
    return withDisplayCurrency(offering.price);
  }

  protected siteName(resource: AgendaResource): string {
    return resource.site?.name ?? resource.name;
  }

  protected readonly bookingPath = reservaDelPortalRoute(SERVICE_BOOKING_SLOT);

  /** El mismo contrato que `paramsDeReserva` de «Agendar una cita». */
  protected bookingParams(start: ServiceStart, offering: ServiceOffering): Record<string, string> {
    return {
      recurso: start.resourceId,
      desde: start.startAt.toISOString(),
      hasta: start.endAtMax.toISOString(),
      oferta: offering.id,
    };
  }

  private loadOfferings(profileId: string): void {
    this.offerings.set(loading());
    this.scheduling.listServiceOfferings(profileId).subscribe({
      next: (list) => {
        this.offerings.set(ready(list));
        const first = list.find((o) => o.isActive && o.isPatientBookable);
        if (this.selectedOfferingId() === null && first !== undefined) {
          this.selectedOfferingId.set(first.id);
        }
      },
      error: (error: unknown) =>
        this.offerings.set(errorToViewState<readonly ServiceOffering[]>(error)),
    });
  }

  private loadStarts(offering: ServiceOffering, tenantId: string, from: Date, to: Date): void {
    const load = ++this.currentLoad;
    const profileId = this.practitionerProfileId();
    // No se piden inicios en el pasado: la semana en curso arranca ahora.
    const start = new Date(Math.max(from.getTime(), Date.now()));
    this.sites.set(loading());
    this.scheduling.listResources({ tenantId }).subscribe({
      next: (page) => {
        if (load !== this.currentLoad) return;
        const own = page.items.filter(
          (r) => PRACTITIONER_PROFILE_TABLES.includes(r.resourceRefType) && r.resourceRefId === profileId,
        );
        if (own.length === 0) {
          this.sites.set(ready([]));
          return;
        }
        forkJoin(
          own.map((resource) =>
            this.scheduling
              .getServiceAvailability({ offeringId: offering.id, resourceId: resource.id, from: start, to })
              .pipe(
                map(
                  (availability): SiteServiceStarts => ({
                    resource,
                    starts: ready(availability.items.slice(0, MAX_STARTS_PER_SITE)),
                  }),
                ),
                // Una sede que falla no esconde a la otra: queda con su propio error.
                catchError((error: unknown) =>
                  of<SiteServiceStarts>({
                    resource,
                    starts: errorToViewState<readonly ServiceStart[]>(error),
                  }),
                ),
              ),
          ),
        ).subscribe((list) => {
          if (load === this.currentLoad) this.sites.set(ready(list));
        });
      },
      error: (error: unknown) => {
        if (load === this.currentLoad) {
          this.sites.set(errorToViewState<readonly SiteServiceStarts[]>(error));
        }
      },
    });
  }
}

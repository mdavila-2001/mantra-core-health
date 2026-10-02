import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type {
  AgendaResource,
  PublishedRule,
  PublishedTemplate,
  ServiceOffering,
} from '../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { withDisplayCurrency } from '../../../core/money/display-currency';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { AGENDA_CREATE_ROUTE, AGENDA_ROUTE } from '../agenda.routes';
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
  'Todavía no publicaste tu horario. Primero publicalo; después marcás qué franjas son para otros servicios.',
);

const NO_SERVICE_HOURS = empty(
  { label: 'Cambiar mi horario', route: SCHEDULE_EDIT_ROUTE },
  'Todavía no declaraste horarios para otros servicios. En «Cambiar mi horario», elegí «Servicios» o «Ambos» en la columna «Atiendo» de cada franja.',
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
  imports: [Alert, AppButton, AppButtonLink, Card, RouterLink, ScheduleGrid, ViewStateHost],
  templateUrl: './services-schedule.html',
  styleUrl: './services-schedule.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesSchedule implements OnInit {
  private readonly scheduling = inject(SchedulingClient);
  private readonly auth = inject(AuthService);

  protected readonly editRoute = SCHEDULE_EDIT_ROUTE;

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

import { inject, Injectable, signal } from '@angular/core';
import { catchError, concatMap, from, map, of, type Observable, filter, take, defaultIfEmpty } from 'rxjs';

import { errorToViewState } from '../../http/error-to-view-state';
import { empty, loading, ready } from '../../view-state/view-state';
import type { ViewState } from '../../view-state/view-state.types';
import { MedicalOrganizationClient } from '../medical-organization/medical-organization.client';
import type {
  MedicalOrganizationConsole,
  OrganizationSite,
  OrganizationStaffMember,
} from '../medical-organization/medical-organization.types';

/** Lo que las pantallas de F4/F5 necesitan saber de la organización activa. */
export interface SiteContext {
  readonly practiceId: string;
  readonly practiceName: string;
  readonly sites: readonly OrganizationSite[];
  readonly staff: readonly OrganizationStaffMember[];
}

/**
 * La organización activa y sus establecimientos, leídos **una vez** por sesión.
 *
 * Las pantallas de quirófano, tarifas y equipos trabajan siempre sobre una sede
 * (`/sites/:siteId/...`), y la sede sale de la consola de la organización (F0),
 * no de un id escrito: un id fijo en la pantalla dejaría de existir el día que
 * se reorganice el establecimiento. Se toma la primera práctica del tenant que
 * tenga sedes; las demás —los centros médicos del directorio— no tienen árbol.
 *
 * No autoriza nada: si la API niega la consola, el estado lo dice (S5) y la
 * pantalla no pide más datos.
 */
@Injectable({ providedIn: 'root' })
export class SiteContextStore {
  private readonly organizations = inject(MedicalOrganizationClient);

  private readonly stateSignal = signal<ViewState<SiteContext>>(loading());
  private requested = false;

  readonly state = this.stateSignal.asReadonly();

  /** Lee el contexto si todavía no se leyó. Idempotente. */
  ensure(): void {
    if (this.requested) return;
    this.reload();
  }

  /** Vuelve a leer (reintento de S8/S9 o cambio de organización). */
  reload(): void {
    this.requested = true;
    this.stateSignal.set(loading());
    this.organizations
      .listPractices()
      .pipe(concatMap((practices) => firstWithSites(practices.map((p) => p.id), (id) => this.organizations.getConsole(id))))
      .subscribe({
        next: (console) => {
          if (console === null) {
            this.stateSignal.set(
              empty(
                { label: 'Ir a la organización médica', route: '/administration/medical-organization' },
                'Su organización todavía no tiene establecimientos registrados.',
              ),
            );
            return;
          }
          this.stateSignal.set(
            ready({
              practiceId: console.organization.id,
              practiceName: console.organization.name,
              sites: console.sites,
              staff: console.staff,
            }),
          );
        },
        error: (error: unknown) => this.stateSignal.set(errorToViewState<SiteContext>(error)),
      });
  }
}

/** La primera consola con sedes; las que fallan (centros sin árbol) se saltean. */
function firstWithSites(
  ids: readonly string[],
  read: (id: string) => Observable<MedicalOrganizationConsole>,
): Observable<MedicalOrganizationConsole | null> {
  return from(ids).pipe(
    concatMap((id) => read(id).pipe(catchError(() => of(null)))),
    filter((console): console is MedicalOrganizationConsole => console !== null && console.sites.length > 0),
    take(1),
    map((console): MedicalOrganizationConsole | null => console),
    defaultIfEmpty(null),
  );
}

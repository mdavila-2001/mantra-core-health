import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, of } from 'rxjs';

import { SessionStore } from '../../core/auth/session.store';
import { InfrastructureOpsClient } from '../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import type { AccessSite, InfraAction, InfrastructureAccess } from '../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { dataOf, ready, routeAuthPending } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';

/**
 * Qué puede hacer la persona en cada establecimiento, **según la API**
 * (`GET /practice/infrastructure-access/me`).
 *
 * Es el S1 de las pantallas de internación: mientras no se sabe, no se piden
 * datos de pacientes. Lo que devuelve sirve para **no ofrecer** puertas que la
 * API va a cerrar; no es una barrera: la API vuelve a decidir en cada petición.
 */
@Injectable({ providedIn: 'root' })
export class InpatientAccessStore {
  private readonly client = inject(InfrastructureOpsClient);
  private readonly session = inject(SessionStore);

  private readonly estado = signal<ViewState<InfrastructureAccess>>(routeAuthPending());
  private cargadoPara: string | null = null;

  readonly state = this.estado.asReadonly();
  readonly sites = computed<readonly AccessSite[]>(() => dataOf(this.estado())?.sites ?? []);

  /** Pide el acceso una vez por persona y organización activas. */
  ensure(): void {
    const clave = `${this.session.userId() ?? ''}|${this.session.activeTenantId() ?? ''}`;
    if (this.cargadoPara === clave && this.estado().status === 'ready') return;
    this.cargadoPara = clave;
    this.estado.set(routeAuthPending());
    this.client
      .getAccess()
      .pipe(
        map((a) => ready(a) as ViewState<InfrastructureAccess>),
        catchError((e: unknown) => of(errorToViewState<InfrastructureAccess>(e))),
      )
      .subscribe((s) => this.estado.set(s));
  }

  /** Vuelve a preguntar (por ejemplo, después de un 403 inesperado). */
  reload(): void {
    this.cargadoPara = null;
    this.ensure();
  }

  site(siteId: string | null): AccessSite | null {
    return this.sites().find((s) => s.siteId === siteId) ?? null;
  }

  /** La sede de la URL si la persona tiene rol ahí; si no, la primera donde lo tiene. */
  pickSite(requested: string | null, action: InfraAction): AccessSite | null {
    const allowed = this.sites().filter((s) => s.actions.includes(action));
    return allowed.find((s) => s.siteId === requested) ?? allowed[0] ?? null;
  }

  can(siteId: string | null, action: InfraAction): boolean {
    return this.site(siteId)?.actions.includes(action) ?? false;
  }
}

import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, distinctUntilChanged, filter, map, of, startWith, switchMap } from 'rxjs';

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
 *
 * ## Reacciona a la sesión (M5)
 *
 * La clave es `userId|activeTenantId`. Si cambia la persona o la organización
 * activa, el acceso anterior se descarta (vuelve a S1) y la petición en vuelo
 * se **cancela** (`switchMap`): nunca queda pintado el acceso de otra cuenta.
 */
@Injectable({ providedIn: 'root' })
export class InpatientAccessStore {
  private readonly client = inject(InfrastructureOpsClient);
  private readonly session = inject(SessionStore);

  private readonly estado = signal<ViewState<InfrastructureAccess>>(routeAuthPending());
  /** `null` hasta que una pantalla lo pide: el store no consulta por su cuenta. */
  private readonly pedido = signal(false);
  private readonly recargas = signal(0);

  /** La clave de la sesión a la que corresponde el acceso. */
  readonly key = computed(() => `${this.session.userId() ?? ''}|${this.session.activeTenantId() ?? ''}`);
  readonly state = this.estado.asReadonly();
  readonly sites = computed<readonly AccessSite[]>(() => dataOf(this.estado())?.sites ?? []);
  /** Las pantallas de internación existen sólo en un hospital (`onlyForTenantTypes`). */
  readonly isHospital = computed(() => this.session.activeTenantType() === 'HOSPITAL');

  constructor() {
    toObservable(computed(() => ({ key: this.key(), on: this.pedido(), n: this.recargas() })))
      .pipe(
        filter((x) => x.on),
        distinctUntilChanged((a, b) => a.key === b.key && a.n === b.n),
        switchMap(() =>
          this.client.getAccess().pipe(
            map((a) => ready(a) as ViewState<InfrastructureAccess>),
            catchError((e: unknown) => of(errorToViewState<InfrastructureAccess>(e))),
            startWith(routeAuthPending() as ViewState<InfrastructureAccess>),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.estado.set(s));
  }

  /** Pide el acceso para la sesión vigente (una vez por clave). */
  ensure(): void {
    this.pedido.set(true);
  }

  /** Vuelve a preguntar (por ejemplo, después de un 403 inesperado). */
  reload(): void {
    this.pedido.set(true);
    this.recargas.update((n) => n + 1);
  }

  /**
   * Lo que la persona puede hacer en la sede: lo de la sede entera más lo que
   * le dan sus asignaciones de unidad o espacio (`grants`). Una enfermera con
   * asignación sólo a su unidad ve el tablero aunque `site.actions` venga vacío;
   * la API acota después cada fila a su alcance.
   */
  actionsIn(site: AccessSite): readonly InfraAction[] {
    return [...new Set([...site.actions, ...site.grants.flatMap((g) => g.actions)])];
  }

  site(siteId: string | null): AccessSite | null {
    return this.sites().find((s) => s.siteId === siteId) ?? null;
  }

  /** La sede de la URL si la persona tiene la acción ahí; si no, la primera donde la tiene. */
  pickSite(requested: string | null, action: InfraAction): AccessSite | null {
    const allowed = this.sites().filter((s) => this.actionsIn(s).includes(action));
    return allowed.find((s) => s.siteId === requested) ?? allowed[0] ?? null;
  }

  can(siteId: string | null, action: InfraAction): boolean {
    const s = this.site(siteId);
    return s !== null && this.actionsIn(s).includes(action);
  }

  /** ¿Tiene la acción en **alguna** sede? */
  canAnywhere(action: InfraAction): boolean {
    return this.sites().some((s) => this.actionsIn(s).includes(action));
  }
}

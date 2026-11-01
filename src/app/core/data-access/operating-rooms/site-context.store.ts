import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, concatMap, distinctUntilChanged, filter, from, map, of, startWith, switchMap, throwError, toArray, type Observable } from 'rxjs';

import { SessionStore } from '../../auth/session.store';
import { errorToViewState } from '../../http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../view-state/view-state';
import type { ViewState } from '../../view-state/view-state.types';
import { MedicalOrganizationClient } from '../medical-organization/medical-organization.client';
import type { MedicalOrganizationConsole, OrganizationCareSpace, OrganizationClinicalUnit, OrganizationStaffMember } from '../medical-organization/medical-organization.types';
import { SiteAccessClient, type InfrastructureAccessMe } from './site-access.client';

/** Una sede sobre la que trabajan las pantallas de F4/F5. */
export interface SiteRef {
  readonly id: string;
  readonly practiceId: string;
  readonly code: string;
  readonly name: string;
  /**
   * Acciones de sede que la API declara (`f4.or.read`…), o `null` cuando la
   * lista vino de la consola de la organización y la API no las informó.
   * Sirven para atenuar, nunca para cortar: la API decide en cada petición.
   */
  readonly actions: readonly string[] | null;
}

/** Las sedes del actor en el tenant activo. */
export interface SiteContext {
  readonly sites: readonly SiteRef[];
  /** De dónde salió la lista: el reflejo de acceso o, sin él, la consola. */
  readonly source: 'access' | 'console';
}

/** Lo que algunas pantallas necesitan de la organización de la sede: personal y unidades. */
export interface SiteDirectory {
  readonly practiceId: string;
  readonly staff: readonly OrganizationStaffMember[];
  readonly clinicalUnits: readonly OrganizationClinicalUnit[];
  readonly careSpaces: readonly OrganizationCareSpace[];
}

const SITE_EMPTY_MESSAGE = 'Su organización todavía no tiene establecimientos registrados.';

/**
 * Las sedes del actor y la sede elegida, **atadas a la sesión**.
 *
 * ## La clave es la sesión
 *
 * La clave es `userId|activeTenantId`. Si cambia la persona o la organización
 * activa, lo anterior se descarta (vuelve a S2) y la lectura en vuelo se
 * cancela (`switchMap`): nunca quedan sedes ni personal de otra cuenta. Además
 * `clear()` está en `SESSION_CLEANERS`, para el cierre de sesión.
 *
 * ## De dónde salen las sedes
 *
 * De `GET /practice/infrastructure-access/me`, que dice en qué sedes el actor
 * tiene un rol de infraestructura y con qué acciones. Mientras esa lectura no
 * exista en la API desplegada (404), se cae a la consola de cada práctica
 * (`GET /practices/:id/organization`); un 403 de la consola **no** se traga:
 * si ninguna práctica responde y alguna negó, el estado es S5, no S3.
 *
 * ## Sede elegida
 *
 * La pantalla muestra un selector (`app-site-switch`) cuando hay más de una;
 * con una sola, esa. Nada se fija en `sites[0]` por su cuenta.
 *
 * ## Personal y unidades
 *
 * La consola completa (estructura, personal, inventario) se pide **sólo**
 * cuando una pantalla la necesita (`ensureDirectory()`: bloques, programar),
 * no por cada médico que abre un expediente.
 */
@Injectable({ providedIn: 'root' })
export class SiteContextStore {
  private readonly access = inject(SiteAccessClient);
  private readonly organizations = inject(MedicalOrganizationClient);
  private readonly session = inject(SessionStore);

  private readonly stateSignal = signal<ViewState<SiteContext>>(loading());
  private readonly directorySignal = signal<ViewState<SiteDirectory>>(loading());
  private readonly requested = signal(false);
  private readonly directoryRequested = signal(false);
  private readonly reloads = signal(0);
  private readonly chosen = signal<string | null>(null);

  /** La sesión a la que corresponde lo leído. */
  readonly key = computed(() => `${this.session.userId() ?? ''}|${this.session.activeTenantId() ?? ''}`);
  readonly state = this.stateSignal.asReadonly();
  readonly directory = this.directorySignal.asReadonly();
  readonly sites = computed<readonly SiteRef[]>(() => dataOf(this.stateSignal())?.sites ?? []);
  /** La sede elegida, o la única. `null` mientras no hay lista. */
  readonly site = computed<SiteRef | null>(() => {
    const sites = this.sites();
    return sites.find((s) => s.id === this.chosen()) ?? sites[0] ?? null;
  });
  readonly siteId = computed(() => this.site()?.id ?? null);
  readonly practiceId = computed(() => this.site()?.practiceId ?? null);

  constructor() {
    toObservable(computed(() => ({ key: this.key(), on: this.requested(), n: this.reloads() })))
      .pipe(
        filter((x) => x.on),
        distinctUntilChanged((a, b) => a.key === b.key && a.n === b.n),
        switchMap(() =>
          this.readSites().pipe(
            map((ctx) => (ctx.sites.length === 0 ? empty({ label: 'Ir a la organización médica', route: '/administration/medical-organization' }, SITE_EMPTY_MESSAGE) : ready(ctx)) as ViewState<SiteContext>),
            catchError((e: unknown) => of(errorToViewState<SiteContext>(e))),
            startWith(loading() as ViewState<SiteContext>),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.stateSignal.set(s));

    toObservable(computed(() => ({ key: this.key(), practiceId: this.practiceId(), on: this.directoryRequested(), n: this.reloads() })))
      .pipe(
        filter((x) => x.on && x.practiceId !== null),
        distinctUntilChanged((a, b) => a.key === b.key && a.practiceId === b.practiceId && a.n === b.n),
        switchMap(({ practiceId }) =>
          this.organizations.getConsole(practiceId!).pipe(
            map((c) => ready({ practiceId: practiceId!, staff: c.staff, clinicalUnits: c.clinicalUnits, careSpaces: c.careSpaces }) as ViewState<SiteDirectory>),
            catchError((e: unknown) => of(errorToViewState<SiteDirectory>(e))),
            startWith(loading() as ViewState<SiteDirectory>),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.directorySignal.set(s));
  }

  /** Pide las sedes para la sesión vigente (una vez por clave). */
  ensure(): void {
    this.requested.set(true);
  }

  /** Pide además el personal y las unidades de la práctica de la sede elegida. */
  ensureDirectory(): void {
    this.requested.set(true);
    this.directoryRequested.set(true);
  }

  /** Vuelve a leer (reintento de S8/S9). */
  reload(): void {
    this.requested.set(true);
    this.reloads.update((n) => n + 1);
  }

  /** Elige la sede; un id que no está en la lista se ignora. */
  select(siteId: string): void {
    if (this.sites().some((s) => s.id === siteId)) this.chosen.set(siteId);
  }

  /** Olvida todo (cierre de sesión): lo que sigue se vuelve a pedir. */
  clear(): void {
    this.chosen.set(null);
    this.requested.set(false);
    this.directoryRequested.set(false);
    this.stateSignal.set(loading());
    this.directorySignal.set(loading());
  }

  private readSites(): Observable<SiteContext> {
    return this.access.getAccess().pipe(
      map((me) => fromAccess(me)),
      catchError((error: unknown) => (isStatus(error, 404) ? this.fromConsoles() : throwError(() => error))),
    );
  }

  /** Sin el reflejo de acceso: las sedes de cada consola que responda. */
  private fromConsoles(): Observable<SiteContext> {
    return this.organizations.listPractices().pipe(
      concatMap((practices) =>
        from(practices.map((p) => p.id)).pipe(
          concatMap((id) =>
            this.organizations.getConsole(id).pipe(
              map((c): MedicalOrganizationConsole | HttpErrorResponse => c),
              catchError((e: unknown) => of(e instanceof HttpErrorResponse ? e : new HttpErrorResponse({ status: 500 }))),
            ),
          ),
          toArray(),
        ),
      ),
      concatMap((results) => {
        const consoles = results.filter((r): r is MedicalOrganizationConsole => !(r instanceof HttpErrorResponse));
        const denied = results.find((r): r is HttpErrorResponse => r instanceof HttpErrorResponse && r.status === 403);
        if (consoles.length === 0 && denied !== undefined) return throwError(() => denied);
        const failed = results.find((r): r is HttpErrorResponse => r instanceof HttpErrorResponse && r.status !== 404);
        if (consoles.length === 0 && failed !== undefined) return throwError(() => failed);
        return of<SiteContext>({
          source: 'console',
          sites: consoles.flatMap((c) => c.sites.map((s) => ({ id: s.id, practiceId: c.organization.id, code: s.code, name: s.name, actions: null }))),
        });
      }),
    );
  }
}

function fromAccess(me: InfrastructureAccessMe): SiteContext {
  return { source: 'access', sites: me.sites.map((s) => ({ id: s.siteId, practiceId: s.practiceId, code: s.code, name: s.name, actions: s.actions })) };
}

function isStatus(error: unknown, status: number): boolean {
  return error instanceof HttpErrorResponse && error.status === status;
}

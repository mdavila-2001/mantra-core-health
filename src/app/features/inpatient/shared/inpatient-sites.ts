import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import { MedicalOrganizationClient } from '../../../core/data-access/medical-organization/medical-organization.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready, routeAuthPending } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

export interface SedeElegible {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

const CLAVE = 'inpatient.site';

/**
 * Los establecimientos entre los que se mira la internación y el que está
 * elegido. Las pantallas de internación son de **un** establecimiento (el censo,
 * los indicadores y el ingreso son por sede), así que la elección se recuerda
 * entre ellas. La lista sale de las consolas de organización del tenant activo.
 *
 * La elección guardada es una comodidad por navegador (`localStorage`, con
 * `try/catch`): sin ella se cae en la primera sede.
 */
@Injectable({ providedIn: 'root' })
export class InpatientSites {
  private readonly client = inject(MedicalOrganizationClient);
  private readonly session = inject(SessionStore);

  readonly state = signal<ViewState<readonly SedeElegible[]>>(routeAuthPending());
  readonly selectedId = signal<string>(leer());

  readonly sites = computed<readonly SedeElegible[]>(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : [];
  });

  /** La sede elegida; si lo guardado ya no existe, la primera. */
  readonly siteId = computed(() => {
    const lista = this.sites();
    const elegida = this.selectedId();
    return lista.some((x) => x.id === elegida) ? elegida : (lista[0]?.id ?? '');
  });

  readonly site = computed(() => this.sites().find((s) => s.id === this.siteId()) ?? null);

  private cargado = false;

  /** Carga una vez por sesión; `forzar` vuelve a pedir (reintento). */
  load(forzar = false): void {
    if (this.session.activeTenantId() === null) {
      this.state.set(routeAuthPending());
      return;
    }
    if (this.cargado && !forzar) return;
    this.cargado = true;
    this.state.set(loading());
    this.client
      .listPractices()
      .pipe(
        switchMap((practicas) =>
          practicas.length === 0
            ? of([] as SedeElegible[])
            : forkJoin(practicas.map((p) => this.client.getConsole(p.id).pipe(catchError(() => of(null))))).pipe(
                map((consolas) => {
                  const vistas = new Set<string>();
                  return consolas.flatMap((c) => c?.sites ?? []).filter((s) => (vistas.has(s.id) ? false : (vistas.add(s.id), true)));
                }),
              ),
        ),
      )
      .subscribe({
        next: (sedes) =>
          this.state.set(
            sedes.length === 0
              ? empty({ label: 'Registrar una sede', route: '/administration/medical-organization' }, 'La organización todavía no tiene establecimientos: sin uno no hay camas que internar.')
              : ready(sedes.map((s) => ({ id: s.id, code: s.code, name: s.name }))),
          ),
        error: (e: unknown) => {
          this.cargado = false;
          this.state.set(errorToViewState<readonly SedeElegible[]>(e));
        },
      });
  }

  select(id: string): void {
    this.selectedId.set(id);
    try {
      localStorage.setItem(CLAVE, id);
    } catch {
      // Sin almacenamiento: la elección vale hasta recargar.
    }
  }
}

function leer(): string {
  try {
    return localStorage.getItem(CLAVE) ?? '';
  } catch {
    return '';
  }
}

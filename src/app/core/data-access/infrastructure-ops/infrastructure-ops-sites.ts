import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, of, shareReplay, switchMap, tap, type Observable } from 'rxjs';

import { MedicalOrganizationClient } from '../medical-organization/medical-organization.client';

/** Un establecimiento que se puede elegir en el tablero. */
export interface OpsSiteOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly practiceName: string;
  /** Cuántos espacios tiene: el establecimiento con más va primero y es el que se abre por omisión. */
  readonly spaceCount: number;
}

/**
 * Los establecimientos de la organización, para elegir cuál mirar.
 *
 * El contrato de F2 no define una lectura de «mis establecimientos»: se arma

 * con las dos que ya existen —`GET /practices` y `GET /practices/:id/organization`—
 * y se guarda por sesión, igual que el catálogo. Si alguna falla no se guarda
 * el fallo: el siguiente intento vuelve a pedir.
 */
@Injectable({ providedIn: 'root' })
export class OpsSiteDirectory {
  private readonly organization = inject(MedicalOrganizationClient);
  private cached: Observable<readonly OpsSiteOption[]> | null = null;

  sites(): Observable<readonly OpsSiteOption[]> {
    this.cached ??= this.organization.listPractices().pipe(
      switchMap((practices) =>
        practices.length === 0
          ? of([] as readonly OpsSiteOption[])
          : forkJoin(
              practices.map((practice) =>
                this.organization.getConsole(practice.id).pipe(
                  // Una organización cuya consola no se pudo leer no deja sin lista a las demás.
                  catchError(() => of(null)),
                  map((data) =>
                    (data?.sites ?? []).map(
                      (site): OpsSiteOption => ({ id: site.id, code: site.code, name: site.name, practiceName: practice.name, spaceCount: site.careSpaceCount }),
                    ),
                  ),
                ),
              ),
            ).pipe(map((groups) => groups.flat().sort((a, b) => b.spaceCount - a.spaceCount || a.name.localeCompare(b.name, 'es')))),
      ),
      tap({ error: () => (this.cached = null) }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.cached;
  }

  refresh(): void {
    this.cached = null;
  }
}

import { inject, Injectable } from '@angular/core';
import { forkJoin, map, of, shareReplay, startWith, switchMap, tap, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type { Observable } from 'rxjs';

import { MedicalCentersClient } from '../../../../../core/data-access/medical-centers/medical-centers.client';
import { PracticeSitesClient } from '../../../../../core/data-access/practice-sites/practice-sites.client';
import { TerminologyClient } from '../../../../../core/data-access/terminology/terminology.client';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import {
  ownSiteOptions,
  performerSelectionConceptsOf,
  type PerformerSelectionConcepts,
  type PerformerSite,
} from './performer-selector.rules';

/** El conjunto que trae los tres modos del ejecutor. */
export const PERFORMER_SELECTION_VALUE_SET = 'service-request-performer-selection';

/** Todo lo que el selector necesita para un procedimiento. */
export interface PerformerSiteData {
  /** Los uuids de los tres modos; `null` si el conjunto no está completo. */
  readonly concepts: PerformerSelectionConcepts | null;
  /** «Lo hago yo»: vacía ⇒ la opción se deshabilita. */
  readonly ownSites: readonly PerformerSite[];
  /** «En este centro»: las sedes de la búsqueda, en el orden recibido. */
  readonly centerSites: readonly PerformerSite[];
}

/**
 * Las lecturas del selector de ejecutor, orquestadas.
 *
 * Por procedimiento hace dos peticiones —sus vinculaciones y la búsqueda de
 * centros— y reutiliza la expansión del conjunto de modos, que no cambia entre
 * procedimientos. Si **cualquiera** falla el estado es de error: no se inventan
 * sedes, porque una sede inventada sería una recomendación falsa al paciente.
 *
 * La búsqueda de centros sale de `MedicalCentersClient`; las vinculaciones del
 * médico, de `PracticeSitesClient`.
 */
@Injectable({ providedIn: 'root' })
export class PerformerSiteOptions {
  private readonly practiceSites = inject(PracticeSitesClient);
  private readonly medicalCenters = inject(MedicalCentersClient);
  private readonly terminology = inject(TerminologyClient);

  /** La expansión del conjunto: se lee una vez; un fallo se puede reintentar. */
  private conceptsRead: Observable<PerformerSelectionConcepts | null> | null = null;

  /**
   * Las opciones para un procedimiento: `loading` primero, después `ready` o
   * el estado de error de la API (un 422 incluido, con su mensaje).
   */
  load(procedureConceptId: string): Observable<ViewState<PerformerSiteData>> {
    return forkJoin({
      concepts: this.readConcepts(),
      // Las vinculaciones antiguas, sin procedimiento, vienen sin `serviceConceptId` ni
      // `statusCode`: quedan fuera de «Lo hago yo» sin tratamiento aparte.
      assignments: this.practiceSites.listMyRoleAssignments().pipe(
        map((rows) =>
          rows.map((row) => ({
            practiceSiteId: row.practiceSiteId ?? null,
            serviceConceptId: row.serviceConceptId ?? null,
            statusCode: row.statusCode ?? '',
          })),
        ),
      ),
      // Sólo los centros completos (sin `includePartial`), en el orden que decide la API.
      centerSites: this.medicalCenters.search({ procedureConceptIds: [procedureConceptId], includePartial: false }).pipe(
        map((page) =>
          page.items.map((item) => ({
            practiceSiteId: item.practiceSiteId,
            name: item.name,
            addressText: item.addressText,
          })),
        ),
      ),
    }).pipe(
      map(({ concepts, assignments, centerSites }) =>
        ready<PerformerSiteData>({
          concepts,
          centerSites,
          ownSites: ownSiteOptions(assignments, centerSites, procedureConceptId),
        }),
      ),
      catchError((error: unknown) => of(errorToViewState<PerformerSiteData>(error))),
      startWith(loading()),
    );
  }

  private readConcepts(): Observable<PerformerSelectionConcepts | null> {
    this.conceptsRead ??= this.terminology.listValueSets({ code: PERFORMER_SELECTION_VALUE_SET }).pipe(
      map((page) => page.items.find((set) => set.internalCode === PERFORMER_SELECTION_VALUE_SET)),
      switchMap((set) =>
        set === undefined
          ? throwError(() => new Error(`El conjunto ${PERFORMER_SELECTION_VALUE_SET} no está sembrado`))
          : this.terminology.readAllOptions(set.id),
      ),
      map((options) => performerSelectionConceptsOf(options)),
      tap({ error: () => (this.conceptsRead = null) }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.conceptsRead;
  }
}

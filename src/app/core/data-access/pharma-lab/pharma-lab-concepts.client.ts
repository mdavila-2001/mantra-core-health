import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, shareReplay, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';

/** Un concepto del carril 17, tal como lo devuelve el diccionario de la API. */
export interface PharmaLabConcept {
  readonly key: string;
  readonly id: string;
  readonly code: string;
  readonly display: string;
}

/** Traductor de `*_concept_id` a rótulo legible. */
export interface ConceptDictionary {
  /** Rótulo del concepto, o el propio identificador si no está en el catálogo. */
  label(conceptId: string | undefined): string;
  /** Identificador del concepto por su nombre lógico (`VISIT_CONFIRMED`). */
  id(key: string): string | undefined;
  /**
   * El **código** de catálogo de un concepto (`PHL_VISIT_CONFIRMED`).
   *
   * Es lo que permite pintar un estado sin atarse ni al uuid —que cambia con
   * cada re-seed— ni al rótulo, que cambia con el idioma. `undefined` mientras
   * el diccionario no resolvió el concepto: en ese caso no se decide nada.
   */
  code(conceptId: string | undefined): string | undefined;
}

/**
 * Diccionario de conceptos del laboratorio farmacéutico.
 *
 * La API devuelve estados y tipos como UUID determinista. Recalcular ese UUID en
 * el navegador exigiría duplicar la función de derivación del backend —dos
 * implementaciones de la misma regla, que se separan en cuanto una cambia—, así
 * que se pide el diccionario una vez y se comparte.
 *
 * `shareReplay(1)` y no una petición por pantalla: el vocabulario no cambia
 * dentro de una sesión, y tres pestañas del laboratorio no deberían pedirlo tres
 * veces.
 */
@Injectable({ providedIn: 'root' })
export class PharmaLabConcepts {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private readonly dictionary$: Observable<ConceptDictionary> = this.http
    .get<PharmaLabConcept[]>(apiUrl(this.baseUrl, '/pharma-labs/reference/concepts'))
    .pipe(
      map((concepts) => {
        const byId = new Map(concepts.map((concept) => [concept.id, concept]));
        const byKey = new Map(concepts.map((concept) => [concept.key, concept]));
        return {
          label: (conceptId: string | undefined): string =>
            conceptId === undefined
              ? '—'
              : (byId.get(conceptId)?.display ?? conceptId),
          id: (key: string): string | undefined => byKey.get(key)?.id,
          code: (conceptId: string | undefined): string | undefined =>
            conceptId === undefined ? undefined : byId.get(conceptId)?.code,
        };
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

  /** El diccionario, cacheado para toda la sesión. */
  load(): Observable<ConceptDictionary> {
    return this.dictionary$;
  }
}

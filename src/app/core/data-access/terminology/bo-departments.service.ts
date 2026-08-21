import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, shareReplay, switchMap, throwError } from 'rxjs';

import { TerminologyClient } from './terminology.client';
import type { ValueSetOption } from './terminology.types';

/**
 * El código interno del catálogo de departamentos de Bolivia (patch
 * `2026-08-20_v414_catalogo-geografico-y-ocupaciones-bo.sql`, backlog T-01).
 */
export const CODIGO_CATALOGO_DEPARTAMENTOS = 'VS_BO_DEPARTMENT';

/**
 * Los 9 departamentos de Bolivia, para el desplegable de «departamento que
 * emitió el documento» y para el domicilio.
 *
 * Mismo criterio que `MedicalSpecialtiesCatalog`: `common.identifiers.
 * issuer_administrative_area_concept_id` y `common.addresses.
 * administrative_area_concept_id` no tienen enumeración dinámica declarada
 * —los conceptos de VS_BO_DEPARTMENT nacen con `gen_random_uuid()` en el
 * patch, no con un id determinista que un `DYNAMIC_ENUM_CATALOG` pudiera
 * fijar a mano—, así que el catálogo se lee por código de conjunto de
 * valores, no por campo destino.
 */
@Injectable({ providedIn: 'root' })
export class BoDepartmentsCatalog {
  private readonly terminology = inject(TerminologyClient);

  /** La lectura en curso o ya resuelta. `null` mientras nadie la pidió. */
  private cache: Observable<readonly ValueSetOption[]> | null = null;

  /**
   * Los departamentos, ya ordenados por la expansión.
   *
   * @returns Las opciones del catálogo; falla si el catálogo no está sembrado.
   */
  listar(): Observable<readonly ValueSetOption[]> {
    this.cache ??= this.leerCatalogo().pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.cache;
  }

  /** Olvida lo cacheado, para un reintento explícito después de un fallo. */
  olvidar(): void {
    this.cache = null;
  }

  private leerCatalogo(): Observable<readonly ValueSetOption[]> {
    return this.terminology.listValueSets({ code: CODIGO_CATALOGO_DEPARTAMENTOS }).pipe(
      map((pagina) =>
        pagina.items.find(
          (conjunto) => conjunto.internalCode === CODIGO_CATALOGO_DEPARTAMENTOS,
        ),
      ),
      switchMap((conjunto) => {
        if (conjunto === undefined) {
          return throwError(
            () => new Error(`El catálogo ${CODIGO_CATALOGO_DEPARTAMENTOS} no está sembrado`),
          );
        }
        return this.terminology.readAllOptions(conjunto.id);
      }),
      map((opciones) => opciones.filter((opcion) => opcion.selectable !== false)),
    );
  }
}

import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, of, shareReplay, switchMap, throwError } from 'rxjs';

import { TerminologyClient } from './terminology.client';
import type { ValueSetOption } from './terminology.types';

/**
 * El código interno del catálogo de departamentos de Bolivia.
 *
 * **Era `VS_BO_DEPARTMENT` hasta el 21/08, y ese conjunto no existía.** Dos
 * carriles declararon el mismo catálogo con nombres distintos: éste, que sólo
 * vivía como constante en el frontend, y `vs_administrative_area` (v4.1.4), que
 * sí está declarado en la bóveda y sembrado por el paquete con los 9
 * departamentos y sus siglas. Se convergió en el que existe —crear el otro
 * habría sido un segundo catálogo con los mismos nueve valores—, que además es
 * el que `common.addresses.administrative_area_concept_id` ya referenciaba.
 */
export const CODIGO_CATALOGO_DEPARTAMENTOS = 'VS_ADMINISTRATIVE_AREA';

/**
 * Los 9 departamentos de Bolivia, para el desplegable de «departamento que
 * emitió el documento» y para el domicilio.
 *
 * Mismo criterio que `MedicalSpecialtiesCatalog`: ni `common.identifiers.
 * issuer_administrative_area_concept_id` ni `common.addresses.
 * administrative_area_concept_id` tienen enumeración dinámica declarada, así
 * que el catálogo se lee **por código de conjunto de valores**, no por campo
 * destino. Pedirlo por `?target=` responde `404`.
 */
@Injectable({ providedIn: 'root' })
export class BoDepartmentsCatalog {
  private readonly terminology = inject(TerminologyClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** La lectura en curso o ya resuelta. `null` mientras nadie la pidió. */
  private cache: Observable<readonly ValueSetOption[]> | null = null;

  /**
   * Los departamentos, ya ordenados por la expansión.
   *
   * **Bajo SSR no se pide nada.** El registro es una ruta pública y por lo
   * tanto prerenderizada: durante el prerender no hay API a la que preguntar,
   * y la petición quedaba colgada hasta tumbar el `yarn build` entero con un
   * `TimeoutError` sobre `/auth/register`. Devolver la lista vacía es correcto
   * además de conveniente: el campo que la usa es opcional y la pantalla ya
   * sabe seguir sin catálogo. En el navegador, tras hidratar, se pide de
   * verdad — y no se cachea el vacío del servidor para que así sea.
   *
   * @returns Las opciones del catálogo; falla si el catálogo no está sembrado.
   */
  listar(): Observable<readonly ValueSetOption[]> {
    if (!this.isBrowser) {
      return of([]);
    }
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

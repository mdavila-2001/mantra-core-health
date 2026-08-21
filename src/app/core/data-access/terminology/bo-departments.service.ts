import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, of, shareReplay, switchMap, throwError } from 'rxjs';

import { TerminologyClient } from './terminology.client';
import type { ValueSetOption } from './terminology.types';

/**
 * El código interno del catálogo de departamentos de Bolivia.
 *
 * **Vuelve a ser `VS_BO_DEPARTMENT`, que es el que la API sirve.** El 21/08 se
 * cambió a `VS_ADMINISTRATIVE_AREA` dando por hecho que el paquete del modelo
 * lo sembraba; no lo siembra, y ese cambio es justamente el que dejó el
 * desplegable en «no pudimos traer el catálogo» de forma permanente. Contra la
 * API en ejecución:
 *
 * - `GET /terminology/value-sets?code=VS_ADMINISTRATIVE_AREA` → `count: 0`. En
 *   los 82 conjuntos sembrados no hay ninguno con ese código; el único que se
 *   le parece es `administrative-gender`, que es el género.
 * - `GET /terminology/value-sets?code=VS_BO_DEPARTMENT` → un conjunto con
 *   `memberCount: 9`, y su expansión devuelve los nueve departamentos
 *   (`geo:bo:department:CH`, `…:LP`, `…:CB`, …) en el orden del INE.
 *
 * Quien lo siembra es `BoGeographySeedService`, en la cadena de seeders de la
 * API. Ese seeder entró por `origin/dev` un minuto después del cambio de acá,
 * así que las dos mitades se cruzaron: el frontend dejó de pedir el catálogo
 * que el backend acababa de empezar a sembrar.
 */
export const CODIGO_CATALOGO_DEPARTAMENTOS = 'VS_BO_DEPARTMENT';

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

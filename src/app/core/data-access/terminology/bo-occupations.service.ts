import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, of, shareReplay, switchMap, throwError } from 'rxjs';

import { TerminologyClient } from './terminology.client';
import type { ValueSetOption } from './terminology.types';

/**
 * El código interno del catálogo de ocupaciones de Bolivia.
 *
 * Es el que fija la nota de entidad de `profiles.persons` en el modelo (v4.1.8)
 * y el que siembra `BoOccupationsSeedService` en la API. **No es
 * `VS_SEGIP_OCCUPATION`**, que es lo que `RegisterPatientDto` decía un día antes
 * y que no llegó a sembrarse nunca: un catálogo tiene un solo dueño, y pedirlo
 * por el otro código devuelve `count: 0` — el mismo cuento de
 * `VS_ADMINISTRATIVE_AREA` con los departamentos.
 */
export const CODIGO_CATALOGO_OCUPACIONES = 'VS_BO_OCCUPATION';

/**
 * El concepto «Otra ocupación», la salida del catálogo.
 *
 * El registro del cliente pide (módulo Paciente §1.4.1) «dejar uno al final
 * libre para que él pueda detallar la ocupación que no encontró». Elegido este
 * concepto —y sólo éste—, el alta pide el oficio escrito a mano y lo manda en
 * `occupationFreeText`. Va acá, con el catálogo, por lo mismo que
 * `CODIGO_EMPRESA_OTRA`: es un dato del catálogo, no de una pantalla.
 */
export const CODIGO_OCUPACION_OTRA = 'occupation:bo:OTRA';

/**
 * Las ocupaciones de Bolivia, para el desplegable de «¿en qué trabajás?» del
 * alta de paciente.
 *
 * Mismo criterio que `BoDepartmentsCatalog`: `profiles.persons.
 * occupation_concept_id` no tiene enumeración dinámica declarada, así que el
 * catálogo se lee **por código de conjunto de valores** y no por campo destino
 * —pedirlo con `?target=` responde `404`—.
 */
@Injectable({ providedIn: 'root' })
export class BoOccupationsCatalog {
  private readonly terminology = inject(TerminologyClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** La lectura en curso o ya resuelta. `null` mientras nadie la pidió. */
  private cache: Observable<readonly ValueSetOption[]> | null = null;

  /**
   * Las ocupaciones, ya ordenadas por la expansión.
   *
   * **Bajo SSR no se pide nada**, por lo mismo que los departamentos: el
   * registro es una ruta pública y prerenderizada, y durante el prerender no
   * hay API a la que preguntar. En el navegador, tras hidratar, se pide de
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
    return this.terminology.listValueSets({ code: CODIGO_CATALOGO_OCUPACIONES }).pipe(
      map((pagina) =>
        pagina.items.find((conjunto) => conjunto.internalCode === CODIGO_CATALOGO_OCUPACIONES),
      ),
      switchMap((conjunto) => {
        if (conjunto === undefined) {
          return throwError(
            () => new Error(`El catálogo ${CODIGO_CATALOGO_OCUPACIONES} no está sembrado`),
          );
        }
        return this.terminology.readAllOptions(conjunto.id);
      }),
      map((opciones) => opciones.filter((opcion) => opcion.selectable !== false)),
    );
  }
}

import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, of, shareReplay, switchMap, throwError } from 'rxjs';

import { TerminologyClient } from './terminology.client';
import type { ValueSetOption } from './terminology.types';

/**
 * El código interno del catálogo de empresas de Bolivia.
 *
 * Es el que siembra `BoEmployersSeedService` en la API, y como todo catálogo
 * tiene un solo dueño, pedirlo por cualquier otro código devuelve `count: 0` —
 * el mismo cuento de `VS_SEGIP_OCCUPATION` con las ocupaciones.
 */
export const CODIGO_CATALOGO_EMPRESAS = 'VS_BO_EMPLOYER';

/**
 * El código de la salida «no está en la lista».
 *
 * Lo mira el alta para saber cuándo pedir el nombre a mano: elegido este
 * concepto, y sólo este, aparece el campo «¿Cuál?». Va acá y no en la pantalla
 * porque es un dato del catálogo, no de una vista — el día que otra pantalla
 * ofrezca el mismo buscador, la regla ya está escrita una sola vez.
 */
export const CODIGO_EMPRESA_OTRA = 'employer:bo:OTRA';

/**
 * Las empresas y empleadores de Bolivia, para el «¿en qué empresa trabajás?»
 * del alta de paciente.
 *
 * Mismo criterio que `BoOccupationsCatalog`: la columna destino no tiene
 * enumeración dinámica declarada, así que el catálogo se lee **por código de
 * conjunto de valores** y no por campo destino —pedirlo con `?target=` responde
 * `404`—.
 *
 * ## Qué reemplaza
 *
 * El alta preguntaba **dónde** queda el trabajo: municipio (un árbol con
 * buscador), calle, y las coordenadas del navegador. Tres campos para un dato
 * que casi nadie completaba. Ahora pregunta la empresa, que es una sola
 * pregunta y la persona la sabe de memoria.
 *
 * ## Por qué la lista no es «todas las empresas de Bolivia»
 *
 * Porque no existe como archivo: el SEPREC publica agregados en SIIP y una
 * consulta de a una empresa en `miempresa.seprec.gob.bo`, sin descarga masiva
 * ni API, sobre un universo de unas 394.000 unidades económicas. Está
 * investigado y escrito en `bo-employers.catalog.ts` del API, que es donde vive
 * la lista.
 */
@Injectable({ providedIn: 'root' })
export class BoEmployersCatalog {
  private readonly terminology = inject(TerminologyClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** La lectura en curso o ya resuelta. `null` mientras nadie la pidió. */
  private cache: Observable<readonly ValueSetOption[]> | null = null;

  /**
   * Las empresas, ya ordenadas por la expansión.
   *
   * **Bajo SSR no se pide nada**, por lo mismo que las ocupaciones: el registro
   * es una ruta pública y prerenderizada, y durante el prerender no hay API a
   * la que preguntar. En el navegador, tras hidratar, se pide de verdad — y no
   * se cachea el vacío del servidor para que así sea.
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
    return this.terminology.listValueSets({ code: CODIGO_CATALOGO_EMPRESAS }).pipe(
      map((pagina) =>
        pagina.items.find((conjunto) => conjunto.internalCode === CODIGO_CATALOGO_EMPRESAS),
      ),
      switchMap((conjunto) => {
        if (conjunto === undefined) {
          return throwError(
            () => new Error(`El catálogo ${CODIGO_CATALOGO_EMPRESAS} no está sembrado`),
          );
        }
        return this.terminology.readAllOptions(conjunto.id);
      }),
      map((opciones) => opciones.filter((opcion) => opcion.selectable !== false)),
    );
  }
}

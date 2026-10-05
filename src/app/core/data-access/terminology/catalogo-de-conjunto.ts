import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, of, shareReplay, switchMap, throwError } from 'rxjs';

import { TerminologyClient } from './terminology.client';
import type { ValueSetOption } from './terminology.types';

/**
 * Un catálogo de terminología pedido por su código interno, con caché.
 *
 * Es la lectura que tenía `BoOccupationsCatalog`, sacada a una base cuando
 * «Otra profesión» necesitó la misma con otro conjunto (`VS_BO_PROFESSION`):
 * la única diferencia entre los dos es el código, y copiar la clase habría
 * dejado dos lecturas que se separan en el primer arreglo.
 */
export abstract class CatalogoDeConjunto {
  private readonly terminology = inject(TerminologyClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** El código interno del conjunto, el que la API recibe en `?code=`. */
  protected abstract readonly codigo: string;

  /** La lectura en curso o ya resuelta. `null` mientras nadie la pidió. */
  private cache: Observable<readonly ValueSetOption[]> | null = null;

  /**
   * Las opciones, ya ordenadas por la expansión.
   *
   * **Bajo SSR no se pide nada**: el registro es una ruta pública y
   * prerenderizada, y durante el prerender no hay API a la que preguntar. En
   * el navegador, tras hidratar, se pide de verdad — y no se cachea el vacío
   * del servidor para que así sea.
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
    return this.terminology.listValueSets({ code: this.codigo }).pipe(
      map((pagina) => pagina.items.find((conjunto) => conjunto.internalCode === this.codigo)),
      switchMap((conjunto) => {
        if (conjunto === undefined) {
          return throwError(() => new Error(`El catálogo ${this.codigo} no está sembrado`));
        }
        return this.terminology.readAllOptions(conjunto.id);
      }),
      map((opciones) => opciones.filter((opcion) => opcion.selectable !== false)),
    );
  }
}

import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, of, shareReplay, switchMap, throwError } from 'rxjs';

import { TerminologyClient } from './terminology.client';
import type { ValueSetOption } from './terminology.types';

/** Los idiomas en los que un profesional atiende. */
export const CODIGO_CATALOGO_IDIOMAS = 'VS_LANGUAGE';

/** El nivel de dominio de un idioma. */
export const CODIGO_CATALOGO_DOMINIO_IDIOMA = 'VS_LANGUAGE_PROFICIENCY';

/**
 * Los dos catálogos de idiomas del perfil profesional: cuáles habla y qué tan
 * bien.
 *
 * Mismo criterio que {@link MedicalSpecialtiesCatalog}, y por los mismos
 * motivos:
 *
 * 1. **Se resuelve por código interno, no por uuid.** El uuid lo deriva el
 *    generador de seeds y cambia si el paquete se regenera; el código es lo
 *    que declara el modelo.
 * 2. **Un catálogo ausente falla, no devuelve una lista vacía.** «No hay
 *    idiomas» y «no pudimos leer el catálogo» le piden cosas distintas a quien
 *    está corrigiendo su perfil.
 * 3. **Cada conjunto se pide una vez** por sesión, y se puede olvidar para
 *    reintentar tras un fallo.
 *
 * Existe porque hasta el 02/10/2026 el perfil **leía** `languages` y ninguna
 * pantalla los escribía: la ficha los mostraba en «Credenciales» y el editor
 * no los ofrecía en ninguna pestaña. Para escribirlos hace falta elegirlos de
 * su catálogo, y éste es el único lugar que lo lee.
 */
@Injectable({ providedIn: 'root' })
export class LanguagesCatalog {
  private readonly terminology = inject(TerminologyClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** La lectura en curso o ya resuelta de cada conjunto, por su código. */
  private readonly cache = new Map<string, Observable<readonly ValueSetOption[]>>();

  /** Los idiomas elegibles, ya ordenados por la expansión. */
  idiomas(): Observable<readonly ValueSetOption[]> {
    return this.listar(CODIGO_CATALOGO_IDIOMAS);
  }

  /** Los niveles de dominio elegibles, ya ordenados por la expansión. */
  niveles(): Observable<readonly ValueSetOption[]> {
    return this.listar(CODIGO_CATALOGO_DOMINIO_IDIOMA);
  }

  /**
   * Olvida lo cacheado. Es para las pruebas y para un reintento explícito
   * después de un fallo: sin esto, un catálogo que falló una vez seguiría
   * fallando toda la sesión porque `shareReplay` repite el error guardado.
   */
  olvidar(): void {
    this.cache.clear();
  }

  private listar(codigo: string): Observable<readonly ValueSetOption[]> {
    // Bajo SSR no se pide nada, por lo mismo que los otros catálogos: durante
    // el prerender no hay API a la que preguntar. En el navegador se pide de
    // verdad, y no se cachea el vacío del servidor para que así sea.
    if (!this.isBrowser) {
      return of([]);
    }
    let lectura = this.cache.get(codigo);
    if (lectura === undefined) {
      lectura = this.leerCatalogo(codigo).pipe(shareReplay({ bufferSize: 1, refCount: false }));
      this.cache.set(codigo, lectura);
    }
    return lectura;
  }

  private leerCatalogo(codigo: string): Observable<readonly ValueSetOption[]> {
    return this.terminology.listValueSets({ code: codigo }).pipe(
      map((pagina) => pagina.items.find((conjunto) => conjunto.internalCode === codigo)),
      switchMap((conjunto) => {
        // Un catálogo ausente no se disfraza de lista vacía.
        if (conjunto === undefined) {
          return throwError(() => new Error(`El catálogo ${codigo} no está sembrado`));
        }
        return this.terminology.readAllOptions(conjunto.id);
      }),
      // Los abstractos agrupan y no se eligen.
      map((opciones) => opciones.filter((opcion) => opcion.selectable !== false)),
    );
  }
}

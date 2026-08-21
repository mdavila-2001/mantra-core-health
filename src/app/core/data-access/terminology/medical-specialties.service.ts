import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, shareReplay, switchMap, throwError } from 'rxjs';

import { TerminologyClient } from './terminology.client';
import type { ValueSetOption } from './terminology.types';

/**
 * El código interno del catálogo de especialidades médicas (patch v4.0.11).
 *
 * Se resuelve por código y no por uuid a propósito: el uuid es derivado por el
 * generador de seeds y cambia si el paquete se regenera, mientras que el código
 * es la clave con la que el modelo lo declara.
 */
export const CODIGO_CATALOGO_ESPECIALIDADES = 'VS_MEDICAL_SPECIALTY';

/**
 * Las 36 especialidades médicas, en castellano.
 *
 * ## Por qué existe, si ya hay un `app-concept-select`
 *
 * `app-concept-select` pide el catálogo por **campo destino**
 * (`profiles.practitioner_specialties.specialty_concept_id`) al registro de
 * enumeraciones dinámicas de la API. Ese registro declara para ese campo un
 * conjunto propio con **una sola opción, en inglés** («General medicine
 * specialty»), que **ninguna fila de la base usa**: las especialidades reales
 * son las 36 de `VS_MEDICAL_SPECIALTY`, que es el que declara el modelo y el
 * que usan todos los perfiles sembrados.
 *
 * Por eso la pantalla de perfil profesional ofrecía una única especialidad
 * ajena al idioma del producto — el fondo de F-19. Mientras las dos
 * declaraciones no se unifiquen (deriva anotada para el dueño del modelo), el
 * front lee el catálogo **del modelo**, que es el que describe la realidad.
 *
 * ## Se pide una vez por sesión
 *
 * Son 36 filas de un catálogo que no cambia durante una sesión, y la piden dos
 * pantallas (perfil y registro). `shareReplay` evita que abrir el perfil dos
 * veces sean cuatro peticiones.
 */
@Injectable({ providedIn: 'root' })
export class MedicalSpecialtiesCatalog {
  private readonly terminology = inject(TerminologyClient);

  /** La lectura en curso o ya resuelta. `null` mientras nadie la pidió. */
  private cache: Observable<readonly ValueSetOption[]> | null = null;

  /**
   * Las especialidades elegibles, ya ordenadas por la expansión.
   *
   * @returns Las opciones del catálogo; falla si el catálogo no está sembrado.
   */
  listar(): Observable<readonly ValueSetOption[]> {
    this.cache ??= this.leerCatalogo().pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.cache;
  }

  /**
   * Olvida lo cacheado. Es para las pruebas y para un reintento explícito
   * después de un fallo: sin esto, un catálogo que falló una vez seguiría
   * fallando toda la sesión porque `shareReplay` repite el error guardado.
   */
  olvidar(): void {
    this.cache = null;
  }

  private leerCatalogo(): Observable<readonly ValueSetOption[]> {
    return this.terminology.listValueSets({ code: CODIGO_CATALOGO_ESPECIALIDADES }).pipe(
      map((pagina) =>
        pagina.items.find((conjunto) => conjunto.internalCode === CODIGO_CATALOGO_ESPECIALIDADES),
      ),
      switchMap((conjunto) => {
        // Un catálogo ausente no se disfraza de lista vacía: «no hay
        // especialidades» y «no pudimos leer el catálogo» le piden cosas
        // distintas a quien está completando su perfil.
        if (conjunto === undefined) {
          return throwError(
            () => new Error(`El catálogo ${CODIGO_CATALOGO_ESPECIALIDADES} no está sembrado`),
          );
        }
        return this.terminology.readAllOptions(conjunto.id);
      }),
      map((opciones) =>
        // Los abstractos agrupan y no se eligen; el catálogo de v4.0.11 no
        // trae ninguno, pero filtrarlo es la regla del tipo, no un supuesto.
        opciones.filter((opcion) => opcion.selectable !== false),
      ),
    );
  }
}

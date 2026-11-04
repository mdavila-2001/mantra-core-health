import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, of, shareReplay } from 'rxjs';

import { SystemContextClient } from './system-context.client';
import type { DynamicEnumOption } from './system-context.types';

/**
 * El campo que gobierna el parentesco de una persona de contacto.
 *
 * Es la clave con la que se pide el catálogo: `esquema.tabla.columna`, no el
 * código del conjunto de valores. Ver la nota de la clase sobre por qué éste se
 * lee por campo destino y los `bo-*` por código.
 */
export const CAMPO_PARENTESCO_PERSONA_RELACIONADA =
  'profiles.related_persons.relationship_concept_id';

/**
 * Las palabras que ve la persona, por código de concepto.
 *
 * El catálogo devuelve su `display` en **inglés técnico** —«Mother
 * relationship»— porque es terminología, no copy de producto. El mapeo por
 * código es el mismo criterio de `app-concept-select`: el código
 * (`RELATIONSHIP_MOTHER`) es la identidad semántica estable del valor, mientras
 * que la etiqueta del catálogo es metadato de presentación y puede cambiar sin
 * aviso.
 *
 * Un código sin entrada acá cae a su `display`: se verá en inglés, que es feo,
 * pero dice algo — a diferencia de una opción en blanco o de un uuid.
 *
 * `RELATIONSHIP_GUARDIAN` está en la lista aunque el alta no lo ofrezca como
 * elección corriente: es el valor que la API escribe cuando no se declara
 * parentesco, así que aparece en el catálogo y tiene que poder decirse.
 */
export const ETIQUETAS_PARENTESCO: Readonly<Record<string, string>> = {
  RELATIONSHIP_GUARDIAN: 'Tutor o representante legal',
  RELATIONSHIP_MOTHER: 'Madre',
  RELATIONSHIP_FATHER: 'Padre',
  RELATIONSHIP_SPOUSE: 'Cónyuge o pareja',
  RELATIONSHIP_CHILD: 'Hijo o hija',
  RELATIONSHIP_SIBLING: 'Hermano o hermana',
  RELATIONSHIP_OTHER_RELATIVE: 'Otro familiar',
  RELATIONSHIP_FRIEND: 'Amistad',
  RELATIONSHIP_OTHER: 'Otra relación',
  RELATIONSHIP_GRANDPARENT: 'Abuelo o abuela',
  RELATIONSHIP_GRANDCHILD: 'Nieto o nieta',
  RELATIONSHIP_UNCLE_AUNT: 'Tío o tía',
  RELATIONSHIP_NEPHEW_NIECE: 'Sobrino o sobrina',
  RELATIONSHIP_COUSIN: 'Primo o prima',
  RELATIONSHIP_HALF_SIBLING: 'Medio hermano o media hermana',
  RELATIONSHIP_GREAT_GRANDPARENT: 'Bisabuelo o bisabuela',
  RELATIONSHIP_GREAT_GRANDCHILD: 'Bisnieto o bisnieta',
  RELATIONSHIP_PARENT_IN_LAW: 'Suegro o suegra',
  RELATIONSHIP_CHILD_IN_LAW: 'Yerno o nuera',
  RELATIONSHIP_SIBLING_IN_LAW: 'Cuñado o cuñada',
  RELATIONSHIP_STEPPARENT: 'Padrastro o madrastra',
  RELATIONSHIP_STEPCHILD: 'Hijastro o hijastra',
  RELATIONSHIP_STEPSIBLING: 'Hermanastro o hermanastra',
  RELATIONSHIP_ADOPTIVE_PARENT: 'Padre o madre adoptivos',
  RELATIONSHIP_ADOPTED_CHILD: 'Hijo o hija adoptivos',
  RELATIONSHIP_FOSTER_PARENT: 'Familia sustituta',
  RELATIONSHIP_EX_SPOUSE: 'Excónyuge o expareja',
  RELATIONSHIP_GODPARENT: 'Padrino o madrina',
  RELATIONSHIP_GODCHILD: 'Ahijado o ahijada',
  RELATIONSHIP_COMPADRE: 'Compadre o comadre',
  RELATIONSHIP_CAREGIVER: 'Cuidador o cuidadora',
  RELATIONSHIP_DOMESTIC_WORKER: 'Trabajadora o trabajador del hogar',
  RELATIONSHIP_ATTORNEY_IN_FACT: 'Apoderado o apoderada',
  RELATIONSHIP_CARE_HOME_STAFF: 'Responsable del hogar o centro de acogida',
  RELATIONSHIP_NEIGHBOR: 'Vecino o vecina',
  RELATIONSHIP_HOUSEMATE: 'Persona con quien comparte vivienda',
  RELATIONSHIP_COWORKER: 'Compañero o compañera de trabajo',
  RELATIONSHIP_EMPLOYER: 'Empleador o empleadora',
};

/**
 * El parentesco del contacto de emergencia, para el desplegable del alta.
 *
 * ## Por qué se lee por campo destino y no por código de conjunto
 *
 * A diferencia de los catálogos bolivianos —`BoDepartmentsCatalog`,
 * `BoOccupationsCatalog`—, `profiles.related_persons.relationship_concept_id`
 * **sí declara enumeración dinámica** en la API, así que se pide por `?target=`
 * y no hay que averiguar el uuid de ningún conjunto de valores. Es el mecanismo
 * que `SystemContextClient` ya sirve, y por eso este catálogo vive con él y no
 * con los de terminología: la carpeta nombra al módulo de la API del que lee.
 *
 * ## Qué agrega sobre el cliente
 *
 * Dos cosas que el cliente no puede saber: que **bajo SSR no hay que pedir
 * nada** —el alta es una ruta pública y prerenderizada, y durante el prerender
 * no hay API a la que preguntar— y cuáles son las palabras en castellano de
 * cada código.
 *
 * ## Un fallo no bloquea el alta
 *
 * El parentesco es opcional: sin catálogo la persona se registra igual, y su
 * contacto de emergencia queda con el valor por defecto de la API. Mismo
 * criterio que la ocupación y el departamento emisor.
 */
@Injectable({ providedIn: 'root' })
export class RelatedPersonRelationshipsCatalog {
  private readonly systemContext = inject(SystemContextClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** La lectura en curso o ya resuelta. `null` mientras nadie la pidió. */
  private cache: Observable<readonly DynamicEnumOption[]> | null = null;

  /**
   * Los parentescos publicados, en el orden en que la API los ofrece.
   *
   * @returns Las opciones del catálogo; lista vacía bajo SSR.
   */
  listar(): Observable<readonly DynamicEnumOption[]> {
    if (!this.isBrowser) {
      return of([]);
    }
    this.cache ??= this.leerCatalogo().pipe(
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.cache;
  }

  /**
   * Olvida lo cacheado, para un reintento explícito después de un fallo.
   *
   * Olvida también lo del cliente: memoiza por `target` con `shareReplay`, así
   * que reintentar sin limpiarlo repetiría el mismo fallo sin tocar la red.
   */
  olvidar(): void {
    this.cache = null;
    this.systemContext.forget(CAMPO_PARENTESCO_PERSONA_RELACIONADA);
  }

  /**
   * Cómo se llama en castellano el parentesco de un código.
   *
   * @param opcion - La opción tal como la devolvió el catálogo.
   * @returns La palabra propia del producto, o el `display` del catálogo.
   */
  etiquetaDe(opcion: DynamicEnumOption): string {
    return ETIQUETAS_PARENTESCO[opcion.code] ?? opcion.display;
  }

  private leerCatalogo(): Observable<readonly DynamicEnumOption[]> {
    return this.systemContext
      .dynamicEnum(CAMPO_PARENTESCO_PERSONA_RELACIONADA)
      .pipe(map((enumeracion) => enumeracion.options));
  }
}

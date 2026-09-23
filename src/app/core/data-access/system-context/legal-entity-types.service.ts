import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, isDevMode } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, of, shareReplay } from 'rxjs';

import {
  COUNTRY_NAMES,
  LEGAL_ENTITY_TYPES_DICTIONARY,
  legalEntityTypeLabel,
  type LegalEntityCountryIso,
} from '../../i18n/legal-entity-types.dictionary';
import { uiLanguage, type UiLanguage } from '../../i18n/ui-language';
import { SystemContextClient } from './system-context.client';
import type { DynamicEnumOption } from './system-context.types';

/**
 * La forma de una opción de lista, declarada **acá**.
 *
 * `core` es una capa por debajo de los componentes y no puede importar de
 * `shared/components` —`check-architecture` lo verifica—. No hace falta el
 * import para que esto siga sirviendo a un `app-select`: TypeScript compara
 * por estructura, así que lo que sale de acá sigue siendo un
 * `SelectOption<string>` válido para quien lo reciba.
 */
interface SelectOption<T> {
  readonly value: T;
  readonly label: string;
}

/**
 * El campo que gobierna el tipo societario de una organización.
 *
 * Mismo mecanismo que `CAMPO_PARENTESCO_PERSONA_RELACIONADA`
 * (`related-person-relationships.service.ts`): se pide por `esquema.tabla.columna`
 * a `GET /system-context/dynamic-enums`, no por código de conjunto de valores.
 */
export const CAMPO_TIPO_SOCIETARIO = 'directory.tenants.legal_entity_type_concept_id';

/** El país por defecto cuando el catálogo no ofrece nada para el país pedido. */
const PAIS_POR_DEFECTO: LegalEntityCountryIso = 'BO';

/**
 * El tipo societario, para el alta pública de organización (subtarea 1.1).
 *
 * ## Por qué existe, si ya hay un catálogo de tipo societario en la API
 *
 * `LegalEntityTypesCatalog.listar()` lee las **21** opciones —las 8 de
 * Bolivia más las de Brasil, Estados Unidos, Argentina y México— con su
 * `display` en inglés técnico, igual que cualquier catálogo de terminología.
 * Lo que este servicio agrega es lo que la API no puede resolver por su
 * cuenta: **filtrar por país** y traducir a la palabra que ve la persona, en
 * el idioma de la interfaz (`legal-entity-types.dictionary.ts`).
 *
 * ## Bajo SSR, y un fallo que no bloquea el alta
 *
 * Mismo criterio que el resto de los catálogos del registro: vacío bajo SSR
 * —el alta es una ruta pública y prerenderizada, y durante el prerender no
 * hay API a la que preguntar— y memoizado por sesión con `shareReplay`.
 */
@Injectable({ providedIn: 'root' })
export class LegalEntityTypesCatalog {
  private readonly systemContext = inject(SystemContextClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** La lectura en curso o ya resuelta. `null` mientras nadie la pidió. */
  private cache: Observable<readonly DynamicEnumOption[]> | null = null;

  /**
   * Las 21 opciones publicadas, en el orden en que la API las ofrece.
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
   */
  olvidar(): void {
    this.cache = null;
    this.systemContext.forget(CAMPO_TIPO_SOCIETARIO);
  }

  /**
   * Los países que el diccionario cubre, con su nombre en el idioma pedido.
   *
   * Bolivia siempre primero: es el país por defecto del producto.
   *
   * @param lang - Idioma de la interfaz; por defecto, el de {@link uiLanguage}.
   * @returns Las opciones de país, listas para un `select`.
   */
  paises(lang: UiLanguage = uiLanguage()): readonly SelectOption<string>[] {
    const isos = new Set(
      Object.values(LEGAL_ENTITY_TYPES_DICTIONARY).map((entry) => entry.countryIso),
    );
    const ordenados = [...isos].sort((a, b) =>
      a === PAIS_POR_DEFECTO ? -1 : b === PAIS_POR_DEFECTO ? 1 : a.localeCompare(b),
    );
    return ordenados.map((iso) => ({ value: iso, label: COUNTRY_NAMES[iso][lang] }));
  }

  /**
   * Las opciones de tipo societario para un país, ya traducidas.
   *
   * Si el país pedido no tiene ninguna figura en el diccionario —un país que
   * la API sembró pero que todavía no llegó acá—, cae a Bolivia: mejor una
   * lista con las 8 figuras conocidas que un desplegable vacío que parece
   * roto.
   *
   * @param opciones - Las opciones crudas que devolvió {@link listar}.
   * @param countryIso - El país elegido en el formulario.
   * @param lang - Idioma de la interfaz; por defecto, el de {@link uiLanguage}.
   * @returns Las opciones del país, traducidas y listas para un `select`.
   */
  opcionesPorPais(
    opciones: readonly DynamicEnumOption[],
    countryIso: string,
    lang: UiLanguage = uiLanguage(),
  ): readonly SelectOption<string>[] {
    const deEsePais = this.filtrarPorPais(opciones, countryIso);
    const fuente = deEsePais.length > 0 ? deEsePais : this.filtrarPorPais(opciones, PAIS_POR_DEFECTO);
    return fuente.map((opcion) => ({
      value: opcion.code,
      label: legalEntityTypeLabel(opcion.code, lang, opcion.display),
    }));
  }

  private filtrarPorPais(
    opciones: readonly DynamicEnumOption[],
    countryIso: string,
  ): readonly DynamicEnumOption[] {
    return opciones.filter((opcion) => {
      const entry = LEGAL_ENTITY_TYPES_DICTIONARY[opcion.code];
      // Un código que la API sembró pero que el diccionario todavía no
      // conoce se avisa en desarrollo y se omite del filtro por país: mejor
      // no ofrecerlo que ofrecerlo sin poder decir a qué país pertenece.
      if (!entry) {
        if (isDevMode()) {
          console.warn(
            `[legal-entity-types] El código "${opcion.code}" no está en el diccionario trilingüe.`,
          );
        }
        return false;
      }
      return entry.countryIso === countryIso;
    });
  }

  private leerCatalogo(): Observable<readonly DynamicEnumOption[]> {
    return this.systemContext
      .dynamicEnum(CAMPO_TIPO_SOCIETARIO)
      .pipe(map((enumeracion) => enumeracion.options));
  }
}

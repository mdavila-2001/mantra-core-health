import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { map, Observable, of, shareReplay } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { DynamicEnum } from './system-context.types';

/**
 * Cliente de `system_context` — las enumeraciones dinámicas (IT3).
 *
 * ## Qué desbloquea
 *
 * Todo campo `*_concept_id` del modelo es un selector poblado desde
 * terminología. Hasta que existió esta lectura no había forma de saber **qué
 * conjunto de valores** gobierna cada campo, así que las pantallas tenían dos
 * salidas y las dos malas: pedir un uuid a mano, o poblar el selector con una
 * búsqueda libre sobre los 965 conceptos del catálogo —que dejaría elegir
 * cualquiera y rompería el vínculo que el modelo declara—.
 *
 * Por eso el alta de paciente salió sin género ni sexo al nacer. Este cliente es
 * lo que permite ofrecerlos.
 *
 * ## La memoización no es una optimización: es parte del contrato
 *
 * Los identificadores son **UUIDv5 deterministas** —el mismo uuid en local, en
 * CI y en producción— y la respuesta trae `cacheToken`, la huella de la versión
 * publicada. Cachear por `target` es seguro por diseño, y el backend lo declara
 * así explícitamente.
 *
 * Se cachea el **observable** y no el valor, con `shareReplay`: dos formularios
 * que se construyen a la vez —pasa en cuanto una pantalla tiene dos selectores—
 * comparten una sola petición en vuelo en vez de disparar dos y quedarse con la
 * que llegue última.
 *
 * ## Un fallo no se cachea
 *
 * `shareReplay` con `refCount` no retiene el error una vez que nadie escucha, y
 * además se limpia la entrada a mano: un catálogo que falló por un corte de red
 * no puede quedar marcado como «este campo no tiene opciones» durante el resto
 * de la sesión.
 */
@Injectable({
  providedIn: 'root',
})
export class SystemContextClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Un observable compartido por target. Ver la nota de memoización. */
  private readonly cache = new Map<string, Observable<DynamicEnum>>();

  /**
   * `GET /system-context/dynamic-enums?target=…` — las opciones de un campo.
   *
   * **Bajo SSR no se pide nada.** Mismo criterio que `BoDepartmentsCatalog`
   * (H1.S1, 2026-09-26): varias pantallas que usan este cliente son rutas
   * públicas prerenderizadas (`register-practitioner` entre ellas), y durante
   * el prerender no hay API a la que preguntar — la petición quedaba colgada
   * hasta tumbar `yarn build --configuration=production-api` con un
   * `TimeoutError`. Devolver la enumeración vacía es correcto además de
   * conveniente: los campos que la usan ya saben mostrar «no pudimos traer el
   * catálogo» y reintentar. En el navegador, tras hidratar, se pide de verdad.
   *
   * @param target - El campo a poblar, como `esquema.tabla.columna`.
   * @returns La enumeración con sus opciones ya ordenadas.
   */
  dynamicEnum(target: string): Observable<DynamicEnum> {
    if (!this.isBrowser) {
      return sinEnumeracion();
    }

    const cacheado = this.cache.get(target);
    if (cacheado !== undefined) {
      return cacheado;
    }

    const peticion = this.http
      .get<WireDynamicEnum>(this.url('/system-context/dynamic-enums'), {
        params: new HttpParams().set('target', target),
      })
      .pipe(
        map(toDynamicEnum),
        shareReplay({ bufferSize: 1, refCount: true }),
      );

    this.cache.set(target, peticion);
    return peticion.pipe(
      // El error se propaga tal cual —quien llame decide cómo mostrarlo— pero la
      // entrada se descarta para que el siguiente intento vuelva a pedir.
      catchAndForget(() => this.cache.delete(target)),
    );
  }

  /**
   * Olvida lo memoizado.
   *
   * No lo usa ninguna pantalla: existe para las pruebas y para el día que haga
   * falta forzar una relectura tras publicar una versión nueva del catálogo.
   */
  forget(target?: string): void {
    if (target === undefined) {
      this.cache.clear();
      return;
    }
    this.cache.delete(target);
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/* ---- formas de transporte -------------------------------------------------
   El contrato no transporta fechas acá, así que la conversión es sólo de
   normalización: los opcionales que llegan `null` se dejan ausentes, para que
   `'cacheToken' in enumeracion` signifique lo que parece. */

type WireDynamicEnum = Omit<
  DynamicEnum,
  'description' | 'versionId' | 'cacheToken' | 'options'
> & {
  readonly description?: string | null;
  readonly versionId?: string | null;
  readonly cacheToken?: string | null;
  readonly options: readonly DynamicEnum['options'][number][];
};

function toDynamicEnum(body: WireDynamicEnum): DynamicEnum {
  const { description, versionId, cacheToken, ...resto } = body;
  return {
    ...resto,
    ...(description === null || description === undefined ? {} : { description }),
    ...(versionId === null || versionId === undefined ? {} : { versionId }),
    ...(cacheToken === null || cacheToken === undefined ? {} : { cacheToken }),
  };
}

/**
 * Corre un efecto cuando el origen falla, sin tocar lo que emite.
 *
 * Se escribe a mano en vez de usar `tap({ error })` porque `tap` no se ejecuta
 * si nadie se suscribe al observable devuelto, y acá el objetivo es justamente
 * limpiar la caché aunque la suscripción se cancele a mitad.
 */
function catchAndForget<T>(alFallar: () => void) {
  return (fuente: Observable<T>): Observable<T> =>
    new Observable<T>((observador) => {
      const sub = fuente.subscribe({
        next: (valor) => observador.next(valor),
        error: (error: unknown) => {
          alFallar();
          observador.error(error);
        },
        complete: () => observador.complete(),
      });
      return () => sub.unsubscribe();
    });
}

/** Reexportado para que las pruebas puedan construir una respuesta vacía. */
export const ENUM_VACIO: DynamicEnum = Object.freeze({
  code: '',
  name: '',
  definitionId: '',
  valueSetId: '',
  allowCustomValue: false,
  options: [],
});

/** Un observable ya resuelto, para las pantallas que no tienen `target`. */
export function sinEnumeracion(): Observable<DynamicEnum> {
  return of(ENUM_VACIO);
}

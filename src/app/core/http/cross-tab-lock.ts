import { DOCUMENT, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, from, type Observable } from 'rxjs';

/**
 * `lib.dom.d.ts` tipa el callback de `LockManager.request` como
 * `(lock: Lock | null) => T`, sin contemplar que puede ser asíncrono — la
 * especificación real sí lo permite y espera la promesa que devuelva. Se
 * redeclara acá con la firma real en vez de tipar `any` en el resto del
 * archivo.
 */
interface AsyncLockManager {
  request<T>(name: string, callback: (lock: Lock | null) => Promise<T>): Promise<T>;
}

/**
 * Exclusión mutua entre pestañas del mismo origen, vía la Web Locks API.
 *
 * Existe por una sola razón: `TokenRefreshService` necesita que dos pestañas
 * que refrescan la sesión a la vez no pisen la rotación una de la otra. El
 * refresh token es de uso único (rotación atómica en el servidor, MCH-005);
 * presentar el mismo desde dos pestañas simultáneas hace que la segunda
 * reciba el que la primera ya gastó, y el servidor lo trata como reuso y
 * revoca la sesión entera.
 *
 * Aislado en su propia clase, y no llamado directo desde `TokenRefreshService`,
 * por lo mismo que `RefreshTokenStorage` es su propia clase: es lo único de la
 * pieza que toca una API del navegador, así que es lo único que hay que doblar
 * en una prueba. `navigator.locks` no existe en el entorno de test (jsdom) ni
 * en Safari anterior a 15.4 ni durante el render del servidor.
 */
@Injectable({
  providedIn: 'root',
})
export class CrossTabLock {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Serializa `source` entre pestañas bajo el nombre `name`.
   *
   * Sin soporte de Web Locks, devuelve `source` **sin envolver**: sigue siendo
   * correcto —ahí sólo puede haber una pestaña disputando el lock, no hay con
   * quién competir— y, a diferencia de envolver siempre en una promesa, no le
   * agrega una vuelta de microtarea a un camino que hoy es puramente síncrono.
   */
  withLock<T>(name: string, source: Observable<T>): Observable<T> {
    const locks = this.isBrowser
      ? (this.document.defaultView?.navigator.locks as AsyncLockManager | undefined)
      : undefined;
    if (locks === undefined) {
      return source;
    }

    return from(locks.request<T>(name, () => firstValueFrom(source)));
  }
}

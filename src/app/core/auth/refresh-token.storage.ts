import { DOCUMENT, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export const REFRESH_TOKEN_STORAGE_KEY = 'mantra.refresh-token';

/**
 * Marca de que hay una sesión abierta **en modo cookie** (TX-10).
 *
 * Con la cookie `httpOnly` el refresh token no pasa por JavaScript, así que no
 * hay nada que guardar. La marca **no es un secreto** —vale `1`— y sirve para
 * dos cosas: (1) no pedir un refresco a cada visitante anónimo al abrir la
 * aplicación, y (2) que las otras pestañas se enteren cuando esta cierra sesión
 * (el evento `storage` de su borrado). Se borra con la sesión.
 */
export const SESSION_HINT_STORAGE_KEY = 'mantra.session';

/**
 * Organización elegida, para no volver a preguntarla en cada recarga.
 *
 * Se persiste **el identificador y nada más**: no es un dato clínico, es la
 * misma cadena que ya viaja en cada petición como `X-Tenant-Id` y que el propio
 * token declara en `tenants[]`.
 *
 * Y se valida al leerla: `SessionStore.selectTenant` ignora un identificador
 * que no esté en el token, así que una clave manipulada no cambia de
 * organización — solo se descarta.
 *
 * **Sobrevive al cierre de sesión, atada a la persona** (TX-11): se guarda como
 * `<userId>|<tenantId>` y sólo se aplica si la persona que entra es la misma.
 * Así la médica con dos organizaciones vuelve a la última que eligió sin pasar
 * por el selector, y otra persona en el mismo dispositivo no hereda su contexto.
 */
export const SELECTED_TENANT_STORAGE_KEY = 'mantra.selected-tenant';

/**
 * Guarda el refresh token entre recargas.
 *
 * Se persiste **solo el refresh token**, nunca el de acceso: el de acceso dura
 * minutos y se vuelve a obtener con el otro, así que guardarlo sería exponer
 * una credencial de más sin ganar nada.
 *
 * Mismo criterio de degradación que `ThemeService`: si el navegador bloquea el
 * almacenamiento —Safari privado, cookies de terceros deshabilitadas—, la
 * sesión sigue funcionando **durante la pestaña** y se pierde al recargar. Peor
 * es romper.
 */
@Injectable({
  providedIn: 'root',
})
export class RefreshTokenStorage {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  read(): string | null {
    const storage = this.storage();
    if (storage === null) {
      return null;
    }

    try {
      const value = storage.getItem(REFRESH_TOKEN_STORAGE_KEY);
      return value === null || value === '' ? null : value;
    } catch {
      return null;
    }
  }

  write(token: string): void {
    const storage = this.storage();
    if (storage === null) {
      return;
    }

    try {
      storage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
    } catch {
      // Escritura rechazada (cuota agotada o modo privado): degradar, no romper.
    }
  }

  /**
   * Borra lo que es de la sesión: el refresh token y la marca de modo cookie.
   *
   * **No** borra la organización elegida: está atada a la persona y es lo que
   * evita el selector en el segundo inicio de sesión (TX-11).
   */
  clear(): void {
    const storage = this.storage();
    if (storage === null) {
      return;
    }

    try {
      storage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
      storage.removeItem(SESSION_HINT_STORAGE_KEY);
    } catch {
      // Ídem: que no se pueda borrar no debe impedir cerrar sesión.
    }
  }

  /** Anota que hay una sesión abierta en modo cookie. No es un secreto. */
  writeSessionHint(): void {
    const storage = this.storage();
    if (storage === null) {
      return;
    }

    try {
      storage.setItem(SESSION_HINT_STORAGE_KEY, '1');
      // Un refresh token que quedó de antes de encender la cookie ya no
      // corresponde: en este modo no puede haber ninguno al alcance de scripts.
      storage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    } catch {
      // Degradar: sin la marca la sesión vive en la pestaña y se pide de nuevo.
    }
  }

  /** Si esta sesión quedó abierta en modo cookie. */
  hasSessionHint(): boolean {
    const storage = this.storage();
    if (storage === null) {
      return false;
    }

    try {
      return storage.getItem(SESSION_HINT_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  /**
   * La organización elegida en una sesión anterior, si la hay.
   *
   * @param userId - Quién entra. Si la elección guardada es de otra persona se
   *   ignora. Sin él, se devuelve lo guardado (compatibilidad).
   */
  readSelectedTenant(userId?: string | null): string | null {
    const storage = this.storage();
    if (storage === null) {
      return null;
    }

    try {
      const value = storage.getItem(SELECTED_TENANT_STORAGE_KEY);
      if (value === null || value === '') {
        return null;
      }
      const separator = value.indexOf('|');
      if (separator === -1) {
        return value;
      }
      const owner = value.slice(0, separator);
      const tenantId = value.slice(separator + 1);
      if (tenantId === '') {
        return null;
      }
      return userId === undefined || userId === null || owner === userId ? tenantId : null;
    } catch {
      return null;
    }
  }

  /**
   * Guarda la organización elegida, atada a la persona cuando se la conoce.
   *
   * @param tenantId - Organización elegida.
   * @param userId - Quién la eligió.
   */
  writeSelectedTenant(tenantId: string, userId?: string | null): void {
    const storage = this.storage();
    if (storage === null) {
      return;
    }

    try {
      storage.setItem(
        SELECTED_TENANT_STORAGE_KEY,
        userId === undefined || userId === null ? tenantId : `${userId}|${tenantId}`,
      );
    } catch {
      // Degradar: se vuelve a preguntar en la próxima recarga, nada más.
    }
  }

  /**
   * Avisa cuando **otra pestaña** cierra la sesión.
   *
   * El evento `storage` solo dispara en las pestañas que **no** hicieron el
   * cambio, que es exactamente lo que hace falta: cerrar sesión en una dejaba
   * la otra funcionando hasta que su token venciera.
   *
   * Devuelve la función que da de baja al oyente. En el servidor no hay
   * ventana, así que devuelve una función que no hace nada.
   */
  onClearedInAnotherTab(onCleared: () => void): () => void {
    const view = this.isBrowser ? this.document.defaultView : null;
    if (view === null || view === undefined) {
      return () => undefined;
    }

    const listener = (event: StorageEvent): void => {
      // `newValue === null` es un borrado. Se ignora el `key === null` que
      // emite un `localStorage.clear()` ajeno: no es nuestro cierre de sesión.
      const esDeSesion =
        event.key === REFRESH_TOKEN_STORAGE_KEY || event.key === SESSION_HINT_STORAGE_KEY;
      if (esDeSesion && event.newValue === null) {
        onCleared();
      }
    };

    view.addEventListener('storage', listener);
    return () => view.removeEventListener('storage', listener);
  }

  /**
   * `localStorage` **lanza** —no devuelve null— cuando el navegador bloquea el
   * almacenamiento. Y en el servidor no existe: por eso se comprueba la
   * plataforma antes de tocarlo.
   */
  private storage(): Storage | null {
    if (!this.isBrowser) {
      return null;
    }

    try {
      return this.document.defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  }
}

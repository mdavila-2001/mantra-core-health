import { DOCUMENT, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export const REFRESH_TOKEN_STORAGE_KEY = 'mantra.refresh-token';

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

  clear(): void {
    const storage = this.storage();
    if (storage === null) {
      return;
    }

    try {
      storage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
      // La organización elegida se va con la sesión. Dejarla haría que la
      // siguiente persona que entre en este dispositivo arrancara con el
      // contexto de la anterior.
      storage.removeItem(SELECTED_TENANT_STORAGE_KEY);
    } catch {
      // Ídem: que no se pueda borrar no debe impedir cerrar sesión.
    }
  }

  /** La organización elegida en una sesión anterior, si la hay. */
  readSelectedTenant(): string | null {
    const storage = this.storage();
    if (storage === null) {
      return null;
    }

    try {
      const value = storage.getItem(SELECTED_TENANT_STORAGE_KEY);
      return value === null || value === '' ? null : value;
    } catch {
      return null;
    }
  }

  writeSelectedTenant(tenantId: string): void {
    const storage = this.storage();
    if (storage === null) {
      return;
    }

    try {
      storage.setItem(SELECTED_TENANT_STORAGE_KEY, tenantId);
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
      if (event.key === REFRESH_TOKEN_STORAGE_KEY && event.newValue === null) {
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

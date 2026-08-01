import { DOCUMENT, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export const REFRESH_TOKEN_STORAGE_KEY = 'mantra.refresh-token';

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
    } catch {
      // Ídem: que no se pueda borrar no debe impedir cerrar sesión.
    }
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

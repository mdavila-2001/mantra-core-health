import { DOCUMENT, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Clave del refresh token. Mismo prefijo que el tema y el nav. */
export const REFRESH_TOKEN_STORAGE_KEY = 'mantra-core-health.refresh-token';

/** Clave de la organización elegida. */
export const TENANT_STORAGE_KEY = 'mantra-core-health.tenant';

/**
 * Lo único de la sesión que sobrevive a una recarga.
 *
 * ## Qué se guarda y qué no
 *
 * **El access token no se guarda.** Vive minutos, viaja en cada petición y guardarlo solo agranda
 * la ventana en la que un XSS se lo lleva. Al recargar se pide uno nuevo con el refresh token, que
 * es una petición y ya.
 *
 * **El refresh token sí**, porque sin él «recargar la página» sería «volver a escribir la
 * contraseña», y eso empuja a la gente a no recargar nunca. Va en `localStorage` y no en una
 * cookie `HttpOnly` —que sería más seguro— por una razón concreta: la API entrega el refresh token
 * **en el cuerpo** de `POST /iam/auth/login`, no como cookie, así que el navegador nunca lo
 * gestiona solo. Ver `PENDIENTES-BACKEND.md`.
 *
 * **La organización elegida también**, porque es una decisión de la persona y volver a preguntarle
 * en cada recarga es ruido. No es una credencial: el token dice a qué organizaciones pertenece y
 * `SessionStore.selectTenant` rechaza cualquier otra.
 *
 * ## Por qué es un servicio y no cuatro llamadas sueltas a `localStorage`
 *
 * Porque bajo SSR `localStorage` no existe, y porque en el modo privado de Safari, con la cuota
 * llena o con la política del navegador en contra, **lanza**. Perder la sesión guardada es un
 * inconveniente; una excepción sin capturar durante el arranque es una pantalla en blanco.
 */
@Injectable({
  providedIn: 'root',
})
export class SessionStorage {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readRefreshToken(): string | null {
    return this.read(REFRESH_TOKEN_STORAGE_KEY);
  }

  /**
   * Guarda el refresh token. `null` lo borra, que es lo que hay que hacer cuando la rotación lo
   * invalidó: dejar el viejo garantizaría un 401 en el próximo arranque.
   */
  writeRefreshToken(token: string | null): void {
    this.write(REFRESH_TOKEN_STORAGE_KEY, token);
  }

  readTenantId(): string | null {
    return this.read(TENANT_STORAGE_KEY);
  }

  writeTenantId(tenantId: string | null): void {
    this.write(TENANT_STORAGE_KEY, tenantId);
  }

  /** Borra todo lo persistido. Se llama al cerrar sesión y ante un refresco fallido. */
  clear(): void {
    this.write(REFRESH_TOKEN_STORAGE_KEY, null);
    this.write(TENANT_STORAGE_KEY, null);
  }

  private read(key: string): string | null {
    if (!this.isBrowser) {
      return null;
    }
    try {
      const value = this.document.defaultView?.localStorage.getItem(key) ?? null;
      return value === '' ? null : value;
    } catch {
      return null;
    }
  }

  private write(key: string, value: string | null): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      const storage = this.document.defaultView?.localStorage;
      if (value === null) {
        storage?.removeItem(key);
      } else {
        storage?.setItem(key, value);
      }
    } catch {
      // Sin persistencia la sesión sigue viva en memoria: se pierde al recargar y nada más.
    }
  }
}

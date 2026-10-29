import { InjectionToken } from '@angular/core';

/**
 * Algo que **olvida lo de la persona** cuando se cierra la sesión (TX-31).
 *
 * Hay contenido sensible que vive en el navegador —plantillas de mensajes del
 * médico, la copia local de la respuesta automática, tarifarios recordados— y
 * en un dispositivo compartido la persona siguiente no debe heredarlo. Cada
 * dueño de ese contenido se registra con este token (multi) y `AuthService.logout`
 * los corre a todos; así `core/auth` no depende de las pantallas.
 */
export type SessionCleaner = () => void;

/** Los limpiadores registrados, en el orden en que se declararon. */
export const SESSION_CLEANERS = new InjectionToken<readonly SessionCleaner[]>('SESSION_CLEANERS');

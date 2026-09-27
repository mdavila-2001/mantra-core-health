import { effect, inject, Injectable, untracked } from '@angular/core';

import { SessionStore } from '../auth/session.store';

/** Los criterios de una búsqueda, por nombre de filtro. Sólo valores con contenido. */
export type SearchCriteria = Readonly<Record<string, string>>;

/**
 * Lo último que se buscó en una pantalla, **en memoria** y no en la URL.
 *
 * ## Por qué existe
 *
 * El listado de pacientes y el archivo clínico guardaban `?q=` (nombre o
 * código) y `?nationalId=` (documento) en su propia URL. Así el dato de una
 * persona quedaba en la barra de direcciones, en el historial del navegador,
 * en el log de acceso del servidor que sirve la aplicación al recargar y en
 * el `Referer` de lo que se abriera desde ahí. Esta memoria reemplaza esa
 * función de la URL —que volver desde la ficha encuentre la búsqueda como
 * estaba— sin escribir el dato en ningún lado.
 *
 * ## Qué no hace, a propósito
 *
 * - **No persiste**: ni `localStorage` ni `sessionStorage` ni `history.state`,
 *   que el navegador guarda en disco para restaurar la sesión. Un `F5`
 *   empieza la búsqueda de cero; es el precio de no dejar el dato escrito.
 * - **No sobrevive a un cambio de sesión**: los criterios quedan atados a
 *   quien los escribió. Al cerrar sesión o entrar con otra cuenta en la misma
 *   pestaña se olvidan, así que nadie encuentra en el buscador lo que buscó
 *   la persona anterior.
 *
 * Una entrada por pantalla (`screen`), para que buscar en el archivo clínico
 * no pise lo que se buscaba en el listado de pacientes.
 */
@Injectable({
  providedIn: 'root',
})
export class SearchMemoryService {
  private readonly session = inject(SessionStore);

  private readonly entries = new Map<string, SearchCriteria>();

  /** Dueño de lo guardado: el `sub` de la sesión que lo escribió. */
  private owner: string | null = null;

  constructor() {
    // Olvida en cuanto cambia la sesión, sin esperar a la próxima lectura:
    // así el dato no queda en memoria después de cerrar sesión.
    effect(() => {
      const current = this.session.userId();
      untracked(() => this.forgetIfOwnerChanged(current));
    });
  }

  /** Los criterios guardados para la pantalla; `{}` si no hay. */
  read(screen: string): SearchCriteria {
    this.forgetIfOwnerChanged(this.session.userId());
    return this.entries.get(screen) ?? {};
  }

  /** Reemplaza los criterios de la pantalla. Los valores vacíos no se guardan. */
  write(screen: string, criteria: SearchCriteria): void {
    this.forgetIfOwnerChanged(this.session.userId());
    const withContent = Object.fromEntries(
      Object.entries(criteria).filter(([, value]) => value !== ''),
    );
    if (Object.keys(withContent).length === 0) {
      this.entries.delete(screen);
      return;
    }
    this.entries.set(screen, withContent);
  }

  /** Olvida los criterios de la pantalla. */
  forget(screen: string): void {
    this.entries.delete(screen);
  }

  private forgetIfOwnerChanged(current: string | null): void {
    if (current === this.owner) return;
    this.entries.clear();
    this.owner = current;
  }
}

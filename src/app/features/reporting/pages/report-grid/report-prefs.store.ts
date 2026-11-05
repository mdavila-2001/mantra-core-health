import { DOCUMENT, inject, Injectable, signal } from '@angular/core';

import { SessionStore } from '@core/auth/session.store';

const KEY_PREFIX = 'mantra.reporting.prefs.v1.';
export const MAX_RECENTS = 6;

interface StoredPrefs {
  readonly favorites: readonly string[];
  readonly recents: readonly string[];
}

function onlyIds(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * Favoritos y recientes del portal de reportería, por persona.
 *
 * Son una comodidad, no un dato: viven en `localStorage` bajo una clave que
 * incluye el usuario (en un equipo compartido, el siguiente no hereda las
 * estrellas del anterior) y toda lectura o escritura está protegida, porque el
 * almacenamiento puede lanzar (modo privado, cuota llena, política del
 * navegador, renderizado en servidor). Sin almacenamiento el portal funciona
 * igual: se pierde la memoria entre visitas y nada más.
 *
 * `load()` no se llama al construir: bajo SSR no hay almacenamiento y leerlo en
 * la ruta de render rompe la hidratación. La pantalla lo pide después de pintar.
 */
@Injectable({ providedIn: 'root' })
export class ReportPrefsStore {
  private readonly document = inject(DOCUMENT);
  private readonly session = inject(SessionStore);

  readonly favorites = signal<readonly string[]>([]);
  readonly recents = signal<readonly string[]>([]);

  private key(): string {
    return `${KEY_PREFIX}${this.session.userId() ?? 'anonymous'}`;
  }

  load(): void {
    let raw: string | null;
    try {
      raw = this.document.defaultView?.localStorage.getItem(this.key()) ?? null;
    } catch {
      raw = null;
    }
    if (raw === null) {
      this.favorites.set([]);
      this.recents.set([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<StoredPrefs> | null;
      this.favorites.set(onlyIds(parsed?.favorites));
      this.recents.set(onlyIds(parsed?.recents).slice(0, MAX_RECENTS));
    } catch {
      // Un valor corrupto no vale una pantalla rota: se empieza de cero.
      this.favorites.set([]);
      this.recents.set([]);
    }
  }

  isFavorite(id: string): boolean {
    return this.favorites().includes(id);
  }

  toggleFavorite(id: string): void {
    this.favorites.update((current) => (current.includes(id) ? current.filter((f) => f !== id) : [...current, id]));
    this.persist();
  }

  /** El abierto más reciente va primero; sin repetidos y con tope. */
  markOpened(id: string): void {
    this.recents.update((current) => [id, ...current.filter((r) => r !== id)].slice(0, MAX_RECENTS));
    this.persist();
  }

  /**
   * Vacía lo que está en memoria al cerrar sesión, para que quien entre después no vea ni un
   * cuadro con los favoritos del anterior antes de que `load()` lea los suyos. Lo guardado
   * (clave por usuario) no se toca: pertenece a quien lo marcó.
   */
  reset(): void {
    this.favorites.set([]);
    this.recents.set([]);
  }

  private persist(): void {
    try {
      const value: StoredPrefs = { favorites: this.favorites(), recents: this.recents() };
      this.document.defaultView?.localStorage.setItem(this.key(), JSON.stringify(value));
    } catch {
      // Sin persistencia el portal sigue funcionando.
    }
  }
}

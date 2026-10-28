import { DOCUMENT, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Dónde se guarda lo que la persona marcó, en este navegador. */
const KEY = 'alovida.chat-preferencias';

/** Cuántos emojis recientes se recuerdan. */
const RECENT_LIMIT = 24;

/** Lo que se guarda, tal cual va al almacenamiento. */
interface SavedPreferences {
  readonly favoritos?: readonly string[];
  readonly archivados?: readonly string[];
  readonly emojis?: readonly string[];
}

/**
 * Lo que cada persona marcó en su bandeja: favoritos, archivados y los emojis
 * que usa.
 *
 * ## Por qué en el navegador
 *
 * Porque **no hay dónde guardarlo**: `community.conversation_participants` no
 * tiene columnas para favorito ni archivado, y agregarlas es un cambio de
 * esquema que le toca al backend (F4 del plan). Mientras tanto esto vive en
 * `localStorage`, igual que las plantillas del profesional: se pierde al
 * cambiar de máquina, y eso es un costo aceptable frente a no poder archivar
 * nada.
 *
 * Se expone como señales y no como acceso al almacenamiento justamente para
 * que el día que existan los campos en la API, esta clase cambie de origen y
 * ninguna pantalla se entere.
 *
 * ## SSR
 *
 * Sin `localStorage` en el servidor no hay nada marcado, que es la respuesta
 * correcta: el servidor no sabe de quién es la sesión que va a hidratar.
 */
@Injectable({ providedIn: 'root' })
export class ChatPreferences {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly saved = this.read();

  readonly favorites = signal<ReadonlySet<string>>(
    new Set(this.saved.favoritos ?? []),
  );
  readonly archived = signal<ReadonlySet<string>>(
    new Set(this.saved.archivados ?? []),
  );
  readonly recentEmojis = signal<readonly string[]>(this.saved.emojis ?? []);

  isFavorite(conversationId: string): boolean {
    return this.favorites().has(conversationId);
  }

  isArchived(conversationId: string): boolean {
    return this.archived().has(conversationId);
  }

  toggleFavorite(conversationId: string): void {
    this.favorites.update((actual) => toggle(actual, conversationId));
    this.persist();
  }

  /**
   * Archiva o desarchiva. Archivar **quita el favorito**: son dos formas
   * opuestas de decir cuánto importa una conversación, y una fila que está en
   * las dos listas a la vez no se entiende en ninguna.
   */
  toggleArchived(conversationId: string): void {
    const estaba = this.isArchived(conversationId);
    this.archived.update((actual) => toggle(actual, conversationId));
    if (!estaba && this.isFavorite(conversationId)) {
      this.favorites.update((actual) => toggle(actual, conversationId));
    }
    this.persist();
  }

  /** Recuerda un emoji recién usado, al frente y sin repetir. */
  rememberEmoji(emoji: string): void {
    this.recentEmojis.update((lista) =>
      [emoji, ...lista.filter((e) => e !== emoji)].slice(0, RECENT_LIMIT),
    );
    this.persist();
  }

  private persist(): void {
    if (!this.isBrowser) {
      return;
    }
    const contenido: SavedPreferences = {
      favoritos: [...this.favorites()],
      archivados: [...this.archived()],
      emojis: [...this.recentEmojis()],
    };
    try {
      this.document.defaultView?.localStorage.setItem(
        KEY,
        JSON.stringify(contenido),
      );
    } catch {
      // Almacenamiento lleno o bloqueado. Lo marcado sigue valiendo en esta
      // sesión; no vale un cartel por algo que la persona no puede arreglar.
    }
  }

  private read(): SavedPreferences {
    if (!this.isBrowser) {
      return {};
    }
    try {
      const crudo = this.document.defaultView?.localStorage.getItem(KEY);
      if (crudo === null || crudo === undefined) {
        return {};
      }
      const guardado: unknown = JSON.parse(crudo);
      if (typeof guardado !== 'object' || guardado === null) {
        return {};
      }
      const { favoritos, archivados, emojis } = guardado as SavedPreferences;
      return {
        favoritos: onlyTexts(favoritos),
        archivados: onlyTexts(archivados),
        emojis: onlyTexts(emojis),
      };
    } catch {
      // Un valor corrupto no puede dejar a nadie sin bandeja.
      return {};
    }
  }
}

function toggle(actual: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const copia = new Set(actual);
  if (!copia.delete(id)) {
    copia.add(id);
  }
  return copia;
}

function onlyTexts(valor: unknown): readonly string[] {
  return Array.isArray(valor)
    ? valor.filter((item): item is string => typeof item === 'string')
    : [];
}

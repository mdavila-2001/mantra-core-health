import { DOCUMENT, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Dónde se guarda lo que la persona marcó, en este navegador. */
const CLAVE = 'alovida.chat-preferencias';

/** Cuántos emojis recientes se recuerdan. */
const TOPE_DE_RECIENTES = 24;

/** Lo que se guarda, tal cual va al almacenamiento. */
interface PreferenciasGuardadas {
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
export class ChatPreferencias {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly guardado = this.leer();

  readonly favoritos = signal<ReadonlySet<string>>(
    new Set(this.guardado.favoritos ?? []),
  );
  readonly archivados = signal<ReadonlySet<string>>(
    new Set(this.guardado.archivados ?? []),
  );
  readonly emojisRecientes = signal<readonly string[]>(this.guardado.emojis ?? []);

  esFavorito(conversationId: string): boolean {
    return this.favoritos().has(conversationId);
  }

  estaArchivado(conversationId: string): boolean {
    return this.archivados().has(conversationId);
  }

  alternarFavorito(conversationId: string): void {
    this.favoritos.update((actual) => alternar(actual, conversationId));
    this.persistir();
  }

  /**
   * Archiva o desarchiva. Archivar **quita el favorito**: son dos formas
   * opuestas de decir cuánto importa una conversación, y una fila que está en
   * las dos listas a la vez no se entiende en ninguna.
   */
  alternarArchivado(conversationId: string): void {
    const estaba = this.estaArchivado(conversationId);
    this.archivados.update((actual) => alternar(actual, conversationId));
    if (!estaba && this.esFavorito(conversationId)) {
      this.favoritos.update((actual) => alternar(actual, conversationId));
    }
    this.persistir();
  }

  /** Recuerda un emoji recién usado, al frente y sin repetir. */
  recordarEmoji(emoji: string): void {
    this.emojisRecientes.update((lista) =>
      [emoji, ...lista.filter((e) => e !== emoji)].slice(0, TOPE_DE_RECIENTES),
    );
    this.persistir();
  }

  private persistir(): void {
    if (!this.isBrowser) {
      return;
    }
    const contenido: PreferenciasGuardadas = {
      favoritos: [...this.favoritos()],
      archivados: [...this.archivados()],
      emojis: [...this.emojisRecientes()],
    };
    try {
      this.document.defaultView?.localStorage.setItem(
        CLAVE,
        JSON.stringify(contenido),
      );
    } catch {
      // Almacenamiento lleno o bloqueado. Lo marcado sigue valiendo en esta
      // sesión; no vale un cartel por algo que la persona no puede arreglar.
    }
  }

  private leer(): PreferenciasGuardadas {
    if (!this.isBrowser) {
      return {};
    }
    try {
      const crudo = this.document.defaultView?.localStorage.getItem(CLAVE);
      if (crudo === null || crudo === undefined) {
        return {};
      }
      const guardado: unknown = JSON.parse(crudo);
      if (typeof guardado !== 'object' || guardado === null) {
        return {};
      }
      const { favoritos, archivados, emojis } = guardado as PreferenciasGuardadas;
      return {
        favoritos: soloTextos(favoritos),
        archivados: soloTextos(archivados),
        emojis: soloTextos(emojis),
      };
    } catch {
      // Un valor corrupto no puede dejar a nadie sin bandeja.
      return {};
    }
  }
}

function alternar(actual: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const copia = new Set(actual);
  if (!copia.delete(id)) {
    copia.add(id);
  }
  return copia;
}

function soloTextos(valor: unknown): readonly string[] {
  return Array.isArray(valor)
    ? valor.filter((item): item is string => typeof item === 'string')
    : [];
}

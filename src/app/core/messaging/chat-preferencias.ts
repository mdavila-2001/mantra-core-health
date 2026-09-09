import {
  computed,
  DOCUMENT,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { ChatStore } from './chat.store';

/** Dónde se guardan los emojis recientes, en este navegador. */
const CLAVE = 'alovida.chat-preferencias';

/** Cuántos emojis recientes se recuerdan. */
const TOPE_DE_RECIENTES = 24;

/** Lo que se guarda, tal cual va al almacenamiento. */
interface PreferenciasGuardadas {
  /** Hasta F4.4 vivían acá; ahora sólo se leen para migrarlos a la API. */
  readonly favoritos?: readonly string[];
  readonly archivados?: readonly string[];
  readonly emojis?: readonly string[];
}

/**
 * Lo que cada persona marcó en su bandeja: favoritos, archivados, fijados y
 * los emojis que usa.
 *
 * ## Ahora vive en la API
 *
 * Hasta F4.4 esto era `localStorage`, porque `conversation_participants` no
 * tenía columnas para favorito ni archivado. Desde que las tiene, la verdad es
 * la fila de la bandeja (`ConversationListItem.isFavorite`, `isPinned`,
 * `archivedAt`) y esta clase es la misma puerta de siempre —las pantallas no
 * cambiaron— pero lee del `ChatStore` y escribe con `PATCH …/participant`.
 *
 * Lo que alguien tenía marcado en el navegador se **migra una vez** a la API
 * al cargar la bandeja, y después se olvida del almacenamiento: nadie pierde
 * lo que había archivado por el cambio de origen.
 *
 * Los emojis recientes siguen en el navegador: son un hábito de tecleo, no un
 * dato de la conversación.
 *
 * ## SSR
 *
 * Sin `localStorage` en el servidor no hay emojis recientes, que es la
 * respuesta correcta.
 */
@Injectable({ providedIn: 'root' })
export class ChatPreferencias {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(ChatStore);

  private readonly guardado = this.leer();

  readonly favoritos = computed<ReadonlySet<string>>(
    () => new Set(this.store.conversaciones().filter((c) => c.isFavorite).map((c) => c.id)),
  );
  readonly archivados = computed<ReadonlySet<string>>(
    () =>
      new Set(
        this.store
          .conversaciones()
          .filter((c) => c.archivedAt !== undefined)
          .map((c) => c.id),
      ),
  );
  readonly fijados = computed<ReadonlySet<string>>(
    () => new Set(this.store.conversaciones().filter((c) => c.isPinned).map((c) => c.id)),
  );
  readonly emojisRecientes = signal<readonly string[]>(this.guardado.emojis ?? []);

  private migrado = false;

  constructor() {
    // Lo que había en el navegador sube a la API la primera vez que la
    // bandeja carga, y sólo para las conversaciones que están en ella: no se
    // puede marcar lo que no se ve.
    effect(() => {
      if (!this.store.bandejaCargada() || this.migrado) {
        return;
      }
      this.migrado = true;
      untracked(() => this.migrar());
    });
  }

  esFavorito(conversationId: string): boolean {
    return this.favoritos().has(conversationId);
  }

  estaArchivado(conversationId: string): boolean {
    return this.archivados().has(conversationId);
  }

  estaFijado(conversationId: string): boolean {
    return this.fijados().has(conversationId);
  }

  alternarFavorito(conversationId: string): void {
    this.store.actualizarPreferencias(conversationId, {
      isFavorite: !this.esFavorito(conversationId),
    });
  }

  /**
   * Archiva o desarchiva. Archivar **quita el favorito**: son dos formas
   * opuestas de decir cuánto importa una conversación, y una fila que está en
   * las dos listas a la vez no se entiende en ninguna. La regla la aplica el
   * backend; acá se refleja en el acto para que la pantalla no espere.
   */
  alternarArchivado(conversationId: string): void {
    this.store.actualizarPreferencias(conversationId, {
      archived: !this.estaArchivado(conversationId),
    });
  }

  /** Fija arriba de la bandeja, o suelta. */
  alternarFijado(conversationId: string): void {
    this.store.actualizarPreferencias(conversationId, {
      isPinned: !this.estaFijado(conversationId),
    });
  }

  /** Recuerda un emoji recién usado, al frente y sin repetir. */
  recordarEmoji(emoji: string): void {
    this.emojisRecientes.update((lista) =>
      [emoji, ...lista.filter((e) => e !== emoji)].slice(0, TOPE_DE_RECIENTES),
    );
    this.persistir();
  }

  /**
   * Lo que quedó marcado en el navegador antes de F4.4, para subirlo a la API
   * una sola vez. Vacío si no había nada o si ya se migró.
   */
  pendientesDeMigrar(): { favoritos: readonly string[]; archivados: readonly string[] } {
    return {
      favoritos: this.guardado.favoritos ?? [],
      archivados: this.guardado.archivados ?? [],
    };
  }

  private migrar(): void {
    const { favoritos, archivados } = this.pendientesDeMigrar();
    if (favoritos.length === 0 && archivados.length === 0) {
      return;
    }
    const enBandeja = new Set(this.store.conversaciones().map((c) => c.id));
    for (const id of favoritos) {
      if (enBandeja.has(id) && !this.esFavorito(id) && !archivados.includes(id)) {
        this.store.actualizarPreferencias(id, { isFavorite: true });
      }
    }
    for (const id of archivados) {
      if (enBandeja.has(id) && !this.estaArchivado(id)) {
        this.store.actualizarPreferencias(id, { archived: true });
      }
    }
    this.olvidarMigradas();
  }

  /** Olvida lo migrado: a partir de acá el navegador sólo guarda emojis. */
  olvidarMigradas(): void {
    (this.guardado as { favoritos?: readonly string[] }).favoritos = undefined;
    (this.guardado as { archivados?: readonly string[] }).archivados = undefined;
    this.persistir();
  }

  private persistir(): void {
    if (!this.isBrowser) {
      return;
    }
    const contenido: PreferenciasGuardadas = {
      ...(this.guardado.favoritos?.length ? { favoritos: this.guardado.favoritos } : {}),
      ...(this.guardado.archivados?.length ? { archivados: this.guardado.archivados } : {}),
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

function soloTextos(valor: unknown): readonly string[] {
  return Array.isArray(valor)
    ? valor.filter((item): item is string => typeof item === 'string')
    : [];
}

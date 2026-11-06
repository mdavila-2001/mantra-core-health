import { DOCUMENT, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** A predefined chat wallpaper. Files come from `scripts/gen-chat-wallpapers.mjs`. */
export interface ChatWallpaperOption {
  readonly id: string;
  readonly nombre: string;
}

/** Same ids, same order, as the generator script. 1920×1080 (Full HD). */
export const CHAT_WALLPAPERS: readonly ChatWallpaperOption[] = [
  { id: 'menta', nombre: 'Menta' },
  { id: 'arena', nombre: 'Arena' },
  { id: 'cielo', nombre: 'Cielo' },
  { id: 'lavanda', nombre: 'Lavanda' },
  { id: 'durazno', nombre: 'Durazno' },
  { id: 'salvia', nombre: 'Salvia' },
  { id: 'petroleo', nombre: 'Petróleo' },
  { id: 'medianoche', nombre: 'Medianoche' },
  { id: 'bosque', nombre: 'Bosque' },
  { id: 'ciruela', nombre: 'Ciruela' },
];

/** Full HD image of a wallpaper, or its 384×216 thumbnail. */
export function wallpaperUrl(id: string, mini = false): string {
  return `/chat-fondos/${id}${mini ? '-mini' : ''}.jpg`;
}

const KEY = 'alovida.chat-wallpaper';

/**
 * The chat wallpaper chosen in this browser (like WhatsApp's «Fondo de
 * pantalla»). `null` is the theme's default paper with its doodle.
 */
@Injectable({ providedIn: 'root' })
export class ChatWallpaper {
  private readonly storage = isPlatformBrowser(inject(PLATFORM_ID))
    ? inject(DOCUMENT).defaultView?.localStorage
    : undefined;

  readonly elegido = signal<ChatWallpaperOption | null>(this.read());

  /** The CSS `url()` of the chosen wallpaper, for the thread host. */
  readonly cssUrl = computed(() => {
    const fondo = this.elegido();
    return fondo === null ? null : `url('${wallpaperUrl(fondo.id)}')`;
  });

  elegir(id: string | null): void {
    this.elegido.set(CHAT_WALLPAPERS.find((w) => w.id === id) ?? null);
    try {
      if (id === null) this.storage?.removeItem(KEY);
      else this.storage?.setItem(KEY, id);
    } catch {
      // Blocked storage: the choice still applies for this session.
    }
  }

  private read(): ChatWallpaperOption | null {
    try {
      const id = this.storage?.getItem(KEY);
      return CHAT_WALLPAPERS.find((w) => w.id === id) ?? null;
    } catch {
      return null;
    }
  }
}

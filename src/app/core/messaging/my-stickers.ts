import { DOCUMENT, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Dónde se guardan, en este navegador. */
const CLAVE = 'alovida.chat-mis-stickers';

/** Cuántos se guardan. El más viejo sale cuando entra uno nuevo. */
const TOPE_DE_STICKERS = 30;

/**
 * Lo más pesado que se acepta como sticker o GIF de la persona.
 *
 * Un sticker es una figurita, no una foto: con más de un mega deja de mandarse
 * al instante. La subida en sí admite hasta 10 MB (`UPLOAD_MAX_BYTES`); el tope
 * de acá es de producto y no del servidor.
 */
export const TOPE_DE_STICKER_BYTES = 1024 * 1024;

/**
 * Lo más pesado que se **guarda** en el navegador para reusarlo.
 *
 * `localStorage` tiene unos 5 MB para todo el sitio y un GIF grande se los
 * come. Uno más pesado que esto se manda igual, pero no queda en «Míos».
 */
const TOPE_PARA_GUARDAR_BYTES = 400 * 1024;

/** Los formatos que el almacenamiento reconoce por firma y sirven de sticker. */
export const TIPOS_DE_STICKER = ['image/png', 'image/webp', 'image/gif', 'image/jpeg'] as const;

/** Un sticker o GIF que la persona subió desde su equipo. */
export interface MiSticker {
  /** Estable dentro de este navegador; no viaja al servidor. */
  readonly id: string;
  readonly nombre: string;
  readonly tipo: string;
  /** El contenido como `data:` URL: lo que se pinta y lo que se vuelve a mandar. */
  readonly url: string;
}

/**
 * Los stickers y GIF propios de la persona.
 *
 * ## Por qué en el navegador
 *
 * Igual que los favoritos y las plantillas: no hay endpoint para «mis
 * stickers» y crearlo es trabajo de backend. Lo que sí existe es la subida de
 * archivos, así que **mandar** uno viaja por el mismo camino de siempre; lo
 * único local es la lista de los que quedaron a mano.
 *
 * ## SSR
 *
 * Sin `localStorage` en el servidor la lista arranca vacía, que es la respuesta
 * correcta: el servidor no sabe de quién es la sesión que va a hidratar.
 */
@Injectable({ providedIn: 'root' })
export class MisStickers {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly lista = signal<readonly MiSticker[]>(this.leer());

  /**
   * Revisa un archivo antes de aceptarlo como sticker.
   *
   * @returns El motivo del rechazo, o `null` si sirve.
   */
  static rechazo(archivo: File): string | null {
    if (!(TIPOS_DE_STICKER as readonly string[]).includes(archivo.type)) {
      return 'Elija una imagen PNG, WEBP, GIF o JPG.';
    }
    if (archivo.size > TOPE_DE_STICKER_BYTES) {
      return 'El sticker pesa más de 1 MB. Pruebe con uno más liviano.';
    }
    return null;
  }

  /**
   * Deja un sticker a mano para reusarlo. Devuelve `false` si no cupo: en ese
   * caso igual se puede mandar, pero no queda en la lista.
   */
  async guardar(archivo: File): Promise<boolean> {
    if (!this.isBrowser || archivo.size > TOPE_PARA_GUARDAR_BYTES) {
      return false;
    }
    const url = await leerComoDataUrl(archivo);
    if (url === null) {
      return false;
    }
    const sticker: MiSticker = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      nombre: archivo.name,
      tipo: archivo.type,
      url,
    };
    const previa = this.lista();
    // El mismo archivo dos veces no ocupa dos lugares.
    const sinRepetido = previa.filter((s) => s.url !== url);
    const nueva = [sticker, ...sinRepetido].slice(0, TOPE_DE_STICKERS);
    this.lista.set(nueva);
    if (!this.persistir()) {
      this.lista.set(previa);
      return false;
    }
    return true;
  }

  quitar(id: string): void {
    this.lista.update((lista) => lista.filter((s) => s.id !== id));
    this.persistir();
  }

  /** Vuelve a armar el `File` de uno guardado, para mandarlo otra vez. */
  static archivoDe(sticker: MiSticker): File | null {
    const coma = sticker.url.indexOf(',');
    if (coma < 0 || typeof atob !== 'function') {
      return null;
    }
    try {
      const binario = atob(sticker.url.slice(coma + 1));
      const bytes = new Uint8Array(binario.length);
      for (let i = 0; i < binario.length; i += 1) {
        bytes[i] = binario.charCodeAt(i);
      }
      return new File([bytes], sticker.nombre, { type: sticker.tipo });
    } catch {
      return null;
    }
  }

  private persistir(): boolean {
    if (!this.isBrowser) {
      return false;
    }
    try {
      this.document.defaultView?.localStorage.setItem(CLAVE, JSON.stringify(this.lista()));
      return true;
    } catch {
      // Almacenamiento lleno o bloqueado: se sigue con lo que hay en memoria.
      return false;
    }
  }

  private leer(): readonly MiSticker[] {
    if (!this.isBrowser) {
      return [];
    }
    try {
      const crudo = this.document.defaultView?.localStorage.getItem(CLAVE);
      const guardado: unknown = crudo == null ? [] : JSON.parse(crudo);
      return Array.isArray(guardado)
        ? guardado.filter(
            (s): s is MiSticker =>
              typeof s === 'object' &&
              s !== null &&
              typeof s.id === 'string' &&
              typeof s.url === 'string' &&
              s.url.startsWith('data:image/') &&
              typeof s.nombre === 'string' &&
              typeof s.tipo === 'string',
          )
        : [];
    } catch {
      return [];
    }
  }
}

function leerComoDataUrl(archivo: File): Promise<string | null> {
  return new Promise((resolver) => {
    const lector = new FileReader();
    lector.onload = () => resolver(typeof lector.result === 'string' ? lector.result : null);
    lector.onerror = () => resolver(null);
    lector.readAsDataURL(archivo);
  });
}

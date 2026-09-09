import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';

/**
 * Dispara la descarga de un `data:` URL como si fuera un archivo del disco.
 *
 * Un `<a download>` es el único elemento que convierte una navegación a un
 * `data:` URL en un guardado de archivo en vez de abrirlo en la pestaña: se
 * crea, se activa con un clic sintético y se descarta, sin pasar por el DOM
 * visible en ningún momento intermedio.
 *
 * Vive como servicio y no como función suelta porque necesita el `document`
 * inyectado: bajo SSR no hay a quién descargarle nada, y `isPlatformBrowser`
 * es lo que distingue "no hacer nada" de un error de renderizado.
 */
@Injectable({ providedIn: 'root' })
export class FileDownloader {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * @param dataUrl - El contenido, ya codificado (`FilesClient.contentDataUrl`).
   * @param filename - Nombre sugerido para el archivo guardado.
   */
  trigger(dataUrl: string, filename: string): void {
    if (!this.isBrowser) return;
    const enlace = this.document.createElement('a');
    enlace.href = dataUrl;
    enlace.download = filename;
    enlace.click();
  }
}

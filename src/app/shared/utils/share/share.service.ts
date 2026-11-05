import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';

import { FileDownloadService } from '../file-download/file-download.service';

/** Qué pasó con un pedido de compartir; quien llama lo dice con palabras. */
export type ShareOutcome = 'shared' | 'copied' | 'downloaded' | 'cancelled' | 'failed';

/**
 * Compartir una vista del producto: un enlace que reabre lo mismo, o un archivo
 * (imagen, SVG, PDF) para mandar por chat o imprimir.
 *
 * Es un servicio y no funciones sueltas por la misma razón que
 * {@link FileDownloadService}: el navegador de las pruebas no deja espiar una
 * función exportada, y la costura para sustituir `navigator.share` es la
 * inyección.
 *
 * **El enlace no lleva datos de la persona.** Sólo lleva la selección (la zona
 * del cuerpo, el término del glosario): lo mismo que ya está en la dirección de
 * la pantalla. Nada clínico viaja en la URL.
 */
@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly download = inject(FileDownloadService);

  /**
   * La dirección actual con los parámetros dados puestos (o quitados, si el
   * valor es `null`). Conserva el resto de la dirección tal cual.
   */
  linkWith(params: Readonly<Record<string, string | null>>): string {
    const url = new URL(this.document.location.href);
    for (const [name, value] of Object.entries(params)) {
      if (value === null || value === '') url.searchParams.delete(name);
      else url.searchParams.set(name, value);
    }
    url.hash = '';
    return url.toString();
  }

  /** Copia el texto al portapapeles; `false` si el navegador no lo deja. */
  async copy(text: string): Promise<boolean> {
    if (!this.isBrowser) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return this.copyWithSelection(text);
    }
  }

  /**
   * Comparte un enlace: la hoja de compartir del sistema si existe (el celular),
   * el portapapeles si no.
   */
  async shareLink(url: string, title: string): Promise<ShareOutcome> {
    if (!this.isBrowser) return 'failed';
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return 'shared';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      }
    }
    return (await this.copy(url)) ? 'copied' : 'failed';
  }

  /**
   * Entrega un archivo: por la hoja de compartir del sistema si acepta
   * archivos de ese tipo **y el aparato es táctil** (en el celular «compartir»
   * es mandarlo por mensaje), y si no, como descarga. En escritorio quien
   * eligió «Descargar» espera un archivo, no una hoja del sistema.
   */
  async shareFile(blob: Blob, fileName: string, title: string): Promise<ShareOutcome> {
    if (!this.isBrowser) return 'failed';
    const file = new File([blob], fileName, { type: blob.type });
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    if (touch && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ title, files: [file] });
        return 'shared';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      }
    }
    this.download.save(blob, fileName);
    return 'downloaded';
  }

  /** Sólo descarga, sin hoja de compartir: lo que pide quien eligió «Descargar». */
  save(blob: Blob, fileName: string): void {
    this.download.save(blob, fileName);
  }

  private copyWithSelection(text: string): boolean {
    const area = this.document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    this.document.body.append(area);
    area.select();
    try {
      return this.document.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}

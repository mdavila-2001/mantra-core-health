import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

/**
 * Entrega al navegador un archivo que ya se tiene en memoria (un `Blob`).
 *
 * Existe porque **la descarga de un dato clínico va por `HttpClient`, con la
 * credencial** (BR-05): abrir en una pestaña nueva una URL que pide
 * `Authorization` sale **sin** token y responde 401 (`window.open` no manda
 * cabeceras). Se baja el `Blob` con el interceptor de sesión, se crea un enlace
 * temporal y se lo entrega con `<a download>`; la URL del objeto se revoca en
 * cuanto se hizo clic, así que no queda ninguna dirección viva al contenido.
 *
 * Es un servicio y no una función suelta por la misma razón que
 * `CsvExportService`: el runner de pruebas no deja espiar una función exportada
 * y la costura para sustituirla es la inyección.
 */
@Injectable({ providedIn: 'root' })
export class FileDownloadService {
  private readonly document = inject(DOCUMENT);

  /**
   * @param blob - Los bytes a entregar.
   * @param fileName - Con qué nombre se guarda.
   */
  save(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    try {
      const enlace = this.document.createElement('a');
      enlace.href = url;
      enlace.download = fileName;
      enlace.rel = 'noopener';
      enlace.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

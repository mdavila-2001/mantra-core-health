import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';

/** Los dos únicos valores que admite el backend. */
export type FileCategory = 'DOCUMENT' | 'IMAGE';

/**
 * Sensibilidad del contenido. `PHI` marca información de salud protegida y
 * cambia cómo se guarda y quién puede descargarla: no es una etiqueta
 * decorativa, así que se pide explícita en cada subida.
 */
export type FileSensitivity = 'NORMAL' | 'PHI';

export interface UploadedFile {
  readonly id: string;
}

/**
 * Cliente de archivos.
 *
 * La subida va como `multipart/form-data`: **no se fija el `Content-Type` a
 * mano**. El navegador tiene que ponerlo él para incluir el `boundary`, y
 * escribirlo rompe la petición del lado del servidor.
 */
@Injectable({
  providedIn: 'root',
})
export class FilesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `POST /common/files/upload`. El campo del archivo se llama `file`. */
  upload(
    file: File,
    category: FileCategory,
    sensitivity: FileSensitivity,
  ): Observable<UploadedFile> {
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    form.append('sensitivity', sensitivity);

    return this.http.post<UploadedFile>(apiUrl(this.baseUrl, '/common/files/upload'), form);
  }
}

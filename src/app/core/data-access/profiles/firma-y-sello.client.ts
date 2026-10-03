import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, of, switchMap, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { FilesClient } from '../files/files.client';

/** La firma y el sello como `data:` URL, o `null` donde no hay imagen. */
export interface FirmaYSello {
  readonly firmaUrl: string | null;
  readonly selloUrl: string | null;
}

/** Lo que se guarda: una clave ausente deja lo que había; `null` la quita. */
export interface CambiosDeFirmaYSello {
  readonly firmaFileId?: string | null;
  readonly selloFileId?: string | null;
}

interface WireActivos {
  readonly signatureFileId: string | null;
  readonly sealFileId: string | null;
}

/**
 * La **firma** y el **sello médico** del profesional: la única puerta por la que
 * la ficha, el editor, el alta y el PDF los leen o los cambian.
 *
 * Son **imágenes** —la firma manuscrita escaneada y el sello—, **no** una firma
 * electrónica: no hay certificado ni criptografía, y este cliente no pretende
 * haberlos.
 *
 * ## Por qué existe
 *
 * GET/PUT propios del backend real; el simulador conserva el mismo contrato
 * para demostraciones. Los archivos se validan y persisten del lado de la API.
 *
 * `data:` y no una URL de archivo porque la CSP es `img-src 'self' data:` (ver
 * `FilesClient.imageDataUrl`).
 */
@Injectable({ providedIn: 'root' })
export class FirmaYSelloClient {
  private readonly http = inject(HttpClient);
  private readonly files = inject(FilesClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Lo que el profesional de la sesión tiene cargado.
   *
   * **Nunca falla**: una imagen que no carga no puede romper una ficha ni un
   * PDF, así que cualquier error —de la lectura o de una de las dos imágenes—
   * se lee como «no hay».
   */
  obtener(): Observable<FirmaYSello> {
    return this.http.get<WireActivos>(this.url()).pipe(
      switchMap((activos) =>
        forkJoin([this.imagen(activos.signatureFileId), this.imagen(activos.sealFileId)]),
      ),
      map(([firmaUrl, selloUrl]) => ({ firmaUrl, selloUrl })),
      catchError(() => of<FirmaYSello>({ firmaUrl: null, selloUrl: null })),
    );
  }

  /**
   * Sube la imagen como `IMAGE` de sensibilidad `NORMAL`. No la asocia a nada
   * todavía: eso es {@link FirmaYSelloClient.guardar}.
   *
   * @returns El id del archivo recién subido.
   */
  subir(archivo: File): Observable<string> {
    return this.files.upload(archivo, 'IMAGE', 'NORMAL').pipe(map((subido) => subido.id));
  }

  /** Deja la firma y/o el sello ya subidos como los del profesional, o los quita. */
  guardar(cambios: CambiosDeFirmaYSello): Observable<void> {
    return this.http
      .put<WireActivos>(this.url(), {
        ...(cambios.firmaFileId === undefined ? {} : { signatureFileId: cambios.firmaFileId }),
        ...(cambios.selloFileId === undefined ? {} : { sealFileId: cambios.selloFileId }),
      })
      .pipe(map(() => undefined));
  }

  private imagen(fileId: string | null): Observable<string | null> {
    return fileId === null
      ? of(null)
      : this.files.imageDataUrl(fileId).pipe(catchError(() => of<string | null>(null)));
  }

  private url(): string {
    return apiUrl(this.baseUrl, '/profiles/practitioners/me/signature-assets');
  }
}

import { inject, Injectable } from '@angular/core';
import { catchError, map, of, switchMap, type Observable } from 'rxjs';

import { FilesClient } from '../files/files.client';
import { DirectoryClient } from './directory.client';
import { blobToDataUrl } from '../files/blob-to-data-url';

/**
 * El logo de una organización —farmacia, laboratorio, clínica, aseguradora—: **la única
 * puerta** por la que sus pantallas lo leen o lo cambian.
 *
 * La API guarda el archivo en el perfil público de la organización. Su contenido
 * se lee por pertenencia al tenant, aunque lo haya subido otro miembro.
 *
 * `data:` y no una URL de archivo porque la CSP es `img-src 'self' data:`.
 */
@Injectable({ providedIn: 'root' })
export class OrganizationLogoClient {
  private readonly directory = inject(DirectoryClient);
  private readonly files = inject(FilesClient);

  /**
   * El logo como `data:` URL, o `null` si no hay o no se pudo leer. **Nunca falla**: un
   * logo que no carga no puede romper una ficha.
   */
  getUrl(tenantId: string): Observable<string | null> {
    return this.directory.getOrganizationLogo(tenantId).pipe(
      switchMap(({ fileId }) =>
        fileId === null
          ? of<string | null>(null)
          : this.directory.getOrganizationLogoContent(tenantId).pipe(
              switchMap(blobToDataUrl),
              map((url): string | null => url),
            ),
      ),
      catchError(() => of<string | null>(null)),
    );
  }

  /**
   * Sube la imagen. Categoría `IMAGE` y sensibilidad `NORMAL`: es el caso que cita
   * `upload-policy.ts` («el logo de una organización»).
   *
   * @returns El id del archivo recién subido; todavía no está asociado a nada.
   */
  upload(archivo: File): Observable<string> {
    return this.files.upload(archivo, 'IMAGE', 'NORMAL').pipe(map((subido) => subido.id));
  }

  /** Deja el archivo ya subido como logo de la organización, o lo quita con `null`. */
  save(tenantId: string, fileId: string | null): Observable<void> {
    return this.directory.setOrganizationLogo(tenantId, fileId).pipe(map(() => undefined));
  }
}

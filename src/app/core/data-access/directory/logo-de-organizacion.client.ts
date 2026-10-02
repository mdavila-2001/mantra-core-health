import { inject, Injectable } from '@angular/core';
import { catchError, map, of, switchMap, type Observable } from 'rxjs';

import { FilesClient } from '../files/files.client';
import { DirectoryClient } from './directory.client';

/**
 * El logo de una organización —farmacia, laboratorio, clínica, aseguradora—: **la única
 * puerta** por la que sus pantallas lo leen o lo cambian.
 *
 * Es el mismo patrón que `LogoDelConsultorioClient`: hoy el backend no tiene un
 * endpoint con el que el dueño de la organización cambie su propio logo (la imagen
 * vive en el perfil público y sólo la escribe un administrador de plataforma), así
 * que la maqueta responde `GET`/`PUT /tenants/{id}/logo`. Cuando la API real lo
 * resuelva se toca **este archivo y `DirectoryClient`**, no las pantallas.
 *
 * `data:` y no una URL de archivo porque la CSP es `img-src 'self' data:`.
 */
@Injectable({ providedIn: 'root' })
export class LogoDeOrganizacionClient {
  private readonly directory = inject(DirectoryClient);
  private readonly files = inject(FilesClient);

  /**
   * El logo como `data:` URL, o `null` si no hay o no se pudo leer. **Nunca falla**: un
   * logo que no carga no puede romper una ficha.
   */
  obtenerUrl(tenantId: string): Observable<string | null> {
    return this.directory.getOrganizationLogo(tenantId).pipe(
      switchMap(({ fileId }) =>
        fileId === null
          ? of<string | null>(null)
          : this.files.imageDataUrl(fileId).pipe(map((url): string | null => url)),
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
  subir(archivo: File): Observable<string> {
    return this.files.upload(archivo, 'IMAGE', 'NORMAL').pipe(map((subido) => subido.id));
  }

  /** Deja el archivo ya subido como logo de la organización, o lo quita con `null`. */
  guardar(tenantId: string, fileId: string | null): Observable<void> {
    return this.directory.setOrganizationLogo(tenantId, fileId).pipe(map(() => undefined));
  }
}

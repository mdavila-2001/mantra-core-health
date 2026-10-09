import { inject, Injectable } from '@angular/core';
import { catchError, map, of, switchMap, type Observable } from 'rxjs';

import { FilesClient } from '../files/files.client';
import { PracticeSitesClient } from './practice-sites.client';
import type { PracticeSite } from './practice-sites.types';

/**
 * El logo del consultorio del profesional: **la única puerta** por la que la
 * ficha, el editor y el PDF lo leen o lo cambian.
 *
 * ## Por qué existe
 *
 * Hoy el backend no tiene dónde guardar el logo de un consultorio: la sede no
 * tiene columna y el perfil público de la organización sólo lo escribe un
 * administrador. Mientras se decide, la maqueta lo cuelga de la sede propia
 * (`PracticeSite.logoFileId`). Si cada pantalla supiera eso, mudarlo al
 * backend real sería tocar todas. Con esta fachada es tocar **este archivo**.
 *
 * ## Contrato que ya no cambia
 *
 * - {@link PracticeLogoClient.getUrl} — el logo como `data:` URL, o
 *   `null` si no hay o no se pudo leer. **Nunca falla**: un logo que no carga
 *   no puede romper una ficha ni un PDF.
 * - {@link PracticeLogoClient.upload} — sube el archivo y devuelve su id.
 *   No lo asocia a nada todavía.
 * - {@link PracticeLogoClient.save} — asocia (o quita, con `null`) el
 *   archivo ya subido.
 *
 * `data:` y no una URL de archivo porque la CSP es `img-src 'self' data:`
 * (ver `FilesClient.imageDataUrl`).
 */
@Injectable({ providedIn: 'root' })
export class PracticeLogoClient {
  private readonly sites = inject(PracticeSitesClient);
  private readonly files = inject(FilesClient);

  /**
   * El logo del consultorio propio como `data:` URL.
   *
   * @param practitionerProfileId - El perfil profesional de la sesión.
   * @returns La imagen, o `null` si no hay logo, no hay consultorio propio o la
   * lectura falló.
   */
  getUrl(practitionerProfileId: string): Observable<string | null> {
    return this.ownSite(practitionerProfileId).pipe(
      switchMap((sede) =>
        sede?.logoFileId
          ? this.files.imageDataUrl(sede.logoFileId).pipe(map((url): string | null => url))
          : of<string | null>(null),
      ),
      catchError(() => of<string | null>(null)),
    );
  }

  /**
   * Sube la imagen. Categoría `IMAGE` y sensibilidad `NORMAL`: es el mismo
   * caso que cita `upload-policy.ts` («el logo de una organización»).
   *
   * @returns El id del archivo recién subido.
   */
  upload(archivo: File): Observable<string> {
    return this.files.upload(archivo, 'IMAGE', 'NORMAL').pipe(map((subido) => subido.id));
  }

  /**
   * Deja el archivo ya subido como logo del consultorio, o lo quita.
   *
   * Sin consultorio propio no hay dónde guardarlo: termina sin hacer nada en
   * vez de inventar un error, porque el resto del perfil se guardó igual.
   *
   * @param fileId - El archivo que devolvió {@link PracticeLogoClient.upload},
   * o `null` para quitar el logo.
   */
  save(practitionerProfileId: string, fileId: string | null): Observable<void> {
    return this.ownSite(practitionerProfileId).pipe(
      switchMap((sede) =>
        sede === undefined
          ? of(undefined)
          : this.sites.setSiteLogo(sede.id, fileId).pipe(map(() => undefined)),
      ),
    );
  }

  private ownSite(practitionerProfileId: string): Observable<PracticeSite | undefined> {
    return this.sites
      .listSitesOfPractitioner(practitionerProfileId)
      .pipe(map((pagina) => pagina.items.find((sede) => sede.isOwnSite === true)));
  }
}

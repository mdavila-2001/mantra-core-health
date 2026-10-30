import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, of, switchMap, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { FilesClient } from '../files/files.client';
import { PracticeSitesClient } from './practice-sites.client';
import type { PracticeSite } from './practice-sites.types';

/**
 * Los formatos que la API acepta como logo (`LOGO_IMAGE_MIME_TYPES`), con la
 * forma del atributo `accept` para que el selector y la validación lean lo mismo.
 */
export const PRACTICE_LOGO_ACCEPT = 'image/png,image/jpeg,image/webp';

/** El tope de un logo en la API (`LOGO_MAX_BYTES`): 2 MB. */
export const PRACTICE_LOGO_MAX_BYTES = 2 * 1024 * 1024;

/** Lo que el alta necesita de la pre-carga anónima: el id a reenviar. */
interface RegistrationLogoUpload {
  readonly fileId?: string | null;
}

/**
 * El logo del consultorio del profesional: **la única puerta** por la que la
 * ficha, el editor, el PDF y el alta lo leen, lo suben o lo cambian.
 *
 * ## Dónde vive
 *
 * En la sede propia (`practice.practice_sites.logo_file_id`): la API lo manda
 * en `PracticeSite.logoFileId` y lo cambia con
 * `PUT /practitioners/me/sites/:siteId/logo`, sólo sobre el consultorio
 * **propio**. Las pantallas no saben nada de eso; si mañana cambia de lugar,
 * se toca **este archivo**.
 *
 * ## Contrato
 *
 * - {@link PracticeLogoClient.getUrl} — el logo como `data:` URL, o
 *   `null` si no hay o no se pudo leer. **Nunca falla**: un logo que no carga
 *   no puede romper una ficha ni un PDF.
 * - {@link PracticeLogoClient.upload} — sube el archivo y devuelve su id.
 *   No lo asocia a nada todavía.
 * - {@link PracticeLogoClient.save} — asocia (o quita, con `null`) el
 *   archivo ya subido.
 * - {@link PracticeLogoClient.uploadForRegistration} — la pre-carga del alta,
 *   cuando todavía no hay cuenta.
 *
 * `data:` y no una URL de archivo porque la CSP es `img-src 'self' data:`
 * (ver `FilesClient.imageDataUrl`).
 */
@Injectable({ providedIn: 'root' })
export class PracticeLogoClient {
  private readonly sites = inject(PracticeSitesClient);
  private readonly files = inject(FilesClient);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

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
   * Sube la imagen. Categoría `IMAGE` y sensibilidad `NORMAL`: es lo que la API
   * exige al asociarla como logo, junto con el formato y el tope de
   * {@link PRACTICE_LOGO_ACCEPT} y {@link PRACTICE_LOGO_MAX_BYTES}.
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

  /**
   * Pre-carga el logo del consultorio propio que declara el alta del médico:
   * `POST /iam/auth/upload-registration-logo`, sin sesión.
   *
   * El archivo nace sin dueño y sólo sirve cuando el alta lo reclama por
   * `ownSite.logoFileId`, en la misma transacción que crea la cuenta. La API
   * aplica las mismas reglas que al logo del perfil y las vuelve a comprobar al
   * reclamarlo.
   *
   * @returns El id que el alta reenvía en `ownSite.logoFileId`.
   * @throws Error si la API no confirma el id: un alta sin él perdería el logo
   * sin avisar.
   */
  uploadForRegistration(file: File): Observable<string> {
    const form = new FormData();
    form.append('file', file);
    return this.http
      .post<RegistrationLogoUpload>(
        apiUrl(this.baseUrl, '/iam/auth/upload-registration-logo'),
        form,
      )
      .pipe(map(confirmedFileId));
  }

  private ownSite(practitionerProfileId: string): Observable<PracticeSite | undefined> {
    return this.sites
      .listSitesOfPractitioner(practitionerProfileId)
      .pipe(map((pagina) => pagina.items.find((sede) => sede.isOwnSite === true)));
  }
}

function confirmedFileId(upload: RegistrationLogoUpload | null): string {
  const fileId = upload?.fileId?.trim() ?? '';
  if (fileId === '') {
    throw new Error('No pudimos confirmar la carga del logo. Vuelva a intentarlo.');
  }
  return fileId;
}

import { inject, Injectable, signal } from '@angular/core';
import { catchError, of, switchMap } from 'rxjs';

import { FilesClient } from '../files/files.client';
import { ProfilesClient } from './profiles.client';

/**
 * La foto de perfil de la persona con sesión, lista para pintar.
 *
 * Vive acá y no en la pantalla de perfil porque la ven **dos** lugares: el
 * retrato del perfil y el avatar del encabezado, que está en todas las
 * pantallas. Quien sube o cambia la foto la deja con {@link set}; el
 * encabezado la pide una vez con {@link load}.
 *
 * Es sólo la foto del paciente (`/profiles/patients/me`). Si no hay foto o la
 * lectura falla, `url` queda en `null` y el avatar sigue mostrando iniciales:
 * una foto que no llega no es un error que haya que contarle a nadie.
 */
@Injectable({ providedIn: 'root' })
export class OwnPhotoStore {
  private readonly profiles = inject(ProfilesClient);
  private readonly files = inject(FilesClient);

  readonly url = signal<string | null>(null);
  private pedida = false;

  /** Lee la foto una sola vez por sesión de navegador. */
  load(): void {
    if (this.pedida) {
      return;
    }
    this.pedida = true;
    this.profiles
      .getOwnPatientProfile()
      .pipe(
        switchMap((perfil) =>
          perfil.photoFileId === undefined ? of(null) : this.files.imageDataUrl(perfil.photoFileId),
        ),
        catchError(() => of<string | null>(null)),
      )
      .subscribe((url) => this.url.set(url));
  }

  /** Quien ya tiene la foto en la mano (perfil, subida) la deja acá. */
  set(url: string | null): void {
    this.pedida = true;
    this.url.set(url);
  }

  /** Al cerrar sesión: la foto de una persona no puede verse en la cuenta siguiente. */
  reset(): void {
    this.pedida = false;
    this.url.set(null);
  }
}

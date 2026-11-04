import { effect, inject, Injectable, signal } from '@angular/core';
import { catchError, of, switchMap, type Observable } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
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
 * Es la foto del perfil con el que la persona se presenta: la del perfil
 * profesional si la sesión tiene uno (`hpid`), la del paciente si no. Así el
 * avatar del encabezado y el retrato de «Mi perfil» muestran la misma imagen.
 * Si no hay foto o la lectura falla, `url` queda en `null` y el avatar sigue mostrando iniciales:
 * una foto que no llega no es un error que haya que contarle a nadie.
 */
@Injectable({ providedIn: 'root' })
export class OwnPhotoStore {
  private readonly profiles = inject(ProfilesClient);
  private readonly files = inject(FilesClient);
  private readonly auth = inject(AuthService);

  readonly url = signal<string | null>(null);
  private pedida = false;

  /** De quién es la foto que se está pidiendo o ya se tiene; `null` sin sesión. */
  private duenio: string | null = null;

  constructor() {
    // La foto es de **una** sesión: si la persona cambia o la sesión termina
    // —por cerrar sesión, por vencimiento o por un 401—, se borra. Atarlo sólo
    // al botón de salir dejaba la foto de la cuenta anterior a la vista de la
    // siguiente.
    effect(() => {
      const actual = this.auth.userId() ?? null;
      if (actual !== this.duenio) {
        this.reset();
        this.duenio = actual;
      }
    });
  }

  /** Lee la foto una sola vez por sesión de navegador. */
  load(): void {
    if (this.pedida) {
      return;
    }
    this.pedida = true;
    const paraQuien = this.duenio;
    // Practitioners see their practitioner photo on «Mi perfil», so the header must too.
    const perfil$: Observable<{ readonly photoFileId?: string }> =
      this.auth.practitionerProfileId() === null
        ? this.profiles.getOwnPatientProfile()
        : this.profiles.getOwnPractitionerProfile();
    perfil$
      .pipe(
        switchMap((perfil) =>
          perfil.photoFileId === undefined ? of(null) : this.files.imageDataUrl(perfil.photoFileId),
        ),
        catchError(() => of<string | null>(null)),
      )
      .subscribe((url) => {
        // Una respuesta que llega después de un cambio de sesión es de otra persona.
        if (this.duenio === paraQuien) {
          this.url.set(url);
        }
      });
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

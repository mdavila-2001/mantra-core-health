import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { SessionStore } from '../auth/session.store';
import { CommunityClient } from '../data-access/community/community.client';
import type { OwnPublicProfile } from '../data-access/community/community.types';

/**
 * El perfil público propio de quien tiene sesión: **una lectura por sesión**.
 *
 * ## Por qué un store y no cada pantalla
 *
 * El perfil público es una entidad aparte del perfil de paciente o de médico
 * que trae la sesión, y casi todo lo social lo necesita: publicar, reaccionar,
 * seguir, guardar y comentar exigen el id del perfil propio (el contrato no lo
 * deduce de la sesión). Antes cada pantalla lo pedía por su cuenta; con la red
 * social repartida en inicio, «Mi red», guardados y la campana, eran cuatro
 * lecturas iguales.
 *
 * ## Cuándo se vuelve a leer
 *
 * Al iniciar sesión y al cerrarla (se olvida). Cambiar de usuario sin recargar
 * la página no puede dejar el perfil del anterior: la respuesta que llega
 * tarde de una sesión que ya no es la vigente se descarta.
 */
@Injectable({ providedIn: 'root' })
export class OwnProfileStore {
  private readonly community = inject(CommunityClient);
  private readonly sesion = inject(SessionStore);

  /** El perfil, o `null` si no tiene o todavía no se sabe (ver {@link resuelto}). */
  readonly perfil = signal<OwnPublicProfile | null>(null);

  /** `true` cuando ya se sabe si tiene perfil; antes, `null` no quiere decir «no tiene». */
  readonly resuelto = signal(false);

  /** Si la lectura falló: no es lo mismo que «no tiene perfil». */
  readonly fallo = signal(false);

  /** Su id: lo que piden las escrituras. */
  readonly id = computed(() => this.perfil()?.id ?? null);

  /** Cada lectura lleva un número; la que llega con otro es de una sesión que ya no es. */
  private lectura = 0;

  private readonly alCambiarLaSesion = effect(() => {
    const hay = this.sesion.isAuthenticated();
    untracked(() => (hay ? this.cargar() : this.olvidar()));
  });

  /** Lee el perfil propio. Sirve también para reintentar tras un fallo. */
  cargar(): void {
    const esta = ++this.lectura;
    this.resuelto.set(false);
    this.fallo.set(false);

    this.community.getOwnProfile().subscribe({
      next: (propio) => {
        if (esta !== this.lectura) return;
        this.perfil.set(propio);
        this.resuelto.set(true);
      },
      error: () => {
        if (esta !== this.lectura) return;
        this.perfil.set(null);
        this.fallo.set(true);
        this.resuelto.set(true);
      },
    });
  }

  /** Reemplaza el perfil tras guardarlo desde otra pantalla (la vitrina). */
  actualizar(perfil: OwnPublicProfile): void {
    this.perfil.set(perfil);
    this.resuelto.set(true);
    this.fallo.set(false);
  }

  private olvidar(): void {
    this.lectura += 1;
    this.perfil.set(null);
    this.resuelto.set(false);
    this.fallo.set(false);
  }
}

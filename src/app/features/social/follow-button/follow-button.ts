import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import { SessionStore } from '@core/auth/session.store';
import { describeApiFailure } from '@core/http/api-failure';
import { FollowStore } from '@core/social/follow.store';
import { OwnProfileStore } from '@core/social/own-profile.store';
import { ProfileSummaryStore } from '@core/social/profile-summary.store';
import { ToastService } from '@shared/components/molecules/toast/toast.service';

/**
 * «Seguir» / «Siguiendo» — el mismo botón en la cabecera de cada publicación,
 * en la ficha pública, en las sugerencias y en «Mi red».
 *
 * ## De dónde sale el estado
 *
 * De `FollowStore`, que lee una vez a quién sigue la persona. Todas las
 * instancias miran el mismo conjunto, así que seguir desde la tarjeta cambia a
 * «Siguiendo» la ficha y las sugerencias sin que ninguna recargue.
 *
 * ## Se identifica por `slug`, no por id
 *
 * La superficie pública no expone ids internos —sólo `slug`—, pero seguir
 * exige el id del perfil. Quien lo conoce lo pasa en `perfilId`; si no, se
 * resuelve por `slug` (una vez por persona, con caché). Esa resolución **sólo
 * se pide con sesión y vitrina propia**: un anónimo que mira veinte
 * publicaciones no dispara veinte lecturas para un botón que lo va a mandar a
 * entrar.
 *
 * ## Qué hace en cada situación (AC-01-17)
 *
 * - **Sin sesión**: se ve igual y lleva a `/auth` con retorno a esta página.
 *   Esconderlo dejaría a quien lee sin saber que puede seguir.
 * - **Con sesión pero sin vitrina pública**: lleva a crearla; el contrato exige
 *   el perfil de quien sigue y no lo deduce de la sesión.
 * - **El propio perfil**: no se dibuja. Nadie se sigue a sí mismo.
 * - **Con una escritura en vuelo**: el botón se bloquea (sin doble envío).
 */
@Component({
  selector: 'app-follow-button',
  templateUrl: './follow-button.html',
  styleUrl: './follow-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FollowButton {
  private readonly seguimientos = inject(FollowStore);
  private readonly propio = inject(OwnProfileStore);
  private readonly sesion = inject(SessionStore);
  private readonly resumenes = inject(ProfileSummaryStore);
  private readonly router = inject(Router);
  private readonly avisos = inject(ToastService);

  /** El `slug` público de la persona. */
  readonly slug = input.required<string>();

  /** Su id de perfil, si quien monta el botón ya lo conoce (evita la resolución por `slug`). */
  readonly perfilId = input<string | null>(null);

  /** Cómo se llama, para el nombre accesible: «Seguir a Dra. Rojas». */
  readonly nombre = input('');

  /** `tarjeta` es el botón compacto de la cabecera; `ficha` el grande de la página de perfil. */
  readonly variante = input<'tarjeta' | 'ficha'>('tarjeta');

  /** Si es el perfil de quien mira, no hay nada que ofrecer. */
  protected readonly esPropio = computed(() => {
    const miPerfil = this.propio.perfil();
    return miPerfil !== null && miPerfil.slug === this.slug();
  });

  /**
   * El id a seguir. `undefined` mientras se resuelve; `null` si no se puede (o
   * si no corresponde buscarlo: sin sesión o sin vitrina propia).
   */
  private readonly destino = computed<string | null | undefined>(() => {
    const conocido = this.perfilId();
    if (conocido !== null) return conocido;
    if (!this.sesion.isAuthenticated() || this.propio.id() === null) return null;
    return this.resumenes.idPorSlug(this.slug());
  });

  protected readonly sigue = computed(() => {
    const id = this.destino();
    return typeof id === 'string' && this.seguimientos.sigue(id);
  });

  /** Con sesión y vitrina, hace falta haber leído a quién sigue y conocer el id. */
  protected readonly listo = computed(() => {
    if (!this.sesion.isAuthenticated() || this.propio.id() === null) return true;
    return this.seguimientos.cargado() && typeof this.destino() === 'string';
  });

  protected readonly ocupado = computed(() => {
    const id = this.destino();
    return typeof id === 'string' && this.seguimientos.ocupado(id);
  });

  protected readonly nombreAccesible = computed(() => {
    const quien = this.nombre().trim();
    const accion = this.sigue() ? 'Dejar de seguir' : 'Seguir';
    return quien === '' ? accion : `${accion} a ${quien}`;
  });

  protected alternar(): void {
    if (!this.sesion.isAuthenticated()) {
      void this.router.navigate(['/auth'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (this.propio.id() === null) {
      void this.router.navigate(['/my-account/profile/edit']);
      return;
    }

    const id = this.destino();
    if (typeof id !== 'string' || this.ocupado()) return;

    const quitar = this.sigue();
    (quitar ? this.seguimientos.dejarDeSeguir(id) : this.seguimientos.seguir(id)).subscribe({
      error: (error: unknown) =>
        this.avisos.error(
          describeApiFailure(
            error,
            quitar ? 'No pudimos dejar de seguir. Reintente.' : 'No pudimos seguir. Reintente.',
          ),
        ),
    });
  }
}

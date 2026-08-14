import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { CommunityClient } from '../../../../core/data-access/community/community.client';
import type { OwnPublicProfile } from '../../../../core/data-access/community/community.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Avatar } from '../../../../shared/components/atoms/avatar/avatar';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';

/** Sólo minúsculas, números y guiones — la misma regla que el backend valida. */
const SLUG_VALIDO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * **Vitrina pública** — la configuras y ves acá mismo cómo queda.
 *
 * ## Por qué edición y vista previa viven en la misma pantalla
 *
 * Separarlas en dos pantallas —una para escribir el slug y la biografía, otra
 * para verlas— obliga a ir y volver para confirmar cada cambio. Acá el
 * formulario y la tarjeta de «así te ven» están una al lado de la otra: se
 * escribe de un lado y el resultado se lee del otro, en la misma pantalla,
 * antes de guardar.
 *
 * ## `PUT` idempotente: no hay «crear» separado de «editar»
 *
 * `CommunityClient.upsertOwnProfile` crea la vitrina si no existía y la
 * actualiza si ya existía — la misma llamada, el mismo formulario. La pantalla
 * no necesita preguntarse cuál de las dos cosas está pasando: sólo manda lo que
 * el formulario dice.
 *
 * ## Quién puede tener vitrina
 *
 * Cualquier sesión con perfil profesional. `getOwnProfile` resuelve el sujeto
 * por el mismo criterio que el backend: el perfil profesional si lo hay, la
 * cuenta si no.
 */
@Component({
  selector: 'app-public-profile-preview',
  imports: [
    Alert,
    AppButtonLink,
    Avatar,
    Card,
    FormActions,
    FormField,
    Input,
    PageHeader,
    RouterLink,
    Switch,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './public-profile-preview.html',
  styleUrl: './public-profile-preview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicProfilePreview {
  private readonly community = inject(CommunityClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /**
   * `null` es un estado **listo**, no una carga: significa «esta sesión
   * todavía no tiene vitrina», que es el punto de partida de cualquiera.
   */
  protected readonly perfil = signal<ViewState<OwnPublicProfile | null>>(loading());

  protected readonly tieneVitrina = computed(() => {
    const estado = this.perfil();
    return estado.status === 'ready' && estado.data !== null;
  });

  /* -- El formulario --------------------------------------------------------- */

  protected readonly slug = signal('');
  protected readonly displayName = signal('');
  protected readonly headline = signal('');
  protected readonly biography = signal('');
  protected readonly acceptsReviews = signal(true);
  protected readonly guardando = signal(false);

  protected readonly slugValido = computed(() => SLUG_VALIDO.test(this.slug()));

  protected readonly puedeGuardar = computed(
    () => this.slugValido() && this.displayName().trim() !== '',
  );

  /** Cómo se ve la tarjeta pública mientras se edita, sin guardar todavía. */
  protected readonly vistaPrevia = computed(() => ({
    displayName: this.displayName().trim() || 'Tu nombre',
    headline: this.headline().trim(),
    biography: this.biography().trim(),
    slug: this.slug().trim() || 'tu-slug',
  }));

  constructor() {
    this.cargar();
  }

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.perfil.set(loading());
    this.community.getOwnProfile().subscribe({
      next: (perfil) => {
        this.sembrarFormulario(perfil);
        this.perfil.set(ready(perfil));
      },
      error: (error: unknown) => this.perfil.set(errorToViewState<OwnPublicProfile | null>(error)),
    });
  }

  private sembrarFormulario(perfil: OwnPublicProfile | null): void {
    this.slug.set(perfil?.slug ?? '');
    this.displayName.set(perfil?.displayName ?? this.auth.displayName() ?? '');
    this.headline.set(perfil?.headline ?? '');
    this.biography.set(perfil?.biography ?? '');
    this.acceptsReviews.set(perfil?.acceptsReviews ?? true);
  }

  protected guardar(): void {
    const tenantId = this.auth.activeTenantId();
    if (tenantId === null || !this.puedeGuardar() || this.guardando()) {
      return;
    }

    this.guardando.set(true);
    this.community
      .upsertOwnProfile({
        tenantId,
        slug: this.slug().trim(),
        displayName: this.displayName().trim(),
        headline: this.headline().trim() || undefined,
        biography: this.biography().trim() || undefined,
        acceptsReviews: this.acceptsReviews(),
      })
      .subscribe({
        next: (perfil) => {
          this.guardando.set(false);
          this.sembrarFormulario(perfil);
          this.perfil.set(ready(perfil));
          this.toasts.success('Tu vitrina pública quedó guardada.', 'Perfil público');
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          const esConflicto = error instanceof HttpErrorResponse && error.status === 409;
          this.toasts.error(
            esConflicto
              ? 'Ese enlace ya lo usa otra persona. Probá con otro.'
              : 'No se pudo guardar. Probá de nuevo.',
            'Perfil público',
          );
        },
      });
  }
}

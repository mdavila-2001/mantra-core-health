import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CommunityClient } from '../../../../core/data-access/community/community.client';
import type { OwnPublicProfile } from '../../../../core/data-access/community/community.types';
import type { PublicProfileDetail } from '../../../../core/data-access/public-directory/public-directory.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { BackLink } from '../../../../shared/components/atoms/back-link/back-link';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { PublicProfileCard } from '../../../public-profile/public-profile-card/public-profile-card';
import {
  avatarUrlDe,
  coverUrlDe,
  fichaPublicaDe,
} from '../public-profile-settings/public-profile-settings';

/**
 * **Cómo me ven** — la ficha pública, de sólo lectura (ALV-004).
 *
 * Hasta el 05/09 esta ruta era también la pantalla donde se configuraba la
 * vitrina: un segundo lugar para configurar el perfil, que es exactamente lo
 * que el cliente pidió eliminar. La configuración vive ahora en
 * `/my-account/edit` (sección «Lo que ven los demás»); acá sólo se mira lo
 * guardado, con **el mismo componente** que dibuja `/p/:slug`.
 */
@Component({
  selector: 'app-public-profile-preview',
  imports: [
    Alert,
    AppButtonLink,
    BackLink,
    PageHeader,
    PublicProfileCard,
    RouterLink,
    ViewStateHost,
  ],
  templateUrl: './public-profile-preview.html',
  styleUrl: './public-profile-preview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicProfilePreview {
  private readonly community = inject(CommunityClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /** `null` es un estado listo: «todavía no tenés vitrina». */
  protected readonly perfil = signal<ViewState<OwnPublicProfile | null>>(loading());

  protected readonly guardado = computed<OwnPublicProfile | null>(() => {
    const estado = this.perfil();
    return estado.status === 'ready' ? estado.data : null;
  });

  /** La ficha tal como se ve, armada desde lo guardado. */
  protected readonly ficha = computed<PublicProfileDetail | null>(() => {
    const publicado = this.guardado();
    if (publicado === null) {
      return null;
    }
    return fichaPublicaDe(publicado, {
      slug: publicado.slug,
      displayName: publicado.displayName,
      headline: publicado.headline ?? '',
      biography: publicado.biography ?? '',
      acceptsReviews: publicado.acceptsReviews ?? true,
      avatarUrl: avatarUrlDe(publicado),
      coverUrl: coverUrlDe(publicado),
    });
  });

  protected readonly enlace = computed(() => {
    const publicado = this.guardado();
    return publicado === null ? null : `alovida.app/p/${publicado.slug}`;
  });

  constructor() {
    this.cargar();
  }

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.perfil.set(loading());
    this.community.getOwnProfile().subscribe({
      next: (perfil) => this.perfil.set(ready(perfil)),
      error: (error: unknown) => this.perfil.set(errorToViewState<OwnPublicProfile | null>(error)),
    });
  }
}

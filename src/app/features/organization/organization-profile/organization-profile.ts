import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import type { MyOrganization } from '../../../core/data-access/directory/directory.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Card } from '../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { InsurerProfileCard } from '../../insurance/insurer-profile-card/insurer-profile-card';
import { OrganizationLogo } from '../organization-logo/organization-logo';
import { PharmacyProfile } from '../pharmacy-profile/pharmacy-profile';

/** Tipo de organización con ficha propia en «Mi perfil». */
const PHARMACY_TENANT_TYPE = 'PHARMACY';

/** Cómo se nombra, en el título, cada tipo de organización con cuenta propia. */
const PROFILE_TITLE_BY_TENANT_TYPE: Readonly<Record<string, string>> = {
  PHARMACY: 'Perfil de la farmacia',
  DIAGNOSTIC_CENTER: 'Perfil del laboratorio',
  PAYER: 'Perfil de la aseguradora',
};

/**
 * «Mi perfil» de una cuenta de organización: su ficha.
 *
 * La cuenta **es** la organización (ver `SessionStore.isOrganizationAccount`),
 * así que su perfil no es el de una persona sino lo que la empresa es en los
 * papeles. Un solo punto de entrada para todos los tipos:
 *
 * - **Farmacia:** la ficha completa (`PharmacyProfile`: empresa, documentos,
 *   representante y gerentes).
 * - **Aseguradora y laboratorio:** los datos de la organización que devuelve el
 *   directorio, y para la aseguradora su ficha de regulador y contacto
 *   (`InsurerProfileCard`). Carpeta legal y gerentes de estos tipos no existen
 *   todavía en ninguna capa: no se inventan.
 */
@Component({
  selector: 'app-organization-profile',
  imports: [Card, InsurerProfileCard, OrganizationLogo, PageHeader, PharmacyProfile, ViewStateHost],
  templateUrl: './organization-profile.html',
  styleUrl: './organization-profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationProfile {
  private readonly auth = inject(AuthService);
  private readonly directory = inject(DirectoryClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly esFarmacia = computed(
    () => this.auth.activeTenantType() === PHARMACY_TENANT_TYPE,
  );

  protected readonly titulo = computed(
    () =>
      PROFILE_TITLE_BY_TENANT_TYPE[this.auth.activeTenantType() ?? ''] ??
      'Perfil de la organización',
  );

  protected readonly organizaciones = signal<ViewState<readonly MyOrganization[]>>(loading());

  /** La organización activa de la sesión, que es la de esta cuenta. */
  protected readonly organizacion = computed<MyOrganization | null>(() => {
    const estado = this.organizaciones();
    if (estado.status !== 'ready') {
      return null;
    }
    const id = this.auth.activeTenantId();
    return estado.data.find((org) => org.id === id) ?? estado.data[0] ?? null;
  });

  constructor() {
    // La ficha de la farmacia trae su propia carga, pero su logo, como el de todos los tipos,
    // sale de la organización que devuelve el directorio.
    this.cargar();
  }

  protected cargar(): void {
    this.organizaciones.set(loading());
    this.directory.listMyOrganizations().subscribe({
      next: (items) => this.organizaciones.set(ready(items)),
      error: (error: unknown) =>
        this.organizaciones.set(errorToViewState<readonly MyOrganization[]>(error)),
    });
  }
}

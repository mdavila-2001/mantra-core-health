import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { HOME_PATH, LOGIN_PATH, RETURN_URL_PARAM } from '../../../core/auth/auth.guard';
import { AuthService } from '../../../core/auth/auth.service';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AuthLayout } from '../../../shared/components/organisms/auth-layout/auth-layout';
import { TenantSwitcher } from '../../../shared/components/organisms/tenant-switcher/tenant-switcher';
import type { TenantOption } from '../../../shared/components/organisms/tenant-switcher/tenant-switcher.types';

/**
 * Elección de organización (J9 · pantalla 5 del M34).
 *
 * Aparece cuando el access token trae **más de un** tenant. Con uno solo, `SessionStore` lo
 * resuelve por su cuenta y esta pantalla no se muestra nunca.
 *
 * ## Por qué hay que preguntar y no elegir la primera
 *
 * Porque `authInterceptor` **no manda `X-Tenant-Id` mientras no haya una organización resuelta**, y
 * elegir por la persona significaría mostrarle datos clínicos bajo el contexto equivocado. En una
 * red de salud eso no es una molestia de navegación: es la historia clínica de otra institución en
 * la pantalla de alguien que buscaba la suya.
 *
 * ## Los nombres salen del token
 *
 * `tenants` sigue siendo la lista de uuid —es la que `SessionStore` usa para validar—, pero el
 * claim `tenantNames` trae el mapa `id -> nombre` para poder pintarlos. Antes esta pantalla mostraba
 * identificadores acortados y pedía elegir entre uuid, que era la única pantalla del sistema donde
 * había que decidir a ciegas.
 *
 * Si un id no está en el mapa, `AuthService.tenantOptions` cae al identificador acortado: una
 * entrada fea es mejor que una entrada en blanco.
 */
@Component({
  selector: 'app-select-organization',
  imports: [AppButton, AuthLayout, TenantSwitcher],
  templateUrl: './select-organization.html',
  styleUrl: './select-organization.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectOrganization {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly activeTenantId = this.auth.activeTenantId;

  protected readonly options = computed<readonly TenantOption[]>(() =>
    this.auth.tenantOptions().map((tenant) => ({
      ...tenant,
      // Los roles del token son globales, no por organización: se muestran como contexto de la
      // sesión, no como «tu rol acá». Decir lo segundo sería afirmar algo que el token no dice.
      role: this.auth.roles().join(' · '),
    })),
  );

  /**
   * Sin sesión no hay nada que elegir. Puede pasar si alguien llega a esta URL directamente o si
   * la sesión venció mientras la pantalla estaba abierta.
   */
  protected readonly hasSession = this.auth.isAuthenticated;

  protected choose(tenantId: string): void {
    this.auth.selectTenant(tenantId);

    // Solo se navega si el store aceptó el tenant. Si no lo aceptó —no está en el token— la
    // pantalla se queda donde está en vez de mandar a un panel sin contexto de organización.
    if (this.auth.activeTenantId() === tenantId) {
      void this.router.navigateByUrl(this.destination());
    }
  }

  protected goToLogin(): void {
    void this.router.navigateByUrl(LOGIN_PATH);
  }

  /** Misma comprobación que el login: solo rutas internas. Ver `Login.safeReturnUrl`. */
  private destination(): string {
    const requested = this.route.snapshot.queryParamMap.get(RETURN_URL_PARAM);

    if (requested === null || !requested.startsWith('/') || requested.startsWith('//')) {
      return HOME_PATH;
    }
    return requested;
  }
}

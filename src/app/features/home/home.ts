import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Badge } from '../../shared/components/atoms/badge/badge';

/**
 * Pantalla a la que se entra tras iniciar sesión.
 *
 * Es deliberadamente mínima: **no es el panel del producto**, sino la prueba de
 * que la sesión existe y de que la aplicación sabe quién entró y en qué
 * organización. Todo lo que muestra sale del token —`name`, `roles`,
 * `tenantNames`—, así que no pide nada al servidor para pintarse.
 *
 * El panel real, con navegación y secciones, es trabajo aparte y depende de que
 * se decida el armazón de la aplicación.
 */
@Component({
  selector: 'app-home',
  imports: [AppButton, Badge],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly roles = this.auth.roles;

  /** Cae al identificador del usuario si el token no trae nombre. */
  readonly nombre = computed(() => this.auth.displayName() ?? this.auth.userId() ?? '');

  /** Nombre legible de la organización activa, o `null` si no hay ninguna. */
  readonly organizacion = computed(() => {
    const tenantId = this.auth.activeTenantId();
    return tenantId === null ? null : this.auth.tenantName(tenantId);
  });

  salir(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/auth');
  }
}

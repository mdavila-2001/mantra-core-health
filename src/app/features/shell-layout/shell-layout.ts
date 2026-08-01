import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { LOGIN_ROUTE } from '../../core/http/auth.interceptor';
import { Breakpoints } from '../../core/layout/breakpoints';
import { Shell } from '../../shared/components/organisms/shell/shell';
import type { HeaderUser } from '../../shared/components/organisms/header/header.types';
import type { NavSection } from '../../shared/components/organisms/side-nav/side-nav.types';
import type { TenantOption } from '../../shared/components/organisms/tenant-switcher/tenant-switcher.types';

/**
 * Armazón de todas las pantallas con sesión.
 *
 * `app-shell` es puro organismo: no conoce usuario, tenant ni rutas, los recibe y los reparte. Este
 * componente es **el que sí sabe**, y existe para que ese conocimiento viva en un solo lugar en vez
 * de en cada pantalla. Las rutas hijas se pintan en el `<router-outlet />` que el shell ya tiene.
 *
 * ## El menú se arma con lo que la sesión permite
 *
 * `sections` se recalcula a partir de los roles del token. **Esconder un ítem no protege nada** —la
 * autoridad es la API, que valida en cada petición—; es no ofrecer una puerta que va a estar
 * cerrada. Quien escriba la URL a mano se topa con el guard primero y con un 403 después.
 *
 * > Nota de la reconciliación (2026-08-01): este componente vino del carril de Pablo y se adaptó a
 * > las superficies que quedaron en el merge — `LOGIN_ROUTE` del interceptor y el `AuthService`
 * > nuestro, del que deriva `user` y `tenants` en vez de pedirle métodos que no tiene.
 */
@Component({
  selector: 'app-shell-layout',
  imports: [Shell],
  templateUrl: './shell-layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly breakpoints = inject(Breakpoints);

  protected readonly activeTenantId = this.auth.activeTenantId;

  /**
   * El shell no mide la ventana: la recibe. Sin esto el nav se queda como columna fija de 260 px
   * también en un teléfono, empujando el contenido fuera de la pantalla.
   */
  protected readonly isDrawer = this.breakpoints.isNavDrawer;

  protected readonly user = computed<HeaderUser | null>(() => {
    if (!this.auth.isAuthenticated()) {
      return null;
    }
    return {
      // El guard no deja llegar acá sin sesión; el userId es el último recurso
      // para que el header nunca quede sin nombre.
      displayName: this.auth.displayName() ?? this.auth.userId() ?? '',
      roles: this.auth.roles(),
    };
  });

  /** Las organizaciones de la sesión, ya con su nombre legible (claim `tenantNames`). */
  protected readonly tenants = computed<readonly TenantOption[]>(() =>
    this.auth.tenants().map((id) => ({ id, name: this.auth.tenantName(id) })),
  );

  /**
   * El menú. Hoy tiene lo que existe de verdad: el panel y la vitrina del sistema de diseño. Las 81
   * secciones del modelo se van agregando a medida que sus pantallas se escriben — un ítem que
   * lleva a una ruta vacía es peor que no tenerlo.
   */
  protected readonly sections = computed<readonly NavSection[]>(() => {
    const general: NavSection = {
      label: 'General',
      items: [
        { label: 'Panel', route: '/panel', icon: 'home' },
        { label: 'Verificar identidad', route: '/identidad/verificar', icon: 'patients' },
      ],
    };

    const herramientas: NavSection = {
      label: 'Herramientas',
      items: [{ label: 'Sistema de diseño', route: '/design-system', icon: 'settings' }],
    };

    return [general, herramientas];
  });

  protected logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl(LOGIN_ROUTE);
  }

  /**
   * Cambiar de organización es un **cambio de contexto de datos**: lo que hubiera en pantalla
   * corresponde a la anterior. Se vuelve al panel en vez de recargar la vista actual, que podría
   * ser el detalle de un recurso que en esta organización no existe.
   */
  protected changeTenant(tenantId: string): void {
    this.auth.selectTenant(tenantId);
    void this.router.navigateByUrl('/panel');
  }
}

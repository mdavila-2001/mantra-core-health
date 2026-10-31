import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import type { TenantOption } from '../../../shared/components/organisms/tenant-switcher/tenant-switcher.types';
import { TutorialTarget } from '../../../shared/components/organisms/tutorial-overlay/tutorial-target.directive';

/**
 * Conmutador de organización del armazón.
 *
 * Quien tiene alcance de plataforma ve además «Toda la plataforma»: es el estado por defecto (ninguna organización
 * fijada, no viaja `X-Tenant-Id`). Elegir una organización lo fija como siempre. Es presentación: la autoridad es la API.
 * Se abre y cierra con el contrato `.menu-anclaje` / `aria-haspopup` de `AlovidaRuntimeService`.
 */
@Component({
  selector: 'app-tenant-menu',
  imports: [TutorialTarget],
  templateUrl: './tenant-menu.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
})
export class TenantMenu {
  readonly tenants = input.required<readonly TenantOption[]>();
  /** `null` = ninguna fijada (toda la plataforma, si el alcance lo permite). */
  readonly activeTenantId = input<string | null>(null);
  /** Rótulo del botón: nombre de la organización activa o «Toda la plataforma». */
  readonly label = input.required<string>();

  /** Alcance de plataforma: ofrece «Toda la plataforma» y se muestra aunque haya una sola organización. */
  protected readonly platformScope = inject(AuthService).hasPlatformScope;
  protected readonly visible = computed(
    () => this.tenants().length > 1 || (this.platformScope() && this.tenants().length > 0),
  );

  readonly tenantChanged = output<string>();
  readonly platformChosen = output<void>();
}

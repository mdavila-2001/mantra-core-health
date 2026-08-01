import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  isDevMode,
  output,
  signal,
} from '@angular/core';

import { AppButton } from '../../atoms/button/button';
import { Card } from '../../molecules/card/card';
import { Menu } from '../../molecules/menu/menu';
import { MenuItem } from '../../molecules/menu/menu-item/menu-item';
import { MenuTrigger } from '../../molecules/menu/menu-trigger/menu-trigger';
import type { TenantOption, TenantSwitcherVariant } from './tenant-switcher.types';

/**
 * Selector de organización activa.
 *
 * ```html
 * <app-tenant-switcher [tenants]="tenants()" [activeTenantId]="activo()"
 *                      (tenantChanged)="cambiarOrganizacion($event)" />
 * ```
 *
 * **Solo emite el id elegido.** Validar que pertenezca a los tenants del
 * access token y propagar `X-Tenant-Id` es de `core/auth`: un componente de
 * presentación que decidiera eso sería un control de acceso dibujado.
 *
 * > Cambiar de organización es un **cambio de contexto de datos**: todo lo que
 * > esté cacheado del tenant anterior queda inválido. Quien escuche
 * > `tenantChanged` es responsable de invalidarlo; el organismo no sabe qué
 * > datos hay en pantalla.
 *
 * Si `activeTenantId` no está en la lista, muestra estado indeterminado y
 * avisa en desarrollo. **No lo corrige solo**: elegir una organización por su
 * cuenta sería decidir en nombre de la persona sobre datos clínicos ajenos.
 */
@Component({
  selector: 'app-tenant-switcher',
  imports: [AppButton, Card, Menu, MenuItem, MenuTrigger],
  templateUrl: './tenant-switcher.html',
  styleUrl: './tenant-switcher.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'switcherClasses()',
  },
})
export class TenantSwitcher {
  readonly tenants = input<readonly TenantOption[]>([]);
  readonly activeTenantId = input<string | null>(null);
  readonly variant = input<TenantSwitcherVariant>('compact');

  readonly tenantChanged = output<string>();

  /** Lo último elegido acá, para anunciarlo por la región viva. */
  private readonly lastAnnounced = signal('');
  readonly announcement = this.lastAnnounced.asReadonly();

  protected readonly activeTenant = computed<TenantOption | null>(() => {
    const id = this.activeTenantId();
    if (id === null) {
      return null;
    }
    return this.tenants().find((tenant) => tenant.id === id) ?? null;
  });

  /** El id activo no está entre los tenants: se muestra sin resolver. */
  readonly isIndeterminate = computed(
    () => this.activeTenantId() !== null && this.activeTenant() === null,
  );

  protected readonly triggerLabel = computed(
    () => this.activeTenant()?.name ?? 'Elegí una organización',
  );

  protected readonly switcherClasses = computed(
    () => `tenant-switcher tenant-switcher--${this.variant()}`,
  );

  constructor() {
    if (isDevMode()) {
      afterNextRender(() => this.warnIfIndeterminate());
    }
  }

  protected select(tenant: TenantOption): void {
    if (tenant.id === this.activeTenantId()) {
      return;
    }
    this.lastAnnounced.set(`Organización activa: ${tenant.name}`);
    this.tenantChanged.emit(tenant.id);
  }

  private warnIfIndeterminate(): void {
    if (this.isIndeterminate()) {
      console.warn(
        '[app-tenant-switcher] `activeTenantId` no está entre los tenants recibidos: ' +
          'se muestra sin resolver. Corregilo en el origen, no acá.',
        this.activeTenantId(),
      );
    }
  }
}

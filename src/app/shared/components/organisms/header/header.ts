import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import type { ThemeMode } from '../../../../core/tokens/design-tokens.types';
import { ThemeService } from '../../../../core/tokens/theme.service';
import { AppButton } from '../../atoms/button/button';
import { Avatar } from '../../atoms/avatar/avatar';
import { Menu } from '../../molecules/menu/menu';
import { MenuItem } from '../../molecules/menu/menu-item/menu-item';
import { MenuTrigger } from '../../molecules/menu/menu-trigger/menu-trigger';
import { TenantSwitcher } from '../tenant-switcher/tenant-switcher';
import type { TenantOption } from '../tenant-switcher/tenant-switcher.types';
import type { HeaderUser } from './header.types';

/**
 * Barra superior de la aplicación autenticada: menú, marca, contenido central
 * y, a la derecha, organización, tema y cuenta.
 *
 * ```html
 * <app-header [user]="usuario()" [tenants]="tenants()" [activeTenantId]="activo()"
 *             [showMenuButton]="esMovil()" [menuOpen]="cajonAbierto()"
 *             (menuToggled)="alternarCajon()" (logoutRequested)="salir()" />
 * ```
 *
 * El rol que muestra sale del `roles[]` que le pasan: **no decodifica el JWT**
 * — eso es de `core/auth`, y un componente de presentación que lea un token
 * termina siendo el lugar equivocado donde se decide quién ve qué.
 *
 * El selector de organización solo aparece con **más de una**: ofrecer un
 * cambio de contexto imposible es ruido.
 */
@Component({
  // Selector de atributo sobre `<header>`: el host ES el landmark de banner,
  // igual que `button[app-button]` y `a[app-link]`. Un `<app-header>` suelto
  // no es ningún landmark y obligaría a envolverlo en cada pantalla.
  selector: 'header[app-header]',
  imports: [AppButton, Avatar, Menu, MenuItem, MenuTrigger, TenantSwitcher],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-header',
  },
})
export class Header {
  private readonly themeService = inject(ThemeService);

  readonly user = input<HeaderUser | null>(null);
  readonly tenants = input<readonly TenantOption[]>([]);
  readonly activeTenantId = input<string | null>(null);

  /** El botón de menú solo tiene sentido cuando el nav es cajón. */
  readonly showMenuButton = input<boolean>(false);
  readonly menuOpen = input<boolean>(false);

  /** Id del panel de navegación, para `aria-controls`. */
  readonly navPanelId = input<string>('app-nav');

  readonly menuToggled = output<void>();
  readonly logoutRequested = output<void>();
  readonly tenantChanged = output<string>();

  protected readonly theme = this.themeService.currentTheme;

  /** Con una sola organización no hay nada que elegir. */
  protected readonly showsTenantSwitcher = computed(() => this.tenants().length > 1);

  /** Los roles, ya legibles, unidos para el menú de cuenta. */
  protected readonly rolesLabel = computed(() => this.user()?.roles.join(' · ') ?? '');

  protected readonly displayName = computed(() => this.user()?.displayName ?? '');

  protected toggleMenu(): void {
    this.menuToggled.emit();
  }

  protected requestLogout(): void {
    this.logoutRequested.emit();
  }

  protected changeTenant(tenantId: string): void {
    this.tenantChanged.emit(tenantId);
  }

  /** Ciclo claro → oscuro → sistema, el mismo orden que la vitrina. */
  protected cycleTheme(): void {
    const orden: readonly ThemeMode[] = ['light', 'dark', 'system'];
    const actual = orden.indexOf(this.theme());
    this.themeService.setTheme(orden[(actual + 1) % orden.length]);
  }
}

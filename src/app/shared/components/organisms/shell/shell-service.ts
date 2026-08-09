import {
  afterNextRender,
  computed,
  DOCUMENT,
  effect,
  inject,
  Injectable,
  Injector,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import type { NavMode } from '../side-nav/side-nav.types';

/** Clave de la preferencia de nav. Espeja el patrón de `ThemeService`. */
export const NAV_STORAGE_KEY = 'mantra-core-health.nav-collapsed';

/**
 * Estado del armazón: si el panel de navegación está expandido, colapsado a
 * íconos o abierto como cajón sobre el contenido.
 *
 * La preferencia se guarda, pero **nunca en la ruta de render**: bajo SSR no
 * hay `localStorage`, así que el servicio arranca en el default y recién
 * después del primer render lee lo guardado. Es el mismo patrón que
 * `ThemeService`, y por la misma razón: leer storage al construir rompe la
 * hidratación.
 */
@Injectable({ providedIn: 'root' })
export class ShellService {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Preferencia de la persona para el nav fijo. Arranca en el default. */
  private readonly collapsedPreference = signal(false);

  /** El cajón solo existe en anchos chicos; en escritorio el nav es fijo. */
  private readonly drawerOpen = signal(false);

  readonly isCollapsed = this.collapsedPreference.asReadonly();
  readonly isDrawerOpen = this.drawerOpen.asReadonly();

  /**
   * Modo efectivo del nav. El CSS decide si el cajón se ve o no según el
   * ancho; este signal solo dice en qué estado lógico está.
   */
  readonly navMode = computed<NavMode>(() => {
    if (this.drawerOpen()) {
      return 'drawer-open';
    }
    return this.collapsedPreference() ? 'collapsed' : 'expanded';
  });

  constructor() {
    // Leer y escribir la preferencia, siempre después del primer render.
    afterNextRender(
      () => {
        this.restorePreference();
        effect(
          () => {
            this.persistPreference(this.collapsedPreference());
          },
          { injector: this.injector },
        );
      },
      { injector: this.injector },
    );
  }

  toggleCollapsed(): void {
    this.collapsedPreference.update((collapsed) => !collapsed);
  }

  openDrawer(): void {
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  private restorePreference(): void {
    const guardado = this.readStorage();
    if (guardado !== null) {
      this.collapsedPreference.set(guardado === 'true');
    }
  }

  /**
   * `localStorage` puede lanzar: modo privado de Safari, cuota llena o
   * política del navegador. La preferencia del nav no vale una pantalla rota.
   */
  private readStorage(): string | null {
    if (!this.isBrowser) {
      return null;
    }
    try {
      return this.document.defaultView?.localStorage.getItem(NAV_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private persistPreference(collapsed: boolean): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      this.document.defaultView?.localStorage.setItem(NAV_STORAGE_KEY, String(collapsed));
    } catch {
      // Sin persistencia la aplicación sigue funcionando: se pierde la preferencia y nada más.
    }
  }
}

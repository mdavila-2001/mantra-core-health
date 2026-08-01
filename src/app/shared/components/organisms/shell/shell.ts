import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Header } from '../header/header';
import type { HeaderUser } from '../header/header.types';
import { SideNav } from '../side-nav/side-nav';
import type { NavSection } from '../side-nav/side-nav.types';
import { ShellService } from './shell-service';
import type { TenantOption } from '../tenant-switcher/tenant-switcher.types';

/** Id del contenido principal. El enlace de salto y el header lo referencian. */
export const MAIN_CONTENT_ID = 'main-content';

/**
 * Armazón de toda pantalla autenticada: encabezado, navegación y contenido.
 *
 * ```html
 * <app-shell [user]="usuario()" [sections]="secciones()" [tenants]="tenants()"
 *            (logoutRequested)="salir()" />
 * ```
 *
 * Tres cosas que el shell garantiza y que ninguna pantalla debería repetir:
 *
 * 1. **Enlace de salto** como primer elemento focusable de la página.
 * 2. **Anuncio de la ruta nueva** por región viva, porque cambiar de vista sin
 *    recargar no dispara ningún anuncio del navegador.
 * 3. **El foco vuelve al `<main>`** en cada navegación: sin eso, quien navega
 *    con teclado sigue parado en el enlace del menú que ya no corresponde.
 *
 * El shell **no conoce usuario, tenant ni rutas**: los recibe y los reparte.
 */
@Component({
  selector: 'app-shell',
  imports: [Header, RouterOutlet, SideNav],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'shell',
  },
})
export class Shell {
  private readonly shellService = inject(ShellService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly mainRef = viewChild<ElementRef<HTMLElement>>('main');

  readonly user = input<HeaderUser | null>(null);
  readonly sections = input<readonly NavSection[]>([]);
  readonly tenants = input<readonly TenantOption[]>([]);
  readonly activeTenantId = input<string | null>(null);

  /**
   * El nav se comporta como cajón. Lo decide quien monta el shell —que es
   * quien conoce el ancho real— y no una media query en TypeScript.
   */
  readonly drawerMode = input<boolean>(false);

  readonly logoutRequested = output<void>();
  readonly tenantChanged = output<string>();

  protected readonly mainContentId = MAIN_CONTENT_ID;
  protected readonly navPanelId = 'shell-nav';

  protected readonly isCollapsed = this.shellService.isCollapsed;
  protected readonly isDrawerOpen = this.shellService.isDrawerOpen;

  /** Lo que la región viva anuncia tras cada navegación. */
  private readonly routeAnnouncement = signal('');
  readonly announcement = this.routeAnnouncement.asReadonly();

  protected readonly navIsDrawer = computed(() => this.drawerMode());

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.onNavigated());
  }

  protected toggleDrawer(): void {
    this.shellService.toggleDrawer();
  }

  protected closeDrawer(): void {
    this.shellService.closeDrawer();
  }

  protected requestLogout(): void {
    this.logoutRequested.emit();
  }

  protected changeTenant(tenantId: string): void {
    this.tenantChanged.emit(tenantId);
  }

  /**
   * Salta al contenido. Se mueve el foco a mano y no solo con el `href`:
   * un ancla a un `<div>` cambia el scroll pero deja el foco donde estaba en
   * varios navegadores.
   */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    this.focusMain();
  }

  private onNavigated(): void {
    // Cerrar el cajón: la pantalla de atrás ya cambió.
    this.shellService.closeDrawer();
    this.focusMain();

    // El título lo estampa la `TitleStrategy` del router, que también escucha
    // `NavigationEnd`: leerlo en el mismo turno devuelve el anterior.
    queueMicrotask(() => this.routeAnnouncement.set(this.title.getTitle()));
  }

  private focusMain(): void {
    if (!this.isBrowser) {
      return;
    }
    const main = this.mainRef()?.nativeElement;
    main?.focus();
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  PLATFORM_ID,
  viewChildren,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { Badge } from '../../atoms/badge/badge';
import { Tooltip } from '../../atoms/tooltip/tooltip';
import type { NavItem, NavSection } from './side-nav.types';

/**
 * Navegación principal. **No conoce los 17 portales**: recibe las secciones ya
 * resueltas por quien sabe qué rol tiene la persona.
 *
 * ```html
 * <app-side-nav [sections]="secciones()" [collapsed]="colapsado()"
 *               [drawer]="esMovil()" [open]="cajonAbierto()"
 *               (closeRequested)="cerrarCajon()" />
 * ```
 *
 * Colapsado a íconos, el texto se oculta **visualmente** pero el nombre
 * accesible se conserva (`aria-label` + tooltip): un ícono sin nombre es un
 * destino mudo para quien usa lector de pantalla.
 *
 * En modo cajón atrapa el foco mientras está abierto, `Escape` cierra y
 * devuelve el foco a quien lo abrió, y el resto de la aplicación queda
 * `inert` — sin eso, tabular sigue caminando por debajo del overlay.
 */
@Component({
  selector: 'app-side-nav',
  imports: [Badge, RouterLink, RouterLinkActive, Tooltip],
  templateUrl: './side-nav.html',
  styleUrl: './side-nav.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'navClasses()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class SideNav {
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly links = viewChildren<ElementRef<HTMLAnchorElement>>('navLink');

  readonly sections = input<readonly NavSection[]>([]);

  /** Colapsado a íconos. Solo aplica al nav fijo, nunca al cajón. */
  readonly collapsed = input<boolean>(false);

  /** El nav se comporta como cajón superpuesto (anchos chicos). */
  readonly drawer = input<boolean>(false);

  /** Cajón abierto. Sin `drawer`, se ignora. */
  readonly open = input<boolean>(false);

  /** El cajón pide cerrarse: Escape, click en el overlay o elegir un destino. */
  readonly closeRequested = output<void>();

  protected readonly isDrawerOpen = computed(() => this.drawer() && this.open());

  /** Colapsar solo tiene sentido con el nav fijo. */
  protected readonly isCollapsed = computed(() => this.collapsed() && !this.drawer());

  protected readonly navClasses = computed(() => {
    const classes = ['side-nav'];
    if (this.drawer()) {
      classes.push('side-nav--drawer');
    }
    if (this.isDrawerOpen()) {
      classes.push('side-nav--open');
    }
    if (this.isCollapsed()) {
      classes.push('side-nav--collapsed');
    }
    return classes.join(' ');
  });

  /**
   * Rutas del menú que son prefijo de otro destino del menú.
   *
   * `routerLinkActive` por prefijo marcaría al padre Y al descendiente a la
   * vez —dos `aria-current="page"`, dos «acá estás» para quien usa lector de
   * pantalla—, así que esas rutas se activan solo con coincidencia exacta.
   * Las hojas siguen por prefijo: una pantalla hija que no está en el menú
   * (el detalle de un caso) mantiene encendido a su padre visible.
   */
  private readonly exactRoutes = computed(() => {
    const routes = this.sections().flatMap((section) => section.items.map((item) => item.route));
    return new Set(
      routes.filter((route) => {
        const prefix = route.endsWith('/') ? route : `${route}/`;
        return routes.some((other) => other !== route && other.startsWith(prefix));
      }),
    );
  });

  /**
   * Identidades estables: un literal en la plantilla sería un objeto nuevo en
   * cada pase de detección, y cada identidad nueva dispara el `ngOnChanges`
   * de `routerLinkActive` — que en su `update()` vuelve a decidir el
   * `aria-current` — una vez por render, para no cambiar nada.
   */
  private static readonly EXACT_MATCH = { exact: true };
  private static readonly PREFIX_MATCH = { exact: false };

  protected activeOptionsFor(item: NavItem): { exact: boolean } {
    return this.exactRoutes().has(item.route) ? SideNav.EXACT_MATCH : SideNav.PREFIX_MATCH;
  }

  constructor() {
    // Mientras el cajón está abierto, el resto de la aplicación es inerte y el
    // foco entra al panel. Sin `inert`, el tabulador sigue recorriendo la
    // página de atrás aunque no se vea.
    effect(() => {
      if (!this.isBrowser) {
        return;
      }
      const abierto = this.isDrawerOpen();
      this.setSiblingsInert(abierto);
      if (abierto) {
        queueMicrotask(() => this.focusFirstLink());
      }
    });
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isDrawerOpen()) {
      event.preventDefault();
      this.closeRequested.emit();
      return;
    }

    const destino = this.nextFocusIndex(event.key);
    if (destino !== null) {
      event.preventDefault();
      this.links()[destino]?.nativeElement.focus();
    }
  }

  /** Elegir un destino cierra el cajón: el contenido nuevo está detrás. */
  protected handleNavigate(): void {
    if (this.isDrawerOpen()) {
      this.closeRequested.emit();
    }
  }

  protected handleOverlayClick(): void {
    this.closeRequested.emit();
  }

  /** Los ítems deshabilitados no reciben foco ni navegan. */
  protected isEnabled(item: NavItem): boolean {
    return item.disabled !== true;
  }

  private nextFocusIndex(key: string): number | null {
    const total = this.links().length;
    if (total === 0) {
      return null;
    }
    const actual = this.links().findIndex(
      (link) => link.nativeElement === this.hostElement.nativeElement.ownerDocument.activeElement,
    );

    switch (key) {
      case 'ArrowDown':
        return actual < 0 ? 0 : (actual + 1) % total;
      case 'ArrowUp':
        return actual < 0 ? total - 1 : (actual - 1 + total) % total;
      case 'Home':
        return 0;
      case 'End':
        return total - 1;
      default:
        return null;
    }
  }

  private focusFirstLink(): void {
    this.links()[0]?.nativeElement.focus();
  }

  /**
   * Marca inerte todo lo que no sea este nav. Se hace sobre los hermanos del
   * host y no sobre el `<body>` entero para no inertizar al propio panel.
   */
  private setSiblingsInert(inert: boolean): void {
    const host = this.hostElement.nativeElement;
    const parent = host.parentElement;
    if (parent === null) {
      return;
    }
    for (const sibling of parent.children) {
      if (sibling === host) {
        continue;
      }
      if (inert) {
        sibling.setAttribute('inert', '');
      } else {
        sibling.removeAttribute('inert');
      }
    }
  }
}

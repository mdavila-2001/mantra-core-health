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
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';

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
  imports: [Badge, RouterLink, Tooltip],
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

  private readonly router = inject(Router);

  /**
   * La URL actual **sin** query ni fragmento: el menú navega por ruta, y un
   * filtro en la dirección no cambia en qué sección está uno.
   */
  /** La última navegación terminada, o `null` si todavía no hubo ninguna. */
  private readonly ultimaNavegacion = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento): string | null => evento.urlAfterRedirects),
    ),
    { initialValue: null },
  );

  /**
   * La URL actual **sin** query ni fragmento: el menú navega por ruta, y un
   * filtro en la dirección no cambia en qué sección está uno.
   *
   * Cae a `router.url` mientras no haya ocurrido ninguna navegación —el primer
   * render, y también un arnés de prueba que monta el componente antes de
   * navegar—. Sin esa reserva el menú no marcaría nada hasta el primer clic.
   */
  private readonly urlActual = computed(() => {
    const url = this.ultimaNavegacion() ?? this.router.url;
    return url.split('?')[0]?.split('#')[0] ?? '';
  });

  readonly sections = input<readonly NavSection[]>([]);

  /** Colapsado a íconos. Solo aplica al nav fijo, nunca al cajón. */
  readonly collapsed = input<boolean>(false);

  /** El nav se comporta como cajón superpuesto (anchos chicos). */
  readonly drawer = input<boolean>(false);

  /** Cajón abierto. Sin `drawer`, se ignora. */
  readonly open = input<boolean>(false);

  /** El cajón pide cerrarse: Escape, click en el overlay o elegir un destino. */
  readonly closeRequested = output<void>();

  /**
   * La ruta del menú que corresponde a la página actual, o `null`.
   *
   * ## Por qué no alcanza `routerLinkActive`
   *
   * Porque compara **por prefijo**: estando en `/my-account/identity/verify`,
   * tanto esa entrada como su padre `/my-account` quedaban activas, y las dos
   * marcadas con `aria-current="page"`. Dos «acá estás» a la vez no es un
   * detalle estético: `aria-current="page"` significa *ésta* es la página, y
   * quien navega con lector de pantalla oía dos.
   *
   * Poner `exact: true` lo habría roto por el otro lado: en la ficha de un
   * paciente —`/administration/patients/<id>`, que no es entrada de menú— no se
   * marcaría ninguna, y la sección dejaría de decir dónde está uno.
   *
   * Se elige la coincidencia **más específica**: la entrada más larga que sea
   * prefijo de la URL actual. Con eso la hija gana a su padre cuando existe, y
   * el padre sigue ganando cuando la página no está en el menú.
   */
  protected readonly rutaActiva = computed<string | null>(() => {
    const url = this.urlActual();
    // eslint-disable-next-line no-console
    if (url === '') {
      return null;
    }

    const rutas = this.sections()
      .flatMap((seccion) => seccion.items)
      .map((item) => item.route);

    return (
      rutas
        // Prefijo de ruta, no de texto: `/administration/patients` no puede
        // ganar con `/administration/patients-archive`.
        .filter((ruta) => url === ruta || url.startsWith(`${ruta}/`))
        .reduce<string | null>(
          (mejor, ruta) => (mejor === null || ruta.length > mejor.length ? ruta : mejor),
          null,
        )
    );
  });

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

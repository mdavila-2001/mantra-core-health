import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  forwardRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AlovidaThemeToggleDirective } from '../../../core/alovida/alovida-theme-toggle.directive';
import { AuthService } from '../../../core/auth/auth.service';
import { LOGIN_ROUTE } from '../../../core/http/auth.interceptor';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../../shared/components/atoms/nav-icon/nav-icon.types';
import { NotificationBell } from '../../../shared/components/organisms/notification-bell/notification-bell';
import {
  PAGE_HEADER_MIGAS_EN_EL_MARCO,
  PAGE_HEADER_PREDETERMINADOS,
  type PageHeaderPredeterminados,
} from '../../../shared/components/organisms/page-header/page-header';
import {
  PORTAL_NAV,
  activeItem,
  groupOf,
  headerFor,
  isActive,
  navEntries,
  portalCrumbs,
  portalUrl,
  siblingTabs,
  type PortalNavEntry,
  type PortalNavGroup,
} from './portal-nav';
import { PortalSearch } from './portal-search';

const CLAVE_ABIERTOS = 'portal.nav.abiertos';

function leerAbiertos(): ReadonlySet<string> {
  try {
    const crudo = sessionStorage.getItem(CLAVE_ABIERTOS);
    const lista: unknown = crudo ? JSON.parse(crudo) : null;
    return new Set(
      Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

/** Un destino de la barra inferior del teléfono. */
interface DestinoInferior {
  readonly label: string;
  readonly path: string;
  readonly icon: NavIconName;
  /** El grupo que lo ilumina: «Gobierno» queda activo en cualquier pantalla de gobierno. */
  readonly grupo: string;
}

/** Cuatro destinos y «Más», como la barra inferior de AtlasAdminPortal. */
const DESTINOS_INFERIORES: readonly DestinoInferior[] = [
  { label: 'Centro', path: '', icon: 'home', grupo: 'home' },
  { label: 'Sistemas', path: 'systems/operations', icon: 'route', grupo: 'systems' },
  { label: 'Catálogo', path: 'catalog/tables', icon: 'book', grupo: 'catalog' },
  { label: 'Gobierno', path: 'governance/audit', icon: 'shield', grupo: 'governance' },
];

/**
 * El ÚNICO marco del portal de inventario, con la estructura de
 * AtlasAdminPortal (`docs/trabajo/2026-10-31-visibilidad-rbac/ESTRUCTURA-ATLAS.md`):
 *
 * - una barra lateral oscura fija con la marca, los grupos plegables y la
 *   salida a la administración;
 * - una barra superior pegajosa con las migas (sólo ahí), el buscador del
 *   portal, la campana, el tema y la cuenta;
 * - el lienzo: pestañas entre pantallas hermanas, la explicación de la vista
 *   plegada en una línea y la pantalla;
 * - en el teléfono, sin barra lateral: barra inferior con cuatro destinos y
 *   «Más», que abre la MISMA navegación como cajón.
 *
 * Se monta fuera del armazón global (`SECCIONES_CON_MARCO_PROPIO` en
 * `app.routes.ts`), con las mismas guardas. Que un ítem se vea o no no es
 * seguridad: la API valida cada petición.
 */
@Component({
  selector: 'app-portal-shell',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    RouterOutlet,
    NavIcon,
    PortalSearch,
    NotificationBell,
    AlovidaThemeToggleDirective,
  ],
  // Las migas viven sólo en la barra superior del portal: ninguna pantalla
  // (nueva o reutilizada) pinta las suyas en su cabecera.
  // Y todas reciben el icono y el eyebrow de su pantalla desde `portal-nav`
  // (cabecera de AtlasAdminPortal) sin tocar su plantilla.
  providers: [
    { provide: PAGE_HEADER_MIGAS_EN_EL_MARCO, useValue: true },
    { provide: PAGE_HEADER_PREDETERMINADOS, useExisting: forwardRef(() => PortalShell) },
  ],
  templateUrl: './portal-shell.html',
  styleUrls: ['./portal-shell.css', './portal-shell-movil.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalShell implements PageHeaderPredeterminados {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly dialogoMovil = viewChild<ElementRef<HTMLDialogElement>>('dialogoMovil');
  private readonly tiraPestanas = viewChild<ElementRef<HTMLElement>>('tiraPestanas');

  protected readonly grupos = PORTAL_NAV;
  protected readonly destinos = DESTINOS_INFERIORES;
  protected readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Grupos que la persona abrió a mano; el de la ruta activa siempre está abierto. */
  private readonly plegados = signal<ReadonlySet<string>>(leerAbiertos());
  protected readonly migas = computed(() => portalCrumbs(this.url()));
  protected readonly grupoActivo = computed(() => groupOf(this.url()));
  protected readonly pantallaActiva = computed(() => activeItem(this.url()));
  protected readonly pestanas = computed(() => siblingTabs(this.url()));
  private readonly cabecera = computed(() => headerFor(this.url()));
  /** Para `PAGE_HEADER_PREDETERMINADOS`: el icono de la pantalla activa. */
  readonly icon = computed(() => this.cabecera().icon);
  /** Para `PAGE_HEADER_PREDETERMINADOS`: el grupo de la pantalla activa. */
  readonly eyebrow = computed(() => this.cabecera().eyebrow);
  protected readonly menuMovilAbierto = signal(false);
  protected readonly explicadorAbierto = signal(false);

  /** La línea de ambiente de la barra superior: contra qué se está trabajando. */
  protected readonly ambiente = environment.mockBackend
    ? 'Maqueta · datos simulados'
    : 'API de AloVida';

  protected readonly nombre = computed(() => this.auth.displayName() ?? this.auth.userId() ?? '');
  protected readonly iniciales = computed(() =>
    this.nombre()
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? '')
      .join(''),
  );

  protected readonly portalUrl = portalUrl;
  protected readonly isActive = isActive;
  protected readonly navEntries = navEntries;

  /**
   * A 390 px la tira de pestañas de sección no entra entera: al montar y en
   * cada navegación la pestaña activa se lleva al centro de la tira (el
   * `scrollIntoView({ inline: 'center', block: 'nearest' })` de la tira, hecho
   * a mano para no mover la ventana). Los bordes se desvanecen en CSS cuando
   * queda tira de ese lado.
   */
  private readonly centrarPestana = afterRenderEffect(() => {
    this.url();
    const tira = this.tiraPestanas()?.nativeElement;
    if (!tira || tira.scrollWidth - tira.clientWidth <= 1) return;
    const activa = tira.querySelector<HTMLElement>('[aria-current="page"]');
    if (!activa) return;
    const caja = tira.getBoundingClientRect();
    const pestana = activa.getBoundingClientRect();
    const desplazamiento = pestana.left + pestana.width / 2 - (caja.left + caja.width / 2);
    if (Math.abs(desplazamiento) > 1) tira.scrollBy?.({ left: desplazamiento });
  });

  constructor() {
    // al navegar, el cajón se cierra y la explicación vuelve a plegarse
    effect(() => {
      this.url();
      this.cerrarMenuMovil();
      this.explicadorAbierto.set(false);
    });
    effect(() => {
      const dialogo = this.dialogoMovil()?.nativeElement;
      if (!dialogo) return;
      if (this.menuMovilAbierto() && !dialogo.open) {
        if (typeof dialogo.showModal === 'function') dialogo.showModal();
        else dialogo.setAttribute('open', '');
      } else if (!this.menuMovilAbierto() && dialogo.open) {
        if (typeof dialogo.close === 'function') dialogo.close();
        else dialogo.removeAttribute('open');
      }
    });
  }

  protected entradaActiva(entrada: PortalNavEntry): boolean {
    const url = this.url();
    return entrada.items.some((item) => isActive(item, url));
  }

  protected estaAbierto(grupo: PortalNavGroup): boolean {
    return this.grupoActivo()?.id === grupo.id || this.plegados().has(grupo.id);
  }

  protected alternar(grupo: PortalNavGroup): void {
    // el grupo de la ruta activa no se pliega: la persona perdería de vista dónde está
    if (this.grupoActivo()?.id === grupo.id) return;
    const siguiente = new Set(this.plegados());
    if (siguiente.has(grupo.id)) siguiente.delete(grupo.id);
    else siguiente.add(grupo.id);
    this.plegados.set(siguiente);
    try {
      sessionStorage.setItem(CLAVE_ABIERTOS, JSON.stringify([...siguiente]));
    } catch {
      /* sin almacenamiento el menú funciona igual, sólo que no recuerda */
    }
  }

  protected destinoActivo(destino: DestinoInferior): boolean {
    return this.grupoActivo()?.id === destino.grupo;
  }

  protected abrirMenuMovil(): void {
    this.menuMovilAbierto.set(true);
  }

  protected cerrarMenuMovil(): void {
    if (this.menuMovilAbierto()) this.menuMovilAbierto.set(false);
  }

  protected alCancelarMenu(event: Event): void {
    event.preventDefault();
    this.cerrarMenuMovil();
  }

  protected alternarExplicador(): void {
    this.explicadorAbierto.update((v) => !v);
  }

  protected cerrarSesion(): void {
    this.auth.logout();
    void this.router.navigateByUrl(LOGIN_ROUTE);
  }
}

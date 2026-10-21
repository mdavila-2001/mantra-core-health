import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import {
  PORTAL_NAV,
  groupOf,
  isActive,
  portalCrumbs,
  portalUrl,
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

/**
 * Marco del portal de inventario: barra lateral de grupos plegables, cabecera
 * con migas y buscador global, y el explicador de la vista. Lo que cada grupo
 * contiene lo dice `PORTAL_NAV`; este componente no sabe qué pantallas hay.
 *
 * Que un ítem se vea o no se ve no es seguridad: los cinco roles del catálogo
 * pueden leer todo y la API valida cada petición.
 */
@Component({
  selector: 'app-portal-shell',
  imports: [NgTemplateOutlet, RouterLink, RouterOutlet, NavIcon, PortalSearch],
  templateUrl: './portal-shell.html',
  styleUrl: './portal-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalShell {
  private readonly router = inject(Router);
  private readonly dialogoMovil = viewChild<ElementRef<HTMLDialogElement>>('dialogoMovil');

  protected readonly grupos = PORTAL_NAV;
  protected readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Grupos que la persona abrió o cerró a mano; el de la ruta activa siempre está abierto. */
  private readonly plegados = signal<ReadonlySet<string>>(leerAbiertos());
  protected readonly migas = computed(() => portalCrumbs(this.url()));
  protected readonly grupoActivo = computed(() => groupOf(this.url()));
  protected readonly pantallaActiva = computed(
    () => this.grupoActivo()?.items.find((i) => isActive(i, this.url())) ?? null,
  );
  protected readonly menuMovilAbierto = signal(false);
  protected readonly explicadorAbierto = signal(false);

  protected readonly portalUrl = portalUrl;
  protected readonly isActive = isActive;

  constructor() {
    // al navegar, el cajón móvil se cierra
    effect(() => {
      this.url();
      this.cerrarMenuMovil();
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
}

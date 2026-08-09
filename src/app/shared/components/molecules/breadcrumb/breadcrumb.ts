import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Link } from '../../atoms/link/link';
import { MenuItem } from '../menu/menu-item/menu-item';
import { MenuTrigger } from '../menu/menu-trigger/menu-trigger';
import { Menu } from '../menu/menu';
import {
  BREADCRUMB_COLLAPSE_THRESHOLD,
  BREADCRUMB_VISIBLE_TAIL,
  type BreadcrumbItem,
} from './breadcrumb.types';

/**
 * Ruta de navegación: organización → sede → paciente → episodio.
 *
 * ```html
 * <app-breadcrumb [items]="[
 *   { label: 'Red SALUD', routerLink: '/' },
 *   { label: 'Hospital Central', routerLink: '/sedes/1' },
 *   { label: 'Juan Pérez' },
 * ]" />
 * ```
 *
 * El **último escalón nunca es enlace**: es dónde estás, y ofrecer un enlace a
 * la página actual es ruido para el teclado y para el lector de pantalla.
 *
 * Con más de cuatro escalones la ruta se colapsa a raíz + `…` + los dos
 * últimos, y el `…` abre un menú con los del medio.
 */
@Component({
  selector: 'app-breadcrumb',
  imports: [Link, RouterLink, Menu, MenuItem, MenuTrigger],
  templateUrl: './breadcrumb.html',
  styleUrl: './breadcrumb.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'breadcrumb',
  },
})
export class Breadcrumb {
  readonly items = input.required<readonly BreadcrumbItem[]>();

  readonly isCollapsed = computed(() => this.items().length > BREADCRUMB_COLLAPSE_THRESHOLD);

  /** La raíz: sin ella no se sabe en qué organización se está trabajando. */
  protected readonly rootItem = computed<BreadcrumbItem | null>(() => this.items()[0] ?? null);

  /** Los del medio, que van al menú del `…`. */
  readonly collapsedItems = computed<readonly BreadcrumbItem[]>(() =>
    this.isCollapsed() ? this.items().slice(1, -BREADCRUMB_VISIBLE_TAIL) : [],
  );

  /** Lo que se dibuja después de la raíz (y del salto, si lo hay). */
  protected readonly tailItems = computed<readonly BreadcrumbItem[]>(() =>
    this.isCollapsed() ? this.items().slice(-BREADCRUMB_VISIBLE_TAIL) : this.items().slice(1),
  );

  /** El último es la página actual: se dibuja como texto, no como enlace. */
  protected isLast(item: BreadcrumbItem): boolean {
    return this.items().at(-1) === item;
  }
}

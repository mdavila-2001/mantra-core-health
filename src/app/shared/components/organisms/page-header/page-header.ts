import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { AppButton } from '../../atoms/button/button';
import { Breadcrumb } from '../../molecules/breadcrumb/breadcrumb';
import type { BreadcrumbItem } from '../../molecules/breadcrumb/breadcrumb.types';
import { Menu } from '../../molecules/menu/menu';
import { MenuItem } from '../../molecules/menu/menu-item/menu-item';
import { MenuTrigger } from '../../molecules/menu/menu-trigger/menu-trigger';

/**
 * Una acción secundaria del encabezado. Van por datos y no por proyección
 * porque en móvil se dibujan como menú y en escritorio como botones: el mismo
 * nodo no puede vivir en los dos lugares, los datos sí.
 */
export interface PageHeaderAction {
  /** Código estable que identifica la acción al emitirse. */
  readonly code: string;
  readonly label: string;
  readonly disabled?: boolean;
}

/**
 * Encabezado de una página de dominio: la ruta, el **único `<h1>`**, el
 * subtítulo, la acción primaria y las secundarias.
 *
 * ```html
 * <app-page-header title="Juan Pérez" subtitle="HC 00123 · 54 años"
 *                  [breadcrumbs]="ruta" [secondaryActions]="acciones"
 *                  (actionSelected)="ejecutar($event)">
 *   <button app-button page-actions>Registrar evolución</button>
 *   <span page-meta>Última atención: 12/07/2026</span>
 * </app-page-header>
 * ```
 *
 * La **primaria va proyectada en `[page-actions]` y nunca se colapsa** —
 * ocultar la acción principal de una pantalla clínica viola la regla de no
 * ocultar del M34. Las secundarias, con más de dos, colapsan en móvil al menú
 * «Más acciones»; desde tablet se muestran como botones.
 */
@Component({
  selector: 'app-page-header',
  imports: [AppButton, Breadcrumb, Menu, MenuItem, MenuTrigger],
  templateUrl: './page-header.html',
  styleUrl: './page-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'page-header',
  },
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly breadcrumbs = input<readonly BreadcrumbItem[]>([]);
  readonly secondaryActions = input<readonly PageHeaderAction[]>([]);

  /** Emite el `code` de la secundaria elegida, venga del botón o del menú. */
  readonly actionSelected = output<string>();

  protected readonly hasBreadcrumbs = computed(() => this.breadcrumbs().length > 0);
  protected readonly hasSecondaryActions = computed(() => this.secondaryActions().length > 0);

  /**
   * Hasta dos secundarias caben como botones en cualquier ancho; con más, en
   * móvil van al menú. El CSS decide qué se ve según el ancho — acá solo se
   * decide si el modo colapsable existe.
   */
  protected readonly collapsesOnMobile = computed(() => this.secondaryActions().length > 2);

  protected select(action: PageHeaderAction): void {
    if (action.disabled) {
      return;
    }
    this.actionSelected.emit(action.code);
  }
}

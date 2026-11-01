import {
  ChangeDetectionStrategy,
  Component,
  InjectionToken,
  computed,
  inject,
  input,
  output,
  type Signal,
} from '@angular/core';

import { AppButton } from '../../atoms/button/button';
import { Breadcrumb } from '../../molecules/breadcrumb/breadcrumb';
import type { BreadcrumbItem } from '../../molecules/breadcrumb/breadcrumb.types';
import { Menu } from '../../molecules/menu/menu';
import { MenuItem } from '../../molecules/menu/menu-item/menu-item';
import { MenuTrigger } from '../../molecules/menu/menu-trigger/menu-trigger';
import { NavIcon } from '../../atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../atoms/nav-icon/nav-icon.types';

/**
 * Lo provee un marco que ya dibuja las migas en su barra superior (el portal de
 * inventario, con la estructura de AtlasAdminPortal): ahí cada cabecera de
 * página repetía su propia miga debajo de la del marco. Con el token en `true`
 * la cabecera no dibuja migas, sea cual sea la pantalla que la use.
 */
export const PAGE_HEADER_MIGAS_EN_EL_MARCO = new InjectionToken<boolean>('PAGE_HEADER_MIGAS_EN_EL_MARCO');

/**
 * Lo que un marco le propone a TODAS las cabeceras de su lienzo cuando la
 * pantalla no dice otra cosa: el icono del módulo (loseta de 40 px) y el
 * eyebrow (la línea en mayúsculas pequeñas sobre el título). Así el portal de
 * inventario da a sus treinta pantallas la cabecera de AtlasAdminPortal sin que
 * ninguna tenga que tocar su plantilla. Son señales porque cambian al navegar
 * sin que el marco se vuelva a crear. Las entradas `icon` y `eyebrow` de la
 * cabecera mandan sobre esto; fuera de un marco que lo provea, nada cambia.
 */
export interface PageHeaderPredeterminados {
  readonly icon: Signal<NavIconName | null>;
  readonly eyebrow: Signal<string>;
}

export const PAGE_HEADER_PREDETERMINADOS = new InjectionToken<PageHeaderPredeterminados>(
  'PAGE_HEADER_PREDETERMINADOS',
);

/**
 * Una acción secundaria del encabezado. Van por datos y no por proyección
 * porque en móvil se dibujan como menú y en escritorio como botones: el mismo
 * nodo no puede vivir en los dos lugares, los datos sí.
 */
export interface PageHeaderAction {
  /** Código estable que identifica la acción al emitirse. */
  readonly code: string;
  readonly label: string;
  /** Va en el botón y en el menú: toda opción lleva ícono (2026-09-24). */
  readonly icon: NavIconName;
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
  imports: [AppButton, Breadcrumb, Menu, MenuItem, MenuTrigger, NavIcon],
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
  /** Icono del módulo, en loseta suave. Sin él (y sin marco que lo proponga) no hay loseta. */
  readonly icon = input<NavIconName | null>(null);
  /** Línea corta en mayúsculas pequeñas sobre el título: el grupo o módulo de la pantalla. */
  readonly eyebrow = input<string>('');
  readonly breadcrumbs = input<readonly BreadcrumbItem[]>([]);
  readonly secondaryActions = input<readonly PageHeaderAction[]>([]);

  /** Emite el `code` de la secundaria elegida, venga del botón o del menú. */
  readonly actionSelected = output<string>();

  private readonly migasEnElMarco = inject(PAGE_HEADER_MIGAS_EN_EL_MARCO, { optional: true }) ?? false;

  private readonly predeterminados = inject(PAGE_HEADER_PREDETERMINADOS, { optional: true });

  protected readonly iconoEfectivo = computed(
    () => this.icon() ?? this.predeterminados?.icon() ?? null,
  );
  protected readonly eyebrowEfectivo = computed(
    () => this.eyebrow() || this.predeterminados?.eyebrow() || '',
  );

  protected readonly hasBreadcrumbs = computed(
    () => !this.migasEnElMarco && this.breadcrumbs().length > 0,
  );
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

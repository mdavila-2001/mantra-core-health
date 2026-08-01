import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  ElementRef,
  forwardRef,
  input,
  model,
  viewChildren,
} from '@angular/core';

import { Tab } from './tab/tab';
import { TABS_PARENT, type TabsHost, type TabsOrientation } from './tabs.types';

/**
 * Pestañas de una ficha. Descubre sus secciones con `contentChildren`, así que
 * el consumidor solo escribe `app-tab`.
 *
 * ```html
 * <app-tabs [(selectedIndex)]="seccion">
 *   <app-tab label="Evolución">…</app-tab>
 *   <app-tab label="Órdenes">…</app-tab>
 * </app-tabs>
 * ```
 *
 * **Activación manual**: las flechas mueven el foco, y recién Enter o Espacio
 * seleccionan. La activación automática (seleccionar al mover el foco) haría
 * que recorrer seis pestañas dispare seis cargas de panel.
 */
@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.html',
  styleUrl: './tabs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: TABS_PARENT, useExisting: forwardRef(() => Tabs) }],
  host: {
    class: 'tabs',
    '[class.tabs--vertical]': 'orientation() === "vertical"',
  },
})
export class Tabs implements TabsHost {
  protected readonly tabs = contentChildren(Tab);

  /** Los botones, para mover el foco sin selección (activación manual). */
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  readonly selectedIndex = model<number>(0);
  readonly orientation = input<TabsOrientation>('horizontal');

  /** Índice realmente pintado: recortado al rango y saltando deshabilitadas. */
  readonly activeIndex = computed(() => {
    const secciones = this.tabs();
    if (secciones.length === 0) {
      return 0;
    }
    const pedido = Math.min(secciones.length - 1, Math.max(0, this.selectedIndex()));
    if (!secciones[pedido].disabled()) {
      return pedido;
    }
    // La pedida está deshabilitada: cae en la primera utilizable.
    const alternativa = secciones.findIndex((tab) => !tab.disabled());
    return alternativa >= 0 ? alternativa : pedido;
  });

  readonly activeTab = computed<Tab | null>(() => this.tabs()[this.activeIndex()] ?? null);

  protected select(index: number): void {
    const tab = this.tabs()[index];
    if (tab === undefined || tab.disabled()) {
      return;
    }
    this.selectedIndex.set(index);
  }

  /**
   * Las flechas mueven el foco entre pestañas utilizables, con vuelta al otro
   * extremo; Home y End van a los bordes. La selección no las sigue.
   */
  protected handleTablistKeydown(event: KeyboardEvent, index: number): void {
    const destino = this.nextFocusIndex(event.key, index);
    if (destino !== null) {
      event.preventDefault();
      this.focusTab(destino);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.select(index);
    }
  }

  private nextFocusIndex(key: string, from: number): number | null {
    const utilizables = this.enabledIndexes();
    if (utilizables.length === 0) {
      return null;
    }

    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
        return this.step(utilizables, from, 1);
      case 'ArrowLeft':
      case 'ArrowUp':
        return this.step(utilizables, from, -1);
      case 'Home':
        return utilizables[0];
      case 'End':
        return utilizables[utilizables.length - 1];
      default:
        return null;
    }
  }

  /** Avanza dentro de las utilizables dando la vuelta al llegar al extremo. */
  private step(utilizables: readonly number[], from: number, direction: 1 | -1): number {
    const posicion = utilizables.indexOf(from);
    if (posicion < 0) {
      return utilizables[0];
    }
    const siguiente = (posicion + direction + utilizables.length) % utilizables.length;
    return utilizables[siguiente];
  }

  private enabledIndexes(): readonly number[] {
    return this.tabs()
      .map((tab, index) => ({ tab, index }))
      .filter(({ tab }) => !tab.disabled())
      .map(({ index }) => index);
  }

  private focusTab(index: number): void {
    this.tabButtons()[index]?.nativeElement.focus();
  }
}

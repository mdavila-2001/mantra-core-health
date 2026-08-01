import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';

import { MENU_PARENT } from '../menu.types';

/**
 * Una acción de un `app-menu`.
 *
 * ```html
 * <app-menu-item (selected)="imprimir()">Imprimir receta</app-menu-item>
 * <app-menu-item destructive (selected)="anular()">Anular orden</app-menu-item>
 * ```
 *
 * Elegir un ítem **cierra el menú**: si quedara abierto, el foco se perdería
 * sobre un panel que ya no corresponde a lo que pasó en la pantalla.
 */
@Component({
  selector: 'app-menu-item',
  templateUrl: './menu-item.html',
  styleUrl: './menu-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'itemClasses()',
    role: 'menuitem',
    // El foco lo mueve el menú con las flechas: los ítems no entran en el
    // orden de tabulación por su cuenta.
    tabindex: '-1',
    '[attr.aria-disabled]': 'disabled() || null',
    '(click)': 'activate()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class MenuItem {
  /** El menú lo usa para mover el foco; por eso es público. */
  readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly menu = inject(MENU_PARENT, { optional: true });

  readonly disabled = input(false, { transform: booleanAttribute });

  /** Acción que borra o anula: tinta de error. */
  readonly destructive = input(false, { transform: booleanAttribute });

  readonly selected = output<void>();

  protected readonly itemClasses = computed(() => {
    const classes = ['menu-item'];
    if (this.destructive()) {
      classes.push('menu-item--destructive');
    }
    if (this.disabled()) {
      classes.push('menu-item--disabled');
    }
    return classes.join(' ');
  });

  protected activate(): void {
    if (this.disabled()) {
      return;
    }
    this.selected.emit();
    this.menu?.close();
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    // el Espacio desplaza la página si no se lo frena
    event.preventDefault();
    this.activate();
  }
}

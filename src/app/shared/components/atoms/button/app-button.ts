import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  isDevMode,
  output,
} from '@angular/core';

import type { ButtonSize, ButtonType, ButtonVariant } from './button.types';

/**
 * Botón del sistema REDSAT. Selector de atributo: el host ES el `<button>`
 * nativo, así la semántica, el teclado y los formularios vienen gratis.
 *
 * ```html
 * <button app-button variant="danger" size="sm" (clicked)="borrar()">
 *   Eliminar cuenta
 * </button>
 * ```
 *
 * El deshabilitado es por `aria-disabled` (no el atributo nativo): el botón
 * sigue siendo enfocable —el lector de pantalla anuncia el estado en vez de
 * hacer desaparecer el control— y el click se intercepta en `handleClick`.
 *
 * Los íconos se proyectan como SVG (`stroke="currentColor"`): el componente
 * los dimensiona y, en carga, se apagan solos con el resto del contenido.
 * En modo `iconOnly` el nombre accesible es obligatorio y va en el host:
 *
 * ```html
 * <button app-button iconOnly variant="neutral" aria-label="Notificaciones">
 *   <svg …></svg>
 * </button>
 * ```
 */
@Component({
  selector: 'button[app-button]',
  templateUrl: './app-button.html',
  styleUrl: './app-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'buttonClasses()',
    '[attr.type]': 'type()',
    '[attr.aria-disabled]': 'disabled()',
    '[attr.aria-busy]': 'isLoading()',
    '(click)': 'handleClick($event)',
  },
})
export class AppButtonComponent {
  private readonly hostElement = inject<ElementRef<HTMLButtonElement>>(ElementRef);

  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly isLoading = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly type = input<ButtonType>('button');

  /** Cuadrado y circular, sin texto: solo el ícono proyectado. */
  readonly iconOnly = input(false, { transform: booleanAttribute });

  readonly clicked = output<MouseEvent>();

  readonly isInteractive = computed(() => !this.disabled() && !this.isLoading());

  readonly buttonClasses = computed(() => {
    const classes = ['btn', `btn--${this.variant()}`, `btn--${this.size()}`];
    if (this.iconOnly()) {
      classes.push('btn--icon-only');
    }
    if (this.isLoading()) {
      classes.push('btn--loading');
    }
    if (this.disabled()) {
      classes.push('btn--disabled');
    }
    return classes.join(' ');
  });

  constructor() {
    if (isDevMode()) {
      afterNextRender(() => this.warnIfMissingAccessibleName());
    }
  }

  handleClick(event: MouseEvent): void {
    if (!this.isInteractive()) {
      // aria-disabled no frena el click nativo: se corta acá para que un
      // type="submit" deshabilitado tampoco dispare el formulario.
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.clicked.emit(event);
  }

  /**
   * Un botón de ícono sin nombre accesible es un control mudo para quien usa
   * lector de pantalla. Solo en desarrollo: en producción no cuesta nada.
   */
  private warnIfMissingAccessibleName(): void {
    if (!this.iconOnly()) {
      return;
    }
    const host = this.hostElement.nativeElement;
    const hasName =
      host.hasAttribute('aria-label') ||
      host.hasAttribute('aria-labelledby') ||
      (host.textContent ?? '').trim().length > 0;

    if (!hasName) {
      console.warn(
        '[app-button] iconOnly sin nombre accesible: agregá aria-label al <button>.',
        host,
      );
    }
  }
}

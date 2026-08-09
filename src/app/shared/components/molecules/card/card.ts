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

import { FOCUSABLE_SELECTOR, type CardPadding, type CardVariant } from './card.types';

/**
 * Contenedor de una ficha o un widget. Tres huecos: encabezado, cuerpo y pie,
 * y los dos extremos **solo existen si se les proyecta algo**.
 *
 * ```html
 * <app-card variant="elevated">
 *   <h3 card-header>Signos vitales</h3>
 *   <p>Frecuencia cardíaca 72 lpm</p>
 *   <div card-footer><button app-button size="sm">Ver histórico</button></div>
 * </app-card>
 * ```
 *
 * Con `interactive` la card entera es el control (`role="button"`, Enter y
 * Espacio la activan). Eso vale para una ficha que se abre completa; si
 * adentro hay botones o enlaces, el control anidado es inalcanzable y se avisa
 * por consola en desarrollo.
 */
@Component({
  selector: 'app-card',
  templateUrl: './card.html',
  styleUrl: './card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'cardClasses()',
    '[attr.role]': 'interactive() ? "button" : null',
    '[attr.tabindex]': 'interactive() ? 0 : null',
    '(click)': 'handleActivation($event)',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class Card {
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly variant = input<CardVariant>('outlined');
  readonly padding = input<CardPadding>('md');
  readonly interactive = input(false, { transform: booleanAttribute });

  readonly activated = output<Event>();

  readonly cardClasses = computed(() => {
    const classes = ['card', `card--${this.variant()}`, `card--padding-${this.padding()}`];
    if (this.interactive()) {
      classes.push('card--interactive');
    }
    return classes.join(' ');
  });

  constructor() {
    if (isDevMode()) {
      afterNextRender(() => this.warnIfInteractiveWithFocusables());
    }
  }

  protected handleActivation(event: Event): void {
    if (!this.interactive()) {
      return;
    }
    this.activated.emit(event);
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (!this.interactive() || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }
    // el Espacio desplaza la página si no se lo frena
    event.preventDefault();
    this.activated.emit(event);
  }

  /**
   * Una card clickeable con controles adentro es una trampa: el lector de
   * pantalla anuncia un botón que contiene otros botones y el teclado no
   * puede activar los de adentro sin disparar el de afuera.
   */
  private warnIfInteractiveWithFocusables(): void {
    if (!this.interactive()) {
      return;
    }
    const anidados = this.hostElement.nativeElement.querySelectorAll(FOCUSABLE_SELECTOR);
    if (anidados.length > 0) {
      console.warn(
        '[app-card] `interactive` con controles enfocables adentro: quedan inalcanzables. ' +
          'Usá una card estática con un botón explícito.',
        this.hostElement.nativeElement,
      );
    }
  }
}

import {
  Directive,
  ElementRef,
  inject,
  input,
  type OnDestroy,
} from '@angular/core';

import type { Menu } from '../menu';

/**
 * Abre un `app-menu` desde cualquier control.
 *
 * ```html
 * <button app-button [appMenuTrigger]="acciones">Acciones</button>
 * <app-menu #acciones>…</app-menu>
 * ```
 *
 * La directiva es la dueña del contrato ARIA del disparador
 * (`aria-haspopup`, `aria-expanded`, `aria-controls`) y de **devolver el
 * foco** cuando el menú se cierra: sin eso, cerrar con Escape deja el foco en
 * el `<body>` y quien navega con teclado pierde el lugar en la página.
 */
@Directive({
  selector: '[appMenuTrigger]',
  host: {
    'aria-haspopup': 'menu',
    '[attr.aria-expanded]': 'menu().isOpen()',
    '[attr.aria-controls]': 'menu().menuId',
    '(click)': 'toggle()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class MenuTrigger implements OnDestroy {
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly appMenuTrigger = input.required<Menu>();

  /** Alias interno: `menu()` se lee mejor que `appMenuTrigger()` en el host. */
  protected readonly menu = this.appMenuTrigger;

  private cierreSuscrito: { unsubscribe(): void } | null = null;

  ngOnDestroy(): void {
    this.cierreSuscrito?.unsubscribe();
  }

  protected toggle(): void {
    this.subscribeToClose();
    this.menu().toggleFrom(this.hostElement.nativeElement);
  }

  /** Las flechas también abren, como en cualquier menú de escritorio. */
  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    event.preventDefault();
    this.subscribeToClose();
    this.menu().openFrom(this.hostElement.nativeElement);
  }

  /**
   * Se suscribe una sola vez, tarde: el `Menu` llega por input y en el
   * constructor todavía no existe.
   */
  private subscribeToClose(): void {
    if (this.cierreSuscrito !== null) {
      return;
    }
    this.cierreSuscrito = this.menu().closed.subscribe(() => this.returnFocus());
  }

  private returnFocus(): void {
    this.hostElement.nativeElement.focus();
  }
}

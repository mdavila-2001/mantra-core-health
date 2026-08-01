import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

/**
 * Diálogo modal reutilizable. Lo que hace que un `role="dialog"` sea un diálogo
 * de verdad y no una etiqueta decorativa:
 *
 * - mueve el foco adentro al abrir,
 * - lo **atrapa** con Tab y Shift+Tab,
 * - cierra con Escape y con clic en el fondo,
 * - devuelve el foco a donde estaba al cerrar.
 *
 * Estaba escrito en línea dentro de `date-picker`, que era la única
 * implementación de trampa de foco del repositorio. Acá se escribe una vez.
 *
 * **Se monta ya abierto**: el consumidor lo envuelve en un `@if`, de modo que
 * crear el componente ES abrirlo y destruirlo ES cerrarlo. Así no hay un estado
 * `open` duplicado a ambos lados que pueda desincronizarse.
 *
 * ```html
 * @if (isOpen()) {
 *   <app-dialog label="Seleccionar fecha" [restoreFocusTo]="trigger()"
 *               (closed)="cerrar()">
 *     …contenido…
 *   </app-dialog>
 * }
 * ```
 */
@Component({
  selector: 'app-dialog',
  templateUrl: './dialog.html',
  styleUrl: './dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogComponent {
  /** Nombre accesible del diálogo. Sin él, un lector anuncia «diálogo» y nada más. */
  readonly label = input.required<string>();

  /**
   * Elemento al que devolver el foco al cerrar — normalmente el botón que abrió.
   * Sin esto el foco cae al `<body>` y quien navega con teclado pierde el sitio.
   */
  readonly restoreFocusTo = input<HTMLElement | null>(null);

  /** Escape o clic en el fondo. El consumidor decide si de verdad cierra. */
  readonly closed = output<void>();

  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');

  constructor() {
    // El foco entra recién cuando la vista existe; `viewChild` avisa en ese
    // momento, cosa que un microtask tras crear el componente no garantiza.
    effect(() => this.surface().nativeElement.focus());

    inject(DestroyRef).onDestroy(() => this.restoreFocusTo()?.focus());
  }

  protected requestClose(): void {
    this.closed.emit();
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.requestClose();
      return;
    }
    if (event.key === 'Tab') {
      this.keepFocusInside(event);
    }
  }

  /**
   * Solo se interviene en los **bordes**: saliendo del último hacia adelante o
   * del primero hacia atrás. En medio se deja pasar el Tab nativo, que ya sabe
   * cuál es el siguiente control mejor que cualquier lista propia.
   */
  private keepFocusInside(event: KeyboardEvent): void {
    const host = this.surface().nativeElement;
    const focusables = host.querySelectorAll<HTMLElement>(
      'button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) {
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = host.ownerDocument.activeElement;

    // `active === host` es el estado recién abierto: el foco está en el
    // contenedor, así que Shift+Tab debe ir a parar al final, no escaparse.
    if (event.shiftKey && (active === first || active === host)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

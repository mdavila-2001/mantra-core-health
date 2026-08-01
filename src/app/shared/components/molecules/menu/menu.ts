import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DOCUMENT,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  output,
  PLATFORM_ID,
  signal,
  type OnDestroy,
} from '@angular/core';

import { nextControlId } from '../../form-control/form-control.context';
import { MenuItem } from './menu-item/menu-item';
import { MENU_GAP_PX, MENU_PARENT, type MenuHost } from './menu.types';

/**
 * Panel de acciones. Se declara junto a su disparador y se abre con la
 * directiva `appMenuTrigger`:
 *
 * ```html
 * <button app-button [appMenuTrigger]="acciones">Acciones</button>
 * <app-menu #acciones>
 *   <app-menu-item (selected)="imprimir()">Imprimir receta</app-menu-item>
 *   <app-menu-item destructive (selected)="anular()">Anular orden</app-menu-item>
 * </app-menu>
 * ```
 *
 * Mientras está abierto, el panel **se muda al `<body>`** y se posiciona con
 * `position: fixed` desde el rectángulo del disparador: en una fila de tabla
 * con `overflow`, un menú posicionado en su lugar aparece recortado. Al
 * cerrarse vuelve exactamente a donde estaba.
 *
 * Teclado completo: `↓`/`↑` con vuelta, `Home`/`End`, `Enter`/`Espacio`
 * activan, `Escape` cierra y devuelve el foco al disparador, `Tab` cierra.
 * Bajo SSR no hace nada: sin `document` no hay nada que medir ni mover.
 */
@Component({
  selector: 'app-menu',
  templateUrl: './menu.html',
  styleUrl: './menu.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MENU_PARENT, useExisting: forwardRef(() => Menu) }],
  host: {
    '[class]': 'menuClasses()',
    '[id]': 'menuId',
    role: 'menu',
    '[attr.aria-hidden]': 'isOpen() ? null : "true"',
    '[style.top.px]': 'top()',
    '[style.left.px]': 'left()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class Menu implements MenuHost, OnDestroy {
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly injector = inject(Injector);

  private readonly items = contentChildren(MenuItem);

  /** Lo escucha la directiva para sincronizar `aria-expanded` y el foco. */
  readonly closed = output<void>();

  readonly menuId = nextControlId('menu');

  private readonly open = signal(false);
  readonly isOpen = this.open.asReadonly();

  protected readonly top = signal(0);
  protected readonly left = signal(0);

  protected readonly menuClasses = computed(() =>
    this.open() ? 'menu menu--open' : 'menu',
  );

  /** Dónde estaba el panel antes de mudarse: para devolverlo tal cual. */
  private homeParent: Node | null = null;
  private homeNextSibling: Node | null = null;
  private trigger: HTMLElement | null = null;

  /** Referencias estables: `removeEventListener` exige la MISMA función. */
  private readonly onViewportChange = (): void => this.place();
  private readonly onPointerDown = (event: Event): void => this.closeIfOutside(event);

  ngOnDestroy(): void {
    this.listenToDocument(false);
    if (this.homeParent === null) {
      return;
    }
    // Está colgado del <body> y su lugar de origen se va con esta misma
    // destrucción: devolverlo ahí no tiene sentido —y el nodo de referencia
    // ya puede no existir—, así que se lo saca y listo.
    this.hostElement.nativeElement.remove();
    this.homeParent = null;
    this.homeNextSibling = null;
  }

  /* ---- apertura y cierre --------------------------------------------------- */

  openFrom(trigger: HTMLElement): void {
    if (!this.isBrowser || this.open()) {
      return;
    }
    this.trigger = trigger;
    this.moveToBody();
    this.open.set(true);
    this.listenToDocument(true);

    // Medir y enfocar exige que el panel YA esté pintado: recién abierto el
    // host sigue en `display: none` y `focus()` sobre algo invisible no hace
    // nada. `afterNextRender` es el único momento seguro.
    afterNextRender(
      () => {
        this.place();
        this.focusItem(this.firstEnabledIndex());
      },
      { injector: this.injector },
    );
  }

  close(): void {
    if (!this.open()) {
      return;
    }
    this.open.set(false);
    this.listenToDocument(false);
    this.detachFromBody();
    this.trigger = null;
    this.closed.emit();
  }

  toggleFrom(trigger: HTMLElement): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.openFrom(trigger);
  }

  /* ---- teclado -------------------------------------------------------------- */

  protected handleKeydown(event: KeyboardEvent): void {
    if (!this.open()) {
      return;
    }

    if (event.key === 'Escape' || event.key === 'Tab') {
      // Tab cierra en vez de sacar el foco a la página de atrás: el menú es
      // una capa, y tabular fuera de ella dejaría un panel abierto sin foco.
      event.preventDefault();
      this.close();
      return;
    }

    const destino = this.nextFocusIndex(event.key);
    if (destino !== null) {
      event.preventDefault();
      this.focusItem(destino);
    }
  }

  private nextFocusIndex(key: string): number | null {
    const utilizables = this.enabledIndexes();
    if (utilizables.length === 0) {
      return null;
    }
    const actual = this.focusedIndex();

    switch (key) {
      case 'ArrowDown':
        return this.step(utilizables, actual, 1);
      case 'ArrowUp':
        return this.step(utilizables, actual, -1);
      case 'Home':
        return utilizables[0];
      case 'End':
        return utilizables.at(-1) ?? null;
      default:
        return null;
    }
  }

  /** Avanza dentro de los utilizables dando la vuelta al llegar al extremo. */
  private step(utilizables: readonly number[], from: number, direction: 1 | -1): number {
    const posicion = utilizables.indexOf(from);
    if (posicion < 0) {
      return direction === 1 ? utilizables[0] : (utilizables.at(-1) ?? utilizables[0]);
    }
    const siguiente = (posicion + direction + utilizables.length) % utilizables.length;
    return utilizables[siguiente];
  }

  private focusedIndex(): number {
    return this.items().findIndex(
      (item) => item.element.nativeElement === this.document.activeElement,
    );
  }

  private enabledIndexes(): readonly number[] {
    return this.items()
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.disabled())
      .map(({ index }) => index);
  }

  private firstEnabledIndex(): number {
    return this.enabledIndexes()[0] ?? -1;
  }

  private focusItem(index: number): void {
    this.items()[index]?.element.nativeElement.focus();
  }

  /* ---- mudanza al body y posicionamiento ------------------------------------ */

  private moveToBody(): void {
    const panel = this.hostElement.nativeElement;
    this.homeParent = panel.parentNode;
    this.homeNextSibling = panel.nextSibling;
    this.document.body.appendChild(panel);
  }

  /** Lo devuelve exactamente a su lugar: el consumidor sigue siendo su dueño. */
  private detachFromBody(): void {
    const parent = this.homeParent;
    if (parent === null) {
      return;
    }
    const sibling = this.homeNextSibling;
    this.homeParent = null;
    this.homeNextSibling = null;

    // El hermano de referencia pudo haberse ido mientras el menú estaba
    // abierto (una fila de tabla que se re-renderiza): `insertBefore` con un
    // nodo que ya no es hijo lanza, y dejaría el panel pegado al <body>.
    if (sibling !== null && sibling.parentNode === parent) {
      parent.insertBefore(this.hostElement.nativeElement, sibling);
      return;
    }
    parent.appendChild(this.hostElement.nativeElement);
  }

  private place(): void {
    const trigger = this.trigger;
    if (trigger === null) {
      return;
    }

    const anclaje = trigger.getBoundingClientRect();
    const panel = this.hostElement.nativeElement.getBoundingClientRect();
    const view = this.document.defaultView;
    const altoViewport = view?.innerHeight ?? 0;
    const anchoViewport = view?.innerWidth ?? 0;

    // Abajo por defecto; si no entra, voltea arriba.
    const entraAbajo = anclaje.bottom + panel.height + MENU_GAP_PX <= altoViewport;
    this.top.set(
      entraAbajo
        ? anclaje.bottom + MENU_GAP_PX
        : Math.max(0, anclaje.top - panel.height - MENU_GAP_PX),
    );

    // Alineado a la izquierda del disparador, sin salirse por la derecha.
    const maximoIzquierda = Math.max(0, anchoViewport - panel.width);
    this.left.set(Math.min(anclaje.left, maximoIzquierda));
  }

  private closeIfOutside(event: Event): void {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    const dentroDelPanel = this.hostElement.nativeElement.contains(target);
    const enElDisparador = this.trigger?.contains(target) === true;

    if (!dentroDelPanel && !enElDisparador) {
      this.close();
    }
  }

  /**
   * Mientras está abierto sigue al disparador y escucha por fuera. Pasivos
   * porque nunca cancelan el scroll; en captura para enterarse también del
   * scroll de un contenedor interno.
   */
  private listenToDocument(listen: boolean): void {
    const view = this.document.defaultView;
    if (view === null) {
      return;
    }
    if (listen) {
      view.addEventListener('scroll', this.onViewportChange, { passive: true, capture: true });
      view.addEventListener('resize', this.onViewportChange, { passive: true });
      this.document.addEventListener('pointerdown', this.onPointerDown, true);
      return;
    }
    view.removeEventListener('scroll', this.onViewportChange, { capture: true });
    view.removeEventListener('resize', this.onViewportChange);
    this.document.removeEventListener('pointerdown', this.onPointerDown, true);
  }
}

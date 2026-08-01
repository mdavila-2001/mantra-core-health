import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ApplicationRef,
  createComponent,
  Directive,
  DOCUMENT,
  ElementRef,
  EnvironmentInjector,
  inject,
  input,
  isDevMode,
  PLATFORM_ID,
  type ComponentRef,
  type OnDestroy,
} from '@angular/core';

import { nextControlId } from '@shared/forms/form-control.context';
import { TooltipPanel } from './tooltip-panel';
import {
  TOOLTIP_GAP_PX,
  TOOLTIP_HOVER_DELAY_MS,
  TOOLTIP_OPPOSITE,
  type TooltipPosition,
} from './tooltip.types';

/** Selectores que ya son enfocables sin `tabindex`. */
const NATIVELY_FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

/**
 * Globo de ayuda sobre cualquier control.
 *
 * ```html
 * <button app-button iconOnly aria-label="Imprimir" appTooltip="Imprimir receta">…</button>
 * <span appTooltip="Índice de masa corporal" appTooltipPosition="right">IMC</span>
 * ```
 *
 * El globo se cuelga del `<body>` y se posiciona con `position: fixed` desde el
 * rectángulo del host: así no lo recorta ningún contenedor con `overflow`, que
 * es donde mueren los tooltips de una tabla clínica. Si el lado pedido no entra
 * en el viewport, voltea al opuesto.
 *
 * Bajo SSR no hace absolutamente nada: no hay `document` que medir. El globo
 * aparece con el puntero (tras una espera corta) y con el foco (sin espera);
 * se va con `mouseleave`, `blur` o `Escape`.
 */
@Directive({
  selector: '[appTooltip]',
  host: {
    '(mouseenter)': 'scheduleShow()',
    '(mouseleave)': 'hide()',
    '(focus)': 'show()',
    '(blur)': 'hide()',
    '(keydown.escape)': 'hide()',
  },
})
export class Tooltip implements OnDestroy {
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly applicationRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly appTooltip = input<string>('');
  readonly appTooltipPosition = input<TooltipPosition>('top');

  private panel: ComponentRef<TooltipPanel> | null = null;
  private pendingShow: ReturnType<typeof setTimeout> | null = null;
  /** El host podía tener su propia descripción: se restituye al ocultar. */
  private describedByBeforeShow: string | null = null;
  private readonly panelId = nextControlId('tooltip');

  /** Referencia estable: `removeEventListener` necesita la MISMA función. */
  private readonly repositionOnViewportChange = (): void => this.place();

  constructor() {
    if (isDevMode()) {
      afterNextRender(() => this.warnIfUnreachable());
    }
  }

  ngOnDestroy(): void {
    // El globo vive fuera del árbol del componente: sin esto queda colgado del
    // <body> para siempre.
    this.hide();
  }

  /** Con el puntero se espera; cruzar una fila de íconos no debe abrir nada. */
  protected scheduleShow(): void {
    if (!this.isBrowser || this.pendingShow !== null) {
      return;
    }
    this.pendingShow = setTimeout(() => {
      this.pendingShow = null;
      this.show();
    }, TOOLTIP_HOVER_DELAY_MS);
  }

  /** Con el teclado no se espera: llegar al control ya es la intención. */
  protected show(): void {
    if (!this.isBrowser || this.panel !== null || !this.appTooltip().trim()) {
      return;
    }

    const panel = createComponent(TooltipPanel, {
      environmentInjector: this.environmentInjector,
    });
    panel.setInput('panelId', this.panelId);
    panel.setInput('text', this.appTooltip());
    panel.setInput('position', this.appTooltipPosition());

    this.applicationRef.attachView(panel.hostView);
    this.document.body.appendChild(panel.location.nativeElement);
    this.panel = panel;

    this.place();
    this.describeHost();
    this.listenToViewport(true);
  }

  protected hide(): void {
    this.cancelPendingShow();

    const panel = this.panel;
    if (panel === null) {
      return;
    }
    this.panel = null;

    this.listenToViewport(false);
    this.restoreHostDescription();
    this.applicationRef.detachView(panel.hostView);
    panel.destroy();
    panel.location.nativeElement.remove();
  }

  private cancelPendingShow(): void {
    if (this.pendingShow !== null) {
      clearTimeout(this.pendingShow);
      this.pendingShow = null;
    }
  }

  /* ---- posicionamiento ----------------------------------------------------- */

  private place(): void {
    const panel = this.panel;
    if (panel === null) {
      return;
    }

    const host = this.hostElement.nativeElement.getBoundingClientRect();
    const globe = (panel.location.nativeElement as HTMLElement).getBoundingClientRect();
    const position = this.fittingPosition(host, globe);
    const { top, left } = this.coordinatesFor(position, host, globe);

    panel.setInput('position', position);
    panel.setInput('top', top);
    panel.setInput('left', left);
    // El globo ya está en el DOM: sin esto se pinta un frame en (0,0).
    panel.changeDetectorRef.detectChanges();
  }

  private fittingPosition(host: DOMRect, globe: DOMRect): TooltipPosition {
    const requested = this.appTooltipPosition();
    return this.fits(requested, host, globe) ? requested : TOOLTIP_OPPOSITE[requested];
  }

  private fits(position: TooltipPosition, host: DOMRect, globe: DOMRect): boolean {
    const view = this.document.defaultView;
    const viewportWidth = view?.innerWidth ?? 0;
    const viewportHeight = view?.innerHeight ?? 0;

    switch (position) {
      case 'top':
        return host.top - globe.height - TOOLTIP_GAP_PX >= 0;
      case 'bottom':
        return host.bottom + globe.height + TOOLTIP_GAP_PX <= viewportHeight;
      case 'left':
        return host.left - globe.width - TOOLTIP_GAP_PX >= 0;
      case 'right':
        return host.right + globe.width + TOOLTIP_GAP_PX <= viewportWidth;
    }
  }

  private coordinatesFor(
    position: TooltipPosition,
    host: DOMRect,
    globe: DOMRect,
  ): { top: number; left: number } {
    const centerX = host.left + host.width / 2 - globe.width / 2;
    const centerY = host.top + host.height / 2 - globe.height / 2;

    switch (position) {
      case 'top':
        return { top: host.top - globe.height - TOOLTIP_GAP_PX, left: centerX };
      case 'bottom':
        return { top: host.bottom + TOOLTIP_GAP_PX, left: centerX };
      case 'left':
        return { top: centerY, left: host.left - globe.width - TOOLTIP_GAP_PX };
      case 'right':
        return { top: centerY, left: host.right + TOOLTIP_GAP_PX };
    }
  }

  /**
   * Mientras el globo está a la vista sigue al host: una tabla clínica se
   * desplaza y el globo, que es `fixed`, se quedaría atrás. Pasivos porque
   * jamás cancelan el scroll; en captura para enterarse también del scroll de
   * un contenedor interno.
   */
  private listenToViewport(listen: boolean): void {
    const view = this.document.defaultView;
    if (view === null) {
      return;
    }
    if (listen) {
      view.addEventListener('scroll', this.repositionOnViewportChange, {
        passive: true,
        capture: true,
      });
      view.addEventListener('resize', this.repositionOnViewportChange, { passive: true });
      return;
    }
    view.removeEventListener('scroll', this.repositionOnViewportChange, { capture: true });
    view.removeEventListener('resize', this.repositionOnViewportChange);
  }

  /* ---- nombre accesible ---------------------------------------------------- */

  private describeHost(): void {
    const host = this.hostElement.nativeElement;
    this.describedByBeforeShow = host.getAttribute('aria-describedby');
    host.setAttribute('aria-describedby', this.panelId);
  }

  private restoreHostDescription(): void {
    const host = this.hostElement.nativeElement;
    if (this.describedByBeforeShow === null) {
      host.removeAttribute('aria-describedby');
      return;
    }
    host.setAttribute('aria-describedby', this.describedByBeforeShow);
    this.describedByBeforeShow = null;
  }

  /**
   * Un tooltip sobre algo que no se puede enfocar ni leer es una ayuda que
   * solo existe para quien usa mouse y ve. Solo en desarrollo.
   */
  private warnIfUnreachable(): void {
    const host = this.hostElement.nativeElement;
    const focusable = host.matches(NATIVELY_FOCUSABLE) || host.tabIndex >= 0;
    const hasVisibleText = (host.textContent ?? '').trim().length > 0;

    if (!focusable && !hasVisibleText) {
      console.warn(
        '[appTooltip] el host no es enfocable ni tiene texto visible: la ayuda queda ' +
          'fuera del alcance del teclado. Agregá tabindex="0" o un nombre accesible.',
        host,
      );
    }
  }
}

import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ApplicationRef,
  createComponent,
  Directive,
  DOCUMENT,
  effect,
  ElementRef,
  EnvironmentInjector,
  inject,
  input,
  isDevMode,
  PLATFORM_ID,
  type ComponentRef,
  type OnDestroy,
  type TemplateRef,
} from '@angular/core';

import { nextControlId } from '@shared/forms/form-control.context';
import { TooltipPanel } from './tooltip-panel';
import { placeFloating, type Rect } from './floating-placement';
import {
  TOOLTIP_CLOSE_DELAY_MS,
  TOOLTIP_GAP_PX,
  TOOLTIP_HOVER_DELAY_MS,
  TOOLTIP_VIEWPORT_MARGIN_PX,
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
 * <button appTooltip="Ecografía" [appTooltipTemplate]="fichaDelServicio">Ecografía</button>
 * ```
 *
 * Con `appTooltipTemplate` el globo pinta esa plantilla en vez del texto: para
 * una ficha corta de sólo lectura. `appTooltip` sigue siendo obligatorio como
 * resumen: es lo que se muestra si la plantilla falta.
 *
 * El globo se cuelga del `<body>` y se posiciona con `position: fixed` desde el
 * rectángulo del host: así no lo recorta ningún contenedor con `overflow`, que
 * es donde mueren los tooltips de una tabla clínica. Si el lado pedido no entra
 * en el viewport, voltea al opuesto.
 *
 * Bajo SSR no hace absolutamente nada: no hay `document` que medir. El globo
 * aparece con el puntero (tras una espera corta) y con el foco (sin espera);
 * se va con `mouseleave`, `blur` o `Escape`.
 *
 * ## Modo rico (CONTRATO-PLANO §5.6, WCAG 2.1 SC 1.4.13)
 *
 * Tres entradas opcionales, apagadas por omisión (el globo simple no cambia):
 *
 * - `appTooltipShift`: además de voltear, **desplaza** el globo a lo largo del
 *   eje para que no se recorte en el borde, y prueba también los lados
 *   perpendiculares. Usa el mismo motor que la tarjeta del plano
 *   (`placeFloating`): no hay un segundo posicionador.
 * - `appTooltipHoverable`: el puntero puede pasar del control al globo sin que
 *   se cierre (se espera `TOOLTIP_CLOSE_DELAY_MS` al salir) y `Escape` lo
 *   descarta en cualquier momento sin mover el foco. Solo para contenido de
 *   lectura; un globo con controles sigue siendo un diálogo no modal.
 * - `appTooltipAnchor`: un rectángulo de viewport que reemplaza al del host,
 *   para anclar a un punto (por ejemplo el cursor sobre un espacio grande).
 */
@Directive({
  selector: '[appTooltip]',
  host: {
    '(mouseenter)': 'scheduleShow()',
    '(mouseleave)': 'leave()',
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
  readonly appTooltipTemplate = input<TemplateRef<unknown> | null>(null);
  /** Desplazar (además de voltear) para no recortar el globo. */
  readonly appTooltipShift = input(false);
  /** El puntero puede entrar al globo; `Escape` lo descarta (WCAG 1.4.13). */
  readonly appTooltipHoverable = input(false);
  /** Rectángulo de viewport al que anclar en vez del host. */
  readonly appTooltipAnchor = input<Rect | null>(null);

  private panel: ComponentRef<TooltipPanel> | null = null;
  private pendingShow: ReturnType<typeof setTimeout> | null = null;
  private pendingHide: ReturnType<typeof setTimeout> | null = null;
  private overPanel = false;
  /** El host podía tener su propia descripción: se restituye al ocultar. */
  private describedByBeforeShow: string | null = null;
  private readonly panelId = nextControlId('tooltip');

  /** Referencia estable: `removeEventListener` necesita la MISMA función. */
  private readonly repositionOnViewportChange = (): void => this.place();
  private readonly dismissOnEscape = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.hide();
  };
  private readonly panelEnter = (): void => {
    this.overPanel = true;
    this.cancelPendingHide();
  };
  private readonly panelLeave = (): void => {
    this.overPanel = false;
    this.scheduleHide();
  };

  constructor() {
    // El texto puede cambiar con el globo abierto —el resumen del paciente en la
    // agenda dice «Buscando…» hasta que llega el historial—: se reescribe y se
    // vuelve a ubicar, porque un texto más largo es un globo más alto.
    effect(() => {
      const text = this.appTooltip();
      const panel = this.panel;
      if (panel === null) {
        return;
      }
      if (!text.trim()) {
        this.hide();
        return;
      }
      panel.setInput('text', text);
      this.place();
    });

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

  /** Salir con el puntero: cierra ya, o da un puente para llegar al globo si es hoverable. */
  protected leave(): void {
    if (this.appTooltipHoverable() && this.panel !== null) {
      this.cancelPendingShow();
      this.scheduleHide();
      return;
    }
    this.hide();
  }

  private scheduleHide(): void {
    this.cancelPendingHide();
    this.pendingHide = setTimeout(() => {
      this.pendingHide = null;
      if (!this.overPanel) this.hide();
    }, TOOLTIP_CLOSE_DELAY_MS);
  }

  private cancelPendingHide(): void {
    if (this.pendingHide !== null) {
      clearTimeout(this.pendingHide);
      this.pendingHide = null;
    }
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
    panel.setInput('template', this.appTooltipTemplate());
    panel.setInput('position', this.appTooltipPosition());
    panel.setInput('hoverable', this.appTooltipHoverable());

    this.applicationRef.attachView(panel.hostView);
    this.document.body.appendChild(panel.location.nativeElement);
    this.panel = panel;
    this.cancelPendingHide();
    if (this.appTooltipHoverable()) {
      const element = panel.location.nativeElement as HTMLElement;
      element.addEventListener('mouseenter', this.panelEnter);
      element.addEventListener('mouseleave', this.panelLeave);
      this.document.addEventListener('keydown', this.dismissOnEscape);
    }

    this.place();
    this.describeHost();
    this.listenToViewport(true);
  }

  protected hide(): void {
    this.cancelPendingShow();
    this.cancelPendingHide();

    const panel = this.panel;
    if (panel === null) {
      return;
    }
    this.panel = null;
    this.overPanel = false;
    const element = panel.location.nativeElement as HTMLElement;
    element.removeEventListener('mouseenter', this.panelEnter);
    element.removeEventListener('mouseleave', this.panelLeave);
    this.document.removeEventListener('keydown', this.dismissOnEscape);

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

    // Primero se pinta el texto y después se mide: medido antes, el globo es una
    // caja vacía de puro padding, queda corrido hacia abajo sobre el host y
    // centrado con un ancho casi nulo.
    panel.changeDetectorRef.detectChanges();
    const hostRect = this.appTooltipAnchor() ?? toRect(this.hostElement.nativeElement.getBoundingClientRect());
    const globe = (panel.location.nativeElement as HTMLElement).getBoundingClientRect();
    const view = this.document.defaultView;
    const shift = this.appTooltipShift();
    const placement = placeFloating(
      hostRect,
      { width: globe.width, height: globe.height },
      {
        preferred: this.appTooltipPosition(),
        gap: TOOLTIP_GAP_PX,
        bounds: { left: 0, top: 0, width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 },
        margin: shift ? TOOLTIP_VIEWPORT_MARGIN_PX : 0,
        shift,
        // Sin `shift` se conserva el comportamiento histórico: probar el lado pedido y su opuesto.
        legacy: !shift,
      },
    );

    panel.setInput('position', placement.side);
    panel.setInput('top', placement.top);
    panel.setInput('left', placement.left);
    // El globo ya está en el DOM: sin esto se pinta un frame en (0,0).
    panel.changeDetectorRef.detectChanges();
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
          'fuera del alcance del teclado. Agregue tabindex="0" o un nombre accesible.',
        host,
      );
    }
  }
}

function toRect(box: DOMRect): Rect {
  return { left: box.left, top: box.top, width: box.width, height: box.height };
}

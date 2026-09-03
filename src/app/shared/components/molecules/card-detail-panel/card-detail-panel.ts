import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  Injector,
  input,
  PLATFORM_ID,
  signal,
  viewChild,
  type OnDestroy,
} from '@angular/core';

import { nextControlId } from '@shared/forms/form-control.context';
import { AppButton } from '../../atoms/button/button';
import { NavIcon } from '../../atoms/nav-icon/nav-icon';
import {
  CARD_DETAIL_PANEL_GAP_PX,
  CARD_DETAIL_PANEL_MARGIN_PX,
  CARD_DETAIL_PANEL_MIN_HEIGHT_PX,
  CARD_ROOT_ATTRIBUTE,
  type CardDetailRow,
} from './card-detail-panel.types';

/**
 * El botón-ícono «Ver más información» de una tarjeta, con su panel
 * superpuesto.
 *
 * ## Por qué el panel se muda al `<body>`
 *
 * Porque el pedido es explícito: el desplegable **no debe empujar a los demás
 * visuales**. Un bloque más en el flujo de la tarjeta estira su celda de la
 * grilla y corre todas las tarjetas siguientes; medido con `boundingBox()`
 * antes y después, la vecina se mueve decenas de píxeles.
 *
 * Con `position: fixed` y el panel colgado del `<body>` no se mueve nada, y
 * además no lo recorta el `overflow` de la grilla ni el `overflow: hidden` de
 * la propia tarjeta —que existe para redondearle las esquinas a la portada—.
 * Es el mismo patrón que `molecules/menu`, por la misma razón, y por eso no
 * hace falta el CDK.
 *
 * ## Ancho: el de la tarjeta, nunca más
 *
 * El panel se mide contra el ancestro marcado con `data-card-root` (lo pone
 * `CentroCard` en su host). Contra el botón se mediría un ícono de 32 px;
 * contra la ventana, en un monitor ancho, saldría una sábana. En 390 px el
 * ancho se recorta al viewport menos el margen, así que no se sale ni obliga a
 * scroll horizontal.
 *
 * ## Es un desplegable, no un diálogo
 *
 * Clic —no hover—: «una especie de tooltip» con datos adentro no se lee en un
 * teléfono ni con teclado. El botón lleva `aria-expanded` y `aria-controls`;
 * `Escape`, `Tab` y un clic afuera cierran, y el foco vuelve al botón.
 */
@Component({
  selector: 'app-card-detail-panel',
  imports: [AppButton, NavIcon],
  templateUrl: './card-detail-panel.html',
  styleUrl: './card-detail-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDetailPanel implements OnDestroy {
  /** El nombre de la entidad. Encabeza el panel y lo nombra para el lector. */
  readonly heading = input.required<string>();

  /** El resto de los datos. Vacío = la entidad no publicó nada más. */
  readonly rows = input.required<readonly CardDetailRow[]>();

  /** Nombre accesible del botón-ícono. */
  readonly triggerLabel = input('Ver más información');

  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly injector = inject(Injector);

  /**
   * `{ read: ElementRef }` no es decorativo: `#trigger` está sobre un
   * `button[app-button]`, y una referencia de plantilla sobre un elemento con
   * componente devuelve **la instancia del componente**, no su elemento. Sin
   * esto, `triggerRef().nativeElement` es `undefined` y el foco no vuelve.
   */
  private readonly triggerRef = viewChild.required('trigger', {
    read: ElementRef<HTMLButtonElement>,
  });
  private readonly panelRef = viewChild.required<ElementRef<HTMLElement>>('panel');

  readonly panelId = nextControlId('card-detail');
  protected readonly headingId = this.panelId + '-heading';

  private readonly opened = signal(false);
  readonly isOpen = this.opened.asReadonly();

  protected readonly top = signal(0);
  protected readonly left = signal(0);
  protected readonly width = signal(0);
  protected readonly maxHeight = signal(0);

  /** Dónde estaba el panel antes de mudarse, para devolverlo tal cual. */
  private homeParent: Node | null = null;
  private homeNextSibling: Node | null = null;

  /** Referencias estables: `removeEventListener` exige la MISMA función. */
  private readonly onViewportChange = (): void => this.place();
  private readonly onPointerDown = (event: Event): void => this.closeIfOutside(event);

  ngOnDestroy(): void {
    this.listenToDocument(false);
    if (this.homeParent === null) {
      return;
    }
    // Está colgado del `<body>` y su lugar de origen se destruye con esta
    // misma vista: devolverlo ahí no tiene sentido, así que se lo saca.
    this.panelRef().nativeElement.remove();
    this.homeParent = null;
    this.homeNextSibling = null;
  }

  protected toggle(): void {
    if (this.opened()) {
      this.close();
      return;
    }
    this.open();
  }

  /** Abre el panel y le deja el foco adentro. */
  open(): void {
    if (!this.isBrowser || this.opened()) {
      return;
    }
    this.moveToBody();
    this.opened.set(true);
    this.listenToDocument(true);

    // Medir y enfocar exige el panel YA pintado: recién abierto sigue en
    // `display: none` y `focus()` sobre algo invisible no hace nada.
    afterNextRender(
      () => {
        this.place();
        this.focusPanel();
      },
      { injector: this.injector },
    );
  }

  /** Cierra el panel y devuelve el foco al botón. */
  close(returnFocus = true): void {
    if (!this.opened()) {
      return;
    }
    this.opened.set(false);
    this.listenToDocument(false);
    this.detachFromBody();
    if (returnFocus) {
      this.triggerRef().nativeElement.focus();
    }
  }

  /**
   * `Escape` cierra. `Tab` también: el panel está colgado del `<body>`, así
   * que tabular fuera de él dejaría el foco al final del documento y el panel
   * abierto atrás, sin nadie adentro.
   */
  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' && event.key !== 'Tab') {
      return;
    }
    event.preventDefault();
    this.close();
  }

  /* ---- mudanza y medición -------------------------------------------------- */

  private moveToBody(): void {
    const panel = this.panelRef().nativeElement;
    this.homeParent = panel.parentNode;
    this.homeNextSibling = panel.nextSibling;
    this.document.body.appendChild(panel);
  }

  private detachFromBody(): void {
    const parent = this.homeParent;
    if (parent === null) {
      return;
    }
    parent.insertBefore(this.panelRef().nativeElement, this.homeNextSibling);
    this.homeParent = null;
    this.homeNextSibling = null;
  }

  /**
   * Coloca el panel debajo del botón, con el ancho de la tarjeta.
   *
   * Crece **hacia abajo**. Cuando abajo no queda alto utilizable —el botón está
   * al pie del viewport— se corre el borde superior hacia arriba en vez de
   * abrirse al revés: así el panel nunca aparece encima del botón, que es lo
   * que confunde a quien lo acaba de tocar.
   */
  private place(): void {
    const view = this.document.defaultView;
    if (view === null) {
      return;
    }

    const trigger = this.triggerRef().nativeElement;
    const card = trigger.closest('[' + CARD_ROOT_ATTRIBUTE + ']') ?? trigger;
    const cardRect = card.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();

    const margen = CARD_DETAIL_PANEL_MARGIN_PX;
    const ancho = Math.min(cardRect.width, view.innerWidth - margen * 2);
    const izquierda = Math.min(
      Math.max(cardRect.left, margen),
      Math.max(margen, view.innerWidth - ancho - margen),
    );

    const arriba = triggerRect.bottom + CARD_DETAIL_PANEL_GAP_PX;
    const disponible = view.innerHeight - margen - arriba;

    if (disponible >= CARD_DETAIL_PANEL_MIN_HEIGHT_PX) {
      this.top.set(arriba);
      this.maxHeight.set(disponible);
    } else {
      const alto = Math.min(
        CARD_DETAIL_PANEL_MIN_HEIGHT_PX,
        Math.max(0, view.innerHeight - margen * 2),
      );
      this.maxHeight.set(alto);
      this.top.set(Math.max(margen, view.innerHeight - margen - alto));
    }

    this.left.set(izquierda);
    this.width.set(ancho);
  }

  private focusPanel(): void {
    const panel = this.panelRef().nativeElement;
    const cerrar = panel.querySelector('button');
    if (cerrar instanceof HTMLElement) {
      cerrar.focus();
      return;
    }
    panel.focus();
  }

  /* ---- escuchas del documento ---------------------------------------------- */

  private listenToDocument(activo: boolean): void {
    if (!this.isBrowser) {
      return;
    }
    const view = this.document.defaultView;
    if (view === null) {
      return;
    }
    if (activo) {
      this.document.addEventListener('pointerdown', this.onPointerDown, true);
      // En captura: un scroll adentro de un contenedor no burbujea a `window`,
      // y el panel quedaría flotando lejos de su tarjeta.
      view.addEventListener('scroll', this.onViewportChange, true);
      view.addEventListener('resize', this.onViewportChange);
      return;
    }
    this.document.removeEventListener('pointerdown', this.onPointerDown, true);
    view.removeEventListener('scroll', this.onViewportChange, true);
    view.removeEventListener('resize', this.onViewportChange);
  }

  /**
   * Un clic afuera cierra sin devolver el foco: quien tocó otra cosa ya eligió
   * dónde quiere estar, y traerle el foco de vuelta al botón se lo saca.
   */
  private closeIfOutside(event: Event): void {
    const destino = event.target;
    if (!(destino instanceof Node)) {
      return;
    }
    if (
      this.panelRef().nativeElement.contains(destino) ||
      this.triggerRef().nativeElement.contains(destino)
    ) {
      return;
    }
    this.close(false);
  }
}

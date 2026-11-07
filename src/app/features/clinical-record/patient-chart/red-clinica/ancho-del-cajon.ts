import { DestroyRef, DOCUMENT, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Below this width the network's side panel becomes a sheet.
 *
 * ## Why its own threshold and not the nav drawer one
 *
 * The side panel sits next to the canvas: nav sidebar (~15rem) + panel
 * (up to 26rem) + a readable canvas (>= ~36rem) need about 1280 px. With the
 * nav drawer threshold (780 px) a 1024 px window left the canvas at 280 px,
 * with the edge jumps overlapping and episode names cut. The query lives here,
 * not in `core/layout/breakpoints.ts`: importing that module from lazy code
 * splits it into its own initial chunk and breaks the initial bundle budget.
 * `ancho-del-cajon.spec.ts` keeps it above the nav drawer threshold.
 */
export const CONSULTA_DEL_CAJON = '(max-width: 1279px)';

/**
 * Whether the network's panel must be shown as a sheet over the content.
 * It reads the window as soon as it is created: it is first injected by a
 * screen that is already rendering, never before the shell. On the server,
 * desktop.
 */
@Injectable({ providedIn: 'root' })
export class AnchoDelCajon {
  private readonly estrecho = signal(false);

  /** `true` when the side panel does not fit next to a readable canvas. */
  readonly panelEnHoja = this.estrecho.asReadonly();

  constructor() {
    const view = inject(DOCUMENT).defaultView;
    if (!isPlatformBrowser(inject(PLATFORM_ID)) || view?.matchMedia === undefined) {
      return;
    }
    const consulta = view.matchMedia(CONSULTA_DEL_CAJON);
    this.estrecho.set(consulta.matches);
    const alCambiar = (evento: MediaQueryListEvent): void => this.estrecho.set(evento.matches);
    consulta.addEventListener('change', alCambiar);
    inject(DestroyRef).onDestroy(() => consulta.removeEventListener('change', alCambiar));
  }
}

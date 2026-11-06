import { DestroyRef, DOCUMENT, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * The nav drawer query, mirrored from `Breakpoints.isNavDrawer`
 * (`core/layout/breakpoints.ts`, `NAV_DRAWER_MAX_WIDTH`).
 *
 * ## Why a mirror and not `Breakpoints`
 *
 * Lazy code that imports `core/layout/breakpoints.ts` makes the bundler split
 * that module into its own initial chunk (it is shared with the shell), and
 * the chunk's wrapping alone pushed the initial bundle over its 1.5 MB budget.
 * The duplication is of the same kind that file documents for its CSS mirror:
 * `ancho-del-cajon.spec.ts` pins this query to `NAV_DRAWER_MAX_WIDTH`, so the
 * two cannot drift apart silently.
 */
export const CONSULTA_DEL_CAJON = '(max-width: 779px)';

/**
 * Whether the window is below the nav drawer threshold, for the clinical
 * network (the side panel becomes a sheet). Unlike `Breakpoints` it reads the
 * window as soon as it is created: it is first injected by a screen that is
 * already rendering, never before the shell. On the server, desktop.
 */
@Injectable({ providedIn: 'root' })
export class AnchoDelCajon {
  private readonly estrecho = signal(false);

  /** `true` when the nav behaves as a drawer over the content. */
  readonly isNavDrawer = this.estrecho.asReadonly();

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

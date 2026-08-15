import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { NavIconName } from './nav-icon.types';

/**
 * El ícono de una sección, del set cerrado de la navegación.
 *
 * ## Por qué existe
 *
 * El marcado de estos siete `<svg>` estaba escrito dentro de `side-nav.html`.
 * Cuando el carril 02 convirtió «Tus accesos» en una rejilla de íconos —la
 * corrección #1— había dos salidas: copiar el `@switch` al panel, o extraerlo.
 *
 * Copiarlo habría producido justo lo que la corrección #8 prohíbe: dos
 * implementaciones de la misma UI que se separan en cuanto alguien retoque una.
 * Y el menú y el panel **tienen** que mostrar el mismo dibujo para la misma
 * sección: son la misma puerta vista desde dos lugares, y un ícono distinto en
 * cada lado rompe el reconocimiento, que es lo único que un ícono aporta.
 *
 * ## Siempre `aria-hidden`
 *
 * El ícono nunca es el nombre accesible: es una ayuda visual que **se repite a
 * propósito** entre secciones distintas —el set es de siete y las secciones son
 * veinticinco—. Quien lo usa pone el nombre en el host (`aria-label`) o al
 * lado; anunciarlo acá diría «imagen» siete veces por pantalla.
 */
@Component({
  selector: 'app-nav-icon',
  template: `
    @switch (name()) {
      @case ('patients') {
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        </svg>
      }
      @case ('calendar') {
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      }
      @case ('orders') {
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      }
      @case ('results') {
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M3 12h4l3 8 4-16 3 8h4" />
        </svg>
      }
      @case ('billing') {
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      }
      @case ('settings') {
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </svg>
      }
      @default {
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
        </svg>
      }
    }
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    svg {
      width: 100%;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavIcon {
  /**
   * Cuál de los siete. Sin nombre —o con uno que el set no tiene— cae en el
   * ícono de inicio, que es el neutro: nunca se deja un hueco donde iba un
   * ícono, porque la rejilla se desalinea y no se entiende por qué.
   */
  readonly name = input<NavIconName | undefined>(undefined);
}

import {
  afterNextRender,
  DestroyRef,
  DOCUMENT,
  inject,
  Injectable,
  Injector,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Ancho a partir del cual el nav deja de ser cajón y pasa a ser columna fija.
 *
 * **Espeja el `@media (min-width: 780px)` de `shell.css` y `side-nav.css`**, y esa duplicación es
 * deliberada: el CSS decide cómo se ve el panel y esto decide si el encabezado ofrece el botón de
 * hamburguesa. Son dos preguntas distintas sobre el mismo umbral, y una de las dos no se puede
 * responder desde una hoja de estilos. La prueba de este archivo fija el número para que no se
 * separen en silencio.
 */
export const NAV_DRAWER_MAX_WIDTH = 780;

/**
 * Ancho a partir del cual la barra puede **recogerse** a su carril de íconos.
 *
 * Espeja el `@media (min-width: 901px)` con que `alovida.css` gobierna el
 * carril, y la duplicación es del mismo tipo que la de arriba: la hoja decide
 * cómo se ve la barra recogida, y esto decide si el armazón la trata como
 * recogida para lo que el CSS no alcanza —el globo de ayuda que devuelve el
 * nombre del destino cuando el rótulo no se ve—.
 *
 * **No es el umbral del cajón, y no debería serlo.** Por debajo de 901 px la
 * barra de ALOVIDA es un cajón sobre el contenido, y recoger un cajón no
 * significa nada: sus renglones necesitan su texto. Sin esta pregunta, una
 * preferencia tomada en el escritorio dejaba el cajón del teléfono con ocho
 * íconos sin nombre.
 */
export const NAV_RAIL_MIN_WIDTH = 901;

/**
 * Si la ventana está por debajo del umbral del cajón.
 *
 * ## Por qué existe, si el CSS ya sabe el ancho
 *
 * Porque `Shell` recibe `drawerMode` como entrada —su documentación lo dice: «lo decide quien monta
 * el shell, que es quien conoce el ancho real»— y de ese booleano depende algo que el CSS no puede
 * hacer: **mostrar u ocultar el botón de menú del encabezado**, que es un elemento del árbol, no un
 * estilo. Sin esto, `drawerMode` se queda en su valor por omisión y en un teléfono el nav ocupa una
 * columna fija de 260 px que empuja el contenido fuera de la pantalla.
 *
 * ## Bajo SSR arranca en escritorio
 *
 * El servidor no tiene ventana ni forma de saber el ancho. Se arranca en `false` —escritorio— y se
 * corrige después del primer render, que es cuando `matchMedia` existe. Al revés sería peor: el
 * HTML del servidor traería el botón de hamburguesa y desaparecería al hidratar en cualquier
 * pantalla grande.
 */
@Injectable({
  providedIn: 'root',
})
export class Breakpoints {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly narrow = signal(false);

  /**
   * Arranca en `true` por la misma razón que `narrow` arranca en `false`: sin
   * ventana que medir se asume escritorio, que es donde el carril existe.
   */
  private readonly railAvailable = signal(true);

  /** `true` cuando el nav debe comportarse como cajón sobre el contenido. */
  readonly isNavDrawer = this.narrow.asReadonly();

  /** `true` cuando la barra puede recogerse a su carril de íconos. */
  readonly canCollapseNav = this.railAvailable.asReadonly();

  constructor() {
    afterNextRender(() => this.observe(), { injector: this.injector });
  }

  private observe(): void {
    if (!this.isBrowser) {
      return;
    }

    const view = this.document.defaultView;
    // `matchMedia` puede faltar en entornos de prueba con un DOM recortado. Sin él se queda en
    // escritorio, que es el modo en el que la aplicación es usable de todas formas.
    if (view?.matchMedia === undefined) {
      return;
    }

    this.watch(view, `(max-width: ${NAV_DRAWER_MAX_WIDTH - 1}px)`, this.narrow);
    this.watch(view, `(min-width: ${NAV_RAIL_MIN_WIDTH}px)`, this.railAvailable);
  }

  /** Sigue una consulta de medios y publica su resultado en un signal. */
  private watch(view: Window, consulta: string, destino: { set(valor: boolean): void }): void {
    const query = view.matchMedia(consulta);
    destino.set(query.matches);

    const onChange = (event: MediaQueryListEvent): void => destino.set(event.matches);
    query.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => query.removeEventListener('change', onChange));
  }
}

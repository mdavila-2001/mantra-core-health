import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';

import { Tab } from './tab/tab';
import {
  TABS_PARENT,
  type TabsAppearance,
  type TabsHost,
  type TabsOrientation,
} from './tabs.types';

/**
 * Pestañas de una ficha. Descubre sus secciones con `contentChildren`, así que
 * el consumidor solo escribe `app-tab`.
 *
 * ```html
 * <app-tabs [(selectedIndex)]="seccion">
 *   <app-tab label="Evolución">…</app-tab>
 *   <app-tab label="Órdenes">…</app-tab>
 * </app-tabs>
 * ```
 *
 * **Activación manual**: las flechas mueven el foco, y recién Enter o Espacio
 * seleccionan. La activación automática (seleccionar al mover el foco) haría
 * que recorrer seis pestañas dispare seis cargas de panel.
 */
@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.html',
  styleUrl: './tabs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: TABS_PARENT, useExisting: forwardRef(() => Tabs) }],
  host: {
    class: 'tabs',
    '[class.tabs--vertical]': 'orientation() === "vertical"',
    '[class.tabs--browser]': 'appearance() === "browser" && orientation() === "horizontal"',
    '(window:resize)': 'medirDesborde()',
  },
})
export class Tabs implements TabsHost {
  protected readonly tabs = contentChildren(Tab);

  /** Los botones, para mover el foco sin selección (activación manual). */
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  /** La tira, para medir su desborde y desplazarla cuando no entra. */
  private readonly tablist = viewChild<ElementRef<HTMLElement>>('tablist');

  readonly selectedIndex = model<number>(0);
  readonly orientation = input<TabsOrientation>('horizontal');

  /** Ver {@link TabsAppearance}. La de siempre es `underline`. */
  readonly appearance = input<TabsAppearance>('underline');

  /** Índice realmente pintado: recortado al rango y saltando deshabilitadas. */
  readonly activeIndex = computed(() => {
    const secciones = this.tabs();
    if (secciones.length === 0) {
      return 0;
    }
    const pedido = Math.min(secciones.length - 1, Math.max(0, this.selectedIndex()));
    if (!secciones[pedido].disabled()) {
      return pedido;
    }
    // La pedida está deshabilitada: cae en la primera utilizable.
    const alternativa = secciones.findIndex((tab) => !tab.disabled());
    return alternativa >= 0 ? alternativa : pedido;
  });

  readonly activeTab = computed<Tab | null>(() => this.tabs()[this.activeIndex()] ?? null);

  protected select(index: number): void {
    const tab = this.tabs()[index];
    if (tab === undefined || tab.disabled()) {
      return;
    }
    this.selectedIndex.set(index);
    this.traerALaVista(index);
  }

  /**
   * Las flechas mueven el foco entre pestañas utilizables, con vuelta al otro
   * extremo; Home y End van a los bordes. La selección no las sigue.
   */
  protected handleTablistKeydown(event: KeyboardEvent, index: number): void {
    const destino = this.nextFocusIndex(event.key, index);
    if (destino !== null) {
      event.preventDefault();
      this.focusTab(destino);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.select(index);
    }
  }

  private nextFocusIndex(key: string, from: number): number | null {
    const utilizables = this.enabledIndexes();
    if (utilizables.length === 0) {
      return null;
    }

    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
        return this.step(utilizables, from, 1);
      case 'ArrowLeft':
      case 'ArrowUp':
        return this.step(utilizables, from, -1);
      case 'Home':
        return utilizables[0];
      case 'End':
        return utilizables[utilizables.length - 1];
      default:
        return null;
    }
  }

  /** Avanza dentro de las utilizables dando la vuelta al llegar al extremo. */
  private step(utilizables: readonly number[], from: number, direction: 1 | -1): number {
    const posicion = utilizables.indexOf(from);
    if (posicion < 0) {
      return utilizables[0];
    }
    const siguiente = (posicion + direction + utilizables.length) % utilizables.length;
    return utilizables[siguiente];
  }

  private enabledIndexes(): readonly number[] {
    return this.tabs()
      .map((tab, index) => ({ tab, index }))
      .filter(({ tab }) => !tab.disabled())
      .map(({ index }) => index);
  }

  private focusTab(index: number): void {
    this.tabButtons()[index]?.nativeElement.focus();
    this.traerALaVista(index);
  }

  /* -- El desborde de la tira ----------------------------------------------

     Ocho pestañas no entran en la columna de una ficha, y hasta ahora eso lo
     resolvía la barra de scroll del navegador: gruesa, siempre visible, y muda
     —la primera pestaña aparecía cortada por la mitad sin nada que dijera que
     a la izquierda había más—. Se mide el desborde y se ofrecen dos flechas.

     Son un atajo de puntero y no entran en el orden de tabulación: el teclado
     ya recorre las pestañas con las flechas del teclado, que además traen la
     enfocada a la vista. Duplicarlo serían dos paradas que no llevan a ningún
     lado nuevo. */

  /** Hay más tira de la que entra: se muestran las flechas. */
  protected readonly desborda = signal(false);

  /** Queda tira hacia atrás / hacia adelante desde donde está el scroll. */
  protected readonly puedeRetroceder = signal(false);
  protected readonly puedeAvanzar = signal(false);

  /**
   * Los rótulos, concatenados.
   *
   * **No** alcanza con mirar `tabs()`: los de una ficha llevan la cantidad de
   * registros —«Observaciones (24)»— y esa cuenta llega con los datos, así que
   * el ancho de la tira cambia sin que la lista de pestañas cambie. Medir sólo
   * cuando aparece o desaparece una pestaña dejaba la tira desbordada y sin
   * flechas, que se lee peor que no tenerlas: la última queda cortada y nada
   * dice que haya más.
   */
  private readonly rotulos = computed(() =>
    this.tabs()
      .map((tab) => tab.label())
      .join('\u0001'),
  );

  /** Vuelve a medir cuando cambia lo que ocupa la tira. */
  private readonly remedicion = afterRenderEffect(() => {
    // Se rastrea lo que cambia el ancho; la medición lee el DOM y escribe
    // señales, y eso no debe rastrearse.
    this.rotulos();
    this.appearance();
    untracked(() => this.medirDesborde());
  });

  constructor() {
    // Y cuando cambia el ancho DISPONIBLE, que no depende de ninguna señal: el
    // menú lateral que se pliega, una columna que se reparte de otra manera.
    // `afterNextRender` no corre en el servidor, así que ahí no hay nada que
    // guardar.
    //
    // **Pero «navegador» no garantiza `ResizeObserver`.** jsdom —el entorno de
    // las 5 000 pruebas de este repo— ejecuta `afterNextRender` y **no** lo
    // implementa: el `new ResizeObserver` tiraba `ReferenceError` y volteaba la
    // prueba entera de cualquier pantalla con pestañas suficientes para
    // desbordar la tira. Se descubrió el 2026-09-10 al agregarle la octava
    // pestaña a «Organización médica»: con siete no desbordaba y el fallo no
    // aparecía. Sin el observador la tira sigue midiéndose al cambiar de
    // pestaña y al cambiar el contenido; lo único que se pierde es el remedido
    // ante un cambio de ancho, que en una prueba no ocurre.
    const destruccion = inject(DestroyRef);
    afterNextRender(() => {
      const tira = this.tablist()?.nativeElement;
      if (tira === undefined || typeof ResizeObserver === 'undefined') {
        return;
      }
      const observador = new ResizeObserver(() => this.medirDesborde());
      observador.observe(tira);
      destruccion.onDestroy(() => observador.disconnect());
    });
  }

  protected medirDesborde(): void {
    const tira = this.tablist()?.nativeElement;
    if (tira === undefined) {
      return;
    }
    // Un píxel de margen: con anchos fraccionarios `scrollWidth` supera a
    // `clientWidth` por redondeo en tiras que sí entran enteras.
    const sobrante = tira.scrollWidth - tira.clientWidth;
    this.desborda.set(sobrante > 1);
    this.puedeRetroceder.set(tira.scrollLeft > 1);
    this.puedeAvanzar.set(tira.scrollLeft < sobrante - 1);
  }

  /** Desplaza poco menos de un ancho, para dejar una pestaña de ancla. */
  protected desplazar(direccion: 1 | -1): void {
    const tira = this.tablist()?.nativeElement;
    if (tira === undefined) {
      return;
    }
    // Con `?.` porque el entorno de pruebas no implementa el desplazamiento
    // programático: sin la guarda, un click en la flecha revienta el spec en
    // vez de no hacer nada, que es lo correcto cuando no hay nada que mover.
    tira.scrollBy?.({ left: direccion * tira.clientWidth * 0.8, behavior: 'smooth' });
  }

  /** Trae una pestaña a la vista sin mover el resto de la página. */
  private traerALaVista(index: number): void {
    const boton = this.tabButtons()[index]?.nativeElement;
    boton?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }
}

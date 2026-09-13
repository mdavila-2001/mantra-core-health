import { TestBed } from '@angular/core/testing';

import { Breakpoints, NAV_DRAWER_MAX_WIDTH, NAV_RAIL_MIN_WIDTH } from './breakpoints';

describe('Breakpoints', () => {
  it('arranca en escritorio: bajo SSR no hay ventana que medir', () => {
    TestBed.configureTestingModule({});
    const breakpoints = TestBed.inject(Breakpoints);

    // Al revés sería peor: el HTML del servidor traería el botón de hamburguesa y desaparecería
    // al hidratar en cualquier pantalla grande.
    expect(breakpoints.isNavDrawer()).toBe(false);
  });

  it('el carril también arranca disponible: sin ventana, se asume escritorio', () => {
    TestBed.configureTestingModule({});
    const breakpoints = TestBed.inject(Breakpoints);

    // Da igual para el primer render —la preferencia de recoger arranca
    // apagada—, pero al revés un `ShellService` que restaurara «recogida»
    // antes de que `matchMedia` contestara dejaría la barra desplegándose
    // sola un cuadro después.
    expect(breakpoints.canCollapseNav()).toBe(true);
  });

  it('el umbral del carril espeja el @media de alovida.css, y NO es el del cajón', () => {
    // `alovida.css` gobierna el carril con `@media (min-width: 901px)`. Si
    // alguien mueve uno y no el otro, hay una franja donde el armazón cree que
    // la barra está recogida y la hoja la dibuja entera: los rótulos quedan
    // sólo para el lector de pantalla sobre una barra de 264 px.
    expect(NAV_RAIL_MIN_WIDTH).toBe(901);
    // Son dos umbrales distintos a propósito: recoger un cajón no significa
    // nada, así que el carril empieza más arriba que la columna fija.
    expect(NAV_RAIL_MIN_WIDTH).toBeGreaterThan(NAV_DRAWER_MAX_WIDTH);
  });

  it('el umbral espeja el @media de shell.css y side-nav.css', () => {
    // Los dos archivos usan `@media (min-width: 780px)`. Si alguien mueve uno y no el otro, el
    // botón de menú y la columna del nav dejan de aparecer al mismo tiempo: en la franja entre
    // ambos valores el nav se ve como cajón cerrado y no hay forma de abrirlo.
    expect(NAV_DRAWER_MAX_WIDTH).toBe(780);
  });
});

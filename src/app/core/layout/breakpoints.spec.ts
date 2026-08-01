import { TestBed } from '@angular/core/testing';

import { Breakpoints, NAV_DRAWER_MAX_WIDTH } from './breakpoints';

describe('Breakpoints', () => {
  it('arranca en escritorio: bajo SSR no hay ventana que medir', () => {
    TestBed.configureTestingModule({});
    const breakpoints = TestBed.inject(Breakpoints);

    // Al revés sería peor: el HTML del servidor traería el botón de hamburguesa y desaparecería
    // al hidratar en cualquier pantalla grande.
    expect(breakpoints.isNavDrawer()).toBe(false);
  });

  it('el umbral espeja el @media de shell.css y side-nav.css', () => {
    // Los dos archivos usan `@media (min-width: 780px)`. Si alguien mueve uno y no el otro, el
    // botón de menú y la columna del nav dejan de aparecer al mismo tiempo: en la franja entre
    // ambos valores el nav se ve como cajón cerrado y no hay forma de abrirlo.
    expect(NAV_DRAWER_MAX_WIDTH).toBe(780);
  });
});

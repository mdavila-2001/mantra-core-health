import { TestBed } from '@angular/core/testing';

import { NavIcon } from './nav-icon';
import { NAV_ICON_NAMES, type NavIconName } from './nav-icon.types';

/**
 * El set de íconos de navegación. Lo que se fija: cada nombre del catálogo
 * tiene su dibujo (ninguno cae al de reserva por olvido), un nombre ausente o
 * desconocido dibuja la casita en vez de dejar un hueco, y el SVG es
 * decorativo (el nombre accesible lo pone quien lo usa).
 */
function svgDe(name: NavIconName | undefined): SVGElement {
  const fixture = TestBed.createComponent(NavIcon);
  fixture.componentRef.setInput('name', name);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('svg')!;
}

const limpio = (svg: SVGElement): string => svg.innerHTML.replace(/<!--[\s\S]*?-->/g, '');

describe('NavIcon', () => {
  it('sin nombre dibuja el de reserva, oculto al lector', () => {
    const svg = svgDe(undefined);
    expect(svg).not.toBeNull();
    expect(svg.children.length).toBeGreaterThan(0);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('cada nombre del catálogo dibuja algo, y sólo «home» comparte dibujo con la reserva', () => {
    const reserva = limpio(svgDe(undefined));
    const caenEnReserva = NAV_ICON_NAMES.filter((n) => n !== 'home' && limpio(svgDe(n)) === reserva);
    expect(caenEnReserva).toEqual([]);
    for (const n of NAV_ICON_NAMES) expect(svgDe(n).children.length).toBeGreaterThan(0);
  });

  it('un nombre desconocido no deja un hueco', () => {
    expect(svgDe('no-existe' as NavIconName).children.length).toBeGreaterThan(0);
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MODULOS_ALOVIDA } from '../alovida-nav.data';
import { AlovidaShell } from './alovida-shell';

/**
 * M-4 / O3-5 — `alovida-shell.html:166`: los íconos del nav son marcado
 * literal de la plantilla y no un string en `innerHTML`. Se fija que lo que se
 * pinta es exactamente eso —SVG de trazos, sin manejadores ni texto— y que los
 * rótulos del nav, que vienen de un dato, llegan como texto.
 */

const ETIQUETAS_SVG = new Set([
  'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'g',
  'defs', 'lineargradient', 'stop', 'pattern',
]);

describe('AlovidaShell · íconos del nav (M-4)', () => {
  let fixture: ComponentFixture<AlovidaShell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlovidaShell],
      providers: [provideRouter([{ path: 'nada', children: [] }])],
    }).compileComponents();
    fixture = TestBed.createComponent(AlovidaShell);
    fixture.detectChanges();
  });

  it('cada ícono del nav es un SVG de trazos inerte: sin script, sin on*, sin texto', () => {
    const nav = (fixture.nativeElement as HTMLElement).querySelector('.app-side-nav')!;
    const iconos = Array.from(nav.querySelectorAll('svg'));

    expect(iconos.length).toBeGreaterThanOrEqual(MODULOS_ALOVIDA.length);
    for (const icono of iconos) {
      for (const nodo of [icono, ...Array.from(icono.querySelectorAll('*'))]) {
        expect(ETIQUETAS_SVG.has(nodo.tagName.toLowerCase())).toBe(true);
        expect(nodo.getAttributeNames().some((a) => /^on/i.test(a) || a === 'href' || a === 'xlink:href')).toBe(false);
      }
      expect(icono.textContent?.trim()).toBe('');
    }
    expect(nav.querySelector('script, foreignObject, iframe, object, embed')).toBeNull();
    // La única imagen del nav es el logo, con origen propio y sin manejadores.
    for (const img of Array.from(nav.querySelectorAll('img'))) {
      expect(img.getAttributeNames().some((a) => /^on/i.test(a))).toBe(false);
      expect(img.getAttribute('src') ?? '').not.toMatch(/^(javascript|data:text)/i);
    }
  });

  it('los rótulos del nav son texto: ningún dato del menú se interpreta como marcado', () => {
    const nav = (fixture.nativeElement as HTMLElement).querySelector('.app-side-nav')!;
    const rotulos = [...nav.querySelectorAll('.app-side-nav__group > a span:last-child')];

    expect(rotulos.length).toBeGreaterThanOrEqual(MODULOS_ALOVIDA.length);
    for (const rotulo of rotulos) expect(rotulo.children).toHaveLength(0);
  });
});

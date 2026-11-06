import { TestBed } from '@angular/core/testing';

import { Sparkline } from './sparkline';

/**
 * La mini-serie de un KPI: decorativa (`aria-hidden`), no se dibuja con menos
 * de dos puntos reales, y un hueco (`null`) corta la línea en vez de unirla.
 */
describe('Sparkline', () => {
  function pintar(values: readonly (number | null)[]): HTMLElement {
    const fixture = TestBed.createComponent(Sparkline);
    fixture.componentRef.setInput('values', values);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it.each([[[]], [[5]], [[null, 3, null]]])('con %j no dibuja nada', (values) => {
    expect(pintar(values).querySelector('svg')).toBeNull();
  });

  it('con dos o más puntos dibuja línea y área, oculta al lector', () => {
    const root = pintar([1, 3, 2]);
    const svg = root.querySelector('svg')!;
    const linea = root.querySelector('.sp__line')!.getAttribute('d')!;

    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('viewBox')).toBe('0 0 120 34');
    expect(linea.startsWith('M')).toBe(true);
    expect((linea.match(/L/g) ?? []).length).toBe(2);
    expect(root.querySelector('.sp__area')!.getAttribute('d')).toMatch(/Z$/);
  });

  it('un hueco corta la línea: hay dos tramos (dos M)', () => {
    const linea = pintar([1, 2, null, 3, 4]).querySelector('.sp__line')!.getAttribute('d')!;
    expect((linea.match(/M/g) ?? []).length).toBe(2);
  });

  it('una serie plana no divide por cero', () => {
    const linea = pintar([7, 7, 7]).querySelector('.sp__line')!.getAttribute('d')!;
    expect(linea).not.toContain('NaN');
    expect(linea).not.toContain('Infinity');
  });
});

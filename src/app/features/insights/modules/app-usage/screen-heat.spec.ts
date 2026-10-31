import { TestBed } from '@angular/core/testing';

import type { ScreenHeat } from '../../domain/app-usage';
import { ScreenHeatMap } from './screen-heat';

/**
 * El mapa de toques de una pantalla de la app: cada zona con su nivel de calor
 * y su porcentaje (coma decimal), el ranking de mayor a menor, las zonas
 * ignoradas (< 2 %) señaladas, y la profundidad de desplazamiento por tramos.
 */

const PANTALLA = {
  id: 'search',
  label: 'Buscar',
  zones: [
    { id: 'z1', label: 'Buscador', x: 0, y: 0, w: 100, h: 10, taps: 60 },
    { id: 'z2', label: 'Filtros', x: 0, y: 10, w: 100, h: 10, taps: 25.5 },
    { id: 'z3', label: 'Banner', x: 0, y: 20, w: 100, h: 10, taps: 1.2 },
  ],
  scroll: [100, 80, 55],
} as unknown as ScreenHeat;

describe('ScreenHeatMap', () => {
  function pintar(): HTMLElement {
    const fixture = TestBed.createComponent(ScreenHeatMap);
    fixture.componentRef.setInput('screen', PANTALLA);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('el teléfono se anuncia como imagen con la zona que más concentra', () => {
    const tel = pintar().querySelector('.sh__phone')!;
    expect(tel.getAttribute('role')).toBe('img');
    expect(tel.getAttribute('aria-label')).toBe('Mapa de toques de la pantalla Buscar: Buscador concentra 60,0 % de los toques.');
  });

  it('el nivel de calor va del 4 (más tocada) al 1, y la ignorada se marca', () => {
    const zonas = Array.from(pintar().querySelectorAll<HTMLElement>('.sh__zone'));
    expect(zonas[0]!.className).toContain('sh__zone--4');
    expect(zonas[2]!.className).toContain('sh__zone--1');
    expect(zonas[2]!.classList.contains('sh__zone--ignored')).toBe(true);
    expect(zonas[1]!.querySelector('.sh__zp')?.textContent).toBe('25,5 %');
    expect(zonas[0]!.style.width).toBe('100%');
  });

  it('el ranking ordena de mayor a menor y avisa de los elementos ignorados', () => {
    const root = pintar();
    expect(Array.from(root.querySelectorAll('.sh__rank li span')).map((s) => s.textContent)).toEqual(['Buscador', 'Filtros', 'Banner']);
    expect(root.querySelector('.sh__rank--ignored em')?.textContent).toBe('Ignorado');
    expect(root.querySelector('.sh__alert')?.textContent).toContain('1 con menos de 2 % de los toques (Banner…)');
  });

  it('la profundidad de desplazamiento va por tramos de 10 %', () => {
    const tramos = Array.from(pintar().querySelectorAll('.sh__scroll li')).map((li) => [
      li.querySelector('.sh__sl')?.textContent,
      li.querySelector('.sh__sv')?.textContent,
    ]);
    expect(tramos).toEqual([
      ['0 %', '100 %'],
      ['10 %', '80 %'],
      ['20 %', '55 %'],
    ]);
  });
});

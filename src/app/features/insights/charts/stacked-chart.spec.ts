import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { StackRow, StackSegment } from './chart.types';
import { StackedChart } from './stacked-chart';

/**
 * Barras apiladas de Insights. Cada segmento es foco de teclado con su lectura
 * completa (fila · segmento: valor y porcentaje); en modo proporción las
 * barras suman 100 %; y siempre hay una tabla con los mismos datos para quien
 * no puede leer el gráfico.
 */

const SEGMENTOS: readonly StackSegment[] = [
  { id: 'meta', label: 'Meta', color: 1 },
  { id: 'google', label: 'Google', color: 2 },
];

const FILAS: readonly StackRow[] = [
  { id: 'w1', label: 'Sem 1', values: { meta: 30, google: 10 } },
  { id: 'w2', label: 'Sem 2', values: { meta: 20 } },
];

describe('StackedChart', () => {
  let fixture: ComponentFixture<StackedChart>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function pintar(proportion = false): void {
    fixture = TestBed.createComponent(StackedChart);
    fixture.componentRef.setInput('rows', FILAS);
    fixture.componentRef.setInput('segments', SEGMENTOS);
    fixture.componentRef.setInput('unit', 'count');
    fixture.componentRef.setInput('proportion', proportion);
    fixture.componentRef.setInput('ariaLabel', 'Conversiones por canal y semana');
    fixture.detectChanges();
  }

  it('es un grupo rotulado con un segmento enfocable por fila y canal', () => {
    pintar();
    expect(root().querySelector('svg')?.getAttribute('aria-label')).toBe('Conversiones por canal y semana');
    const segmentos = Array.from(root().querySelectorAll('rect.st__seg'));
    expect(segmentos).toHaveLength(4);
    expect(segmentos.every((s) => s.getAttribute('tabindex') === '0')).toBe(true);
    expect(segmentos[0]!.getAttribute('aria-label')).toMatch(/^Sem 1 · Meta: 30 \(75/);
  });

  it('un valor ausente cuenta como cero y no dibuja altura', () => {
    pintar();
    const segmentos = Array.from(root().querySelectorAll('rect.st__seg'));
    expect(Number(segmentos[3]!.getAttribute('height'))).toBe(0);
    expect(segmentos[3]!.getAttribute('aria-label')).toContain('Sem 2 · Google: 0');
  });

  it('en proporción, la barra de una fila ocupa el alto completo del eje', () => {
    pintar(true);
    const [a, b] = Array.from(root().querySelectorAll('rect.st__seg')).slice(0, 2).map((r) => Number(r.getAttribute('height')));
    const tope = Math.max(...Array.from(root().querySelectorAll('line.st__grid')).map((l) => Number(l.getAttribute('y1'))));
    const piso = Math.min(...Array.from(root().querySelectorAll('line.st__grid')).map((l) => Number(l.getAttribute('y1'))));
    expect(a! + b!).toBeCloseTo(tope - piso, 0);
    expect(Array.from(root().querySelectorAll('.st__tick')).some((t) => t.textContent?.includes('%'))).toBe(true);
  });

  it('pasar el puntero resalta el segmento', () => {
    pintar();
    const seg = root().querySelector('rect.st__seg')!;
    seg.dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    expect(seg.classList.contains('st__seg--hover')).toBe(true);
    seg.dispatchEvent(new Event('pointerleave'));
    fixture.detectChanges();
    expect(seg.classList.contains('st__seg--hover')).toBe(false);
  });

  it('la leyenda y la tabla repiten los datos en texto', () => {
    pintar();
    expect(Array.from(root().querySelectorAll('.st__legend li')).map((li) => li.textContent?.trim())).toEqual(['Meta', 'Google']);
    const filas = Array.from(root().querySelectorAll('tbody tr')).map((tr) => Array.from(tr.children).map((c) => c.textContent?.trim()));
    expect(filas).toEqual([
      ['Sem 1', '30', '10'],
      ['Sem 2', '20', '0'],
    ]);
    expect(root().querySelector('caption')?.textContent).toBe('Conversiones por canal y semana');
  });
});

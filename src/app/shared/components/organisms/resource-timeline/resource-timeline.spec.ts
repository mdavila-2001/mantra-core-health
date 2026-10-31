import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ResourceTimeline } from './resource-timeline';

/** La línea de tiempo pinta posiciones proporcionales y la misma lista para teléfono. */
describe('ResourceTimeline', () => {
  const day = '2026-11-02';
  const at = (hhmm: string): string => new Date(`${day}T${hhmm}:00`).toISOString();

  function render() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ResourceTimeline);
    fixture.componentRef.setInput('rows', [{ id: 'r1', label: 'QX-01' }, { id: 'r2', label: 'QX-02' }]);
    fixture.componentRef.setInput('segments', [
      { id: 'b', rowId: 'r1', kind: 'band', start: at('08:00'), end: at('14:00'), label: 'Bloque', detail: 'Bloque de Traumatología' },
      { id: 'c', rowId: 'r1', kind: 'item', start: at('09:00'), end: at('10:00'), reservedStart: at('08:40'), reservedEnd: at('10:30'), label: 'CX-1', detail: 'CX-1 con preparación y limpieza', route: '/interventions/c' },
    ]);
    fixture.componentRef.setInput('day', day);
    fixture.componentRef.setInput('startHour', 7);
    fixture.componentRef.setInput('endHour', 19);
    fixture.componentRef.setInput('label', 'Quirófanos');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('ubica cada segmento en % del día visible y sombrea la ventana reservada', () => {
    const host = render();
    const band = host.querySelector<HTMLElement>('[data-testid=timeline-band]')!;
    // 08:00 sobre 07–19 = 1/12 ≈ 8,33 %, 6 h = 50 %.
    expect(parseFloat(band.style.left)).toBeCloseTo(8.333, 2);
    expect(parseFloat(band.style.width)).toBeCloseTo(50, 2);
    const item = host.querySelector<HTMLElement>('[data-testid=timeline-item]')!;
    const core = item.querySelector<HTMLElement>('.resource-timeline__core')!;
    // Ventana 08:40–10:30 (110 min); el caso empieza 20 min adentro y dura 60.
    expect(parseFloat(core.style.left)).toBeCloseTo((20 / 110) * 100, 2);
    expect(parseFloat(core.style.width)).toBeCloseTo((60 / 110) * 100, 2);
  });

  it('cada segmento tiene texto accesible y el que tiene ruta es un enlace', () => {
    const host = render();
    const link = host.querySelector<HTMLAnchorElement>('[data-testid=timeline-item] a')!;
    expect(link.getAttribute('aria-label')).toBe('CX-1 con preparación y limpieza');
    expect(host.querySelector('[data-testid=timeline-band]')!.textContent).toContain('Bloque de Traumatología');
  });

  it('la lista alternativa trae lo mismo, en orden', () => {
    const host = render();
    const text = host.querySelector('.resource-timeline__list')!.textContent ?? '';
    expect(text).toContain('08:00–14:00');
    expect(text).toContain('09:00–10:00');
    expect(text.indexOf('08:00–14:00')).toBeLessThan(text.indexOf('09:00–10:00'));
  });
});

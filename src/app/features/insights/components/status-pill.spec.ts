import { TestBed } from '@angular/core/testing';

import type { HealthStatus } from '../domain/insights.types';
import { StatusPill } from './status-pill';

/**
 * El semáforo de salud de una métrica. El estado no se comunica sólo por color:
 * lleva un ícono de forma distinta (oculto al lector) y el rótulo en texto.
 */
describe('StatusPill', () => {
  function pintar(status: HealthStatus, short = false): HTMLElement {
    const fixture = TestBed.createComponent(StatusPill);
    fixture.componentRef.setInput('status', status);
    fixture.componentRef.setInput('short', short);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('.pill')!;
  }

  it.each([
    ['optimal', '●', 'Óptimo'],
    ['acceptable', '◆', 'Aceptable'],
    ['alert', '▲', 'Alerta'],
    ['critical', '■', 'Crítico'],
    ['insufficient', '○', 'Sin evidencia suficiente'],
  ] as const)('%s: forma %s y rótulo «%s»', (status, icono, rotulo) => {
    const pill = pintar(status);

    expect(pill.classList.contains(`pill--${status}`)).toBe(true);
    expect(pill.querySelector('.pill__icon')?.textContent).toBe(icono);
    expect(pill.querySelector('.pill__icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(pill.textContent).toContain(rotulo);
  });

  it('en versión corta, «sin evidencia suficiente» se abrevia; los demás no cambian', () => {
    expect(pintar('insufficient', true).textContent).toContain('Sin evidencia');
    expect(pintar('insufficient', true).textContent).not.toContain('suficiente');
    expect(pintar('critical', true).textContent).toContain('Crítico');
  });
});

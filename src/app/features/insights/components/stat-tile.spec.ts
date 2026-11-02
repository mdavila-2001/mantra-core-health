import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { StatTile } from './stat-tile';

/**
 * Un indicador suelto: rótulo, valor (o «Sin dato», nunca un cero inventado),
 * variación con flecha según el signo y su lectura buena/mala, y una ayuda.
 */
describe('StatTile', () => {
  let fixture: ComponentFixture<StatTile>;

  function pintar(inputs: Record<string, unknown>): HTMLElement {
    fixture = TestBed.createComponent(StatTile);
    fixture.componentRef.setInput('label', 'Turnos');
    fixture.componentRef.setInput('value', '1.204');
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra rótulo y valor, sin variación ni ayuda si no vienen', () => {
    const root = pintar({});
    expect(root.querySelector('.st__label')?.textContent).toBe('Turnos');
    expect(root.querySelector('.st__value')?.textContent).toBe('1.204');
    expect(root.querySelector('.st__delta')).toBeNull();
    expect(root.querySelector('.st__hint')).toBeNull();
    expect(root.querySelector('app-ins-status')).toBeNull();
  });

  it('sin valor dice «Sin dato» y lo marca', () => {
    const valor = pintar({ value: null }).querySelector('.st__value')!;
    expect(valor.textContent).toBe('Sin dato');
    expect(valor.classList.contains('st__value--none')).toBe(true);
  });

  it.each([
    ['+12 %', '↑'],
    ['−3 %', '↓'],
    ['-3 %', '↓'],
    ['0 %', '→'],
  ])('la variación %s lleva la flecha %s', (delta, flecha) => {
    expect(pintar({ delta }).querySelector('.st__delta span')?.textContent).toBe(flecha);
  });

  it('la variación se colorea según sea buena o mala, no según el signo', () => {
    expect(pintar({ delta: '−3 %', good: true }).querySelector('.st__delta--good')).not.toBeNull();
    expect(pintar({ delta: '+3 %', good: false }).querySelector('.st__delta--bad')).not.toBeNull();
    const neutra = pintar({ delta: '+3 %' }).querySelector('.st__delta')!;
    expect(neutra.classList.contains('st__delta--good') || neutra.classList.contains('st__delta--bad')).toBe(false);
  });

  it('con estado de salud pinta su semáforo corto, y la ayuda si viene', () => {
    const root = pintar({ status: 'insufficient', hint: 'Últimos 30 días' });
    expect(root.querySelector('app-ins-status')?.textContent).toContain('Sin evidencia');
    expect(root.querySelector('.st__hint')?.textContent).toBe('Últimos 30 días');
  });
});

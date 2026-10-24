import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { MonthPoint } from '../spending.model';
import { niceCeiling, SpendingYearChart } from './spending-year-chart';

const NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function months(currentUntil: number): MonthPoint[] {
  return NAMES.map((label, monthIndex) => ({
    monthIndex,
    label,
    shortLabel: label.slice(0, 3),
    currentCents: monthIndex > currentUntil ? null : 20000,
    previousCents: 10000,
  }));
}

describe('SpendingYearChart', () => {
  let fixture: ComponentFixture<SpendingYearChart>;

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function montar(points: MonthPoint[]): void {
    fixture = TestBed.createComponent(SpendingYearChart);
    fixture.componentRef.setInput('months', points);
    fixture.componentRef.setInput('currentYear', 2026);
    fixture.componentRef.setInput('previousYear', 2025);
    fixture.componentRef.setInput('currencyLabel', 'Bs');
    fixture.detectChanges();
  }

  it('el tope del eje es una cifra redonda', () => {
    expect(niceCeiling(0)).toBe(1);
    expect(niceCeiling(87_000)).toBe(100_000);
    expect(niceCeiling(210_000)).toBe(250_000);
    expect(niceCeiling(410_000)).toBe(500_000);
  });

  it('los meses que no llegaron no dibujan barra del año en curso', () => {
    montar(months(8));

    const meses = raiz().querySelectorAll('[data-testid="spending-year-chart-month"]');
    expect(meses).toHaveLength(12);
    expect(meses[8]?.querySelector('.year-chart__bar--current')).not.toBeNull();
    expect(meses[9]?.querySelector('.year-chart__bar--current')).toBeNull();
    expect(meses[9]?.getAttribute('aria-label')).toContain('todavía no llegó');
  });

  it('cada mes es una parada de teclado que dice sus dos cifras y la variación', () => {
    montar(months(8));

    const marzo = raiz().querySelectorAll('[data-testid="spending-year-chart-month"]')[2]!;
    expect(marzo.getAttribute('tabindex')).toBe('0');
    const label = marzo.getAttribute('aria-label') ?? '';
    expect(label).toContain('2026: Bs 200,00');
    expect(label).toContain('2025: Bs 100,00');
    expect(label).toContain('100 % más que marzo de 2025');
  });

  it('el foco abre el globo y lo cierra al salir', () => {
    montar(months(8));
    const marzo = raiz().querySelectorAll<HTMLElement>('[data-testid="spending-year-chart-month"]')[2]!;

    marzo.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    const globo = raiz().querySelector('[data-testid="spending-year-chart-tooltip"]');
    expect(globo?.textContent).toContain('marzo');
    expect(globo?.textContent).toContain('Bs 200,00');

    marzo.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(raiz().querySelector('[data-testid="spending-year-chart-tooltip"]')).toBeNull();
  });

  it('una tabla oculta tiene todas las cifras para quien no ve el gráfico', () => {
    montar(months(8));

    const filas = raiz().querySelectorAll('table.sr-only tbody tr');
    expect(filas).toHaveLength(12);
    expect(filas[11]?.textContent).toContain('Todavía no llegó');
  });
});

import { TestBed } from '@angular/core/testing';

import type { InfoCalculo } from '@core/data-access/reporting/reporting.types';
import { CalcInfo } from './calc-info';

/**
 * «Cómo se calcula» un indicador de reportería: definición, fórmula, fuente y
 * frescura siempre; numerador, denominador y salvedades sólo si existen (una
 * fila vacía haría creer que el dato falta).
 */
describe('CalcInfo', () => {
  function pintar(info: InfoCalculo): HTMLElement {
    const fixture = TestBed.createComponent(CalcInfo);
    fixture.componentRef.setInput('info', info);
    fixture.componentRef.setInput('label', 'tasa de ausentismo');
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('[data-testid="calc-info"]')!;
  }

  const terminos = (root: HTMLElement): string[] => Array.from(root.querySelectorAll('dt')).map((dt) => dt.textContent ?? '');

  it('es una región rotulada con lo mínimo: qué es, fórmula, fuente y frescura', () => {
    const root = pintar({ definicion: 'Citas sin asistencia', formula: 'ausentes / citas', fuente: 'Agenda', frescura: 'cada hora' });

    expect(root.getAttribute('role')).toBe('region');
    expect(root.getAttribute('aria-label')).toBe('Cómo se calcula tasa de ausentismo');
    expect(terminos(root)).toEqual(['Qué es', 'Fórmula', 'Fuente', 'Frescura']);
    expect(root.querySelector('.ci__formula')?.textContent).toBe('ausentes / citas');
  });

  it('con numerador, denominador y salvedades, los agrega', () => {
    const root = pintar({
      definicion: 'd',
      formula: 'a / b',
      numerador: 'citas ausentes',
      denominador: 'citas confirmadas',
      fuente: 'Agenda',
      frescura: 'diaria',
      salvedades: ['Excluye teleconsulta', 'Sin datos antes de agosto'],
    });

    expect(terminos(root)).toEqual(['Qué es', 'Fórmula', 'Numerador', 'Denominador', 'Fuente', 'Frescura', 'Salvedades']);
    expect(Array.from(root.querySelectorAll('li')).map((li) => li.textContent)).toEqual([
      'Excluye teleconsulta',
      'Sin datos antes de agosto',
    ]);
  });

  it('una lista de salvedades vacía no pinta el rótulo', () => {
    const root = pintar({ definicion: 'd', formula: 'f', fuente: 'x', frescura: 'y', salvedades: [] });
    expect(terminos(root)).not.toContain('Salvedades');
  });
});

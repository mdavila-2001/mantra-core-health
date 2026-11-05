import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { ChartType, VizRecommendation } from '../domain/insights.types';
import type { ChartOption } from '../domain/viz-recommender';
import { ChartPicker } from './chart-picker';

/**
 * El selector de visualización: un `radiogroup` navegable con flechas (roving
 * tabindex), que marca la recomendada y explica por qué; si se elige otra,
 * dice qué pregunta responde y ofrece volver. Las no disponibles no se eligen.
 */

const OPCIONES: readonly ChartOption[] = [
  { chart: 'line', label: 'Línea', intent: 'trend', available: true, recommended: true, note: '' },
  { chart: 'bar', label: 'Barras', intent: 'compare', available: true, recommended: false, note: '' },
  { chart: 'stacked', label: 'Apiladas', intent: 'composition', available: false, recommended: false, note: 'hace falta más de un canal' },
  { chart: 'area', label: 'Área', intent: 'trend', available: true, recommended: false, note: '' },
] as unknown as readonly ChartOption[];

const RECOMENDACION: VizRecommendation = {
  recommended: 'line',
  alternatives: ['bar'],
  reason: 'Es una serie en el tiempo.',
  caution: 'Evite el gráfico circular.',
} as VizRecommendation;

describe('ChartPicker', () => {
  let fixture: ComponentFixture<ChartPicker>;
  let elegidos: ChartType[];

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const opciones = (): HTMLButtonElement[] => Array.from(root().querySelectorAll<HTMLButtonElement>('[role="radio"]'));

  function pintar(value: ChartType): void {
    fixture = TestBed.createComponent(ChartPicker);
    fixture.componentRef.setInput('options', OPCIONES);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('recommendation', RECOMENDACION);
    elegidos = [];
    fixture.componentInstance.picked.subscribe((c) => elegidos.push(c));
    fixture.detectChanges();
  }

  it('es un radiogroup con la elegida marcada y sola en el orden de tabulación', () => {
    pintar('line');
    expect(root().querySelector('[role="radiogroup"]')?.getAttribute('aria-labelledby')).toBe('cp-title');
    expect(opciones().map((o) => o.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false']);
    expect(opciones().map((o) => o.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
  });

  it('con la recomendada explica el motivo y la advertencia', () => {
    pintar('line');
    expect(root().querySelector('.cp__reason')?.textContent).toContain('Visualización recomendada: Línea.');
    expect(root().querySelector('.cp__reason')?.textContent).toContain('Es una serie en el tiempo.');
    expect(root().querySelector('.cp__caution')?.textContent).toBe('Evite el gráfico circular.');
    expect(opciones()[0]!.textContent).toContain('Recomendada');
  });

  it('con otra elegida dice qué pregunta responde y ofrece volver a la recomendada', () => {
    pintar('bar');
    expect(root().querySelector('.cp__reason')?.textContent).toContain('Usted eligió «Barras»');
    expect(root().querySelector('.cp__reason')?.textContent).toContain('¿Quién rinde mejor?');
    root().querySelector<HTMLButtonElement>('.cp__back')!.click();
    expect(elegidos).toEqual(['line']);
  });

  it('una opción no disponible está deshabilitada y explica por qué', () => {
    pintar('line');
    const apiladas = opciones()[2]!;
    expect(apiladas.disabled).toBe(true);
    expect(apiladas.getAttribute('title')).toBe('No disponible: hace falta más de un canal');
  });

  it('las flechas recorren sólo las disponibles, en círculo', () => {
    pintar('bar');
    const derecha = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    opciones()[1]!.dispatchEvent(derecha);
    expect(derecha.defaultPrevented).toBe(true);
    expect(elegidos).toEqual(['area']);

    pintar('line');
    opciones()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true }));
    expect(elegidos).toEqual(['area']);
  });

  it('otra tecla no elige nada', () => {
    pintar('line');
    opciones()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(elegidos).toEqual([]);
  });

  it('un clic en una disponible la emite', () => {
    pintar('line');
    opciones()[3]!.click();
    expect(elegidos).toEqual(['area']);
  });
});

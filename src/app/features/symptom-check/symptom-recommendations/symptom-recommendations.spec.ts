import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it } from 'vitest';
import { SymptomRecommendations } from './symptom-recommendations';
import type { Recommendation } from '../symptoms';

const render = (items: readonly Recommendation[]): HTMLElement => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(SymptomRecommendations);
  fixture.componentRef.setInput('recomendaciones', items);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
};

const rec = (nombre: string): Recommendation => ({ nombre, peso: 1, porque: ['dolor de hombro'] });

describe('SymptomRecommendations', () => {
  it('shows arrows and an "n of m" counter when there is more than one card', () => {
    const html = render([rec('Medicina general'), rec('Traumatología'), rec('Fisioterapia')]);
    expect(html.querySelectorAll('[data-testid^="sintomas-especialidad-"]').length).toBe(3);
    expect(html.querySelector('[data-testid="sintomas-carrusel-contador"]')?.textContent).toContain('1 de 3');
    expect(html.querySelector<HTMLButtonElement>('[data-testid="sintomas-carrusel-anterior"]')?.disabled).toBe(true);
    expect(html.querySelector('[data-testid="sintomas-carrusel-siguiente"]')).not.toBeNull();
  });

  it('hides the controls with a single card', () => {
    const html = render([rec('Medicina general')]);
    expect(html.querySelector('[data-testid="sintomas-carrusel-siguiente"]')).toBeNull();
  });
});

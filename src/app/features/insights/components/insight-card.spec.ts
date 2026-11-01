import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Insight } from '../domain/insights.types';
import { InsightCard } from './insight-card';

/**
 * Un hallazgo interpretado: cada afirmación dice su nivel de evidencia (dato,
 * interpretación, hipótesis), la confianza se declara, y «¿De dónde salió
 * esto?» despliega la trazabilidad —periodo, método y fuentes con su conteo—.
 */

const HALLAZGO: Insight = {
  id: 'i-1',
  module: 'campaigns',
  title: 'La campaña rinde más los lunes',
  statements: [
    { level: 'observed', text: 'El CTR de los lunes es 2,1 %.' },
    { level: 'hypothesis', text: 'Puede deberse al horario.' },
  ],
  confidence: 'low',
  confidenceFactors: ['Pocas semanas', 'Un solo canal'],
  trace: { period: '1–30 oct', method: 'Comparación por día', sources: [{ label: 'Meta Ads', count: 12034, unit: 'clics' }] },
  action: { label: 'Ver por día', module: 'campaigns', query: { grain: 'day' } },
};

describe('InsightCard', () => {
  let fixture: ComponentFixture<InsightCard>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(InsightCard);
    fixture.componentRef.setInput('insight', HALLAZGO);
    fixture.detectChanges();
  });

  it('cada afirmación lleva su nivel de evidencia y la confianza se declara', () => {
    const filas = Array.from(root().querySelectorAll('.in__row'));
    expect(filas.map((f) => f.querySelector('[class*="in__level"]')?.textContent)).toEqual(['Dato observado', 'Hipótesis']);
    expect(root().querySelector('.in__conf')?.textContent).toContain('Confianza baja');
    expect(root().querySelector('.in__conf')?.getAttribute('title')).toBe('Pocas semanas · Un solo canal');
  });

  it('la trazabilidad está plegada y se despliega con su botón', () => {
    const boton = root().querySelector<HTMLButtonElement>('.in__trace')!;
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(root().querySelector('.in__trace-box')).toBeNull();

    boton.click();
    fixture.detectChanges();
    const caja = root().querySelector('.in__trace-box')!;
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(boton.getAttribute('aria-controls')).toBe(caja.id);
    expect(caja.textContent).toContain('Comparación por día');
    expect(caja.textContent).toContain('clics · Meta Ads');
    expect(boton.textContent).toContain('Ocultar el origen');
  });

  it('la acción lleva al módulo con su consulta', () => {
    const enlace = root().querySelector('a.in__go')!;
    expect(enlace.getAttribute('href')).toBe('/insights/campaigns?grain=day');
    expect(enlace.textContent).toContain('Ver por día');
  });
});

import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { KpiAssessment } from '../domain/insights.types';
import { KpiCard } from './kpi-card';

/**
 * La tarjeta de un KPI: es un botón que abre el análisis y se anuncia entero
 * (métrica, valor, variación). Un valor que no se pudo calcular dice «Sin dato»
 * y el motivo; la variación se colorea según la métrica mejore o empeore, no
 * según el signo; y las referencias (benchmark, objetivo) sólo si existen.
 */

function evaluacion(partial: Partial<KpiAssessment> = {}, kpi: Partial<KpiAssessment['kpi']> = {}): KpiAssessment {
  return {
    kpi: {
      metric: 'reach',
      value: 12500,
      numerator: null,
      denominator: null,
      gap: null,
      sampleDays: 30,
      estimated: false,
      ...kpi,
    },
    benchmark: null,
    target: null,
    previous: 10000,
    changeVsPrevious: 0.25,
    changeVsBenchmark: null,
    status: 'optimal',
    statusReason: 'Supera el objetivo.',
    ...partial,
  } as KpiAssessment;
}

describe('KpiCard', () => {
  let fixture: ComponentFixture<KpiCard>;

  function pintar(assessment: KpiAssessment, extra: Record<string, unknown> = {}): HTMLElement {
    fixture = TestBed.createComponent(KpiCard);
    fixture.componentRef.setInput('assessment', assessment);
    for (const [k, v] of Object.entries(extra)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('es un botón que se anuncia con métrica, valor y variación, y emite opened', () => {
    const root = pintar(evaluacion());
    const boton = root.querySelector<HTMLButtonElement>('.kpi__btn')!;
    let abiertos = 0;
    fixture.componentInstance.opened.subscribe(() => (abiertos += 1));

    expect(boton.getAttribute('aria-label')).toMatch(/^Alcance: .+\. Sube .+ frente a el periodo anterior\. Abrir análisis\.$/);
    expect(root.querySelector('.kpi__label')?.textContent).toContain('Alcance');
    boton.click();
    expect(abiertos).toBe(1);
  });

  it('una subida en una métrica que conviene que suba es buena; con flecha arriba', () => {
    const delta = pintar(evaluacion()).querySelector('.kpi__delta')!;
    expect(delta.classList.contains('kpi__delta--good')).toBe(true);
    expect(delta.querySelector('span')?.textContent).toBe('↑');
  });

  it('una bajada en esa métrica es mala', () => {
    const delta = pintar(evaluacion({ changeVsPrevious: -0.2 })).querySelector('.kpi__delta')!;
    expect(delta.classList.contains('kpi__delta--bad')).toBe(true);
    expect(delta.querySelector('span')?.textContent).toBe('↓');
  });

  it('sin periodo anterior lo dice en vez de inventar una variación', () => {
    const root = pintar(evaluacion({ changeVsPrevious: null }));
    expect(root.querySelector('.kpi__delta')).toBeNull();
    expect(root.textContent).toContain('Sin periodo anterior comparable');
  });

  it('sin valor: «Sin dato» y el motivo', () => {
    const root = pintar(evaluacion({}, { value: null, gap: { message: 'Falta el gasto de Meta.' } as never }));
    expect(root.querySelector('.kpi__value--none')?.textContent).toBe('Sin dato');
    expect(root.querySelector('.kpi__gap')?.textContent).toContain('Falta el gasto de Meta.');
  });

  it('sin referencias lo dice; con objetivo lo muestra', () => {
    expect(pintar(evaluacion()).textContent).toContain('Sin referencia para comparar');
    const root = pintar(evaluacion({ target: { source: 'strategic', value: 10000, note: 'Meta Q4', verified: true } }));
    expect(root.querySelector('.kpi__ref')?.textContent).toContain('Objetivo');
  });

  it('una cifra estimada lleva su marca', () => {
    expect(pintar(evaluacion({}, { estimated: true })).querySelector('abbr.kpi__est')).not.toBeNull();
  });

  it('compacta no muestra semáforo ni referencias; expandida muestra la lectura de decisión', () => {
    const compacta = pintar(evaluacion(), { density: 'compact' });
    expect(compacta.querySelector('app-ins-status')).toBeNull();
    expect(compacta.querySelector('.kpi__refs')).toBeNull();

    const expandida = pintar(evaluacion(), { density: 'expanded', series: [1, 2, 3] });
    expect(expandida.querySelector('.kpi__read')?.textContent).toContain('Decisión que permite');
    expect(expandida.querySelector('app-ins-spark svg')).not.toBeNull();
  });

  it('seleccionada se anuncia como presionada', () => {
    expect(pintar(evaluacion(), { selected: true }).querySelector('.kpi__btn')?.getAttribute('aria-pressed')).toBe('true');
  });
});

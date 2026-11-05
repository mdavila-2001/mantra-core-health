import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { MarketingAlert } from '../domain/insights.types';
import { AlertCard } from './alert-card';

/**
 * Una alerta de marketing: severidad con forma y texto (no sólo color), qué
 * pasó, magnitud y confianza, y el enlace para investigar en el módulo que la
 * originó con sus filtros. La versión compacta omite causa, impacto y evidencia.
 */

const ALERTA: MarketingAlert = {
  id: 'a-1',
  severity: 'risk',
  title: 'Cae la conversión en Santa Cruz',
  what: 'La conversión bajó 18 % en 7 días.',
  detectedAt: '2026-10-28',
  magnitude: '−18 %',
  source: 'Meta Ads',
  cause: 'Cambio de creatividad',
  impact: '40 turnos menos',
  confidence: 'medium',
  recommendation: 'Revisar la creatividad nueva.',
  evidence: ['CTR estable', 'CPC sube'],
  module: 'funnel',
  query: { region: 'SCZ' },
  series: [10, 9, 8],
  status: 'open',
};

describe('AlertCard', () => {
  let fixture: ComponentFixture<AlertCard>;

  function pintar(alert: MarketingAlert, compact = false): HTMLElement {
    fixture = TestBed.createComponent(AlertCard);
    fixture.componentRef.setInput('alert', alert);
    fixture.componentRef.setInput('compact', compact);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('lleva la severidad en la clase, con forma y rótulo, y se rotula por su título', () => {
    const root = pintar(ALERTA);
    expect(root.classList.contains('al--risk')).toBe(true);
    expect(root.querySelector('.al__level')?.textContent).toContain('▲');
    expect(root.querySelector('.al__level')?.textContent).toContain('Posible riesgo');
    expect(root.querySelector('article')?.getAttribute('aria-labelledby')).toBe('al-a-1');
    expect(root.querySelector('#al-a-1')?.textContent).toBe('Cae la conversión en Santa Cruz');
  });

  it('completa: fecha corta y fuente, causa, impacto, confianza, recomendación y evidencia', () => {
    const root = pintar(ALERTA);
    expect(root.querySelector('.al__when')?.textContent).toContain('Meta Ads');
    expect(root.textContent).toContain('Cambio de creatividad');
    expect(root.textContent).toContain('40 turnos menos');
    expect(root.textContent).toContain('Media');
    expect(root.querySelectorAll('.al__evidence li')).toHaveLength(2);
    expect(root.querySelector('app-ins-spark svg')).not.toBeNull();
  });

  it('compacta omite causa, impacto, recomendación y evidencia', () => {
    const root = pintar(ALERTA, true);
    expect(root.textContent).not.toContain('Cambio de creatividad');
    expect(root.querySelector('.al__rec')).toBeNull();
    expect(root.querySelector('.al__evidence')).toBeNull();
    expect(root.textContent).toContain('−18 %');
  });

  it('el enlace lleva al módulo de origen con sus filtros', () => {
    const enlace = pintar(ALERTA).querySelector('a.al__go')!;
    expect(enlace.getAttribute('href')).toBe('/insights/funnel?region=SCZ');
    expect(enlace.textContent).toContain('Investigar en Embudo y experiencia del paciente');
  });

  it('con una serie de un solo punto no dibuja la mini-serie', () => {
    expect(pintar({ ...ALERTA, series: [3] }).querySelector('app-ins-spark')).toBeNull();
  });
});

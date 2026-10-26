import { TestBed } from '@angular/core/testing';

import type { GlossaryNeighbor } from '@core/data-access/terminology/terminology.types';
import { RelationEvidence } from './relation-evidence';

const base: GlossaryNeighbor = { conceptId: 'x', slug: 'x', display: 'Neumonía', category: null };

function montar(neighbor: GlossaryNeighbor): HTMLElement {
  const fixture = TestBed.createComponent(RelationEvidence);
  fixture.componentRef.setInput('neighbor', neighbor);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('RelationEvidence', () => {
  it('sin evidencia no pinta nada', () => {
    expect(montar(base).querySelector('.relation-evidence')).toBeNull();
  });

  it('dice la fuerza con barra y con palabras, y el sello con su nivel', () => {
    const host = montar({ ...base, strength: 0.7, frequency: 'FREQUENT', evidenceTier: 'NATIONAL_STANDARD' });

    expect(host.querySelector<HTMLElement>('.relation-evidence__bar')?.style.inlineSize).toBe('70%');
    expect(host.querySelector('.relation-evidence__strength')?.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('.relation-evidence__frequency')?.textContent?.trim()).toBe('Frecuente');
    expect(host.querySelector('.relation-evidence__seal')?.textContent?.trim()).toBe('Norma nacional');
  });

  it('el sello se alcanza con el teclado para abrir su ayuda', () => {
    const host = montar({ ...base, evidenceTier: 'CURATED_REFERENCE', sourceCodes: ['ORPHA'] });

    const sello = host.querySelector<HTMLElement>('.relation-evidence__seal')!;
    expect(sello.tabIndex).toBe(0);
  });

  it('un hallazgo descartado no lleva barra: no es una relación débil sino negativa', () => {
    const host = montar({ ...base, strength: 0.4, frequency: 'EXCLUDED' });

    expect(host.querySelector('.relation-evidence__bar')).toBeNull();
    expect(host.querySelector('.relation-evidence--excluded')).not.toBeNull();
    expect(host.textContent).toContain('La fuente lo descarta');
  });
});

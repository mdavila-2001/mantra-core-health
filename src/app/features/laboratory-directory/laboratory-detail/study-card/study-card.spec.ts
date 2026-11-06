import { TestBed } from '@angular/core/testing';

import type { DiagnosticStudy } from '../../../../core/data-access/diagnostic-units/diagnostic-units.types';
import { LabStudyCard } from './study-card';

const STUDY: DiagnosticStudy = {
  id: 's1',
  code: '04-01-070',
  name: 'Radiografía de tórax frontal y lateral',
  description: 'Radiografía de tórax frontal y lateral realizado en Centro de Imagen Sur.',
  siteId: null,
  modality: { code: 'RX', display: 'Radiografía' },
  preparationInstructions: 'Retirar objetos metálicos.',
  expectedDurationMinutes: null,
  expectedTurnaroundMinutes: 1440,
  requiresMedicalOrder: true,
  prices: [{ amount: '107.71', currency: { code: 'BOB', display: 'Boliviano' }, scheduleCode: 'REFERENCIA_FONASA_2026_BOB', siteId: null }],
};

describe('LabStudyCard', () => {
  function render(study: DiagnosticStudy): HTMLElement {
    const fixture = TestBed.createComponent(LabStudyCard);
    fixture.componentRef.setInput('study', study);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('no repite el nombre como descripción', () => {
    const text = render(STUDY).textContent ?? '';
    expect(text).not.toContain('realizado en Centro de Imagen Sur');
  });

  it('muestra la descripción cuando agrega algo al nombre', () => {
    const text = render({ ...STUDY, description: 'Incluye informe del radiólogo.' }).textContent ?? '';
    expect(text).toContain('Incluye informe del radiólogo.');
  });

  it('destaca preparación, orden médica, entrega y el rótulo honesto del precio', () => {
    const host = render(STUDY);
    expect(host.querySelector('.study-card__prep')?.textContent).toContain('Retirar objetos metálicos.');
    expect(host.textContent).toContain('Requiere orden médica');
    expect(host.querySelector('.study-card__eta')?.textContent).toContain('24 h');
    expect(host.textContent).toContain('Referencia FONASA 2026 (Chile), en Bs');
    expect(host.querySelector('[data-testid="unit-study-price"]')?.textContent?.trim()).toBe('107,71 Bs');
  });

  it('muestra la descripción si agrega algo después de «realizado en …»', () => {
    const text = render({ ...STUDY, description: 'Radiografía de tórax frontal y lateral realizado en Centro Sur. Incluye informe.' }).textContent ?? '';
    expect(text).toContain('Incluye informe.');
  });

  it('dice «Sin precio publicado» en vez de un cero', () => {
    const host = render({ ...STUDY, prices: [] });
    expect(host.querySelector('[data-testid="unit-study-price"]')?.textContent).toContain('Sin precio publicado');
  });
});

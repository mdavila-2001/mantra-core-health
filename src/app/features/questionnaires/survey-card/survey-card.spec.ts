import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SurveyCard, type SurveyCardData } from './survey-card';

const base: SurveyCardData = {
  id: 'e1',
  title: 'Satisfacción',
  status: 'ACTIVE',
  latestVersionNumber: 1,
  published: true,
  questionCount: 4,
  origin: 'PRACTITIONER',
  assignments: [
    { id: 'a1', targetType: 'SERVICE', targetId: 's1', targetName: 'Ecografía' },
    { id: 'a2', targetType: 'CARE_TYPE', targetId: 'c1' },
  ],
  palabra: 'Activa',
  tono: 'success',
  ruta: '/questionnaires/e1',
};

function render(data: SurveyCardData): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(SurveyCard);
  fixture.componentRef.setInput('encuesta', data);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('SurveyCard', () => {
  it('lists the services by name and links the inbox to the sheet', () => {
    const el = render(base);
    const chips = el.querySelector('[data-testid="encuesta-servicios"]')?.textContent ?? '';
    expect(chips).toContain('Ecografía');
    expect(chips).toContain('Todas mis consultas');
    const inbox = el.querySelector<HTMLAnchorElement>('[data-testid="respuestas-e1"]');
    expect(inbox?.textContent).toContain('Ver respuestas');
    expect(inbox?.getAttribute('href')).toBe('/questionnaires/e1#respuestas');
    expect(el.querySelector('[data-testid="abrir-e1"]')).not.toBeNull();
  });

  it('marks a base survey, names its scope and sends the inbox to the summary', () => {
    const el = render({ ...base, id: 'b1', origin: 'SYSTEM', scope: 'SERVICE', assignments: [] });
    expect(el.textContent).toContain('Base del sistema');
    expect(el.querySelector('[data-testid="encuesta-servicios"]')?.textContent).toContain('Todos los servicios');
    expect(el.querySelector('[data-testid="respuestas-b1"]')?.getAttribute('href')).toBe('/questionnaires#resumen');
    expect(el.querySelector('[data-testid="abrir-b1"]')).toBeNull();
  });

  it('says so when an own survey has no service yet', () => {
    const el = render({ ...base, assignments: [] });
    expect(el.querySelector('[data-testid="encuesta-sin-servicios"]')).not.toBeNull();
  });
});

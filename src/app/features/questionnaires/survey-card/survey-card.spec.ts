import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SurveyCard, type SurveyCardData } from './survey-card';

const imported: SurveyCardData = {
  id: 'e1',
  title: 'Estudios por imágenes',
  status: 'ACTIVE',
  latestVersionNumber: 1,
  published: true,
  questionCount: 4,
  origin: 'PRACTITIONER',
  assignments: [
    { id: 'a1', targetType: 'SERVICE', targetId: 's1', targetName: 'Ecografía' },
    { id: 'a2', targetType: 'CARE_TYPE', targetId: 'c1' },
  ],
  label: 'Se envía',
  tone: 'success',
  route: '/questionnaires/e1',
  current: true,
};

function render(data: SurveyCardData): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(SurveyCard);
  fixture.componentRef.setInput('survey', data);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('SurveyCard · read-only', () => {
  it('a current survey lists its services by name and links its responses; nothing edits it', () => {
    const card = render(imported);
    const chips = card.querySelector('[data-testid="survey-card-targets"]')?.textContent ?? '';
    expect(chips).toContain('Ecografía');
    // Only services are destinations now: a consultation link is not «sent».
    expect(chips).not.toContain('consultas');
    const inbox = card.querySelector<HTMLAnchorElement>('[data-testid="survey-responses-e1"]');
    expect(inbox?.textContent).toContain('Ver respuestas');
    expect(inbox?.getAttribute('href')).toBe('/questionnaires/e1#respuestas');
    expect(card.textContent).not.toMatch(/\bAbrir\b|Borrador|Desactivada|sin publicar/);
  });

  it('marks a base survey, names its scope and sends the inbox to the summary', () => {
    const card = render({ ...imported, id: 'b1', origin: 'SYSTEM', scope: 'SERVICE', assignments: [] });
    expect(card.textContent).toContain('Base del sistema');
    expect(card.querySelector('[data-testid="survey-card-targets"]')?.textContent).toContain('Servicios sin encuesta propia');
    expect(card.querySelector('[data-testid="survey-responses-b1"]')?.getAttribute('href')).toBe('/questionnaires#resumen');
  });

  it('a past survey says it is no longer sent and lists no destination, but its responses stay readable', () => {
    const card = render({ ...imported, current: false, label: 'Encuesta anterior (ya no se envía)', tone: 'secondary' });
    expect(card.querySelector('[data-testid="survey-card-status-e1"]')?.textContent).toContain('Encuesta anterior (ya no se envía)');
    expect(card.querySelector('[data-testid="survey-card-past-note"]')).not.toBeNull();
    expect(card.querySelector('[data-testid="survey-card-targets"]')).toBeNull();
    expect(card.querySelector('[data-testid="survey-responses-e1"]')).not.toBeNull();
    expect(card.textContent).not.toContain('Activa');
  });
});

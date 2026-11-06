import { TestBed } from '@angular/core/testing';

import type { SurveyQuestion } from '../../../../core/data-access/surveys/surveys.types';
import { QuestionView } from './question-view';

function render(question: SurveyQuestion): HTMLElement {
  const fixture = TestBed.createComponent(QuestionView);
  fixture.componentRef.setInput('question', question);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('QuestionView · solo lectura', () => {
  it('muestra texto, obligatoria, tipo y una muestra apagada; no hay nada que abrir', () => {
    const view = render({ id: 'q', position: 2, questionText: '¿Volvería?', answerType: 'BOOLEAN', required: true } as SurveyQuestion);
    expect(view.textContent).toContain('¿Volvería?');
    expect(view.querySelector('[aria-label="obligatoria"]')).not.toBeNull();
    expect(view.textContent).toContain('Sí / No');
    expect(view.querySelector('button, [role="button"]')).toBeNull();
    expect(view.querySelector('input')?.disabled).toBe(true);
  });

  it('resume hasta tres opciones y cuenta el resto', () => {
    const view = render({ id: 'q', position: 1, questionText: '¿Cuál?', answerType: 'SINGLE_CHOICE', required: false, options: ['A', 'B', 'C', 'D', 'E'] } as SurveyQuestion);
    expect(view.querySelector('.pregunta__meta')?.textContent).toContain('A · B · C · y 2 más');
    expect(view.querySelectorAll('.pregunta__opcion')).toHaveLength(5);
  });
});

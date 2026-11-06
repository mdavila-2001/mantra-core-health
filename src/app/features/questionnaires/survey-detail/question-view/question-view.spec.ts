import { TestBed } from '@angular/core/testing';

import type { SurveyQuestion } from '../../../../core/data-access/surveys/surveys.types';
import { QuestionView } from './question-view';

function render(question: SurveyQuestion): HTMLElement {
  const fixture = TestBed.createComponent(QuestionView);
  fixture.componentRef.setInput('question', question);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('QuestionView · solo lectura, como texto', () => {
  it('muestra texto, la marca de obligatoria (dicha en palabras) y cómo se responde; nada editable', () => {
    const view = render({ id: 'q', position: 2, questionText: '¿Volvería?', answerType: 'BOOLEAN', required: true });
    expect(view.textContent).toContain('¿Volvería?');
    expect(view.querySelector('.sr-only')?.textContent).toContain('obligatoria');
    expect(view.querySelector('.pregunta__meta')?.textContent?.trim()).toBe('Sí / No');
    expect(view.querySelector('input, button, [role="button"]')).toBeNull();
  });

  it('lista las opciones una sola vez, con las mismas palabras que el selector', () => {
    const view = render({ id: 'q', position: 1, questionText: '¿Cuál?', answerType: 'SINGLE_CHOICE', required: false, options: ['A', 'B', 'C'] });
    expect(view.querySelector('.pregunta__meta')?.textContent?.trim()).toBe('Una opción: A · B · C · opcional');
    expect(view.textContent?.match(/\bA\b/g)).toHaveLength(1);
  });
});

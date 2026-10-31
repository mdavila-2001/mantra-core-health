import { TestBed } from '@angular/core/testing';

import type { AnswerType } from '@core/data-access/surveys/surveys.types';
import { QuestionTypeIcon } from './question-type-icon';

/**
 * El ícono del tipo de pregunta de un cuestionario. Es decorativo (el tipo se
 * dice en texto al lado): `aria-hidden` y sin foco. Cada tipo tiene un dibujo
 * propio; dos tipos con el mismo dibujo no se distinguirían a simple vista.
 */

const TIPOS: readonly AnswerType[] = ['TEXT', 'SCALE', 'BOOLEAN', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE'];

function dibujo(tipo: AnswerType): HTMLElement {
  const fixture = TestBed.createComponent(QuestionTypeIcon);
  fixture.componentRef.setInput('tipo', tipo);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('QuestionTypeIcon', () => {
  it('es decorativo: oculto al lector y fuera del foco', () => {
    const host = dibujo('TEXT');
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.classList.contains('icono-tipo-pregunta')).toBe(true);
    expect(host.querySelector('svg')?.getAttribute('focusable')).toBe('false');
  });

  it.each(TIPOS)('%s dibuja trazos', (tipo) => {
    expect(dibujo(tipo).querySelector('svg')!.children.length).toBeGreaterThan(0);
  });

  it('los cinco tipos tienen dibujos distintos', () => {
    const dibujos = TIPOS.map((t) => dibujo(t).querySelector('svg')!.innerHTML.replace(/<!--[\s\S]*?-->/g, ''));
    expect(new Set(dibujos).size).toBe(TIPOS.length);
  });
});

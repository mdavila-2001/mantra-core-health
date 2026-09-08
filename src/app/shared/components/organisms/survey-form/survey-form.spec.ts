import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { SurveyQuestion } from '@core/data-access/surveys/surveys.types';
import { SurveyForm } from './survey-form';

/**
 * El cuestionario renderizado.
 *
 * Es el organismo que comparten la pantalla de responder y la vista previa de
 * quien autora, así que lo que se prueba es que cada tipo saque **su** control
 * —si eso se desvía, la previa deja de decir la verdad— y el recorte de una
 * escala impracticable, que es el único caso donde el organismo decide algo por
 * su cuenta.
 */
describe('SurveyForm', () => {
  let fixture: ComponentFixture<SurveyForm>;

  function pregunta(parcial: Partial<SurveyQuestion>): SurveyQuestion {
    return {
      id: 'q-1',
      position: 1,
      questionText: 'Pregunta',
      answerType: 'TEXT',
      required: false,
      ...parcial,
    };
  }

  function montar(preguntas: readonly SurveyQuestion[], soloLectura = false): HTMLElement {
    fixture = TestBed.createComponent(SurveyForm);
    fixture.componentRef.setInput('preguntas', preguntas);
    fixture.componentRef.setInput('soloLectura', soloLectura);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('un texto libre se responde con un área de texto', () => {
    const host = montar([pregunta({ answerType: 'TEXT' })]);

    expect(host.querySelector('app-textarea')).not.toBeNull();
    expect(host.querySelector('app-radio-group')).toBeNull();
  });

  it('un sí/no se responde con dos radios', () => {
    const host = montar([pregunta({ answerType: 'BOOLEAN' })]);

    expect(host.querySelectorAll('app-radio')).toHaveLength(2);
    expect(host.textContent).toContain('Sí');
    expect(host.textContent).toContain('No');
  });

  it('una elección múltiple se responde con casillas, no con radios', () => {
    const host = montar([
      pregunta({ answerType: 'MULTIPLE_CHOICE', options: ['Uno', 'Dos', 'Tres'] }),
    ]);

    expect(host.querySelectorAll('app-checkbox')).toHaveLength(3);
    expect(host.querySelector('app-radio-group')).toBeNull();
  });

  it('una escala dibuja un radio por punto, extremos incluidos', () => {
    const host = montar([pregunta({ answerType: 'SCALE', scaleMin: 0, scaleMax: 10 })]);

    expect(host.querySelectorAll('app-radio')).toHaveLength(11);
  });

  it('una escala impracticable se recorta a sus extremos y lo dice', () => {
    // El backend acepta 0–500. Dibujar quinientos radios cuelga la pantalla, y
    // quien armó la encuesta no se entera hasta verla: la previa tiene que
    // avisarlo.
    const host = montar([pregunta({ answerType: 'SCALE', scaleMin: 0, scaleMax: 500 })]);

    expect(host.querySelectorAll('app-radio')).toHaveLength(2);
    expect(host.textContent).toContain('demasiados puntos');
  });

  it('en vista previa nada figura como obligatorio', () => {
    // No se está enviando nada, así que marcar obligatorias sería un aviso
    // sobre un envío que no existe.
    const host = montar([pregunta({ required: true })], true);

    expect(host.querySelector('[aria-required="true"]')).toBeNull();
  });

  it('marca la pregunta que quedó sin responder', () => {
    fixture = TestBed.createComponent(SurveyForm);
    fixture.componentRef.setInput('preguntas', [pregunta({ required: true })]);
    fixture.componentRef.setInput('faltantes', new Set(['q-1']));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Esta pregunta es obligatoria',
    );
  });

  it('en vista previa NO marca faltantes aunque se las pasen', () => {
    fixture = TestBed.createComponent(SurveyForm);
    fixture.componentRef.setInput('preguntas', [pregunta({ required: true })]);
    fixture.componentRef.setInput('faltantes', new Set(['q-1']));
    fixture.componentRef.setInput('soloLectura', true);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Esta pregunta es obligatoria',
    );
  });

  it('responder guarda el valor y lo avisa', () => {
    montar([pregunta({ answerType: 'TEXT' })]);
    const componente = fixture.componentInstance;

    let avisado: { questionId: string } | null = null;
    componente.respondido.subscribe((e) => (avisado = e));

    (componente as unknown as { responder(id: string, v: string): void }).responder('q-1', 'Bien');

    expect(componente.respuestas().get('q-1')).toBe('Bien');
    expect(avisado).toEqual({ questionId: 'q-1', valor: 'Bien' });
  });

  it('alternar una casilla agrega y quita sin perder las otras', () => {
    montar([pregunta({ answerType: 'MULTIPLE_CHOICE', options: ['A', 'B'] })]);
    const componente = fixture.componentInstance as unknown as {
      alternar(id: string, o: string, m: boolean): void;
    };

    componente.alternar('q-1', 'A', true);
    componente.alternar('q-1', 'B', true);
    componente.alternar('q-1', 'A', false);

    expect(fixture.componentInstance.respuestas().get('q-1')).toEqual(['B']);
  });
});

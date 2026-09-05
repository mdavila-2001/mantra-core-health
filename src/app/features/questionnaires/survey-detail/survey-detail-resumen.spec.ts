import { describe, expect, it } from 'vitest';

import type { SurveyQuestion, SurveyResponse } from '../../../core/data-access/surveys/surveys.types';
import { celdaCsv, resumirPregunta, slugify } from './survey-detail';

/** Arma una respuesta mínima con una sola contestación, para no repetir el resto de campos en cada test. */
function respuestaCon(answer: SurveyResponse['answers'][number]): SurveyResponse {
  return {
    id: `r-${Math.random()}`,
    invitationId: 'inv-1',
    appointmentBookingId: 'bkg-1',
    submittedAt: new Date('2026-01-01'),
    answers: [answer],
  };
}

const preguntaEscala: SurveyQuestion = {
  id: 'q-escala',
  position: 1,
  questionText: '¿Qué tan satisfecho quedaste?',
  answerType: 'SCALE',
  required: true,
  scaleMin: 1,
  scaleMax: 5,
};

const preguntaOpcion: SurveyQuestion = {
  id: 'q-opcion',
  position: 2,
  questionText: '¿Qué mejorarías?',
  answerType: 'SINGLE_CHOICE',
  required: false,
  options: ['Puntualidad', 'Trato', 'Instalaciones'],
};

const preguntaBooleana: SurveyQuestion = {
  id: 'q-bool',
  position: 3,
  questionText: '¿Volverías a atenderte?',
  answerType: 'BOOLEAN',
  required: true,
};

const preguntaTexto: SurveyQuestion = {
  id: 'q-texto',
  position: 4,
  questionText: 'Contanos más',
  answerType: 'TEXT',
  required: false,
};

describe('resumirPregunta — dashboard de FT-29', () => {
  it('cuenta cada valor de escala y calcula el promedio', () => {
    const respuestas = [
      respuestaCon({ questionId: 'q-escala', questionText: '', answerType: 'SCALE', valueNumber: 5 }),
      respuestaCon({ questionId: 'q-escala', questionText: '', answerType: 'SCALE', valueNumber: 5 }),
      respuestaCon({ questionId: 'q-escala', questionText: '', answerType: 'SCALE', valueNumber: 3 }),
    ];

    const resumen = resumirPregunta(preguntaEscala, respuestas);

    expect(resumen.totalRespondida).toBe(3);
    expect(resumen.promedio).toBeCloseTo(4.33, 1);
    expect(resumen.barras).toEqual([
      { etiqueta: '1', cantidad: 0, porcentaje: 0 },
      { etiqueta: '2', cantidad: 0, porcentaje: 0 },
      { etiqueta: '3', cantidad: 1, porcentaje: 33 },
      { etiqueta: '4', cantidad: 0, porcentaje: 0 },
      { etiqueta: '5', cantidad: 2, porcentaje: 67 },
    ]);
  });

  it('cuenta cuántos eligieron cada opción de elección simple', () => {
    const respuestas = [
      respuestaCon({
        questionId: 'q-opcion',
        questionText: '',
        answerType: 'SINGLE_CHOICE',
        valueChoices: ['Trato'],
      }),
      respuestaCon({
        questionId: 'q-opcion',
        questionText: '',
        answerType: 'SINGLE_CHOICE',
        valueChoices: ['Trato'],
      }),
    ];

    const resumen = resumirPregunta(preguntaOpcion, respuestas);

    expect(resumen.barras).toEqual([
      { etiqueta: 'Puntualidad', cantidad: 0, porcentaje: 0 },
      { etiqueta: 'Trato', cantidad: 2, porcentaje: 100 },
      { etiqueta: 'Instalaciones', cantidad: 0, porcentaje: 0 },
    ]);
    expect(resumen.promedio).toBeNull();
  });

  it('cuenta sí/no en una pregunta booleana', () => {
    const respuestas = [
      respuestaCon({ questionId: 'q-bool', questionText: '', answerType: 'BOOLEAN', valueBoolean: true }),
      respuestaCon({ questionId: 'q-bool', questionText: '', answerType: 'BOOLEAN', valueBoolean: false }),
      respuestaCon({ questionId: 'q-bool', questionText: '', answerType: 'BOOLEAN', valueBoolean: true }),
    ];

    const resumen = resumirPregunta(preguntaBooleana, respuestas);

    expect(resumen.barras).toEqual([
      { etiqueta: 'Sí', cantidad: 2, porcentaje: 67 },
      { etiqueta: 'No', cantidad: 1, porcentaje: 33 },
    ]);
  });

  it('no arma barras para texto libre: agruparlo no diría nada', () => {
    const respuestas = [
      respuestaCon({ questionId: 'q-texto', questionText: '', answerType: 'TEXT', valueText: 'Todo bien' }),
    ];

    const resumen = resumirPregunta(preguntaTexto, respuestas);

    expect(resumen.barras).toEqual([]);
    expect(resumen.totalRespondida).toBe(1);
  });

  it('nadie respondió: 0 sobre 0 es 0%, no NaN', () => {
    const resumen = resumirPregunta(preguntaEscala, []);

    expect(resumen.totalRespondida).toBe(0);
    expect(resumen.promedio).toBeNull();
    expect(resumen.barras.every((b) => b.porcentaje === 0)).toBe(true);
  });
});

describe('celdaCsv', () => {
  it('deja pasar un valor simple sin comillas', () => {
    expect(celdaCsv('Bien')).toBe('Bien');
  });

  it('encierra en comillas un valor con coma', () => {
    expect(celdaCsv('Puntualidad, trato')).toBe('"Puntualidad, trato"');
  });

  it('duplica las comillas internas', () => {
    expect(celdaCsv('Dijo "todo bien"')).toBe('"Dijo ""todo bien"""');
  });

  it('encierra en comillas un valor con salto de línea', () => {
    expect(celdaCsv('Primera línea\nSegunda línea')).toBe('"Primera línea\nSegunda línea"');
  });
});

describe('slugify', () => {
  it('quita tildes y pasa a minúsculas', () => {
    expect(slugify('Satisfacción Post-Consulta')).toBe('satisfaccion-post-consulta');
  });

  it('nunca devuelve una cadena vacía', () => {
    expect(slugify('¿¿¿???')).toBe('encuesta');
  });
});

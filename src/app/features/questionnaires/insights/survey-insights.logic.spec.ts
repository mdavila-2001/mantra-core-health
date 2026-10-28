import { describe, expect, it } from 'vitest';

import type { InsightsQuestion } from '../../../core/data-access/surveys/surveys.types';
import {
  barrasDeTendencia,
  combinarPorDimension,
  preguntaNeutraDeDimension,
  rotuloDeDimension,
  etiquetaDePeriodo,
  formatearNps,
  PERIODO_INICIAL,
  PERIODOS,
  preguntasGraficables,
  rangoDe,
  resumirAgregado,
  satisfaccionGlobal,
  segmentosNps,
  semaforoNps,
  tasaDeRespuesta,
} from './survey-insights.logic';

function pregunta(parcial: Partial<InsightsQuestion>): InsightsQuestion {
  return {
    questionId: 'q',
    text: 'Pregunta',
    dimension: null,
    suppressed: false,
    answerType: 'SCALE',
    n: 0,
    average: null,
    distribution: [],
    optionCounts: [],
    ...parcial,
  };
}

describe('semáforo del NPS', () => {
  it.each([
    [75, 'excelente', 'success'],
    [50, 'excelente', 'success'],
    [49, 'bueno', 'success'],
    [30, 'bueno', 'success'],
    [29, 'aceptable', 'warning'],
    [0, 'aceptable', 'warning'],
    [-1, 'a-mejorar', 'error'],
    [-100, 'a-mejorar', 'error'],
  ] as const)('NPS %i es %s (%s)', (valor, nivel, tono) => {
    const semaforo = semaforoNps(valor);
    expect(semaforo.nivel).toBe(nivel);
    expect(semaforo.tono).toBe(tono);
    // El color nunca va solo: siempre hay una palabra.
    expect(semaforo.palabra.length).toBeGreaterThan(0);
  });

  it('sin datos no pinta ningún color: un 0 inventado se leería como «aceptable»', () => {
    expect(semaforoNps(null)).toMatchObject({ nivel: 'sin-datos', tono: 'neutral' });
  });

  it('muestra el signo explícito', () => {
    expect(formatearNps(32)).toBe('+32');
    expect(formatearNps(-10)).toBe('-10');
    expect(formatearNps(0)).toBe('0');
    expect(formatearNps(null)).toBe('—');
  });
});

describe('tasa de respuesta', () => {
  it('se recalcula desde los conteos, no se lee del servidor', () => {
    // El contrato no fija si `responseRate` es fracción o porcentaje.
    expect(tasaDeRespuesta({ issued: 64, answered: 40, responseRate: 0.625 })).toBe(63);
    expect(tasaDeRespuesta({ issued: 64, answered: 40, responseRate: 62.5 })).toBe(63);
  });

  it('sin envíos no hay tasa (no es 0 %)', () => {
    expect(tasaDeRespuesta({ issued: 0, answered: 0, responseRate: 0 })).toBeNull();
  });
});

describe('desglose del NPS', () => {
  it('da promotores, pasivos y detractores con su porcentaje sobre n', () => {
    const segmentos = segmentosNps({ value: 20, promoters: 12, passives: 8, detractors: 5, n: 25 });
    expect(segmentos.map((s) => [s.clave, s.cantidad, s.porcentaje])).toEqual([
      ['promoters', 12, 48],
      ['passives', 8, 32],
      ['detractors', 5, 20],
    ]);
  });

  it('con n = 0 los porcentajes son 0 y no NaN', () => {
    const segmentos = segmentosNps({ value: null, promoters: 0, passives: 0, detractors: 0, n: 0 });
    expect(segmentos.every((s) => s.porcentaje === 0)).toBe(true);
  });
});

describe('período: presets de meses calendario', () => {
  const hoy = new Date(2026, 9, 28); // 28 de octubre de 2026, hora local

  it('«Este mes» va del día 1 al último día del mes en curso', () => {
    expect(rangoDe('mes', hoy)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('«3 meses» es el mes actual y los 2 anteriores, con límites de mes', () => {
    expect(rangoDe('3m', hoy)).toEqual({ from: '2026-08-01', to: '2026-10-31' });
  });

  it('«12 meses» es el actual y los 11 anteriores: 12 meses justos', () => {
    expect(rangoDe('12m', hoy)).toEqual({ from: '2025-11-01', to: '2026-10-31' });
  });

  it('el último día respeta meses cortos y bisiestos', () => {
    expect(rangoDe('mes', new Date(2026, 1, 10)).to).toBe('2026-02-28');
    expect(rangoDe('mes', new Date(2028, 1, 10)).to).toBe('2028-02-29');
    expect(rangoDe('mes', new Date(2026, 3, 1)).to).toBe('2026-04-30');
  });

  it('cruza el año sin perder meses', () => {
    expect(rangoDe('3m', new Date(2026, 0, 15))).toEqual({ from: '2025-11-01', to: '2026-01-31' });
  });

  it('siempre from = día 1 y to = último día, en cualquier mes del año', () => {
    for (let mes = 0; mes < 12; mes += 1) {
      for (const p of ['mes', '3m', '12m'] as const) {
        const { from, to } = rangoDe(p, new Date(2026, mes, 17));
        expect(from.endsWith('-01'), `${p} ${mes}`).toBe(true);
        const ultimo = new Date(Number(to.slice(0, 4)), Number(to.slice(5, 7)), 0).getDate();
        expect(Number(to.slice(8)), `${p} ${mes}`).toBe(ultimo);
      }
    }
  });

  it('no ofrece rangos libres: sólo tres presets', () => {
    expect(PERIODOS.map((p) => p.value)).toEqual(['mes', '3m', '12m']);
    expect(PERIODO_INICIAL).toBe('3m');
  });
});

describe('satisfacción global', () => {
  it('pondera por n las preguntas de la dimensión (consulta y servicio)', () => {
    const resultado = satisfaccionGlobal([
      pregunta({ dimension: 'satisfaccion_global', n: 30, average: 4.0 }),
      pregunta({ dimension: 'satisfaccion_global', n: 10, average: 3.0 }),
      pregunta({ dimension: 'comunicacion', n: 99, average: 1 }),
    ]);
    expect(resultado?.n).toBe(40);
    expect(resultado?.promedio).toBeCloseTo(3.75, 5);
  });

  it('es null si nadie la contestó', () => {
    expect(satisfaccionGlobal([pregunta({ dimension: 'satisfaccion_global', n: 0, average: null })])).toBeNull();
    expect(satisfaccionGlobal([])).toBeNull();
  });
});

describe('barras de una pregunta agregada', () => {
  it('1–5: completa los valores sin respuestas con cero y calcula el porcentaje sobre n', () => {
    const resumen = resumirAgregado(
      pregunta({
        n: 10,
        average: 4.2,
        distribution: [
          { value: 3, count: 1 },
          { value: 4, count: 5 },
          { value: 5, count: 4 },
        ],
      }),
    );
    expect(resumen.escala).toBe('1-5');
    expect(resumen.barras.map((b) => b.etiqueta)).toEqual(['1', '2', '3', '4', '5']);
    expect(resumen.barras.map((b) => b.cantidad)).toEqual([0, 0, 1, 5, 4]);
    expect(resumen.barras.map((b) => b.porcentaje)).toEqual([0, 0, 10, 50, 40]);
    expect(resumen.promedio).toBe(4.2);
  });

  it('0–10 (NPS): once barras', () => {
    const resumen = resumirAgregado(
      pregunta({ n: 4, distribution: [{ value: 0, count: 1 }, { value: 9, count: 3 }] }),
    );
    expect(resumen.escala).toBe('0-10');
    expect(resumen.barras).toHaveLength(11);
    expect(resumen.barras[9]).toMatchObject({ etiqueta: '9', cantidad: 3, porcentaje: 75 });
  });

  it('opciones: una barra por opción, en el orden de la pregunta', () => {
    const resumen = resumirAgregado(
      pregunta({
        answerType: 'SINGLE_CHOICE',
        n: 8,
        optionCounts: [
          { option: 'Menos de 15 minutos', count: 5 },
          { option: 'De 15 a 30 minutos', count: 3 },
          { option: 'Más de 1 hora', count: 0 },
        ],
      }),
    );
    expect(resumen.escala).toBeNull();
    expect(resumen.barras.map((b) => [b.etiqueta, b.porcentaje])).toEqual([
      ['Menos de 15 minutos', 63],
      ['De 15 a 30 minutos', 38],
      ['Más de 1 hora', 0],
    ]);
  });

  it('sin respuestas no divide por cero', () => {
    const resumen = resumirAgregado(pregunta({ n: 0 }));
    expect(resumen.barras.every((b) => b.porcentaje === 0)).toBe(true);
  });
});

describe('orden de las preguntas', () => {
  it('base por dimensión, propias al final, y sin texto libre', () => {
    const orden = preguntasGraficables([
      pregunta({ questionId: 'propia', dimension: null }),
      pregunta({ questionId: 'nps', dimension: 'recomendacion_nps' }),
      pregunta({ questionId: 'texto', dimension: 'comentario_abierto', answerType: 'TEXT' }),
      pregunta({ questionId: 'acceso', dimension: 'esfuerzo_acceso' }),
    ]);
    expect(orden.map((p) => p.questionId)).toEqual(['acceso', 'nps', 'propia']);
  });
});

describe('tendencia', () => {
  it('rotula semanas y meses sin correrse un día por el huso', () => {
    expect(etiquetaDePeriodo('2026-10-26').corta).toBe('26 oct');
    expect(etiquetaDePeriodo('2026-10').corta).toBe('oct');
    expect(etiquetaDePeriodo('2026-10').larga).toBe('oct de 2026');
  });

  it('escala las barras al máximo y no deja en cero un período con respuestas', () => {
    const barras = barrasDeTendencia([
      { period: '2026-08', answered: 0, average: null },
      { period: '2026-09', answered: 1, average: 4 },
      { period: '2026-10', answered: 40, average: 4.5 },
    ]);
    expect(barras.map((b) => b.alturaPct)).toEqual([0, 4, 100]);
  });

  it('sin períodos no revienta', () => {
    expect(barrasDeTendencia([])).toEqual([]);
  });
});

describe('combinar consulta y servicio por dimensión', () => {
  it('suma los conteos, pondera el promedio y titula con la dimensión (ningún enunciado habla por los dos)', () => {
    const [unica] = combinarPorDimension([
      pregunta({
        questionId: 'consulta',
        text: 'En esta consulta, ¿cómo calificaría…?',
        dimension: 'satisfaccion_global',
        n: 30,
        average: 4,
        distribution: [{ value: 4, count: 30 }],
      }),
      pregunta({
        questionId: 'servicio',
        text: 'Con este servicio, ¿cómo calificaría…?',
        dimension: 'satisfaccion_global',
        n: 10,
        average: 3,
        distribution: [{ value: 3, count: 10 }],
      }),
    ]);
    expect(unica!.combinada).toBe(true);
    expect(unica!.pregunta.n).toBe(40);
    expect(unica!.pregunta.average).toBeCloseTo(3.75, 5);
    // El enunciado es el neutro de la dimensión: no dice «consulta» ni «servicio».
    expect(unica!.neutra).toBe(true);
    expect(unica!.pregunta.text).toBe(preguntaNeutraDeDimension('satisfaccion_global'));
    expect(unica!.pregunta.text).not.toMatch(/consulta|servicio/i);
    expect(unica!.pregunta.distribution).toEqual([
      { value: 3, count: 10 },
      { value: 4, count: 30 },
    ]);
  });

  it('suma las opciones de una elección por su texto', () => {
    const [unica] = combinarPorDimension([
      pregunta({ dimension: 'tiempo_espera', answerType: 'SINGLE_CHOICE', n: 5, optionCounts: [{ option: 'A', count: 3 }, { option: 'B', count: 2 }] }),
      pregunta({ dimension: 'tiempo_espera', answerType: 'SINGLE_CHOICE', n: 4, optionCounts: [{ option: 'A', count: 1 }, { option: 'B', count: 3 }] }),
    ]);
    expect(unica!.pregunta.optionCounts).toEqual([{ option: 'A', count: 4 }, { option: 'B', count: 5 }]);
  });

  it('las propias y las que están solas pasan tal cual', () => {
    const resultado = combinarPorDimension([
      pregunta({ questionId: 'propia-1', dimension: null }),
      pregunta({ questionId: 'propia-2', dimension: null }),
      pregunta({ questionId: 'sola', dimension: 'comunicacion' }),
    ]);
    expect(resultado.map((r) => [r.pregunta.questionId, r.combinada])).toEqual([
      ['propia-1', false],
      ['propia-2', false],
      ['sola', false],
    ]);
  });
});

describe('preguntas suprimidas por el servidor', () => {
  it('una suprimida NO se suma a una que no lo está (se reconstruiría lo que se escondió)', () => {
    const resultado = combinarPorDimension([
      pregunta({ questionId: 'consulta', dimension: 'comunicacion', n: 30, average: 4, distribution: [{ value: 4, count: 30 }] }),
      pregunta({ questionId: 'servicio', dimension: 'comunicacion', suppressed: true }),
    ]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]!.combinada).toBe(false);
    expect(resultado[0]!.pregunta.questionId).toBe('consulta');
    expect(resultado[0]!.pregunta.n).toBe(30);
  });

  it('sin filtro, la que gana no habla de «servicio» ni de «consulta»: lleva el enunciado neutro', () => {
    const resultado = combinarPorDimension([
      pregunta({ questionId: 'consulta', text: 'En esta consulta, ¿con qué frecuencia le trataron con respeto?', dimension: 'trato_respetuoso', suppressed: true }),
      pregunta({ questionId: 'servicio', text: 'Durante este servicio, ¿con qué frecuencia le trataron con respeto?', dimension: 'trato_respetuoso', n: 6, average: 4.5 }),
    ]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]!.pregunta.questionId).toBe('servicio');
    expect(resultado[0]!.pregunta.n).toBe(6);
    expect(resultado[0]!.neutra).toBe(true);
    expect(resultado[0]!.pregunta.text).toBe(preguntaNeutraDeDimension('trato_respetuoso'));
    expect(resultado[0]!.pregunta.text).not.toMatch(/consulta|servicio/i);
  });

  it('con un servicio elegido conserva el enunciado de ese servicio', () => {
    const resultado = combinarPorDimension(
      [
        pregunta({ questionId: 'consulta', dimension: 'trato_respetuoso', suppressed: true }),
        pregunta({ questionId: 'servicio', text: 'Durante este servicio, ¿…?', dimension: 'trato_respetuoso', n: 6, average: 4.5 }),
      ],
      'servicio',
    );
    expect(resultado[0]!.neutra).toBe(false);
    expect(resultado[0]!.pregunta.text).toBe('Durante este servicio, ¿…?');
  });

  it('una dimensión de una sola fuente conserva su enunciado', () => {
    const [sola] = combinarPorDimension([
      pregunta({ questionId: 'c', text: 'En esta consulta, ¿…?', dimension: 'comunicacion', suppressed: true }),
    ]);
    expect(sola!.neutra).toBe(false);
    expect(sola!.pregunta.text).toBe('En esta consulta, ¿…?');
  });

  it('toda dimensión base tiene su enunciado neutro, sin las palabras «consulta» ni «servicio»', () => {
    for (const dimension of [
      'esfuerzo_acceso', 'tiempo_espera', 'comunicacion', 'claridad_explicacion',
      'trato_respetuoso', 'seguridad_percibida', 'satisfaccion_global', 'recomendacion_nps',
    ]) {
      const texto = preguntaNeutraDeDimension(dimension);
      expect(texto).not.toBe(rotuloDeDimension(dimension));
      expect(texto).not.toMatch(/consulta|servicio/i);
    }
  });

  it('gana la que sí tiene datos aunque la suprimida venga primero', () => {
    const resultado = combinarPorDimension([
      pregunta({ questionId: 'servicio', dimension: 'comunicacion', suppressed: true }),
      pregunta({ questionId: 'consulta', dimension: 'comunicacion', n: 12, average: 4 }),
    ]);
    expect(resultado.map((r) => r.pregunta.questionId)).toEqual(['consulta']);
  });

  it('si las dos están suprimidas queda una sola fila suprimida', () => {
    const resultado = combinarPorDimension([
      pregunta({ questionId: 'a', dimension: 'comunicacion', suppressed: true }),
      pregunta({ questionId: 'b', dimension: 'comunicacion', suppressed: true }),
    ]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]!.pregunta.suppressed).toBe(true);
  });

  it('la satisfacción global ignora las suprimidas', () => {
    expect(
      satisfaccionGlobal([pregunta({ dimension: 'satisfaccion_global', suppressed: true, n: 0, average: null })]),
    ).toBeNull();
  });
});

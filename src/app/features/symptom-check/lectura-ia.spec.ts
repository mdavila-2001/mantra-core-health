import type { LecturaIa } from '@core/data-access/triage-ia/triage-ia.types';

import { combinar, lecturaVigente, sintomasDeLaLectura } from './lectura-ia';
import { reconocer, recomendar } from './sintomas';

/** Lo que el servicio devolvió de verdad para las tres frases del pedido (2026-09-23). */
const LECTURA: LecturaIa = {
  urgency: 'programada',
  symptoms: [
    {
      code: 'dolor-de-panza',
      label: 'dolor de panza',
      kind: 'curated',
      zones: ['estomago'],
      bodyPart: { code: 'estomago', label: 'estómago', side: null },
      alarm: false,
      especialidades: [{ nombre: 'Gastroenterología', peso: 3 }],
    },
    {
      code: 'mancha:espalda',
      label: 'manchas en la espalda',
      kind: 'anatomy',
      zones: ['espalda', 'piel'],
      bodyPart: { code: 'espalda', label: 'espalda', side: null },
      alarm: false,
      especialidades: [
        { nombre: 'Dermatología', peso: 3 },
        { nombre: 'Medicina general', peso: 1 },
      ],
    },
    {
      code: 'tristeza',
      label: 'tristeza persistente',
      kind: 'curated',
      zones: ['animo'],
      bodyPart: null,
      alarm: false,
      especialidades: [{ nombre: 'Psicología', peso: 3 }],
    },
  ],
};

describe('sintomasDeLaLectura', () => {
  it('los de la tabla vuelven como su fila y los anatómicos como un síntoma nuevo con sus especialidades', () => {
    const sintomas = sintomasDeLaLectura(LECTURA);
    expect(sintomas.map((s) => s.id)).toEqual(['dolor-de-panza', 'mancha:espalda', 'tristeza']);
    const manchas = sintomas[1];
    expect(manchas.nombre).toBe('manchas en la espalda');
    expect(manchas.especialidades[0]).toEqual({ nombre: 'Dermatología', peso: 3 });
    // La fila de la tabla conserva sus especialidades reales, no las del cable.
    expect(sintomas[0].especialidades.length).toBeGreaterThan(0);
  });

  it('ubica un síntoma de la tabla con la parte y el lado cuando el nombre no los dice', () => {
    const [hormigueo] = sintomasDeLaLectura({
      urgency: 'programada',
      symptoms: [
        {
          code: 'hormigueo', label: 'hormigueo', kind: 'curated', zones: ['manos'],
          bodyPart: { code: 'mano', label: 'mano', side: 'izquierdo' }, alarm: false, especialidades: [],
        },
      ],
    });
    expect(hormigueo.id).toBe('hormigueo');
    expect(hormigueo.nombre).toContain('· mano (lado izquierdo)');
  });

  it('un código que esta tabla no tiene se ignora', () => {
    const sintomas = sintomasDeLaLectura({
      urgency: 'programada',
      symptoms: [{ ...LECTURA.symptoms[0], code: 'fila-de-otro-build' }],
    });
    expect(sintomas).toEqual([]);
  });

  it('sin lectura no hay nada que sumar', () => {
    expect(sintomasDeLaLectura(null)).toEqual([]);
  });
});

describe('combinar', () => {
  it('suma lo que el motor local no ve y recomienda con la misma lógica', () => {
    const texto = 'Me duele el estómago, no sé dónde exactamente. Me salieron unas manchas raras en la espalda. Me siento triste';
    const locales = reconocer(texto);
    expect(locales.some((s) => s.id === 'mancha:espalda')).toBe(false);

    const todos = combinar(locales, sintomasDeLaLectura(LECTURA));
    expect(todos.map((s) => s.id)).toEqual(expect.arrayContaining(['dolor-de-panza', 'tristeza', 'mancha:espalda']));
    expect(new Set(todos.map((s) => s.id)).size).toBe(todos.length);

    const especialidades = recomendar(todos).map((r) => r.nombre);
    expect(especialidades).toContain('Dermatología');
    expect(especialidades).toContain('Gastroenterología');
  });

  it('un síntoma que vieron los dos queda en la versión del servicio y en su lugar', () => {
    const locales = reconocer('me duele el estómago');
    const todos = combinar(locales, sintomasDeLaLectura(LECTURA));
    expect(todos[0].id).toBe('dolor-de-panza');
    expect(todos[0].nombre).toBe('dolor de panza · estómago');
    expect(todos.filter((s) => s.id === 'dolor-de-panza')).toHaveLength(1);
  });
});

describe('lecturaVigente', () => {
  const guardada = { texto: 'me duele el brazo', lectura: LECTURA };

  it('vale mientras se sigue escribiendo o dictando al final', () => {
    expect(lecturaVigente(guardada, 'me duele el brazo')).toBe(LECTURA);
    expect(lecturaVigente(guardada, 'me duele el brazo y la pierna')).toBe(LECTURA);
  });

  it('deja de valer si se borró o cambió lo que la produjo', () => {
    expect(lecturaVigente(guardada, 'me duele el')).toBeNull();
    expect(lecturaVigente(guardada, 'me duele la pierna')).toBeNull();
    expect(lecturaVigente(null, 'lo que sea')).toBeNull();
  });
});

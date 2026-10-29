import { shortName } from './labels';

describe('rótulos cortos de los locales', () => {
  it('deja el nombre entero si cabe y quita el apellido tras « · » y los paréntesis', () => {
    expect(shortName('Consultorio 1 · Medicina general', 30)).toBe('Consultorio 1');
    expect(shortName('Observación (4 camas)', 30)).toBe('Observación');
    expect(shortName('Aislamiento 1 (presión negativa)', 30)).toBe('Aislamiento 1');
  });

  it('abrevia con sentido antes de cortar una palabra', () => {
    expect(shortName('Habitación 101', 8)).toBe('Hab. 101');
    expect(shortName('Control de enfermería Cirugía', 12)).toContain('Enfermería');
  });

  it('si solo cabe el número, deja el número', () => {
    expect(shortName('Habitación 101', 4)).toBe('101');
  });

  it('en un local diminuto no pinta nada', () => {
    expect(shortName('Quirófano', 2)).toBe('');
  });

  it('el último recurso es el recorte con puntos suspensivos', () => {
    expect(shortName('Central de esterilización', 12)).toBe('Central de…');
  });
});

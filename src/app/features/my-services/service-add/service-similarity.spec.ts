import {
  MAX_SUGGESTIONS,
  nameSimilarity,
  significantWords,
  similarServices,
} from './service-similarity';

/**
 * El parecido entre nombres de servicio es determinista (criterio 6 del
 * carril 23): estas pruebas fijan qué se considera «lo mismo dicho de otra
 * forma» y qué no.
 */
describe('service-similarity', () => {
  it('normaliza tildes, mayúsculas, signos y palabras que no distinguen', () => {
    expect(significantWords('Consulta de Ecografía, obstétrica')).toEqual([
      'ecografia',
      'obstetrica',
    ]);
  });

  it('el mismo servicio con otras palabras se parece del todo', () => {
    expect(nameSimilarity('Control prenatal', 'Consulta de control prenatal')).toBe(1);
  });

  it('tolera plurales y errores de tipeo', () => {
    expect(nameSimilarity('Ecografias obstetricas', 'Ecografía obstétrica')).toBeGreaterThanOrEqual(
      0.6,
    );
    expect(nameSimilarity('Electrocardiograma', 'Electrocardiogrma')).toBeGreaterThanOrEqual(0.6);
  });

  it('servicios distintos no se parecen aunque compartan «consulta de»', () => {
    expect(nameSimilarity('Consulta de nutrición', 'Consulta de cardiología')).toBeLessThan(0.6);
    expect(nameSimilarity('Ecografía obstétrica', 'Control prenatal')).toBeLessThan(0.6);
  });

  it('es determinista: la misma entrada da el mismo puntaje', () => {
    const a = nameSimilarity('Curación de heridas', 'Curacion de herida simple');
    const b = nameSimilarity('Curación de heridas', 'Curacion de herida simple');
    expect(a).toBe(b);
  });

  it('propone los parecidos ordenados y con tope', () => {
    const existentes = [
      { name: 'Control prenatal' },
      { name: 'Consulta de control prenatal' },
      { name: 'Control prenatal de alto riesgo' },
      { name: 'Control prenatal mensual' },
      { name: 'Ecografía obstétrica' },
    ];
    const parecidos = similarServices('control prenatal', existentes);
    expect(parecidos.length).toBe(MAX_SUGGESTIONS);
    expect(parecidos.map((p) => p.service.name)).not.toContain('Ecografía obstétrica');
    expect(parecidos[0]!.score).toBe(1);
  });

  it('un nombre sin palabras que cuenten no se parece a nada', () => {
    expect(similarServices('de la', [{ name: 'Consulta' }])).toEqual([]);
  });
});

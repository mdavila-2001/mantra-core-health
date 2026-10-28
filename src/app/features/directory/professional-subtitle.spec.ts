import { professionalSubtitle } from './professional-subtitle';

/**
 * El guardia de F-25: si esta prueba se pone en rojo es porque una tarjeta de la
 * Guía volvió a poder mostrar el nombre de otra persona como subtítulo.
 */
describe('subtituloProfesional', () => {
  it('deja pasar un título profesional de verdad', () => {
    expect(professionalSubtitle('Medicina Familiar', 'Ana Lucía Flores')).toBe('Medicina Familiar');
  });

  it('sin título no inventa nada', () => {
    expect(professionalSubtitle(undefined, 'Ana Lucía Flores')).toBeUndefined();
    expect(professionalSubtitle('   ', 'Ana Lucía Flores')).toBeUndefined();
  });

  // Los tres cruces exactos que la recorrida del 18/08/2026 encontró.
  it.each([
    ['Ana Lucía Flores', 'Dra. Camila Roca — Medicina Familiar'],
    ['Mateo Quiroga Ríos', 'Dr. Andrés Mercado — Cardiología'],
    ['Carla Mendoza Suárez', 'Dr. Rodrigo Paz (caso 15)'],
  ])('%s no muestra «%s»: es el nombre de otro', (nombre, cruzado) => {
    expect(professionalSubtitle(cruzado, nombre)).toBeUndefined();
  });

  it('el nombre de otro de la misma lista se detecta aunque no lleve tratamiento', () => {
    expect(
      professionalSubtitle('Camila Roca, Medicina Familiar', 'Ana Lucía Flores', [
        'Camila Roca',
        'Ana Lucía Flores',
      ]),
    ).toBeUndefined();
  });

  it('el tratamiento del propio titular no es un cruce', () => {
    // «Dra. Lucía Salas» en la tarjeta de Lucía Salas es redundante, no falso.
    expect(professionalSubtitle('Dra. Lucía Salas', 'Dra. Lucía Salas')).toBe('Dra. Lucía Salas');
  });

  it('compara sin tildes ni mayúsculas: «Lucia» y «Lucía» son la misma persona', () => {
    expect(professionalSubtitle('Dra. Lucia Salas', 'Dra. Lucía Salas')).toBe('Dra. Lucia Salas');
    expect(
      professionalSubtitle('CAMILA ROCA — Pediatría', 'Ana Flores', ['Camila Roca']),
    ).toBeUndefined();
  });
});

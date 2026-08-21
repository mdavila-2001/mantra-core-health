import { subtituloProfesional } from './subtitulo-profesional';

/**
 * El guardia de F-25: si esta prueba se pone en rojo es porque una tarjeta de la
 * Guía volvió a poder mostrar el nombre de otra persona como subtítulo.
 */
describe('subtituloProfesional', () => {
  it('deja pasar un título profesional de verdad', () => {
    expect(subtituloProfesional('Medicina Familiar', 'Ana Lucía Flores')).toBe(
      'Medicina Familiar',
    );
  });

  it('sin título no inventa nada', () => {
    expect(subtituloProfesional(undefined, 'Ana Lucía Flores')).toBeUndefined();
    expect(subtituloProfesional('   ', 'Ana Lucía Flores')).toBeUndefined();
  });

  // Los tres cruces exactos que la recorrida del 18/08/2026 encontró.
  it.each([
    ['Ana Lucía Flores', 'Dra. Camila Roca — Medicina Familiar'],
    ['Mateo Quiroga Ríos', 'Dr. Andrés Mercado — Cardiología'],
    ['Carla Mendoza Suárez', 'Dr. Rodrigo Paz (caso 15)'],
  ])('%s no muestra «%s»: es el nombre de otro', (nombre, cruzado) => {
    expect(subtituloProfesional(cruzado, nombre)).toBeUndefined();
  });

  it('el nombre de otro de la misma lista se detecta aunque no lleve tratamiento', () => {
    expect(
      subtituloProfesional('Camila Roca, Medicina Familiar', 'Ana Lucía Flores', [
        'Camila Roca',
        'Ana Lucía Flores',
      ]),
    ).toBeUndefined();
  });

  it('el tratamiento del propio titular no es un cruce', () => {
    // «Dra. Lucía Salas» en la tarjeta de Lucía Salas es redundante, no falso.
    expect(subtituloProfesional('Dra. Lucía Salas', 'Dra. Lucía Salas')).toBe(
      'Dra. Lucía Salas',
    );
  });

  it('compara sin tildes ni mayúsculas: «Lucia» y «Lucía» son la misma persona', () => {
    expect(subtituloProfesional('Dra. Lucia Salas', 'Dra. Lucía Salas')).toBe(
      'Dra. Lucia Salas',
    );
    expect(
      subtituloProfesional('CAMILA ROCA — Pediatría', 'Ana Flores', ['Camila Roca']),
    ).toBeUndefined();
  });
});

import { inicialesDe } from './iniciales';

/**
 * Las iniciales del cuadrado sin foto.
 *
 * Estas pruebas nacen de una captura: el directorio de médicos mostraba doce
 * tarjetas seguidas con «D», porque su copia de esta función no descartaba el
 * tratamiento y el backend compone los nombres como «Dr(a). Nombre Apellido».
 * Con iniciales iguales, las iniciales dejan de hacer lo único que hacen.
 */
describe('inicialesDe', () => {
  it('descarta el tratamiento con paréntesis, que es como lo compone el backend', () => {
    expect(inicialesDe('Dr(a). Andrés Quispe Mamani')).toBe('AQ');
  });

  it('descarta «Dra.» y «Dr.» sueltos', () => {
    expect(inicialesDe('Dra. Marisol Quispe Ticona')).toBe('MQ');
    expect(inicialesDe('Dr. Andrés Peña')).toBe('AP');
  });

  it('sin tratamiento toma las dos primeras', () => {
    expect(inicialesDe('Ana Quispe Mamani')).toBe('AQ');
  });

  it('con un solo nombre da una sola inicial, no un cuadrado vacío', () => {
    expect(inicialesDe('Farmacia')).toBe('F');
  });

  it('un nombre que es sólo un tratamiento no queda en blanco', () => {
    // Mejor una inicial pobre que un cuadrado vacío: el dato es raro pero
    // existe, y la tarjeta se dibuja igual.
    expect(inicialesDe('Dra.')).toBe('D');
  });

  it('ignora lo que no empieza con letra', () => {
    expect(inicialesDe('  Ana   Quispe ')).toBe('AQ');
  });

  it('respeta los acentos como primera letra', () => {
    expect(inicialesDe('Ángel Íñiguez')).toBe('ÁÍ');
  });
});

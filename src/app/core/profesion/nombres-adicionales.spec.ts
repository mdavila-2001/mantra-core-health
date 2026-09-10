import { separarNombres, unirNombres } from './nombres-adicionales';

/**
 * La codificación de los nombres que no son el primero.
 *
 * Lo que estas pruebas fijan: que **partir y volver a unir sea la identidad**.
 * De eso depende que el editor del perfil no le borre el tercer nombre a quien
 * lo declaró en el alta — que es exactamente lo que pasaba cuando cada
 * pantalla tenía su propia idea de cómo se escribe `middle_name`.
 */
describe('nombres adicionales', () => {
  describe('unirNombres', () => {
    it('junta los nombres con un espacio', () => {
      expect(unirNombres(['Lucía', 'María'])).toBe('Lucía María');
    });

    it('descarta las casillas vacías en vez de dejar espacios de más', () => {
      expect(unirNombres(['Lucía', '', '  ', 'Belén'])).toBe('Lucía Belén');
    });

    it('sin ningún nombre devuelve la cadena vacía, que es cómo se borra', () => {
      expect(unirNombres(['', '  '])).toBe('');
    });
  });

  describe('separarNombres', () => {
    it('reparte el primero en el segundo nombre y el segundo en el tercero', () => {
      expect(separarNombres('Lucía María')).toEqual({
        segundo: 'Lucía',
        tercero: 'María',
        extra: [],
      });
    });

    it('el cuarto y el quinto caen en las casillas agregadas', () => {
      expect(separarNombres('Lucía María Belén Sol')).toEqual({
        segundo: 'Lucía',
        tercero: 'María',
        extra: ['Belén', 'Sol'],
      });
    });

    it('un solo nombre adicional no inventa una casilla extra vacía', () => {
      expect(separarNombres('Lucía')).toEqual({ segundo: 'Lucía', tercero: '', extra: [] });
    });

    it('sin nombres adicionales deja las tres casillas vacías', () => {
      expect(separarNombres(undefined)).toEqual({ segundo: '', tercero: '', extra: [] });
    });
  });

  it('partir y volver a unir devuelve lo mismo', () => {
    const guardado = 'Lucía María Belén';
    const partes = separarNombres(guardado);

    expect(unirNombres([partes.segundo, partes.tercero, ...partes.extra])).toBe(guardado);
  });
});

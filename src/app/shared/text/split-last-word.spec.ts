import { splitLastWord } from './split-last-word';

describe('splitLastWord', () => {
  it('separa la última palabra y conserva el espacio en la cabeza', () => {
    expect(splitLastWord('Valeria Rojas Mendoza')).toEqual({ head: 'Valeria Rojas ', tail: 'Mendoza' });
  });

  it('un nombre de una palabra va entero en la cola', () => {
    expect(splitLastWord('Mendoza')).toEqual({ head: '', tail: 'Mendoza' });
  });

  it('vacío, nulo o de espacios no falla', () => {
    for (const vacio of ['', '   ', null, undefined]) {
      expect(splitLastWord(vacio)).toEqual({ head: '', tail: '' });
    }
  });

  it('un nombre de 200 caracteres no se corta ni se pierde', () => {
    const largo = `${'A'.repeat(100)} ${'B'.repeat(99)}`;
    const { head, tail } = splitLastWord(largo);
    expect(head + tail).toBe(largo);
    expect(tail).toBe('B'.repeat(99));
  });

  it('descarta los espacios de los bordes', () => {
    expect(splitLastWord('  Ana Rojas  ')).toEqual({ head: 'Ana ', tail: 'Rojas' });
  });
});

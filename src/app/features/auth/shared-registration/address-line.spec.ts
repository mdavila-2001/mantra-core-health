import { componerDireccion } from './address-line';

describe('componerDireccion', () => {
  it('une la calle y el distrito con una coma', () => {
    expect(componerDireccion('Av. Banzer #42', 'Distrito 5')).toBe('Av. Banzer #42, Distrito 5');
  });

  it('con una sola parte devuelve esa parte, sin coma', () => {
    expect(componerDireccion('Av. Banzer #42', '')).toBe('Av. Banzer #42');
    expect(componerDireccion('  ', 'Distrito 5')).toBe('Distrito 5');
  });

  it('sin texto en ninguna devuelve vacío', () => {
    expect(componerDireccion('', '  ')).toBe('');
  });

  it('no duplica lo que ya está escrito en la calle', () => {
    expect(componerDireccion('Sacaba', 'sacaba')).toBe('Sacaba');
  });
});

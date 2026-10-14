import { cleanDisplayName } from './clean-display-name';

describe('cleanDisplayName', () => {
  it('elimina comas iniciales o espacios', () => {
    expect(cleanDisplayName(', Marisol Antelo de Aguilera')).toBe('Marisol Antelo de Aguilera');
    expect(cleanDisplayName(', , Dr. Carlos')).toBe('Dr. Carlos');
  });

  it('elimina comas duplicadas en el medio', () => {
    expect(cleanDisplayName('Antelo de Aguilera,, Marisol')).toBe('Antelo de Aguilera, Marisol');
  });

  it('preserva nombres limpios', () => {
    expect(cleanDisplayName('Acha Vargas Luis')).toBe('Acha Vargas Luis');
    expect(cleanDisplayName('Dra. Marisol Quispe Ticona')).toBe('Dra. Marisol Quispe Ticona');
  });

  it('soporta vacíos y nulos', () => {
    expect(cleanDisplayName(null)).toBe('');
    expect(cleanDisplayName(undefined)).toBe('');
    expect(cleanDisplayName('')).toBe('');
  });
});

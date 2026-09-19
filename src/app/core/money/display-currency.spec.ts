import { displayCurrency, withDisplayCurrency } from './display-currency';

/**
 * La regla en una línea: «Bs» para el boliviano y para la UMA del arancel, y
 * el código tal cual para cualquier otra moneda. Lo segundo es lo que impide
 * que un precio en dólares se lea como si fueran bolivianos.
 */
describe('displayCurrency', () => {
  it.each([['BOB'], ['Bs'], ['Boliviano'], ['Bolivianos']])('%s se escribe «Bs»', (codigo) => {
    expect(displayCurrency(codigo)).toBe('Bs');
  });

  it('la UMA del arancel también, y sin convertir el número', () => {
    // Pedido del propietario (19/09/2026): el factor de la UMA a bolivianos no
    // está declarado en ninguna parte, así que se cambia el rótulo y nada más.
    expect(withDisplayCurrency('100', 'UMA')).toBe('100 Bs');
  });

  it('otra moneda conserva su código: «Bs» sobre dólares sería otro precio', () => {
    expect(displayCurrency('USD')).toBe('USD');
    expect(withDisplayCurrency('40.00', 'USD')).toBe('40.00 USD');
  });

  it('sin código se asume la moneda del producto', () => {
    expect(displayCurrency()).toBe('Bs');
    expect(displayCurrency(null)).toBe('Bs');
    expect(displayCurrency('  ')).toBe('Bs');
  });

  it('no reformatea el importe: lo que llega es lo que se muestra', () => {
    expect(withDisplayCurrency('1.234,50', 'BOB')).toBe('1.234,50 Bs');
  });
});

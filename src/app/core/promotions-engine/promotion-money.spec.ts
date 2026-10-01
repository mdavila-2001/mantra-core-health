import {
  fromCents,
  isValidPercent,
  normalizeAmount,
  percentOffCents,
  priceAfterPercent,
  savingPercent,
  sumLines,
  toCents,
} from './promotion-money';

describe('toCents / fromCents', () => {
  it.each([
    ['10', 1000],
    ['10.5', 1050],
    ['10.50', 1050],
    ['0.10', 10],
    [' 7.25 ', 725],
    ['0', 0],
  ])('«%s» son %s centavos', (text, cents) => {
    expect(toCents(text)).toBe(cents);
  });

  it.each(['', '  ', '-1', '1.234', 'abc', '1,50', '.5', '10.'])('rechaza «%s»', (text) => {
    expect(toCents(text)).toBeNull();
  });

  it('0.10 + 0.20 no deriva: 30 centavos exactos', () => {
    expect(fromCents((toCents('0.10') ?? 0) + (toCents('0.20') ?? 0))).toBe('0.30');
  });

  it('normalizeAmount fija los dos decimales', () => {
    expect(normalizeAmount('15')).toBe('15.00');
    expect(normalizeAmount('22.5')).toBe('22.50');
    expect(normalizeAmount('x')).toBeNull();
  });
});

describe('porcentajes', () => {
  it.each([1, 50, 99])('%s % es válido', (percent) => {
    expect(isValidPercent(percent)).toBe(true);
  });

  it.each([0, 100, -1, 2.5, Number.NaN])('%s % no es válido', (percent) => {
    expect(isValidPercent(percent)).toBe(false);
  });

  it('el precio resultante se redondea hacia abajo: quien lee «33 %» nunca paga peor', () => {
    expect(priceAfterPercent('10.01', 33)).toBe('6.70');
    expect(percentOffCents(1001, 33)).toBe(331);
  });

  it('priceAfterPercent rechaza lo que no es un importe o un porcentaje', () => {
    expect(priceAfterPercent('abc', 10)).toBeNull();
    expect(priceAfterPercent('10.00', 100)).toBeNull();
  });

  it('savingPercent se deriva de los dos precios', () => {
    expect(savingPercent('10.00', '8.00')).toBe(20);
    expect(savingPercent('10.00', '10.00')).toBeNull();
    expect(savingPercent('10.00', '12.00')).toBeNull();
    expect(savingPercent('0', '0')).toBeNull();
    expect(savingPercent('x', '1')).toBeNull();
  });
});

describe('sumLines', () => {
  it('suma precio por cantidad', () => {
    expect(sumLines([{ price: '10.00', quantity: 2 }, { price: '5.50', quantity: 1 }])).toBe('25.50');
  });

  it('devuelve null si algún renglón no se puede calcular', () => {
    expect(sumLines([{ price: 'x', quantity: 1 }])).toBeNull();
    expect(sumLines([{ price: '1.00', quantity: -1 }])).toBeNull();
    expect(sumLines([{ price: '1.00', quantity: 1.5 }])).toBeNull();
  });
});

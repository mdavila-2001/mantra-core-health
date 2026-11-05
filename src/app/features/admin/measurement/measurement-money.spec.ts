import type { MoneyItem } from '../../../core/data-access/admin-portal/analytics-money.types';
import { agruparPorMoneda, formatearImporte, rotuloDeTipo } from './measurement-money';

function fila(parcial: Partial<MoneyItem>): MoneyItem {
  return { module: 'billing', moduleLabel: 'Facturación', kind: 'FACTURADO', currency: 'BOB', operations: 1, amount: '1.00', ...parcial };
}

describe('formato del dinero por cadena', () => {
  it('correcto: miles con punto, coma decimal y dos decimales', () => {
    expect(formatearImporte('18450.50')).toBe('18.450,50');
    expect(formatearImporte('1250000.00')).toBe('1.250.000,00');
    expect(formatearImporte('310.75')).toBe('310,75');
  });

  it('límite: completa a dos decimales y no recorta los que hay', () => {
    expect(formatearImporte('12')).toBe('12,00');
    expect(formatearImporte('12.5')).toBe('12,50');
    expect(formatearImporte('0.001')).toBe('0,001');
    expect(formatearImporte('0.00')).toBe('0,00');
    expect(formatearImporte('-1500.25')).toBe('-1.500,25');
  });

  it('límite: un importe más grande que 2^53 conserva hasta el último centavo', () => {
    expect(String(Number('9007199254740993.10'))).toBe('9007199254740994'); // con number el dato ya está perdido
    expect(formatearImporte('9007199254740993.10')).toBe('9.007.199.254.740.993,10');
  });

  it('inválido: lo que no es decimal se muestra tal cual, sin convertirlo en 0 ni en NaN', () => {
    expect(formatearImporte('abc')).toBe('abc');
    expect(formatearImporte('')).toBe('');
    expect(formatearImporte('1e5')).toBe('1e5');
  });

  it('un tipo desconocido se muestra con su código', () => {
    expect(rotuloDeTipo('COBRADO')).toBe('Cobrado');
    expect(rotuloDeTipo('NUEVO')).toBe('NUEVO');
  });
});

describe('agrupar por moneda', () => {
  it('cada moneda en su grupo y ningún importe se toca ni se suma', () => {
    const items = [
      fila({ currency: 'USD', amount: '310.75' }),
      fila({ currency: 'BOB', amount: '18450.50' }),
      fila({ currency: 'BOB', amount: '14200.00', kind: 'COBRADO' }),
    ];
    const grupos = agruparPorMoneda(items);
    expect(grupos.map((g) => g.currency)).toEqual(['BOB', 'USD']);
    expect(grupos[0]!.items.map((i) => i.amount)).toEqual(['18450.50', '14200.00']);
    expect(grupos[1]!.items.map((i) => i.amount)).toEqual(['310.75']);
    expect(grupos.flatMap((g) => g.items).length).toBe(items.length);
  });

  it('sin filas no hay grupos (no se inventa una moneda con cero)', () => {
    expect(agruparPorMoneda([])).toEqual([]);
  });
});

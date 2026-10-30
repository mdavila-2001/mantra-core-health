import {
  LEDGER_TABS,
  atLeastTwoDecimals,
  describeCutOff,
  describePeriod,
  isIsoDate,
  periodFileSuffix,
  subtractAmounts,
  sumAmounts,
} from './ledger-period';

describe('ledger-period (TAREA-20 · período y decimales de los informes)', () => {
  it('las pestañas siguen el orden del pedido', () => {
    expect(Object.keys(LEDGER_TABS)).toEqual([
      'scorecard',
      'journal',
      'generalLedger',
      'cashFlow',
      'incomeStatement',
      'balanceSheet',
    ]);
    expect(Object.values(LEDGER_TABS)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('isIsoDate acepta sólo fechas AAAA-MM-DD que existen', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('31/01/2026')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });

  it('dice el período con palabras, sin pasar por el huso horario', () => {
    expect(describePeriod({})).toBe('Todo el historial');
    expect(describePeriod({ from: '2026-01-01', to: '2026-01-31' })).toBe(
      'Del 01/01/2026 al 31/01/2026',
    );
    expect(describePeriod({ from: '2026-01-01' })).toBe('Desde el 01/01/2026');
    expect(describePeriod({ to: '2026-01-31' })).toBe('Hasta el 31/01/2026');
    expect(describeCutOff({ from: '2026-01-01', to: '2026-03-31' })).toBe('Al 31/03/2026');
    expect(describeCutOff({})).toBe('A la fecha');
  });

  it('el nombre del archivo exportado lleva el período', () => {
    expect(periodFileSuffix({})).toBe('');
    expect(periodFileSuffix({ from: '2026-01-01', to: '2026-01-31' })).toBe(
      '_2026-01-01_2026-01-31',
    );
    expect(periodFileSuffix({ to: '2026-01-31' })).toBe('_inicio_2026-01-31');
  });

  it('suma y resta exacto, sin errores de coma flotante', () => {
    // 0.1 + 0.2 en `number` da 0.30000000000000004.
    expect(sumAmounts(['0.10', '0.20'])).toBe('0.30');
    expect(sumAmounts([])).toBe('0.00');
    expect(sumAmounts(['9007199254740993.10', '0.01'])).toBe('9007199254740993.11');
    expect(subtractAmounts('100.00', '100.00')).toBe('0.00');
    expect(subtractAmounts('50', '80.25')).toBe('-30.25');
    expect(atLeastTwoDecimals('5')).toBe('5.00');
    expect(atLeastTwoDecimals('1.2345')).toBe('1.2345');
  });
});

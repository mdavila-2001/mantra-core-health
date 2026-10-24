import { toDay, fromDay, readableDay, editableAmount, normalizedAmount } from './records.format';

describe('el formato de la contabilidad simple', () => {
  it('lee el monto como lo escribe una persona en Bolivia', () => {
    expect(normalizedAmount('1.250,50')).toBe('1250.50');
    expect(normalizedAmount('1250,5')).toBe('1250.50');
    expect(normalizedAmount('1250.5')).toBe('1250.50');
    expect(normalizedAmount(' 800 ')).toBe('800.00');
  });

  it('rechaza lo que no es un monto mayor a cero', () => {
    expect(normalizedAmount('')).toBeNull();
    expect(normalizedAmount('0')).toBeNull();
    expect(normalizedAmount('-5')).toBeNull();
    expect(normalizedAmount('12,345')).toBeNull();
    expect(normalizedAmount('doce')).toBeNull();
  });

  it('vuelve a mostrar el monto guardado con coma, para editarlo', () => {
    expect(editableAmount('1250.50')).toBe('1250,50');
  });

  it('las fechas van y vuelven sin correrse de día por la zona horaria', () => {
    expect(toDay(fromDay('2026-09-01'))).toBe('2026-09-01');
    expect(readableDay('2026-09-28')).toBe('28/09/2026');
  });
});

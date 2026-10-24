import { aDia, deDia, diaLegible, montoEditable, montoNormalizado } from './registros.formato';

describe('el formato de la contabilidad simple', () => {
  it('lee el monto como lo escribe una persona en Bolivia', () => {
    expect(montoNormalizado('1.250,50')).toBe('1250.50');
    expect(montoNormalizado('1250,5')).toBe('1250.50');
    expect(montoNormalizado('1250.5')).toBe('1250.50');
    expect(montoNormalizado(' 800 ')).toBe('800.00');
  });

  it('rechaza lo que no es un monto mayor a cero', () => {
    expect(montoNormalizado('')).toBeNull();
    expect(montoNormalizado('0')).toBeNull();
    expect(montoNormalizado('-5')).toBeNull();
    expect(montoNormalizado('12,345')).toBeNull();
    expect(montoNormalizado('doce')).toBeNull();
  });

  it('vuelve a mostrar el monto guardado con coma, para editarlo', () => {
    expect(montoEditable('1250.50')).toBe('1250,50');
  });

  it('las fechas van y vuelven sin correrse de día por la zona horaria', () => {
    expect(aDia(deDia('2026-09-01'))).toBe('2026-09-01');
    expect(diaLegible('2026-09-28')).toBe('28/09/2026');
  });
});

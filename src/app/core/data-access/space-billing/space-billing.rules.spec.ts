import { amountOf, bedDayKey, bedDays, orTimeUnits, validityOverlaps, validOn } from './space-billing.rules';

/** Instante local: la regla cuenta medianoches de la sede, no de UTC. */
const at = (y: number, m: number, d: number, h: number): string => new Date(y, m - 1, d, h).toISOString();

describe('reglas de devengo (F5e)', () => {
  describe('regla de medianoche (D7)', () => {
    it('criterio del contrato: ingreso 27/10 15:00, traslado 28/10 10:00, egreso 30/10 09:00 → 3 días-cama', () => {
      const days = bedDays(
        [
          { careSpaceId: 'compartida', bedCategoryCode: 'BED_CAT_SHARED', start: at(2026, 10, 27, 15), end: at(2026, 10, 28, 10) },
          { careSpaceId: 'uci', bedCategoryCode: 'BED_CAT_ICU', start: at(2026, 10, 28, 10), end: at(2026, 10, 30, 9) },
        ],
        new Date(2026, 10, 15),
      );
      expect(days).toEqual([
        { serviceDate: '2026-10-27', careSpaceId: 'compartida', bedCategoryCode: 'BED_CAT_SHARED' },
        { serviceDate: '2026-10-28', careSpaceId: 'uci', bedCategoryCode: 'BED_CAT_ICU' },
        { serviceDate: '2026-10-29', careSpaceId: 'uci', bedCategoryCode: 'BED_CAT_ICU' },
      ]);
    });

    it('ejemplo del proceso 11: el traslado del día rige desde la medianoche siguiente', () => {
      const days = bedDays(
        [
          { careSpaceId: 'c', bedCategoryCode: 'SHARED', start: at(2026, 10, 28, 15), end: at(2026, 10, 30, 9) },
          { careSpaceId: 'u', bedCategoryCode: 'ICU', start: at(2026, 10, 30, 9), end: at(2026, 10, 31, 10) },
        ],
        new Date(2026, 10, 15),
      );
      expect(days.map((d) => `${d.serviceDate}:${d.bedCategoryCode}`)).toEqual(['2026-10-28:SHARED', '2026-10-29:SHARED', '2026-10-30:ICU']);
    });

    it('el día del egreso no se cobra y una estancia sin medianoche cobra un día', () => {
      const corta = [{ careSpaceId: 'c', bedCategoryCode: 'SHARED', start: at(2026, 10, 28, 8), end: at(2026, 10, 28, 20) }];
      expect(bedDays(corta, new Date(2026, 10, 15))).toEqual([{ serviceDate: '2026-10-28', careSpaceId: 'c', bedCategoryCode: 'SHARED' }]);
      expect(bedDays(corta, new Date(2026, 10, 15), false)).toEqual([]);
    });

    it('una estancia abierta cuenta hasta la última medianoche antes de ahora', () => {
      const abierta = [{ careSpaceId: 'c', bedCategoryCode: 'SHARED', start: at(2026, 10, 29, 18), end: null }];
      expect(bedDays(abierta, new Date(2026, 9, 31, 11)).map((d) => d.serviceDate)).toEqual(['2026-10-29', '2026-10-30']);
    });
  });

  it('la clave de idempotencia es una por encuentro y fecha', () => {
    expect(bedDayKey('e-1', '2026-10-27')).toBe('BEDDAY:e-1:2026-10-27');
  });

  it('quirófano por tiempo: 95 min con unidad de 30 → 4 unidades; respeta el mínimo', () => {
    expect(orTimeUnits(95, 30)).toBe(4);
    expect(orTimeUnits(130, 30)).toBe(5);
    expect(orTimeUnits(20, 30, 2)).toBe(2);
    expect(() => orTimeUnits(10, 0)).toThrow(RangeError);
  });

  it('vigencias semiabiertas: la nueva tarifa futura no toca los días pasados', () => {
    expect(validOn('2026-10-30', '2026-01-01', '2026-11-01')).toBe(true);
    expect(validOn('2026-11-01', '2026-01-01', '2026-11-01')).toBe(false);
    expect(validityOverlaps('2026-01-01', '2026-11-01', '2026-11-01', null)).toBe(false);
    expect(validityOverlaps('2026-01-01', null, '2026-06-01', null)).toBe(true);
  });

  it('importe = cantidad × precio, y sin precio no hay importe', () => {
    expect(amountOf('3', '450.000000')).toBe('1350.00');
    expect(amountOf('1', null)).toBeNull();
  });
});

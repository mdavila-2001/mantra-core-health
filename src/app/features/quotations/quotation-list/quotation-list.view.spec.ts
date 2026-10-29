import {
  NO_DATA,
  quotationDate,
  quotationPrice,
  quotationStatusLabel,
} from './quotation-list.view';

describe('quotation-list.view (H15)', () => {
  it('precio en bolivianos: «300,00 Bs», venga como cadena o como número', () => {
    expect(quotationPrice('300', 'BOB')).toBe('300,00 Bs');
    expect(quotationPrice(300, 'BOB')).toBe('300,00 Bs');
    expect(quotationPrice('1500.5', 'BOB')).toBe('1.500,50 Bs');
  });

  it('otra moneda: el número y su código', () => {
    expect(quotationPrice('300', 'USD')).toBe('300,00 USD');
  });

  it('sin moneda resuelta: el número solo, sin inventarla', () => {
    expect(quotationPrice('300', undefined)).toBe('300,00');
    expect(quotationPrice('300', '')).toBe('300,00');
  });

  describe('fechas sin correrse un día', () => {
    const tz = process.env['TZ'];
    afterEach(() => {
      process.env['TZ'] = tz;
    });

    for (const zone of ['America/La_Paz', 'UTC']) {
      it(`'2026-11-10' → «10/11/2026» con el reloj en ${zone}`, () => {
        process.env['TZ'] = zone;
        expect(quotationDate('2026-11-10')).toBe('10/11/2026');
        expect(quotationDate('2026-11-30')).toBe('30/11/2026');
      });
    }
  });

  it('una fecha vacía o ilegible dice «Sin dato»', () => {
    expect(quotationDate('')).toBe(NO_DATA);
    expect(quotationDate(undefined)).toBe(NO_DATA);
    expect(quotationDate('mañana')).toBe(NO_DATA);
  });

  describe('estado', () => {
    it('ACTIVE, que terminología da en inglés, se nombra en castellano', () => {
      expect(quotationStatusLabel('ACTIVE', 'Active')).toBe('Vigente');
      expect(quotationStatusLabel('state:active', 'Active')).toBe('Vigente');
    });

    it('un código que no conoce usa la etiqueta de terminología, tal cual', () => {
      expect(quotationStatusLabel('ACCEPTED_BY_PATIENT', 'Aceptada por el paciente')).toBe(
        'Aceptada por el paciente',
      );
    });

    it('sin código ni etiqueta: «Sin dato», nunca vacío', () => {
      expect(quotationStatusLabel(undefined, undefined)).toBe(NO_DATA);
      expect(quotationStatusLabel('', '  ')).toBe(NO_DATA);
    });
  });
});

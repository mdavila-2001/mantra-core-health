import { opcEntero, opcFecha, opcTexto } from './optional-fields';

describe('optional-fields', () => {
  it('accepts the number an `app-input type="number"` hands the form', () => {
    expect(opcEntero('minNoticeMinutes', 60)).toEqual({ minNoticeMinutes: 60 });
    expect(opcEntero('capacity', 0)).toEqual({ capacity: 0 });
    expect(opcTexto('practiceId', 7)).toEqual({ practiceId: '7' });
  });

  it('omits empty values, including a cleared number input (null)', () => {
    expect(opcEntero('maxAdvanceDays', null)).toEqual({});
    expect(opcEntero('maxAdvanceDays', '  ')).toEqual({});
    expect(opcTexto('timeZone', undefined)).toEqual({});
    expect(opcFecha('validTo', null)).toEqual({});
  });

  it('keeps reading text as before', () => {
    expect(opcEntero('capacity', ' 3 ')).toEqual({ capacity: 3 });
    expect(opcTexto('timeZone', ' America/La_Paz ')).toEqual({ timeZone: 'America/La_Paz' });
  });
});

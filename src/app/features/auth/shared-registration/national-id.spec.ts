import { FormControl } from '@angular/forms';

import {
  INVALID_NATIONAL_ID_MESSAGE,
  nationalIdError,
  validateBolivianNationalId,
} from './national-id';

describe('nationalIdError', () => {
  it('acepta de cinco a nueve dígitos', () => {
    for (const id of ['12345', '123456', '1234567', '12345678', '123456789', '4455667']) {
      expect(nationalIdError(id), id).toBeNull();
    }
  });

  it('rechaza lo que no son sólo dígitos, sin corregirlo en silencio', () => {
    for (const id of ['QA-123', 'H1-', '1.234.567', '1234567 ', ' 1234567', '1234567LP', 'abc']) {
      expect(nationalIdError(id), id).toBe('characters');
    }
  });

  it('rechaza lo demasiado corto o largo', () => {
    expect(nationalIdError('1234')).toBe('length');
    expect(nationalIdError('1')).toBe('length');
    expect(nationalIdError('1234567890')).toBe('length');
  });

  it('rechaza un solo dígito repetido, que es un relleno y no una cédula', () => {
    for (const id of ['00000', '0000000', '1111111', '999999999']) {
      expect(nationalIdError(id), id).toBe('repeated');
    }
  });
});

describe('validateBolivianNationalId', () => {
  it('deja el vacío a Validators.required', () => {
    expect(validateBolivianNationalId(new FormControl(''))).toBeNull();
  });

  it('informa el motivo en el error `nationalId`', () => {
    expect(validateBolivianNationalId(new FormControl('12'))).toEqual({ nationalId: 'length' });
    expect(validateBolivianNationalId(new FormControl('ABC123'))).toEqual({
      nationalId: 'characters',
    });
  });

  it('ignora los espacios de los extremos, que el envío también recorta', () => {
    expect(validateBolivianNationalId(new FormControl(' 1234567 '))).toBeNull();
  });

  it('trae un mensaje que dice qué se espera', () => {
    expect(INVALID_NATIONAL_ID_MESSAGE).toContain('5 a 9 dígitos');
  });
});

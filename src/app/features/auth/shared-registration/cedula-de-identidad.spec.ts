import { FormControl } from '@angular/forms';

import {
  errorDeCedula,
  MENSAJE_CEDULA_INVALIDA,
  validarCedulaBoliviana,
} from './cedula-de-identidad';

describe('errorDeCedula', () => {
  it('acepta de cinco a nueve dígitos', () => {
    for (const cedula of ['12345', '123456', '1234567', '12345678', '123456789', '4455667']) {
      expect(errorDeCedula(cedula), cedula).toBeNull();
    }
  });

  it('rechaza lo que no son sólo dígitos, sin corregirlo en silencio', () => {
    for (const cedula of ['QA-123', 'H1-', '1.234.567', '1234567 ', ' 1234567', '1234567LP', 'abc']) {
      expect(errorDeCedula(cedula), cedula).toBe('caracteres');
    }
  });

  it('rechaza lo demasiado corto o largo', () => {
    expect(errorDeCedula('1234')).toBe('longitud');
    expect(errorDeCedula('1')).toBe('longitud');
    expect(errorDeCedula('1234567890')).toBe('longitud');
  });

  it('rechaza un solo dígito repetido, que es un relleno y no una cédula', () => {
    for (const cedula of ['00000', '0000000', '1111111', '999999999']) {
      expect(errorDeCedula(cedula), cedula).toBe('repetida');
    }
  });
});

describe('validarCedulaBoliviana', () => {
  it('deja el vacío a Validators.required', () => {
    expect(validarCedulaBoliviana(new FormControl(''))).toBeNull();
  });

  it('informa el motivo en el error `cedula`', () => {
    expect(validarCedulaBoliviana(new FormControl('12'))).toEqual({ cedula: 'longitud' });
    expect(validarCedulaBoliviana(new FormControl('ABC123'))).toEqual({ cedula: 'caracteres' });
  });

  it('ignora los espacios de los extremos al validar un valor ya escrito', () => {
    expect(validarCedulaBoliviana(new FormControl(' 1234567 '))).toBeNull();
  });

  it('trae un mensaje que dice qué se espera', () => {
    expect(MENSAJE_CEDULA_INVALIDA).toContain('5 a 9 dígitos');
  });
});

import { FormControl } from '@angular/forms';

import { largoRecortado, noSoloEspacios } from './trimmed-text';

const con = (valor: string | null) => new FormControl(valor);

describe('noSoloEspacios', () => {
  it('un valor de solo espacios es un dato que falta', () => {
    expect(noSoloEspacios(con('   '))).toEqual({ required: true });
    expect(noSoloEspacios(con('\t \n'))).toEqual({ required: true });
  });

  it('el vacío de verdad y lo que tiene letras no son asunto suyo', () => {
    expect(noSoloEspacios(con(''))).toBeNull();
    expect(noSoloEspacios(con(null))).toBeNull();
    expect(noSoloEspacios(con(' Ana '))).toBeNull();
  });
});

describe('largoRecortado', () => {
  const validar = largoRecortado(3, 5);

  it('solo espacios es «falta», aunque tenga el largo mínimo', () => {
    expect(validar(con('     '))).toEqual({ required: true });
  });

  it('mide después de recortar', () => {
    expect(validar(con('  ab  '))).toEqual({ minlength: { requiredLength: 3, actualLength: 2 } });
    expect(validar(con('  abcdef  '))).toEqual({ maxlength: { requiredLength: 5, actualLength: 6 } });
    expect(validar(con('  abc  '))).toBeNull();
    expect(validar(con('abcde'))).toBeNull();
  });

  it('el vacío de verdad se lo deja a `required`', () => {
    expect(validar(con(''))).toBeNull();
  });
});

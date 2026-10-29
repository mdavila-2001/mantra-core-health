import { FormControl } from '@angular/forms';

import { nitValido, registroDeEstablecimientoValido } from './medical-center-rules';

const con = (valor: string | null) => new FormControl(valor);

describe('nitValido', () => {
  it('«   » es un NIT que falta, no uno que pasa', () => {
    expect(nitValido(con('   '))).toEqual({ required: true });
    expect(nitValido(con('\t'))).toEqual({ required: true });
  });

  it('vacío de verdad es asunto de `required`; un NIT con la forma de la API pasa, recortado', () => {
    expect(nitValido(con(''))).toBeNull();
    expect(nitValido(con(null))).toBeNull();
    expect(nitValido(con(' 1023456789 '))).toBeNull();
    expect(nitValido(con('abc'))).toEqual({ pattern: true });
  });
});

describe('registroDeEstablecimientoValido', () => {
  it('«   » es un número de registro que falta, no uno que pasa', () => {
    expect(registroDeEstablecimientoValido(con('   '))).toEqual({ required: true });
  });

  it('mide recortado y con la forma de la API', () => {
    expect(registroDeEstablecimientoValido(con(''))).toBeNull();
    expect(registroDeEstablecimientoValido(con('  SEDES-1  '))).toBeNull();
    expect(registroDeEstablecimientoValido(con(' ab '))).toEqual({
      minlength: { requiredLength: 3, actualLength: 2 },
    });
    expect(registroDeEstablecimientoValido(con('SEDES SC'))).toEqual({ pattern: true });
  });
});

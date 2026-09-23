import { FormControl } from '@angular/forms';

import {
  MENSAJE_CONTRASENA_CORTA,
  MIN_CARACTERES_CONTRASENA,
  validadoresDeContrasena,
} from './politica-de-contrasena';

function control(valor: string): FormControl<string> {
  return new FormControl(valor, {
    nonNullable: true,
    validators: [...validadoresDeContrasena],
  });
}

describe('política de contraseña del alta', () => {
  it('exige los ocho caracteres que pide la API', () => {
    expect(MIN_CARACTERES_CONTRASENA).toBe(8);
  });

  it('rechaza una contraseña vacía por obligatoria', () => {
    expect(control('').errors).toEqual({ required: true });
  });

  it('rechaza una contraseña de siete caracteres', () => {
    expect(control('secreto').hasError('minlength')).toBe(true);
  });

  it('acepta una contraseña de exactamente ocho', () => {
    expect(control('secreto1').valid).toBe(true);
  });

  it('dice lo mismo que decían las altas por separado', () => {
    expect(MENSAJE_CONTRASENA_CORTA).toBe('La contraseña necesita al menos 8 caracteres.');
  });
});

import { FormControl } from '@angular/forms';

import { mensajeDeError } from './mensaje-de-error';
import { validadorDeSeleccion } from './validadores-de-seleccion';

/**
 * Los topes de un campo de varias respuestas, y cómo se dicen.
 *
 * Se prueban juntos el validador y su traducción porque son las dos mitades
 * de la misma promesa: un tope que se cumple pero se anuncia mal —«al menos
 * 2» cuando era «exactamente 2»— es un formulario que miente sobre lo que
 * pide.
 */
describe('validadorDeSeleccion', () => {
  function control(valor: unknown, minimo?: number, maximo?: number): FormControl {
    const c = new FormControl(valor, validadorDeSeleccion(minimo, maximo));
    c.markAsTouched();
    return c;
  }

  const CAMPO = { label: 'Factores de riesgo' };

  it('vacío no falla: si es obligatorio lo dice `required`, y si no, no marcar nada vale', () => {
    // Contar un array vacío como «menos de dos» haría obligatorio a un campo
    // que no lo es.
    expect(control([], 2).errors).toBeNull();
    expect(control('', 2).errors).toBeNull();
  });

  it('«al menos N» falla por debajo y se dice así', () => {
    const c = control(['a'], 2);
    expect(c.errors).toEqual({ minSelections: { min: 2, actual: 1 } });
    expect(mensajeDeError(c, CAMPO)).toBe('Marcá al menos 2 opciones.');
    expect(control(['a', 'b'], 2).errors).toBeNull();
  });

  it('«como máximo N» falla por encima y se dice así', () => {
    const c = control(['a', 'b', 'c'], undefined, 2);
    expect(c.errors).toEqual({ maxSelections: { max: 2, actual: 3 } });
    expect(mensajeDeError(c, CAMPO)).toBe('Marcá como máximo 2 opciones.');
    expect(control(['a', 'b'], undefined, 2).errors).toBeNull();
  });

  it('«exactamente N» no es la suma de los otros dos: tiene su propio mensaje', () => {
    const c = control(['a'], 2, 2);
    expect(c.errors).toEqual({ exactSelections: { required: 2, actual: 1 } });
    expect(mensajeDeError(c, CAMPO)).toBe('Marcá exactamente 2 opciones.');
    expect(control(['a', 'b', 'c'], 2, 2).errors).toEqual({
      exactSelections: { required: 2, actual: 3 },
    });
    expect(control(['a', 'b'], 2, 2).errors).toBeNull();
  });

  it('con uno solo el mensaje va en singular', () => {
    expect(mensajeDeError(control(['a', 'b'], undefined, 1), CAMPO)).toBe(
      'Marcá como máximo 1 opción.',
    );
  });
});

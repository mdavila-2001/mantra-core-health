import { FormControl } from '@angular/forms';

import { mensajeDeError } from './mensaje-de-error';
import { validadorDeCuadricula, validadorDeSeleccion } from './validadores-de-seleccion';

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

/**
 * Las dos restricciones de una cuadrícula, y cómo se dicen.
 *
 * Mismo criterio que arriba: el validador y su traducción se prueban juntos
 * porque son las dos mitades de la misma promesa. Una cuadrícula en rojo que
 * no dice qué fila falta manda a contarlas a ojo.
 */
describe('validadorDeCuadricula', () => {
  const FILAS = ['tos', 'fiebre', 'dolor'];
  const CAMPO = { label: 'Síntomas' };

  function control(
    valor: unknown,
    opciones: { requerirCadaFila?: boolean; unaPorColumna?: boolean } = {},
  ) {
    const c = new FormControl(
      valor,
      validadorDeCuadricula(FILAS, {
        requerirCadaFila: opciones.requerirCadaFila ?? false,
        unaPorColumna: opciones.unaPorColumna ?? false,
      }),
    );
    c.markAsTouched();
    return c;
  }

  it('sin restricciones no falla nunca, aunque no se conteste nada', () => {
    expect(control({}).errors).toBeNull();
  });

  it('«cada fila» cuenta las que faltan, y lo dice', () => {
    // No es lo mismo que `required`: una cuadrícula obligatoria con una sola
    // fila contestada ya cumple el obligatorio, y con esto no.
    const c = control({ tos: 'nunca' }, { requerirCadaFila: true });
    expect(c.errors).toEqual({ gridRowMissing: { missing: 2, total: 3 } });
    expect(mensajeDeError(c, CAMPO)).toBe('Faltan responder 2 filas.');
  });

  it('con una sola fila pendiente el mensaje va en singular', () => {
    const c = control({ tos: 'nunca', fiebre: 'a-veces' }, { requerirCadaFila: true });
    expect(mensajeDeError(c, CAMPO)).toBe('Falta responder una fila.');
  });

  it('con todas contestadas no falla, en las dos formas de guardar', () => {
    expect(
      control({ tos: 'a', fiebre: 'b', dolor: 'c' }, { requerirCadaFila: true }).errors,
    ).toBeNull();
    expect(
      control(
        { tos: ['a'], fiebre: ['b', 'c'], dolor: ['a'] },
        { requerirCadaFila: true },
      ).errors,
    ).toBeNull();
  });

  it('«una por columna» detecta la repetida y la nombra', () => {
    const c = control({ tos: 'nunca', fiebre: 'nunca' }, { unaPorColumna: true });
    expect(c.errors).toEqual({ gridColumnRepeated: { column: 'nunca' } });
    expect(mensajeDeError(c, CAMPO)).toBe(
      '«nunca» ya está elegida en otra fila: sólo se puede una vez por columna.',
    );
  });

  it('la columna repetida se dice antes que las filas que faltan', () => {
    // Las dos fallan a la vez, y gana la que la persona acaba de provocar.
    const c = control({ tos: 'nunca', fiebre: 'nunca' }, {
      unaPorColumna: true,
      requerirCadaFila: true,
    });
    expect(c.errors).toEqual({ gridColumnRepeated: { column: 'nunca' } });
  });

  it('tolera el valor con el que nace un control sin valor inicial', () => {
    // `''` es lo que deja un `FormControl` recién creado. Sin esto, la
    // cuadrícula obligatoria fallaría leyendo propiedades de una cadena.
    expect(control('', { requerirCadaFila: true }).errors).toEqual({
      gridRowMissing: { missing: 3, total: 3 },
    });
    expect(control(null, { unaPorColumna: true }).errors).toBeNull();
  });
});

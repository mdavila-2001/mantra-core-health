import { errorMessageOf, NOT_FOUND_MESSAGE } from './form-support';

describe('errorMessageOf', () => {
  it('S6: un 404 tiene mensaje propio, no `null`', () => {
    // Con `null` el formulario quedaba mudo: el botón volvía a habilitarse y
    // nadie decía que el registro al que apuntaba ya no estaba.
    expect(errorMessageOf({ status: 'not-found' }, 'prohibido')).toBe(NOT_FOUND_MESSAGE);
  });

  it('la pantalla puede decir qué es lo que no se encontró', () => {
    expect(errorMessageOf({ status: 'not-found' }, 'prohibido', 'No está la sede.')).toBe(
      'No está la sede.',
    );
  });

  it('S9 lleva el requestId y S5 cae en el texto de la pantalla', () => {
    expect(errorMessageOf({ status: 'error', requestId: 'req-1' }, 'prohibido')).toContain('req-1');
    expect(errorMessageOf({ status: 'forbidden' }, 'prohibido')).toBe('prohibido');
  });

  it('los estados sin fallo no producen mensaje', () => {
    expect(errorMessageOf({ status: 'loading' }, 'prohibido')).toBeNull();
    expect(errorMessageOf({ status: 'ready', data: null }, 'prohibido')).toBeNull();
  });
});

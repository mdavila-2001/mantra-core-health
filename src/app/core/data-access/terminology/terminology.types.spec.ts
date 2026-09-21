import { valorDeTexto } from './terminology.types';

/**
 * H4 (C-20, reparto de Ender 2026-09-20): la frecuencia por defecto de un
 * medicamento se lee con la misma defensividad que {@link listaDeTextos} —
 * `properties` es `value_json` libre, y una forma inesperada no puede tirar
 * la pantalla.
 */
describe('valorDeTexto', () => {
  it('devuelve el texto cuando la propiedad es un string no vacío', () => {
    expect(valorDeTexto({ default_frequency: 'Cada 8 horas' }, 'default_frequency')).toBe('Cada 8 horas');
  });

  it('recorta espacios sobrantes', () => {
    expect(valorDeTexto({ default_frequency: '  Cada 8 horas  ' }, 'default_frequency')).toBe('Cada 8 horas');
  });

  it('devuelve undefined si la propiedad no existe (medicamento sin frecuencia declarada)', () => {
    expect(valorDeTexto({}, 'default_frequency')).toBeUndefined();
    expect(valorDeTexto(undefined, 'default_frequency')).toBeUndefined();
  });

  it('devuelve undefined si el valor está mal formado (no es texto)', () => {
    expect(valorDeTexto({ default_frequency: 42 }, 'default_frequency')).toBeUndefined();
    expect(valorDeTexto({ default_frequency: ['Cada 8 horas'] }, 'default_frequency')).toBeUndefined();
    expect(valorDeTexto({ default_frequency: null }, 'default_frequency')).toBeUndefined();
  });

  it('devuelve undefined si el texto es sólo espacios', () => {
    expect(valorDeTexto({ default_frequency: '   ' }, 'default_frequency')).toBeUndefined();
  });
});

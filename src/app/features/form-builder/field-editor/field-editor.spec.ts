import {
  aDataType,
  aTipoDeCampo,
  esDeEleccion,
  etiquetaDeTipo,
  reglaDe,
  TIPOS_DE_DATO,
  topesDe,
} from './field-editor';

/**
 * La traducción entre el tipo que se elige en pantalla y el que viaja.
 *
 * Se prueban las **funciones** y no la tarjeta dibujada: lo que puede fallar
 * acá es la traducción —«Opción múltiple» y «Casillas» son el mismo `code` con
 * distinta cardinalidad, y el vocabulario del seed clínico (`NUMBER`, `TEXT`)
 * no es el del contrato—, no que Angular pinte un `<select>`.
 *
 * El fallo, además, es mudo en el peor sentido: un campo de elección que se
 * traduce mal vuelve del servidor como texto corto, y las opciones que el
 * doctor escribió desaparecen sin un solo error en consola.
 */
describe('los tipos del generador de formularios', () => {
  it('manda los dos de elección como `code`, que es el tipo que el backend conoce', () => {
    // No hay un tipo técnico «opción múltiple»: lo que se guarda es uno de los
    // códigos ofrecidos. Inventar un tipo dejaría campos que el backend
    // rechaza al completarse.
    expect(aDataType('choice')).toBe('code');
    expect(aDataType('checkboxes')).toBe('code');
  });

  it('los demás viajan tal como se eligen', () => {
    expect(aDataType('string')).toBe('string');
    expect(aDataType('integer')).toBe('integer');
    expect(aDataType('date')).toBe('date');
  });

  it('distingue una sola respuesta de varias por la cardinalidad, no por el tipo', () => {
    // Los dos llegan como `code`; si no se mirara `multiple`, «Casillas de
    // verificación» volvería del servidor convertido en «Opción múltiple» y
    // dejaría de poder marcarse más de una.
    expect(aTipoDeCampo('code', false)).toBe('choice');
    expect(aTipoDeCampo('code', true)).toBe('checkboxes');
  });

  it('la vuelta desde el servidor conserva el tipo elegido', () => {
    // La ida y la vuelta tienen que cerrar: si no, abrir un formulario ya
    // guardado mostraría en el desplegable algo distinto de lo que se eligió.
    for (const { value } of TIPOS_DE_DATO) {
      expect(aTipoDeCampo(aDataType(value), value === 'checkboxes')).toBe(value);
    }
  });

  it('traduce el vocabulario del seed clínico, que no es el del contrato', () => {
    // Los campos del estándar vienen con `NUMBER`/`TEXT`; sin esto caerían
    // todos en «Texto corto» y la tarjeta mentiría sobre lo que se responde.
    expect(aTipoDeCampo('NUMBER')).toBe('integer');
    expect(aTipoDeCampo('TEXT')).toBe('text');
    expect(aTipoDeCampo('BOOLEAN')).toBe('boolean');
  });

  it('un tipo que el generador no ofrece cae en texto corto y no rompe', () => {
    // `json`, `binary` y `reference` existen en el contrato y esta pantalla no
    // los ofrece: un campo del estándar que los traiga se sigue dibujando.
    expect(aTipoDeCampo('json')).toBe('string');
    expect(aTipoDeCampo('binary')).toBe('string');
  });

  it('sólo los de elección piden una lista de respuestas', () => {
    expect(esDeEleccion('choice')).toBe(true);
    expect(esDeEleccion('checkboxes')).toBe(true);
    expect(esDeEleccion('string')).toBe(false);
    expect(esDeEleccion('boolean')).toBe(false);
  });

  it('el rótulo de un campo del estándar nombra el tipo que de verdad es', () => {
    // Es lo único que dice de qué se responde en una tarjeta que no se puede
    // abrir: si dijera «Texto» sobre una lista cerrada, sería falso.
    expect(etiquetaDeTipo('code', false)).toBe('Opción múltiple');
    expect(etiquetaDeTipo('code', true)).toBe('Casillas de verificación');
    expect(etiquetaDeTipo('NUMBER')).toBe('Número');
    expect(etiquetaDeTipo('string')).toBe('Respuesta corta');
    expect(etiquetaDeTipo('lo-que-sea')).toBe('Texto');
  });

  it('el desplegable ofrece los dos de elección, que es lo que faltaba', () => {
    // Sin ellos el generador sólo sabía pedir texto y números, que es justo lo
    // que un formulario clínico menos usa.
    const etiquetas = TIPOS_DE_DATO.map((o) => o.label);
    expect(etiquetas).toContain('Opción múltiple');
    expect(etiquetas).toContain('Casillas de verificación');
  });
});

/**
 * La «validación de respuesta» de las casillas: al menos, como máximo,
 * exactamente. En pantalla es una regla y un número; en el contrato son dos
 * topes. La ida y la vuelta tienen que cerrar, o un campo guardado con
 * «exactamente 2» se abriría diciendo «al menos 2» con un máximo escondido.
 */
describe('los topes de respuestas de un campo de varias', () => {
  it('«exactamente» son los dos topes iguales', () => {
    expect(topesDe('exacto', 2)).toEqual({ cardinalityMin: 2, cardinalityMax: 2 });
    expect(reglaDe(2, 2)).toEqual({ regla: 'exacto', cantidad: 2 });
  });

  it('«al menos» y «como máximo» ponen uno y QUITAN el otro', () => {
    // `null` y no `undefined`: «no viene» es «no cambió», y cambiar de
    // «exactamente 2» a «al menos 2» tiene que sacar el máximo que había.
    expect(topesDe('minimo', 3)).toEqual({ cardinalityMin: 3, cardinalityMax: null });
    expect(topesDe('maximo', 3)).toEqual({ cardinalityMin: null, cardinalityMax: 3 });
    expect(reglaDe(3, undefined)).toEqual({ regla: 'minimo', cantidad: 3 });
    expect(reglaDe(undefined, 3)).toEqual({ regla: 'maximo', cantidad: 3 });
  });

  it('sin regla se quitan los dos, y un campo sin topes abre sin regla', () => {
    expect(topesDe('ninguna', 5)).toEqual({ cardinalityMin: null, cardinalityMax: null });
    expect(reglaDe(undefined, undefined)).toEqual({ regla: 'ninguna', cantidad: 1 });
  });

  it('la vuelta conserva la regla elegida', () => {
    for (const regla of ['minimo', 'maximo', 'exacto'] as const) {
      const { cardinalityMin, cardinalityMax } = topesDe(regla, 4);
      expect(reglaDe(cardinalityMin ?? undefined, cardinalityMax ?? undefined)).toEqual({
        regla,
        cantidad: 4,
      });
    }
  });
});

import {
  forbidden,
  loading,
  notFound,
  offline,
  ready,
  stale,
  unexpectedError,
  validation,
} from '../../core/view-state/view-state';

import { mensajeDeEscritura, mensajeDeFalloDeEscritura } from './mensaje-de-escritura';

/**
 * La cola de fallos que comparten los ocho puntos de escritura del expediente.
 *
 * Vale la pena fijarla acá y no sólo desde cada bloque: el defecto que la hizo
 * existir —`offline` sin mensaje en `allergy-block`— era invisible desde
 * arriba, porque el formulario se desbloqueaba igual y la única señal era la
 * ausencia de un aviso. Una prueba sobre la función lo vuelve imposible de
 * repetir en el noveno bloque que se escriba.
 */
describe('mensajeDeFalloDeEscritura', () => {
  const textos = { accion: 'registrar la alergia' };

  /**
   * Era el agujero: la petición que nunca llegó no caía en ninguna rama y la
   * pantalla se quedaba muda. No falló el servidor, así que reintentar sirve y
   * el mensaje lo dice.
   */
  it('la petición que no llega se cuenta', () => {
    expect(mensajeDeFalloDeEscritura(offline(), textos)).toBe(
      'No pudimos conectarnos. Revisá tu conexión y reintentá.',
    );
  });

  it('el 403 con mensaje del servidor usa el del servidor', () => {
    expect(mensajeDeFalloDeEscritura(forbidden({ message: 'Falta el alcance clinical:write' }), textos)).toBe(
      'Falta el alcance clinical:write',
    );
  });

  /**
   * `message: ''` es lo que manda el backend cuando el 403 no trae detalle. Con
   * `??` en vez de `||`, el aviso salía **en blanco**: un recuadro rojo vacío no
   * es un mensaje, es un susto. Lo encontró la prueba del bloque de alergias.
   */
  it('el 403 sin detalle cae al texto del bloque, no a un aviso vacío', () => {
    expect(mensajeDeFalloDeEscritura(forbidden({ message: '' }), textos)).toBe(
      'Tu rol no permite registrar la alergia.',
    );
    expect(
      mensajeDeFalloDeEscritura(forbidden({ message: '' }), {
        ...textos,
        sinPermiso: 'Tu rol no permite registrar alergias.',
      }),
    ).toBe('Tu rol no permite registrar alergias.');
  });

  /** S6 no confirma que el recurso exista: ni su nombre ni su dueño. */
  it('el 404 no filtra nada del recurso', () => {
    expect(mensajeDeFalloDeEscritura(notFound(), textos)).toBe(
      'El expediente ya no existe. Recargá la pantalla.',
    );
    expect(mensajeDeFalloDeEscritura(notFound(), { ...textos, yaNoExiste: 'La receta ya no existe.' })).toBe(
      'La receta ya no existe.',
    );
  });

  /**
   * S9 exige el identificador de petición: sin él, quien reporta el problema y
   * quien lo busca en los registros no tienen cómo encontrarse.
   */
  it('el fallo inesperado lleva su identificador de petición', () => {
    expect(mensajeDeFalloDeEscritura(unexpectedError('req-42', 'Se cayó el índice'), textos)).toBe(
      'Se cayó el índice (req-42)',
    );
    expect(mensajeDeFalloDeEscritura(unexpectedError('req-42', ''), textos)).toBe(
      'Ocurrió un error inesperado. (req-42)',
    );
  });

  /**
   * La validación se queda en el bloque: es lo único que **no** es igual entre
   * ellos —el duplicado del diagnóstico, la firma que le falta a la receta—.
   */
  it('la validación no la resuelve la cola', () => {
    expect(
      mensajeDeFalloDeEscritura(validation([{ code: 'VALIDATION', message: 'Falta el código' }]), textos),
    ).toBeNull();
  });

  /** Lo que no es un fallo no inventa un mensaje de fallo. */
  it('los estados que no son fallo devuelven null', () => {
    expect(mensajeDeFalloDeEscritura(ready(null), textos)).toBeNull();
    expect(mensajeDeFalloDeEscritura(loading(), textos)).toBeNull();
    expect(mensajeDeFalloDeEscritura(stale(null, new Date()), textos)).toBeNull();
  });
});

describe('mensajeDeEscritura', () => {
  const textos = { accion: 'registrar la observación' };

  /**
   * El primero y no todos: los demás son del mismo envío y se corrigen igual, y
   * una lista dentro de un aviso se lee como un bloque de texto que se saltea.
   */
  it('de la validación cuenta el primer problema', () => {
    expect(
      mensajeDeEscritura(
        validation([
          { code: 'VALIDATION', message: 'Falta el código' },
          { code: 'VALIDATION', message: 'Falta la unidad' },
        ]),
        textos,
      ),
    ).toBe('Falta el código');
  });

  /** Una validación sin problemas legibles no deja el aviso en blanco. */
  it('la validación sin detalle cae al genérico', () => {
    expect(mensajeDeEscritura(validation([]), textos)).toBe('No pudimos registrar la observación.');
  });

  it('el resto de los fallos los resuelve la cola compartida', () => {
    expect(mensajeDeEscritura(offline(), textos)).toBe(
      'No pudimos conectarnos. Revisá tu conexión y reintentá.',
    );
    expect(mensajeDeEscritura(ready(null), textos)).toBeNull();
  });
});

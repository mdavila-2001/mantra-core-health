import { CURSOR_ANTERIOR, historialDeCursor } from './cursor-history';

/**
 * La regla que cuatro listados escribían a mano, fijada una vez: la API solo
 * entrega `nextCursor`, y el camino de vuelta lo recuerda el historial.
 */
describe('historialDeCursor', () => {
  it('arranca en la primera página: sin cursor que mandar y sin «Anterior»', () => {
    const paginado = historialDeCursor();

    expect(paginado.actual()).toBeUndefined();
    expect(paginado.cursor()).toEqual({ prevCursor: null, nextCursor: null });
  });

  it('cuando llega la página, ofrece «Siguiente» con el cursor que devolvió la API', () => {
    const paginado = historialDeCursor();

    paginado.llego('cur-2');

    expect(paginado.cursor().nextCursor).toBe('cur-2');
    // Todavía no se avanzó: no hay adónde volver.
    expect(paginado.cursor().prevCursor).toBeNull();
  });

  it('avanzar recuerda el cursor y lo manda en la siguiente petición', () => {
    const paginado = historialDeCursor();
    paginado.llego('cur-2');

    paginado.mover('cur-2');

    expect(paginado.actual()).toBe('cur-2');
    expect(paginado.cursor().prevCursor).toBe(CURSOR_ANTERIOR);
  });

  it('volver reusa el cursor visitado, no uno inventado', () => {
    const paginado = historialDeCursor();
    paginado.llego('cur-2');
    paginado.mover('cur-2');
    paginado.llego('cur-3');
    paginado.mover('cur-3');

    paginado.mover(CURSOR_ANTERIOR);
    expect(paginado.actual()).toBe('cur-2');

    paginado.mover(CURSOR_ANTERIOR);
    expect(paginado.actual()).toBeUndefined();
    expect(paginado.cursor().prevCursor).toBeNull();
  });

  it('volver desde la primera página no rompe el historial', () => {
    const paginado = historialDeCursor();

    paginado.mover(CURSOR_ANTERIOR);

    expect(paginado.actual()).toBeUndefined();
    expect(paginado.cursor().prevCursor).toBeNull();
  });

  it('un fallo al cargar apaga «Siguiente» pero no pierde la página en la que quedó', () => {
    const paginado = historialDeCursor();
    paginado.llego('cur-2');
    paginado.mover('cur-2');

    paginado.llego(null);

    // Reintentar (S8/S9) repite esta página, no la primera.
    expect(paginado.actual()).toBe('cur-2');
    expect(paginado.cursor()).toEqual({ prevCursor: CURSOR_ANTERIOR, nextCursor: null });
  });

  it('otro filtro es otra lista: reiniciar vuelve al principio y olvida el camino', () => {
    const paginado = historialDeCursor();
    paginado.llego('cur-2');
    paginado.mover('cur-2');

    paginado.reiniciar();

    expect(paginado.actual()).toBeUndefined();
    expect(paginado.cursor()).toEqual({ prevCursor: null, nextCursor: null });
  });

  it('`cursor` es una señal: la tabla se entera sin que nadie la avise', () => {
    const paginado = historialDeCursor();
    const antes = paginado.cursor();

    paginado.llego('cur-2');

    expect(paginado.cursor()).not.toBe(antes);
    expect(paginado.cursor().nextCursor).toBe('cur-2');
  });
});

import { PaginadorDeCursor } from './catalog-editor-pager';

describe('PaginadorDeCursor', () => {
  it('en la primera página no hay «anterior» y «siguiente» es el cursor recibido', () => {
    const p = new PaginadorDeCursor();
    p.recibir('c2');
    expect(p.cursor().prevCursor).toBeNull();
    expect(p.cursor().nextCursor).toBe('c2');
  });

  it('avanza y vuelve por la pila de cursores hasta la primera página', () => {
    const p = new PaginadorDeCursor();
    p.recibir('c2');
    expect(p.mover('c2')).toBe('c2');
    p.recibir('c3');
    expect(p.mover('c3')).toBe('c3');
    p.recibir(null);
    expect(p.cursor().nextCursor).toBeNull();
    const previa = p.cursor().prevCursor!;
    expect(p.mover(previa)).toBe('c2');
    p.recibir('c3');
    const primera = p.cursor().prevCursor!;
    expect(p.mover(primera)).toBeUndefined();
    expect(p.actual()).toBeUndefined();
    expect(p.cursor().prevCursor).toBeNull();
  });

  it('reiniciar vuelve a la primera página y olvida la pila', () => {
    const p = new PaginadorDeCursor();
    p.recibir('c2');
    p.mover('c2');
    p.reiniciar();
    expect(p.actual()).toBeUndefined();
    expect(p.cursor()).toEqual({ prevCursor: null, nextCursor: null });
  });
});

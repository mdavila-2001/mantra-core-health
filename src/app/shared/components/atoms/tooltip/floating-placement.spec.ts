import { placeFloating, type Rect } from './floating-placement';

describe('posicionamiento flip + shift', () => {
  const bounds: Rect = { left: 0, top: 0, width: 1000, height: 600 };
  const card = { width: 300, height: 200 };
  const base = { gap: 8, margin: 8, bounds, shift: true } as const;

  it('prefiere arriba y centra la tarjeta sobre el ancla', () => {
    const anchor: Rect = { left: 450, top: 300, width: 100, height: 60 };
    const p = placeFloating(anchor, card, { ...base, preferred: 'top' });
    expect(p.side).toBe('top');
    expect(p.top).toBe(300 - 200 - 8);
    expect(p.left).toBe(500 - 150);
    expect(p.clipped).toBe(false);
  });

  it('en el borde norte voltea hacia abajo', () => {
    const anchor: Rect = { left: 450, top: 20, width: 100, height: 60 };
    const p = placeFloating(anchor, card, { ...base, preferred: 'top' });
    expect(p.side).toBe('bottom');
    expect(p.top).toBe(20 + 60 + 8);
  });

  it('en el borde oeste desplaza la tarjeta para no recortarla y la flecha sigue apuntando al ancla', () => {
    const anchor: Rect = { left: 10, top: 300, width: 40, height: 40 };
    const p = placeFloating(anchor, card, { ...base, preferred: 'top' });
    expect(p.left).toBeGreaterThanOrEqual(8);
    // el ancla está a 30 px del borde de la tarjeta
    expect(p.left + p.arrowOffset).toBeCloseTo(30, 0);
  });

  it('en el borde este no se sale por la derecha', () => {
    const anchor: Rect = { left: 960, top: 300, width: 30, height: 30 };
    const p = placeFloating(anchor, card, { ...base, preferred: 'top' });
    expect(p.left + card.width).toBeLessThanOrEqual(1000 - 8 + 0.01);
  });

  it('si ni arriba ni abajo entran, prueba a la derecha y luego a la izquierda', () => {
    const tall = { width: 200, height: 580 };
    const anchor: Rect = { left: 700, top: 250, width: 40, height: 40 };
    const p = placeFloating(anchor, tall, { ...base, preferred: 'top' });
    expect(p.side).toBe('right');
    const east: Rect = { left: 900, top: 250, width: 40, height: 40 };
    expect(placeFloating(east, tall, { ...base, preferred: 'top' }).side).toBe('left');
  });

  it('si no entra por ningún lado se queda con el lado de más espacio y marca el recorte', () => {
    const huge = { width: 2000, height: 1200 };
    const anchor: Rect = { left: 500, top: 300, width: 40, height: 40 };
    const p = placeFloating(anchor, huge, { ...base, preferred: 'top' });
    expect(p.clipped).toBe(true);
  });

  it('modo histórico del Tooltip: sin desplazar y, si el lado pedido no entra, el opuesto', () => {
    const anchor: Rect = { left: 10, top: 10, width: 40, height: 20 };
    const p = placeFloating(anchor, { width: 100, height: 40 }, { preferred: 'top', gap: 8, bounds: { left: 0, top: 0, width: 800, height: 600 }, legacy: true });
    expect(p.side).toBe('bottom');
    expect(p.left).toBe(10 + 20 - 50); // centrado aunque se salga: comportamiento previo
    expect(p.top).toBe(10 + 20 + 8);
  });
});

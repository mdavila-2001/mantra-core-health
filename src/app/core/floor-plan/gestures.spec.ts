import { GestureTracker, TAP_MAX_MOVE_PX, TAP_MAX_MS } from './gestures';

describe('gestos del lienzo', () => {
  it('un toque corto y quieto es un toque', () => {
    const g = new GestureTracker();
    g.down(1, 100, 100, 0);
    g.move(1, 103, 102);
    expect(g.up(1, 120).wasTap).toBe(true);
  });

  it('moverse más de 8 px lo vuelve arrastre', () => {
    const g = new GestureTracker();
    g.down(1, 100, 100, 0);
    const step = g.move(1, 100 + TAP_MAX_MOVE_PX + 5, 100);
    expect(step).toEqual({ kind: 'pan', dx: 13, dy: 0 });
    expect(g.moved).toBe(true);
    expect(g.up(1, 100).wasTap).toBe(false);
  });

  it('mantener apretado más de medio segundo no es un toque', () => {
    const g = new GestureTracker();
    g.down(1, 10, 10, 0);
    expect(g.up(1, TAP_MAX_MS + 1).wasTap).toBe(false);
  });

  it('dos dedos que se separan son un pellizco: el factor es la razón de distancias y el centro se conserva', () => {
    const g = new GestureTracker();
    g.down(1, 100, 100, 0);
    g.down(2, 200, 100, 0);
    expect(g.isPinching).toBe(true);
    const step = g.move(2, 300, 100)!;
    expect(step.kind).toBe('pinch');
    if (step.kind === 'pinch') {
      expect(step.factor).toBeCloseTo(2, 9);
      expect(step.center).toEqual({ x: 200, y: 100 });
      expect(step.dx).toBe(50);
    }
  });

  it('un pellizco nunca termina en toque, ni siquiera al soltar el último dedo sin moverlo', () => {
    const g = new GestureTracker();
    g.down(1, 100, 100, 0);
    g.down(2, 140, 100, 5);
    g.up(2, 10);
    expect(g.wasMultiTouch).toBe(true);
    expect(g.up(1, 12).wasTap).toBe(false);
  });

  it('al soltar un dedo el otro sigue arrastrando sin saltos', () => {
    const g = new GestureTracker();
    g.down(1, 0, 0, 0);
    g.down(2, 100, 0, 0);
    g.move(2, 120, 0);
    g.up(2, 50);
    expect(g.move(1, 5, 5)).toEqual({ kind: 'pan', dx: 5, dy: 5 });
  });

  it('un puntero desconocido se ignora y cancelar limpia todo', () => {
    const g = new GestureTracker();
    expect(g.move(9, 1, 1)).toBeNull();
    g.down(1, 0, 0, 0);
    g.cancel();
    expect(g.count).toBe(0);
    expect(g.up(1, 1).wasTap).toBe(false);
  });
});

import {
  MAX_SCALE,
  MIN_SCALE,
  clampViewport,
  ensureVisible,
  frameBBox,
  panBy,
  screenToWorld,
  viewBoxOf,
  visibleBBox,
  worldToScreen,
  zoomAt,
  zoomPercent,
  type Viewport,
} from './plan-viewport';

const SIZE = { width: 1000, height: 500 };

describe('vista del plano (zoom y desplazamiento)', () => {
  it('encuadra una caja con margen y la centra', () => {
    const view = frameBBox([0, 0, 64, 26], SIZE, 20);
    expect(view.cx).toBe(32);
    expect(view.cy).toBe(13);
    // el lado que limita es el ancho: (1000 - 40) / 64
    expect(view.scale).toBeCloseTo(15, 9);
    const [x0, , x1] = visibleBBox(view, SIZE);
    expect(x0).toBeLessThan(0);
    expect(x1).toBeGreaterThan(64);
  });

  it('el viewBox deriva de la vista y conserva la proporción del lienzo', () => {
    const view: Viewport = { cx: 32, cy: 13, scale: 10 };
    expect(viewBoxOf(view, SIZE)).toBe('-18 -12 100 50');
  });

  it('pantalla ↔ mundo es una ida y vuelta exacta', () => {
    const view: Viewport = { cx: 20, cy: 8, scale: 12 };
    const world = screenToWorld(view, SIZE, [333, 111]);
    const back = worldToScreen(view, SIZE, world);
    expect(back[0]).toBeCloseTo(333, 9);
    expect(back[1]).toBeCloseTo(111, 9);
  });

  it('el zoom deja fijo el punto del mundo que está bajo el cursor', () => {
    const view: Viewport = { cx: 32, cy: 13, scale: 10 };
    const cursor: [number, number] = [740, 120];
    const before = screenToWorld(view, SIZE, cursor);
    const zoomed = zoomAt(view, SIZE, 2.5, cursor);
    const after = screenToWorld(zoomed, SIZE, cursor);
    expect(zoomed.scale).toBeCloseTo(25, 9);
    expect(after[0]).toBeCloseTo(before[0], 9);
    expect(after[1]).toBeCloseTo(before[1], 9);
  });

  it('el zoom se acota a 5 % y 1 600 %', () => {
    const view: Viewport = { cx: 0, cy: 0, scale: 10 };
    expect(zoomAt(view, SIZE, 1e9, [500, 250]).scale).toBe(MAX_SCALE);
    expect(zoomAt(view, SIZE, 1e-9, [500, 250]).scale).toBe(MIN_SCALE);
    expect(zoomPercent(MAX_SCALE)).toBe(1600);
    expect(zoomPercent(MIN_SCALE)).toBe(5);
    expect(zoomPercent(10)).toBe(100);
  });

  it('desplazar 100 px a la derecha mueve el centro 100/escala metros a la izquierda', () => {
    expect(panBy({ cx: 10, cy: 10, scale: 20 }, 100, -40)).toEqual({ cx: 5, cy: 12, scale: 20 });
  });

  it('el acotado no deja perder el plano pero respeta lo que ya está a la vista', () => {
    const inside: Viewport = { cx: 30, cy: 10, scale: 10 };
    expect(clampViewport(inside, SIZE, [0, 0, 64, 26])).toBe(inside);
    const lost = clampViewport({ cx: 5000, cy: -900, scale: 10 }, SIZE, [0, 0, 64, 26]);
    expect(lost.cx).toBeLessThan(200);
    expect(lost.cy).toBeGreaterThan(-100);
  });

  it('mostrar una caja ya visible no mueve nada; una fuera de vista la trae con el mínimo desplazamiento', () => {
    const view: Viewport = { cx: 30, cy: 13, scale: 10 }; // ve x ∈ [-20, 80]
    expect(ensureVisible(view, SIZE, [10, 5, 14, 9], 0)).toBe(view);
    const moved = ensureVisible(view, SIZE, [90, 5, 94, 9], 10);
    const [, , x1] = visibleBBox(moved, SIZE);
    expect(x1).toBeCloseTo(94 + 1, 9);
    expect(moved.cy).toBe(view.cy);
  });
});

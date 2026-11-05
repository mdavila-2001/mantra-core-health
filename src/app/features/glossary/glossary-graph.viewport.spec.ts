import { describe, expect, it } from 'vitest';

import { GraphViewport } from './glossary-graph.viewport';

const ventana = { width: 800, height: 400 };

describe('GraphViewport', () => {
  it('ajusta un árbol que entra a la ventana y lo centra', () => {
    const viewport = new GraphViewport(() => ventana);
    viewport.fit(1000, 400);
    expect(viewport.scale()).toBe(0.8);
    expect(viewport.offsetX()).toBe(0);
    expect(viewport.offsetY()).toBe(40);
  });

  it('un árbol enorme no baja del piso: queda legible, a la izquierda y con la raíz a media altura', () => {
    const viewport = new GraphViewport(() => ventana);
    viewport.fit(8000, 6000, 3000);
    expect(viewport.scale()).toBe(0.6);
    expect(viewport.offsetX()).toBe(16);
    expect(viewport.offsetY()).toBe(200 - 3000 * 0.6);
  });

  it('un árbol chico no se agranda al ajustar', () => {
    const viewport = new GraphViewport(() => ventana);
    viewport.fit(200, 100);
    expect(viewport.scale()).toBe(1);
    expect(viewport.offsetX()).toBe(300);
  });

  it('sin lienzo todavía no ajusta nada', () => {
    const viewport = new GraphViewport(() => undefined);
    viewport.fit(1600, 400);
    expect(viewport.scale()).toBe(1);
  });

  it('acerca y aleja con tope en los dos extremos', () => {
    const viewport = new GraphViewport(() => ventana);
    for (let i = 0; i < 20; i++) viewport.zoomIn();
    expect(viewport.zoomText()).toBe('250 %');
    for (let i = 0; i < 40; i++) viewport.zoomOut();
    expect(viewport.zoomText()).toBe('25 %');
  });

  it('un arrastre mueve el árbol y el clic que lo cierra se descarta una sola vez', () => {
    const viewport = new GraphViewport(() => ventana);
    viewport.onPointerDown({ button: 0, clientX: 10, clientY: 10 } as PointerEvent);
    viewport.onPointerMove({ clientX: 60, clientY: 40 } as PointerEvent);
    viewport.onPointerUp();
    expect(viewport.offsetX()).toBe(50);
    expect(viewport.offsetY()).toBe(30);
    expect(viewport.consumeDrag()).toBe(true);
    expect(viewport.consumeDrag()).toBe(false);
  });

  it('un toque sin movimiento no es un arrastre', () => {
    const viewport = new GraphViewport(() => ventana);
    viewport.onPointerDown({ button: 0, clientX: 10, clientY: 10 } as PointerEvent);
    viewport.onPointerMove({ clientX: 12, clientY: 11 } as PointerEvent);
    viewport.onPointerUp();
    expect(viewport.offsetX()).toBe(0);
    expect(viewport.consumeDrag()).toBe(false);
  });

  it('el encuadre sigue al lienzo hasta que alguien lo mueve', () => {
    const viewport = new GraphViewport(() => ventana);
    expect(viewport.untouched).toBe(false);
    viewport.fit(1000, 400);
    expect(viewport.untouched).toBe(true);
    viewport.zoomIn();
    expect(viewport.untouched).toBe(false);
    viewport.fit(1000, 400);
    viewport.onPointerDown({ button: 0, clientX: 0, clientY: 0 } as PointerEvent);
    viewport.onPointerMove({ clientX: 40, clientY: 0 } as PointerEvent);
    expect(viewport.untouched).toBe(false);
  });
});

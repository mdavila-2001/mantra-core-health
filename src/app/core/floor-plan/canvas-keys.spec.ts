import { KEY_PAN_STEP_PX, keyAction, type KeyInput } from './canvas-keys';

const k = (key: string, extra: Partial<KeyInput> = {}): KeyInput => ({ key, ctrlKey: false, metaKey: false, altKey: false, ...extra });

describe('teclado del lienzo', () => {
  it('Escape descarta; + − 0 . hacen zoom y encuadre; / busca; Av Pág y Re Pág cambian de lienzo', () => {
    expect(keyAction(k('Escape'), false)).toEqual({ type: 'dismiss' });
    expect(keyAction(k('+'), false)).toEqual({ type: 'zoomIn' });
    expect(keyAction(k('='), false)).toEqual({ type: 'zoomIn' });
    expect(keyAction(k('-'), false)).toEqual({ type: 'zoomOut' });
    expect(keyAction(k('0'), false)).toEqual({ type: 'fit' });
    expect(keyAction(k('.'), false)).toEqual({ type: 'frameSelected' });
    expect(keyAction(k('/'), false)).toEqual({ type: 'search' });
    expect(keyAction(k('PageDown'), false)).toEqual({ type: 'floor', step: 1 });
    expect(keyAction(k('PageUp'), false)).toEqual({ type: 'floor', step: -1 });
  });

  it('las flechas van al vecino espacial; con Alt desplazan la vista; en el editor las resuelve el editor', () => {
    expect(keyAction(k('ArrowRight'), false)).toEqual({ type: 'move', direction: 'right' });
    expect(keyAction(k('ArrowUp', { altKey: true }), false)).toEqual({ type: 'pan', dx: 0, dy: KEY_PAN_STEP_PX });
    expect(keyAction(k('ArrowLeft', { altKey: true }), true)).toEqual({ type: 'pan', dx: KEY_PAN_STEP_PX, dy: 0 });
    expect(keyAction(k('ArrowLeft'), true)).toBeNull();
  });

  it('Inicio y Fin saltan al primero y al último; Enter y Espacio abren la ficha (Ctrl+Enter no)', () => {
    expect(keyAction(k('Home'), false)).toEqual({ type: 'edge', which: 'first' });
    expect(keyAction(k('End'), false)).toEqual({ type: 'edge', which: 'last' });
    expect(keyAction(k('Enter'), false)).toEqual({ type: 'open' });
    expect(keyAction(k(' '), false)).toEqual({ type: 'open' });
    expect(keyAction(k('Enter', { ctrlKey: true }), false)).toBeNull();
  });

  it('Tab y las demás teclas no se interceptan: el foco nunca queda atrapado', () => {
    expect(keyAction(k('Tab'), false)).toBeNull();
    expect(keyAction(k('a'), false)).toBeNull();
  });
});

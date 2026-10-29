import { editorKeyCommand, type KeyInput } from './editor-keys';

const k = (key: string, over: Partial<KeyInput> = {}): KeyInput => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...over });
const ctx = { pathDraft: false, canNudge: true };

describe('editorKeyCommand', () => {
  it('Ctrl+Z deshace, Ctrl+Shift+Z y Ctrl+Y rehacen, Ctrl+S guarda', () => {
    expect(editorKeyCommand(k('z', { ctrlKey: true }), ctx)).toEqual({ type: 'undo' });
    expect(editorKeyCommand(k('Z', { ctrlKey: true, shiftKey: true }), ctx)).toEqual({ type: 'redo' });
    expect(editorKeyCommand(k('y', { metaKey: true }), ctx)).toEqual({ type: 'redo' });
    expect(editorKeyCommand(k('s', { ctrlKey: true }), ctx)).toEqual({ type: 'save' });
  });

  it('las letras cambian de herramienta (V, H, R, P, W, D, N)', () => {
    const tools = ['v', 'h', 'r', 'p', 'w', 'd', 'n'].map((key) => editorKeyCommand(k(key), ctx));
    expect(tools.map((c) => c && c.type === 'tool' && c.tool)).toEqual(['select', 'hand', 'rect', 'polygon', 'wall', 'door', 'window']);
  });

  it('las flechas empujan (Shift = cinco pasos) y Alt las deja para la vista', () => {
    expect(editorKeyCommand(k('ArrowLeft'), ctx)).toEqual({ type: 'nudge', dx: -1, dy: 0, big: false });
    expect(editorKeyCommand(k('ArrowDown', { shiftKey: true }), ctx)).toEqual({ type: 'nudge', dx: 0, dy: 1, big: true });
    expect(editorKeyCommand(k('ArrowDown', { altKey: true }), ctx)).toBeNull();
    expect(editorKeyCommand(k('ArrowDown'), { pathDraft: false, canNudge: false })).toBeNull();
  });

  it('con un trazo a medias, Entrar lo cierra y Retroceso quita el último punto; sin trazo, Retroceso quita la figura', () => {
    expect(editorKeyCommand(k('Enter'), { pathDraft: true, canNudge: false })).toEqual({ type: 'finish-draft' });
    expect(editorKeyCommand(k('Backspace'), { pathDraft: true, canNudge: false })).toEqual({ type: 'back-draft' });
    expect(editorKeyCommand(k('Backspace'), ctx)).toEqual({ type: 'delete' });
    expect(editorKeyCommand(k('Delete'), ctx)).toEqual({ type: 'delete' });
    expect(editorKeyCommand(k('Escape'), ctx)).toEqual({ type: 'escape' });
  });
});

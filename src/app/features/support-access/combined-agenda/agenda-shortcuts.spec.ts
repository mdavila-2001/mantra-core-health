import { describe, expect, it } from 'vitest';

import { shortcutFor, type ShortcutContext } from './agenda-shortcuts';

const LIBRE: ShortcutContext = { dragging: false, finderOpen: false, panelOpen: false, holding: false };

function tecla(key: string, parcial: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; defaultPrevented: boolean; target: EventTarget | null }> = {}) {
  return { key, ctrlKey: false, metaKey: false, altKey: false, defaultPrevented: false, target: document.body, ...parcial };
}

describe('atajos de teclado de la agenda', () => {
  it('N, /, T y las flechas son comandos', () => {
    expect(shortcutFor(tecla('n'), LIBRE)).toBe('NEW');
    expect(shortcutFor(tecla('N'), LIBRE)).toBe('NEW');
    expect(shortcutFor(tecla('/'), LIBRE)).toBe('SEARCH');
    expect(shortcutFor(tecla('t'), LIBRE)).toBe('TODAY');
    expect(shortcutFor(tecla('ArrowLeft'), LIBRE)).toBe('PREVIOUS');
    expect(shortcutFor(tecla('ArrowRight'), LIBRE)).toBe('NEXT');
    expect(shortcutFor(tecla('x'), LIBRE)).toBeNull();
  });

  it('no se come lo que se escribe en un campo', () => {
    for (const etiqueta of ['input', 'textarea', 'select']) {
      const campo = document.createElement(etiqueta);
      expect(shortcutFor(tecla('n', { target: campo }), LIBRE), etiqueta).toBeNull();
      expect(shortcutFor(tecla('/', { target: campo }), LIBRE), etiqueta).toBeNull();
    }
  });

  it('no actúa con Ctrl, Cmd o Alt: son del navegador', () => {
    expect(shortcutFor(tecla('t', { ctrlKey: true }), LIBRE)).toBeNull();
    expect(shortcutFor(tecla('n', { metaKey: true }), LIBRE)).toBeNull();
    expect(shortcutFor(tecla('ArrowLeft', { altKey: true }), LIBRE)).toBeNull();
  });

  it('no actúa si otro ya atendió la tecla ni dentro de un diálogo abierto', () => {
    expect(shortcutFor(tecla('t', { defaultPrevented: true }), LIBRE)).toBeNull();
    const dialogo = document.createElement('div');
    dialogo.setAttribute('role', 'dialog');
    const boton = document.createElement('button');
    dialogo.append(boton);
    document.body.append(dialogo);
    expect(shortcutFor(tecla('t', { target: boton }), LIBRE)).toBeNull();
    dialogo.remove();
  });

  it('a mitad de un arrastre no hay atajos', () => {
    expect(shortcutFor(tecla('t'), { ...LIBRE, dragging: true })).toBeNull();
    expect(shortcutFor(tecla('Escape'), { ...LIBRE, dragging: true, panelOpen: true })).toBeNull();
  });

  it('las flechas dentro de la grilla la desplazan; sobre un evento mueven la fecha', () => {
    const grilla = document.createElement('div');
    grilla.setAttribute('data-scroll', '');
    const evento = document.createElement('button');
    evento.className = 'celda';
    grilla.append(evento);
    document.body.append(grilla);
    expect(shortcutFor(tecla('ArrowRight', { target: grilla }), LIBRE)).toBeNull();
    expect(shortcutFor(tecla('ArrowRight', { target: evento }), LIBRE)).toBe('NEXT');
    grilla.remove();
  });

  it('Escape cierra lo último que se abrió: primero el buscador, luego el panel, luego la cita en mano', () => {
    expect(shortcutFor(tecla('Escape'), { ...LIBRE, finderOpen: true, panelOpen: true, holding: true })).toBe('CLOSE_FINDER');
    expect(shortcutFor(tecla('Escape'), { ...LIBRE, panelOpen: true, holding: true })).toBe('CLOSE_PANEL');
    expect(shortcutFor(tecla('Escape'), { ...LIBRE, holding: true })).toBe('CANCEL_HOLDING');
    expect(shortcutFor(tecla('Escape'), LIBRE)).toBeNull();
  });

  it('Escape funciona aun escribiendo en un campo: es la salida', () => {
    expect(shortcutFor(tecla('Escape', { target: document.createElement('input') }), { ...LIBRE, finderOpen: true })).toBe('CLOSE_FINDER');
  });
});

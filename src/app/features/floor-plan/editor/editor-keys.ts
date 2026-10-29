import type { EditTool } from './plan-editor-pointer';

export type KeyCommand =
  | { readonly type: 'undo' | 'redo' | 'save' | 'escape' | 'finish-draft' | 'back-draft' | 'delete' | 'select-active' }
  | { readonly type: 'tool'; readonly tool: EditTool }
  | { readonly type: 'nudge'; readonly dx: -1 | 0 | 1; readonly dy: -1 | 0 | 1; readonly big: boolean };

export interface KeyContext {
  /** Hay un polígono o un muro a medio dibujar. */
  readonly pathDraft: boolean;
  readonly canNudge: boolean;
}

export interface KeyInput {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

const TOOL_KEYS: Readonly<Record<string, EditTool>> = { v: 'select', h: 'hand', r: 'rect', p: 'polygon', w: 'wall', d: 'door', n: 'window' };
const ARROWS: Readonly<Record<string, readonly [-1 | 0 | 1, -1 | 0 | 1]>> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };

/**
 * Atajos del editor (CONTRATO-PLANO §5.3): V/H/R/P/W/D/N cambian de herramienta,
 * `Ctrl+Z`/`Ctrl+Shift+Z`/`Ctrl+Y` deshacen y rehacen, `Ctrl+S` guarda, `Supr`
 * quita, las flechas empujan un paso de grilla (`Shift` = 5) y `Esc` sale de lo
 * que se esté haciendo. Alt+flecha queda para desplazar la vista.
 */
export function editorKeyCommand(input: KeyInput, context: KeyContext): KeyCommand | null {
  const key = input.key.toLowerCase();
  const mod = input.ctrlKey || input.metaKey;
  if (mod) {
    if (key === 'z') return { type: input.shiftKey ? 'redo' : 'undo' };
    if (key === 'y') return { type: 'redo' };
    if (key === 's') return { type: 'save' };
    return null;
  }
  if (key === 'escape') return { type: 'escape' };
  if (key === 'enter') return { type: context.pathDraft ? 'finish-draft' : 'select-active' };
  if (key === 'backspace' && context.pathDraft) return { type: 'back-draft' };
  if (key === 'delete' || key === 'backspace') return { type: 'delete' };
  const tool = TOOL_KEYS[key];
  if (tool && !input.altKey) return { type: 'tool', tool };
  const arrow = ARROWS[key];
  if (arrow && !input.altKey && context.canNudge) return { type: 'nudge', dx: arrow[0], dy: arrow[1], big: input.shiftKey };
  return null;
}

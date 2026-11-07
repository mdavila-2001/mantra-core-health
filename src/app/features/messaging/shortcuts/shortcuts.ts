/** A WhatsApp Web keyboard shortcut and what it does in AloVida. */
export interface Shortcut {
  /** `KeyboardEvent.code`, layout independent (Option/AltGr change `key`). */
  readonly code: string;
  readonly shift: boolean;
  readonly accion: ShortcutAction;
  /** Keys as shown in the help (`Mod` becomes Ctrl+Alt or ⌘+Ctrl). */
  readonly teclas: string;
  readonly descripcion: string;
}

export type ShortcutAction =
  | 'buscar'
  | 'nuevo'
  | 'buscarEnChat'
  | 'siguiente'
  | 'anterior'
  | 'archivar'
  | 'perfil'
  | 'emojis'
  | 'stickers';

/**
 * Same combinations as WhatsApp Web: Ctrl+Alt on Windows/Linux, ⌘+Ctrl on
 * macOS. Ctrl+/ (⌘+/) opens the list; Esc closes the open chat.
 */
export const SHORTCUTS: readonly Shortcut[] = [
  { code: 'KeyN', shift: false, accion: 'nuevo', teclas: 'Mod + N', descripcion: 'Nuevo chat' },
  { code: 'Slash', shift: false, accion: 'buscar', teclas: 'Mod + /', descripcion: 'Buscar chats' },
  { code: 'KeyF', shift: true, accion: 'buscarEnChat', teclas: 'Mod + Shift + F', descripcion: 'Buscar en el chat' },
  { code: 'BracketRight', shift: true, accion: 'siguiente', teclas: 'Mod + Shift + ]', descripcion: 'Chat siguiente' },
  { code: 'BracketLeft', shift: true, accion: 'anterior', teclas: 'Mod + Shift + [', descripcion: 'Chat anterior' },
  { code: 'KeyE', shift: true, accion: 'archivar', teclas: 'Mod + Shift + E', descripcion: 'Archivar o desarchivar el chat' },
  { code: 'KeyP', shift: false, accion: 'perfil', teclas: 'Mod + P', descripcion: 'Ver el perfil del contacto' },
  { code: 'KeyE', shift: false, accion: 'emojis', teclas: 'Mod + E', descripcion: 'Panel de emojis' },
  { code: 'KeyS', shift: false, accion: 'stickers', teclas: 'Mod + S', descripcion: 'Panel de stickers' },
];

/** Fixed keys of the composer and the thread, listed in the help too. */
export const FIXED_KEYS: readonly { readonly teclas: string; readonly descripcion: string }[] = [
  { teclas: 'Enter', descripcion: 'Enviar el mensaje' },
  { teclas: 'Shift + Enter', descripcion: 'Nueva línea' },
  { teclas: '↑', descripcion: 'Editar su último mensaje (con el campo vacío)' },
  { teclas: 'Esc', descripcion: 'Cerrar el menú, la respuesta o el chat abierto' },
  { teclas: 'Ctrl + /', descripcion: 'Ver estos atajos' },
];

/** The WhatsApp modifier: Ctrl+Alt (Windows/Linux) or ⌘+Ctrl (macOS). */
export function isMod(evento: KeyboardEvent): boolean {
  return (evento.ctrlKey && evento.altKey) || (evento.metaKey && evento.ctrlKey);
}

/** The shortcut an event triggers, if any. */
export function shortcutOf(evento: KeyboardEvent): Shortcut | undefined {
  // AltGr arrives as Ctrl+Alt on Windows: AltGr+E is € on a Spanish keyboard, not a shortcut.
  if (!isMod(evento) || evento.getModifierState?.('AltGraph')) return undefined;
  return SHORTCUTS.find((s) => s.code === evento.code && s.shift === evento.shiftKey);
}

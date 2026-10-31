/**
 * Los atajos de teclado de la agenda, como función pura: dado el evento y el
 * estado de la pantalla, dicen **qué comando** corresponde (o ninguno).
 *
 * - `N` nueva cita · `/` buscar paciente · `T` hoy · `←` `→` período anterior y
 *   siguiente · `Esc` cierra lo último que se abrió.
 * - Nada se dispara mientras se escribe en un campo, dentro de un diálogo, con
 *   `Ctrl`/`Alt`/`Cmd` apretados ni a mitad de un arrastre: un atajo que se
 *   come lo que se escribe es peor que no tenerlo.
 * - Las flechas no mueven la fecha cuando el foco está **dentro de la grilla**
 *   (ahí desplazan la vista, que es lo que se espera), pero sí sobre un evento.
 */
export type ShortcutCommand = 'NEW' | 'SEARCH' | 'TODAY' | 'PREVIOUS' | 'NEXT' | 'CLOSE_FINDER' | 'CLOSE_PANEL' | 'CANCEL_HOLDING';

export interface ShortcutContext {
  readonly dragging: boolean;
  readonly finderOpen: boolean;
  readonly panelOpen: boolean;
  readonly holding: boolean;
}

/** Lo mínimo del evento que se mira: así se prueba sin teclado real. */
export interface ShortcutEvent {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly defaultPrevented: boolean;
  readonly target: EventTarget | null;
}

function isTyping(target: HTMLElement | null): boolean {
  if (target === null) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
}

export function shortcutFor(event: ShortcutEvent, context: ShortcutContext): ShortcutCommand | null {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return null;
  const target = event.target instanceof HTMLElement ? event.target : null;

  if (event.key === 'Escape') {
    if (context.dragging) return null;
    if (context.finderOpen) return 'CLOSE_FINDER';
    if (context.panelOpen) return 'CLOSE_PANEL';
    return context.holding ? 'CANCEL_HOLDING' : null;
  }

  if (isTyping(target) || context.dragging) return null;
  if (target?.closest('dialog[open], [role="dialog"], [aria-modal="true"]') != null) return null;

  switch (event.key) {
    case 'n':
    case 'N':
      return 'NEW';
    case '/':
      return 'SEARCH';
    case 't':
    case 'T':
      return 'TODAY';
    case 'ArrowLeft':
    case 'ArrowRight': {
      const dentroDeLaGrilla = target?.closest('[data-scroll]') != null && !target.classList.contains('celda');
      if (dentroDeLaGrilla) return null;
      return event.key === 'ArrowLeft' ? 'PREVIOUS' : 'NEXT';
    }
    default:
      return null;
  }
}

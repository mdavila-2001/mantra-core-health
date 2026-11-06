import { DOCUMENT, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ChatPreferences } from '../../../core/messaging/chat-preferences';
import { ChatStore } from '../../../core/messaging/chat.store';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { FIXED_KEYS, SHORTCUTS, shortcutOf, type ShortcutAction } from './shortcuts';

/**
 * WhatsApp Web keyboard shortcuts for the messaging page, plus their help
 * dialog (Ctrl+/ or ⌘+/). Mounted once by `Messaging`.
 *
 * It drives the page through its own controls (`data-testid`) instead of
 * reaching into the components, so a shortcut does exactly what the click does.
 */
@Component({
  selector: 'app-messaging-shortcuts',
  imports: [ContentDialog],
  templateUrl: './messaging-shortcuts.html',
  styleUrl: './messaging-shortcuts.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'alTeclear($event)' },
})
export class MessagingShortcuts {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly store = inject(ChatStore);
  private readonly preferencias = inject(ChatPreferences);

  protected readonly ayuda = signal(false);
  protected readonly atajos = SHORTCUTS;
  protected readonly fijas = FIXED_KEYS;
  protected readonly mod = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '') ? '⌘ + Ctrl' : 'Ctrl + Alt';

  protected alTeclear(evento: KeyboardEvent): void {
    if (evento.defaultPrevented) return;
    // Ctrl+/ or ⌘+/ alone; ⌘+Ctrl+/ is «Buscar chats» on macOS.
    if ((evento.ctrlKey !== evento.metaKey) && !evento.altKey && evento.code === 'Slash') {
      evento.preventDefault();
      this.ayuda.update((v) => !v);
      return;
    }
    if (evento.key === 'Escape') {
      this.cerrarChat(evento.target);
      return;
    }
    const atajo = shortcutOf(evento);
    if (atajo) {
      evento.preventDefault();
      this.ejecutar(atajo.accion);
    }
  }

  private ejecutar(accion: ShortcutAction): void {
    const activa = this.store.activaId();
    switch (accion) {
      case 'buscar':
      case 'nuevo':
        this.query<HTMLInputElement>('[data-testid="mensajeria-consulta"]')?.focus();
        return;
      case 'buscarEnChat':
        return this.click('[data-testid="hilo-buscar-abrir"]');
      case 'siguiente':
      case 'anterior':
        return this.moverse(accion === 'siguiente' ? 1 : -1);
      case 'archivar':
        if (activa !== null) this.preferencias.toggleArchived(activa);
        return;
      case 'perfil':
        if (activa !== null) void this.router.navigate(['/messaging', activa], { queryParams: { contacto: 1 } });
        return;
      case 'emojis':
      case 'stickers':
        this.click('[data-testid="composer-emojis"]');
        if (accion === 'stickers') setTimeout(() => this.click('[data-testid="composer-solapa-stickers"]'));
        return;
    }
  }

  /** Next or previous row of the inbox, as currently filtered. */
  private moverse(paso: 1 | -1): void {
    const filas = [...this.document.querySelectorAll<HTMLAnchorElement>('a[data-testid="conversacion"]')];
    if (filas.length === 0) return;
    const actual = filas.findIndex((a) => a.getAttribute('aria-current') === 'page');
    const destino = actual === -1 ? (paso === 1 ? 0 : filas.length - 1) : (actual + paso + filas.length) % filas.length;
    filas[destino].click();
  }

  /**
   * Esc closes the open chat, like WhatsApp, but only when nothing else took
   * it: a menu, a dialog or panel (even one that just closed on this same key)
   * or a text field, which use Esc for themselves.
   */
  private cerrarChat(target: EventTarget | null): void {
    // `[aria-expanded]`: a menu toggle may already have closed its menu on this same key.
    const capa = 'dialog, [role="dialog"], [role="menu"], [aria-expanded], input, textarea';
    const ocupado =
      (target instanceof Element && target.closest(capa) !== null) ||
      this.document.querySelector('dialog[open], [role="dialog"], app-messaging [aria-expanded="true"]') !== null;
    if (!ocupado && this.store.activaId() !== null) void this.router.navigate(['/messaging']);
  }

  private query<T extends HTMLElement>(selector: string): T | null {
    return this.document.querySelector<T>(selector);
  }

  private click(selector: string): void {
    this.query(selector)?.click();
  }
}

import { pointerOutside } from './menu-dismiss';
import { placeMessageMenu } from './thread/message-menu';
import { lastOwnText } from './thread/composer/last-own-message';
import { shortcutOf } from './shortcuts/shortcuts';
import { clockSkew } from './thread/clock-skew';
import type { MensajeDelHilo } from '../../core/messaging/chat.store';

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  new DOMRect(left, top, width, height);

describe('pointerOutside', () => {
  it('is false inside the menu or its toggle, true anywhere else', () => {
    document.body.innerHTML = '<ul class="m"><li><b id="in"></b></li></ul><button class="t"></button><p id="out"></p>';
    expect(pointerOutside(document.getElementById('in'), '.m, .t')).toBe(false);
    expect(pointerOutside(document.querySelector('.t'), '.m, .t')).toBe(false);
    expect(pointerOutside(document.getElementById('out'), '.m, .t')).toBe(true);
    expect(pointerOutside(null, '.m, .t')).toBe(true);
  });
});

describe('placeMessageMenu', () => {
  /** A chevron at `chevron`, a 240×300 menu and a 600 px tall frame starting at y=100. */
  function place(chevron: DOMRect, own = true): HTMLElement {
    document.body.innerHTML = `<li class="${own ? 'is-propio' : ''}"><div><button></button><ul class="hilo__menu--mensaje"></ul></div></li><div id="f"></div>`;
    const button = document.querySelector('button') as HTMLElement;
    const menu = document.querySelector('ul') as HTMLElement;
    const frame = document.getElementById('f') as HTMLElement;
    button.getBoundingClientRect = () => chevron;
    menu.getBoundingClientRect = () => rect(0, 0, 240, 300);
    frame.getBoundingClientRect = () => rect(300, 100, 800, 600);
    placeMessageMenu(button, frame);
    return menu;
  }

  it('opens below the chevron when it fits', () => {
    const menu = place(rect(900, 150, 20, 20));
    expect(menu.style.top).toBe('174px');
    expect(menu.style.left).toBe('680px');
  });

  it('opens above near the bottom of the frame', () => {
    expect(place(rect(900, 600, 20, 20)).style.top).toBe('296px');
  });

  it('never leaves the frame: near the top it is pinned inside, not clipped (bug 06/11)', () => {
    // Neither below (150+300 > 692) with a tiny frame nor above fits: pinned at the top edge.
    document.body.innerHTML = '';
    const menu = place(rect(900, 400, 20, 20));
    const top = parseInt(menu.style.top, 10);
    expect(top).toBeGreaterThanOrEqual(108);
    expect(top + 300).toBeLessThanOrEqual(692);
  });

  it('reports false once the message scrolled out of the frame, so the menu closes', () => {
    document.body.innerHTML = '<li><div><button></button><ul class="hilo__menu--mensaje"></ul></div></li><div id="f"></div>';
    const button = document.querySelector('button') as HTMLElement;
    button.getBoundingClientRect = () => rect(900, 20, 20, 20);
    (document.getElementById('f') as HTMLElement).getBoundingClientRect = () => rect(300, 100, 800, 600);
    expect(placeMessageMenu(button, document.getElementById('f') as HTMLElement)).toBe(false);
  });

  it('aligns to the left edge of the chevron on other people’s messages', () => {
    expect(place(rect(400, 150, 20, 20), false).style.left).toBe('400px');
  });
});

describe('lastOwnText', () => {
  const now = Date.now();
  const m = (id: string, sender: string, body: string | undefined, minutesAgo = 1) =>
    ({ id, senderProfileId: sender, bodyText: body, estado: 'enviado', sentAt: new Date(now - minutesAgo * 60_000) }) as unknown as MensajeDelHilo;

  it('is the newest sent text of the profile', () => {
    const list = [m('a', 'me', 'one'), m('b', 'me', 'two'), m('c', 'other', 'x'), m('d', 'me', undefined)];
    expect(lastOwnText(list, 'me', now)?.id).toBe('b');
    expect(lastOwnText(list, 'nobody', now)).toBeUndefined();
  });

  it('is nothing once the last one left the 15-minute window (↑ is not swallowed)', () => {
    expect(lastOwnText([m('a', 'me', 'old', 16)], 'me', now)).toBeUndefined();
  });
});

describe('shortcutOf', () => {
  const key = (code: string, init: KeyboardEventInit) => new KeyboardEvent('keydown', { code, ...init });

  it('uses the WhatsApp Web modifiers: Ctrl+Alt or ⌘+Ctrl', () => {
    expect(shortcutOf(key('KeyN', { ctrlKey: true, altKey: true }))?.accion).toBe('nuevo');
    expect(shortcutOf(key('KeyN', { metaKey: true, ctrlKey: true }))?.accion).toBe('nuevo');
    expect(shortcutOf(key('KeyN', { ctrlKey: true }))).toBeUndefined();
  });

  it('ignores AltGr (Ctrl+Alt on Windows): AltGr+E types €', () => {
    const altGr = key('KeyE', { ctrlKey: true, altKey: true });
    Object.defineProperty(altGr, 'getModifierState', { value: (k: string) => k === 'AltGraph' });
    expect(shortcutOf(altGr)).toBeUndefined();
  });

  it('tells Mod+E (emojis) from Mod+Shift+E (archive)', () => {
    expect(shortcutOf(key('KeyE', { ctrlKey: true, altKey: true }))?.accion).toBe('emojis');
    expect(shortcutOf(key('KeyE', { ctrlKey: true, altKey: true, shiftKey: true }))?.accion).toBe('archivar');
  });
});

describe('clockSkew', () => {
  const msg = (sentAt: number, sender = 'me', pendiente?: object) =>
    ({ id: 'm', senderProfileId: sender, estado: 'enviado', sentAt: new Date(sentAt), pendiente }) as unknown as MensajeDelHilo;

  it('measures server minus browser clock on the acknowledged own message (bug: «5 min» at minute 3)', () => {
    // The laptop clock runs 2 minutes ahead of the server.
    expect(clockSkew([msg(1_000_000)], 'me', 1_000_000 + 120_000)).toBe(-120_000);
  });

  it('waits while the message is still pending, someone else wrote last, or nothing was sent', () => {
    expect(clockSkew([msg(1_000, 'me', {})], 'me', 5_000)).toBeNull();
    expect(clockSkew([msg(1_000, 'other')], 'me', 5_000)).toBeNull();
    expect(clockSkew([msg(1_000)], 'me', 0)).toBeNull();
  });
});

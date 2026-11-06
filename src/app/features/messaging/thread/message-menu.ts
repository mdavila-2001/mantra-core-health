/** Gap between the chevron and the menu, and between the menu and the edges. */
const GAP = 4;
const EDGE = 8;

/**
 * Places the message menu next to its chevron, always fully visible.
 *
 * The menu used to be `position: absolute` inside the scrolling list: near the
 * top of the thread it opened upwards and was clipped by the list (the bug
 * reported on 2026-11-06). Now it is `position: fixed` and clamped to the
 * thread frame: below the chevron when it fits, above when it does not, and
 * pinned to the frame edge as a last resort (like WhatsApp).
 *
 * Also called on scroll, so the menu follows its message.
 *
 * @param anchor - The chevron button of the message.
 * @param frame - The scrolling frame of the thread; the viewport if absent.
 * @returns `false` when the message left the frame and the menu should close.
 */
export function placeMessageMenu(anchor: HTMLElement, frame: HTMLElement | undefined): boolean {
  const menu = anchor.parentElement?.querySelector<HTMLElement>('.hilo__menu--mensaje');
  if (!menu) return true;
  const b = anchor.getBoundingClientRect();
  menu.style.maxHeight = '';
  const m = menu.getBoundingClientRect();
  const f = frame?.getBoundingClientRect() ?? new DOMRect(0, 0, innerWidth, innerHeight);
  if (!anchor.isConnected || b.bottom < f.top || b.top > f.bottom) return false;
  const top0 = f.top + EDGE;
  const bottom0 = f.bottom - EDGE;
  // Short screens (landscape phone): the menu scrolls inside the frame instead of overflowing it.
  menu.style.maxHeight = `${Math.max(0, bottom0 - top0)}px`;

  let top = b.bottom + GAP;
  if (top + m.height > bottom0) {
    const above = b.top - GAP - m.height;
    top = above >= top0 ? above : Math.max(top0, bottom0 - m.height);
  }
  const own = anchor.closest('.is-propio') !== null;
  const left = clamp(own ? b.right - m.width : b.left, f.left + EDGE, f.right - EDGE - m.width);

  menu.style.top = `${Math.round(top)}px`;
  menu.style.left = `${Math.round(left)}px`;
  menu.style.visibility = 'visible';
  return true;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

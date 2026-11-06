/**
 * Whether a `pointerdown` landed outside an open menu and its toggle button.
 *
 * Messaging menus (inbox row, thread header, message) close like WhatsApp's:
 * touching anywhere else closes them. The toggle button itself does not count
 * as "outside" so its own `click` keeps toggling.
 *
 * @param target - Where the pointer landed.
 * @param selectors - CSS selectors of the menu and its toggle button.
 * @returns `true` when the menu must close.
 */
export function pointerOutside(target: EventTarget | null, selectors: string): boolean {
  return !(target instanceof Element) || target.closest(selectors) === null;
}

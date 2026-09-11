import type { Locator, Page } from '@playwright/test';

/**
 * Toca el centro de un elemento (desplazado en píxeles), como haría un dedo
 * o un clic sobre el mapa. Portado de `registro-ubicacion-en-mapa.mjs`.
 */
export async function tocar(page: Page, locator: Locator, dx = 0, dy = 0): Promise<void> {
  const caja = await locator.boundingBox();
  if (caja === null) throw new Error('No se pudo ubicar el elemento para tocarlo.');
  await page.mouse.click(caja.x + caja.width / 2 + dx, caja.y + caja.height / 2 + dy);
}

/** El centro del primer pin de Leaflet dentro del mapa, esperando a que exista. */
export async function centroDelPin(mapa: Locator): Promise<{ x: number; y: number }> {
  const pin = mapa.locator('.leaflet-marker-icon').first();
  await pin.waitFor({ timeout: 15_000 });
  const caja = await pin.boundingBox();
  if (caja === null) throw new Error('El pin no tiene una posición medible.');
  return { x: Math.round(caja.x + caja.width / 2), y: Math.round(caja.y + caja.height / 2) };
}

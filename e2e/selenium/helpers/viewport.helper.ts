import type { WebDriver } from 'selenium-webdriver';

import type { Viewport } from '../config/environment';

/**
 * Ayudas de tamaño de ventana.
 *
 * El desborde horizontal es el defecto responsive que más se cuela: en la
 * máquina de quien lo escribió no se nota, y en un teléfono obliga a desplazar
 * de lado para llegar a un botón. Se mide contra el propio navegador —el ancho
 * del documento contra el de la ventana— en vez de mirar una captura.
 */

/** Cambia el tamaño de la ventana sin recrear el navegador. */
export async function cambiarViewport(driver: WebDriver, viewport: Viewport): Promise<void> {
  await driver.manage().window().setRect({ width: viewport.ancho, height: viewport.alto });
}

/** Ancho real del contenido y de la ventana, tal como los ve el navegador. */
export async function medidasDeAncho(
  driver: WebDriver,
): Promise<{ documento: number; ventana: number }> {
  return driver.executeScript<{ documento: number; ventana: number }>(
    `return {
       documento: Math.max(
         document.documentElement.scrollWidth,
         document.body ? document.body.scrollWidth : 0,
       ),
       ventana: document.documentElement.clientWidth,
     };`,
  );
}

/**
 * `true` si hay contenido fuera de la pantalla a lo ancho.
 *
 * Se admite un píxel de holgura: el redondeo de los tamaños fraccionarios que
 * produce un diseño con `rem` genera diferencias de menos de uno que no son un
 * desborde de verdad.
 */
export async function hayDesbordeHorizontal(driver: WebDriver): Promise<boolean> {
  const { documento, ventana } = await medidasDeAncho(driver);
  return documento - ventana > 1;
}

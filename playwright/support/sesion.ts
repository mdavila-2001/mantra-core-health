import { expect, type Page } from '@playwright/test';

import type { Actor } from './actores';

/**
 * Moverse por la aplicación con una sesión real.
 *
 * Las tres restricciones que dan forma a este archivo son del backend y no se
 * pueden aflojar desde el frontend, así que la suite se acomoda a ellas. Están
 * documentadas una por una donde importan.
 */

/**
 * Espera a que Angular haya hidratado.
 *
 * La aplicación se sirve con render del servidor: el HTML del formulario existe
 * **antes** de que el JavaScript responda. Escribir o hacer clic en esa ventana
 * no hace nada —o peor, dispara el envío nativo del formulario— y la prueba
 * falla por una carrera que se lee como un defecto del producto.
 *
 * `<app-root>` con hijos + documento completo es la misma señal que usa la
 * suite de Cypress; el doble `requestAnimationFrame` agrega la garantía de que
 * además ya se pintó.
 */
export async function esperarAplicacionLista(page: Page): Promise<void> {
  await page.waitForLoadState('load');
  await expect(page.locator('app-root')).not.toBeEmpty({ timeout: 30_000 });
  await page.evaluate(
    () =>
      new Promise<void>((listo) => {
        requestAnimationFrame(() => requestAnimationFrame(() => listo()));
      }),
  );
}

/**
 * Escribe en un campo y comprueba que llegó entero.
 *
 * Misma carrera de hidratación: se midieron pérdidas de los **primeros**
 * caracteres, que producen un `401` con las credenciales correctas — la peor
 * forma de fallar, porque acusa al dato. Se escribe, se relee, y si no coincide
 * se rehace una vez; la aserción final deja a la vista un problema distinto en
 * lugar de reintentar para siempre.
 */
async function escribir(page: Page, testId: string, texto: string): Promise<void> {
  const campo = page.getByTestId(testId);
  await campo.fill(texto);
  if ((await campo.inputValue()) !== texto) {
    await campo.fill(texto);
  }
  await expect(campo).toHaveValue(texto);
}

/**
 * Entra por la pantalla de ingreso, como una persona.
 *
 * No se inyecta un token en el almacenamiento: la sesión sólo persiste el
 * refresh token y `AuthService` lo canjea al arrancar, así que una sesión
 * fabricada a mano no recorre el mismo camino que una real — y el objetivo del
 * barrido es justamente ver lo que ve una persona.
 */
export async function entrar(page: Page, actor: Actor): Promise<void> {
  await page.goto('/auth');
  await esperarAplicacionLista(page);

  await escribir(page, 'login-identifier', actor.identificador);
  await escribir(page, 'login-password', actor.clave);
  await page.getByTestId('login-submit').click();

  // Dos destinos legítimos: el panel, o la elección de organización cuando la
  // sesión pertenece a más de una. Esperar sólo el panel dejaría la suite roja
  // para cualquiera con dos organizaciones, que es normal.
  await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });

  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }

  await esperarAplicacionLista(page);
}

/**
 * Va a una ruta **sin recargar la página**, que es lo que hace el menú.
 *
 * ## Por qué no `page.goto`
 *
 * Cada carga completa cuesta un canje de refresh token —`AuthService` lo hace
 * al arrancar— y `POST /iam/auth/token/refresh` está limitado a **diez por
 * minuto y por IP**. Un barrido de treinta rutas con `goto` agota el cupo en la
 * ruta once, el `429` se trata como sesión caída, y la suite se rompe contra una
 * protección que funciona bien.
 *
 * Además es más fiel: nadie recorre una aplicación reescribiendo la dirección.
 * Se navega por el router, como el menú.
 */
export async function irA(page: Page, ruta: string): Promise<void> {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, ruta);
}

/**
 * Espera a que la pantalla deje de moverse.
 *
 * Las pantallas encadenan lecturas —la agenda pide recursos y después citas—,
 * así que «la red está quieta» es la única señal honesta de que terminaron. Se
 * usa un techo corto y se sigue si no llega: una pantalla que nunca deja de
 * pedir es un hallazgo del barrido, no un motivo para abortarlo.
 */
export async function estable(page: Page): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  } catch {
    // Deliberado: la inestabilidad se reporta como estado de la ruta.
  }
  await expect(page.locator('app-root')).not.toBeEmpty();
}

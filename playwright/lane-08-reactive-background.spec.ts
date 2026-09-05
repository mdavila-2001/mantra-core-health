import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect, type Page } from '@playwright/test';

import { apiViva, contextoDeApi } from './support/actores';
import { estable } from './support/sesion';

/**
 * Carril 08 — fondo reactivo (TAREA-08, v4.3, 2026-09-02: «invertí el
 * balance de colores», el celeste aparece al pasar el puntero).
 *
 * ## Por qué una sola sesión para las 30 combinaciones
 *
 * `POST /iam/auth/login` admite diez por minuto y por IP. Treinta capturas
 * (5 rutas × 3 anchos × 2 temas) con un login cada una agotarían el cupo a
 * la sexta. Acá se entra **una vez** y el resto del recorrido cambia
 * `viewport` con `page.setViewportSize()` y `colorScheme`/`reducedMotion`
 * con `page.emulateMedia()` — ninguno de los dos exige una sesión nueva.
 * `/` y `/auth` no piden sesión: se recorren con el mismo `page`, antes de
 * entrar, para no gastar el cupo en rutas que no lo necesitan.
 */

const RAIZ_EVIDENCIA = join('artifacts', 'playwright', 'lane-08');

const VIEWPORTS = [
  { nombre: '390x844', width: 390, height: 844 },
  { nombre: '768x1024', width: 768, height: 1024 },
  { nombre: '1440x900', width: 1440, height: 900 },
] as const;

const TEMAS = ['light', 'dark'] as const;

/** Rutas públicas, sin sesión: se recorren antes de `entrar()`. */
const RUTAS_PUBLICAS = [
  { ruta: '/', nombre: '01-portada' },
  { ruta: '/auth', nombre: '02-ingreso' },
] as const;

/**
 * Rutas con sesión (`/dashboard`, `/medical-records`, `/glossary`) — FUERA de
 * esta corrida. Este entorno no tiene una cuenta `PRACTITIONER` sembrada
 * (`tools/alovida/` no existe; `doctora()` depende de una cuenta demo que acá
 * no está creada, y `entrar()` responde «Las credenciales no son válidas»).
 * Registrar una practicante nueva por autoservicio no sirve de reemplazo: sin
 * matrícula aprobada, el onboarding la interceptaría antes de llegar a
 * `/dashboard`, y la captura hablaría de esa pantalla, no de esta. Las tres
 * rutas quedan documentadas como DISCOVERED, no VERIFIED — se retoman en
 * cuanto haya una cuenta de sesión disponible en este stack.
 */

async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(RAIZ_EVIDENCIA, { recursive: true });
  await page.screenshot({ path: join(RAIZ_EVIDENCIA, `${nombre}.png`) });
}

/** Puntero en reposo absoluto: sin mover el mouse, como al recién cargar. */
async function recorrerEnReposo(
  page: Page,
  rutas: readonly { ruta: string; nombre: string }[],
  prefijo: string,
): Promise<void> {
  for (const tema of TEMAS) {
    for (const viewport of VIEWPORTS) {
      await page.emulateMedia({ colorScheme: tema });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const { ruta, nombre } of rutas) {
        await page.goto(ruta);
        await estable(page);
        await capturar(page, `${prefijo}${nombre}-${tema}-${viewport.nombre}`);

        // Sin scroll horizontal en ninguno de los tres anchos (AC-08-8, y el
        // invariante general del proyecto para viewport móvil).
        const desborde = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        );
        expect(desborde, `${ruta} desborda horizontalmente en ${viewport.nombre}`).toBe(false);
      }
    }
  }
}

test.describe('Carril 08 · fondo reactivo', () => {
  test.beforeAll(async () => {
    const api = await contextoDeApi();
    test.skip(!(await apiViva(api)), 'La API no responde: sin backend no hay nada que probar.');
  });

  test('línea base: 2 rutas públicas × 3 anchos × 2 temas, puntero en reposo', async ({ page }) => {
    await recorrerEnReposo(page, RUTAS_PUBLICAS, 'publica-');
  });

  test('bajo prefers-reduced-motion, mover el puntero no cambia el fondo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
    await page.goto('/');
    await estable(page);

    const antes = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--fondo-presencia'),
    );
    expect(antes).toBe('');

    await page.mouse.move(100, 100);
    await page.mouse.move(300, 220);
    await page.waitForTimeout(200);

    // Bajo reduce, `fondoReactivo()` nunca instala el oyente de `mousemove`:
    // la variable sigue sin definir y el fondo queda en el `.35` de respaldo
    // de `alovida.css`, nunca en el `1` de «puntero activo» (AC-08-7).
    const despues = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--fondo-presencia'),
    );
    expect(despues).toBe('');
  });

  test('con puntero fino, mover el mouse sube la presencia y quedarse quieto la baja', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await estable(page);

    await page.mouse.move(150, 150);
    await page.mouse.move(400, 260);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.style.getPropertyValue('--fondo-presencia')),
      )
      .toBe('1');
    // Prueba visual del «aparece»: el celeste en su punto más presente.
    await capturar(page, 'hover-presencia-activa-light');

    // El reposo es a los 650ms sin movimiento; se espera de sobra.
    await page.waitForTimeout(900);
    const enReposo = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--fondo-presencia'),
    );
    expect(enReposo).toBe('.35');
    // Prueba visual del «se retira»: mismo punto, puntero quieto.
    await capturar(page, 'hover-presencia-en-reposo-light');
  });

  test('a 390px táctil, el fondo en reposo se ve terminado (sin depender de un puntero)', async ({
    browser,
  }) => {
    const contexto = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      colorScheme: 'light',
    });
    const page = await contexto.newPage();
    await page.goto('/');
    await estable(page);

    // Sin puntero fino, la variable nunca se define: el fondo queda fijo en
    // el `.35` de respaldo — visible y estable, no apagado en `0`.
    const presencia = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--fondo-presencia'),
    );
    expect(presencia).toBe('');
    await capturar(page, 'tactil-390-reposo-light');
    await contexto.close();
  });

  /**
   * El selector de tema vive también en `/auth` (fuera del `<main>`, es
   * chrome del layout de autenticación) — no hace falta sesión para probar
   * que invierte el fondo. `/ajustes` tiene el mismo control, pero pedirle
   * sesión a esta prueba lo dejaría bloqueado por lo mismo que el bloque de
   * arriba: sin cuenta `PRACTITIONER` sembrada en este stack.
   */
  test('cambiar el tema invierte el fondo sin recargar', async ({ page }) => {
    await page.goto('/auth');
    await estable(page);

    const grupo = page.getByRole('group', { name: 'Tema de la interfaz' });
    await grupo.getByRole('button', { name: 'Oscuro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro');
    // `data-theme` (el atributo del sistema de tokens general) sigue el
    // mismo cambio; `'system'` es el único valor que lo deja sin escribir.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await grupo.getByRole('button', { name: 'Claro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});

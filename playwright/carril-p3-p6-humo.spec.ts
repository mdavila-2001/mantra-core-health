import {
  devices,
  expect,
  test,
  type Browser,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

import { UI } from '../src/testing/acceptance/core/contracts/ui.contract';
import { esperarAplicacionLista, irA } from './support/sesion';

/**
 * Humo de las pantallas de P3 y P6 **en dos formatos**: escritorio y un móvil
 * emulado.
 *
 * ## Por qué existe además de los journeys
 *
 * Los journeys (`p3-muro-social.spec.ts`, `p6-moderacion-resenas.spec.ts`)
 * necesitan el catálogo de semillas completo: cinco identidades autenticables,
 * follows sembrados y una atención cerrada. Este humo necesita **una sola
 * cuenta** —la que siembra el arranque de la API— y responde una pregunta más
 * chica pero que nadie había respondido todavía: *¿estas pantallas abren, y se
 * ven, en el sistema real?*
 *
 * ## Por qué dos formatos
 *
 * La cola de moderación es una tabla de filas con acciones, y el composer tiene
 * una botonera. Las dos cosas son justo lo que se rompe al angostar la pantalla:
 * botones que se salen, texto que se corta, controles que quedan fuera del área
 * táctil. Verlo sólo en escritorio deja la mitad de los usuarios sin comprobar.
 *
 * El móvil se emula con el perfil de dispositivo de Playwright —viewport, factor
 * de escala, `userAgent` y eventos táctiles—, no sólo estrechando la ventana:
 * `hover` no existe en un móvil y un menú que sólo aparece al pasar el puntero se
 * ve bien en una ventana angosta y no se puede usar en un teléfono.
 */

/** La cuenta que siembra el arranque de la API (`BOOTSTRAP_ADMIN_*`). */
const CUENTA = {
  identificador:
    process.env['E2E_ADMIN_EMAIL'] ?? 'cpacentropreparacionacademica@gmail.com',
  clave: process.env['E2E_ADMIN_PASSWORD'] ?? 'S3cret-passw0rd',
};

/** Dónde se dejan las capturas, para poder mirarlas después. */
const EVIDENCIA = 'artifacts/playwright/humo-p3-p6';

/**
 * Entra por la pantalla de ingreso.
 *
 * No se inyecta un token: la aplicación sólo persiste el refresh token y lo
 * canjea al arrancar, así que una sesión fabricada no recorre el mismo camino
 * que una real.
 */
async function entrar(page: Page): Promise<void> {
  await page.goto('/auth');
  await esperarAplicacionLista(page);
  await page.getByTestId('login-identifier').fill(CUENTA.identificador);
  await page.getByTestId('login-password').fill(CUENTA.clave);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
  await esperarAplicacionLista(page);
}

/** Guarda una captura con nombre estable. */
async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: `${EVIDENCIA}/${nombre}.png`, fullPage: true });
}

/**
 * Comprueba que la pantalla no desborde a lo ancho.
 *
 * Es la falla que más se cuela: en escritorio no se nota y en un teléfono
 * aparece una barra horizontal que corta los botones de la derecha. Se compara
 * el ancho del documento con el del viewport, con un margen de un píxel para el
 * redondeo del navegador.
 */
async function sinDesbordeHorizontal(page: Page): Promise<void> {
  const desborde = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(desborde, 'la pantalla desborda a lo ancho').toBeLessThanOrEqual(1);
}

/**
 * Los dos formatos que se prueban.
 *
 * El contexto se crea a mano y no con `test.use`: aplicar un perfil de
 * dispositivo dentro de un `describe` cambiaría el navegador por defecto y
 * Playwright lo rechaza porque forzaría un trabajador nuevo. Crear el contexto
 * es lo mismo y además deja explícito que cada formato es una sesión aparte.
 */
const FORMATOS: readonly {
  readonly nombre: string;
  readonly opciones: BrowserContextOptions;
}[] = [
  { nombre: 'escritorio', opciones: { viewport: { width: 1440, height: 900 } } },
  { nombre: 'movil', opciones: { ...devices['Pixel 5'] } },
];

/** Abre una página con el formato pedido. */
async function abrir(
  browser: Browser,
  opciones: BrowserContextOptions,
): Promise<Page> {
  const contexto = await browser.newContext(opciones);
  return contexto.newPage();
}

for (const formato of FORMATOS) {
  test.describe(`P3/P6 · humo en ${formato.nombre}`, () => {
    test('el muro abre, ofrece publicar y no desborda', async ({ browser }) => {
      const page = await abrir(browser, formato.opciones);
      await entrar(page);
      await irA(page, '/feed');
      await esperarAplicacionLista(page);

      // Dos estados legítimos: hay vitrina y aparece el composer, o no la hay y
      // aparece la puerta que invita a crearla. Lo que no puede pasar es que la
      // pantalla quede en blanco.
      const composer = page.getByTestId(UI.postComposer);
      const puerta = page.getByText('Todavía no tenés perfil público');
      await expect(composer.or(puerta).first()).toBeVisible({ timeout: 30_000 });

      if (await composer.isVisible().catch(() => false)) {
        await expect(page.getByTestId(UI.postComposerBody)).toBeVisible();
        await expect(page.getByTestId(UI.postComposerVisibility)).toBeVisible();
        // El punto de extensión de P5: existe, se ve y está apagado.
        const imagenes = page.getByTestId(UI.postComposerMedia);
        await expect(imagenes).toBeVisible();
        await expect(imagenes).toHaveAttribute('aria-disabled', 'true');
      }

      await sinDesbordeHorizontal(page);
      await capturar(page, `muro-${formato.nombre}`);
    });

    test('la moderación abre su cola y sus dos pestañas', async ({
      browser,
    }) => {
      const page = await abrir(browser, formato.opciones);
      await entrar(page);

      const cola = page.waitForResponse(
        (r) =>
          r.url().includes('/community/moderation/queue') && r.status() === 200,
        { timeout: 60_000 },
      );
      await irA(page, '/administration/moderation');
      await esperarAplicacionLista(page);

      // La lectura que antes no existía: se comprueba que la pantalla la pida y
      // que el servidor la conteste con 200, no sólo que se pinte algo.
      const respuesta = await cola;
      const cuerpo = (await respuesta.json()) as { items: unknown[] };
      expect(Array.isArray(cuerpo.items)).toBe(true);

      await expect(page.getByTestId(UI.moderationQueueTab)).toBeVisible();
      await expect(page.getByTestId(UI.moderationAppealsTab)).toBeVisible();

      // Cambiar a apelaciones pide la otra lectura.
      const apelaciones = page.waitForResponse(
        (r) =>
          r.url().includes('/community/moderation/appeals') &&
          r.status() === 200,
        { timeout: 60_000 },
      );
      await page.getByTestId(UI.moderationAppealsTab).click();
      await apelaciones;

      await sinDesbordeHorizontal(page);
      await capturar(page, `moderacion-${formato.nombre}`);
    });
  });
}

test.afterAll(() => {
  mkdirSync(EVIDENCIA, { recursive: true });
  writeFileSync(
    `${EVIDENCIA}/LEEME.md`,
    [
      '# Humo de P3/P6 en escritorio y móvil',
      '',
      'Capturas de las dos pantallas de los carriles de la Dell, contra el stack',
      'real (API en el 3000, front en el 4200).',
      '',
      'El móvil se emula con el perfil `Pixel 5` de Playwright: viewport, factor',
      'de escala, `userAgent` y eventos táctiles. No es la ventana angosta — que',
      'no distingue un menú que sólo abre al pasar el puntero.',
      '',
      'Lo que este humo **no** cubre: los journeys completos, que necesitan el',
      'catálogo de semillas (cinco identidades, follows y una atención cerrada).',
    ].join('\n'),
    'utf8',
  );
});

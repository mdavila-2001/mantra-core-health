import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, urlDeApi } from './support/actores';

/**
 * Carril 06 — los cuatro directorios de entidades de salud, sin sesión.
 *
 * ## Qué prueba
 *
 * Que las cuatro pantallas —medicamentos, hospitales, laboratorios y
 * aseguradoras— se recorran **mirando** y no leyendo: grilla de cards con
 * imagen o su degradado, un desplegable que se superpone en vez de empujar, el
 * modal de farmacias con lista y mapa, y «Cómo llegar» centrado en el
 * establecimiento elegido.
 *
 * ## Lo que se mide, y no se mira a ojo
 *
 * **AC-06-6 no se comprueba viendo la pantalla.** «Las tarjetas vecinas no se
 * mueven ni un píxel» es una afirmación numérica: se toma el `boundingBox()` de
 * la card siguiente antes y después de abrir el panel, y se comparan. Un panel
 * que empuja 3 px pasa cualquier revisión visual y falla acá.
 *
 * **AC-06-20 no se comprueba mirando la pantalla tampoco.** Una violación de CSP
 * bloquea **en silencio**: el recurso no carga, no hay error visible, y la
 * pantalla se ve «bien» con un mapa gris. Sólo se ve en la consola.
 */

/** Los tres anchos de la ficha. El de escritorio es el del config. */
const VIEWPORTS = [
  { nombre: 'móvil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'escritorio', width: 1440, height: 900 },
] as const;

/** Las cuatro rutas del pedido, con el rótulo que las nombra. */
const DIRECTORIOS = [
  { ruta: '/search/medications', nombre: 'medicamentos' },
  { ruta: '/search/hospitals', nombre: 'hospitales' },
  { ruta: '/search/diagnostics', nombre: 'laboratorios' },
  { ruta: '/search/insurers', nombre: 'aseguradoras' },
] as const;

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await contextoDeApi();
  expect(
    await apiViva(api),
    `La API E2E no responde en ${urlDeApi()}. Levantá el entorno con \`yarn seed:e2e\` en el repositorio de la API.`,
  ).toBe(true);
});

test.afterAll(async () => {
  await api.dispose();
});

/**
 * Abre una ruta sin sesión y espera a que haya cards.
 *
 * **No usa `networkidle`**: contra el servidor de desarrollo el socket de
 * recarga en vivo no deja la red quieta nunca.
 */
async function abrirDirectorio(page: Page, ruta: string): Promise<void> {
  await page.goto(ruta, { waitUntil: 'domcontentloaded' });
  await page.locator('[app-centro-card]').first().waitFor({ state: 'visible' });
}

test.describe('AC-06-1 y AC-06-2 · las cuatro son grilla de cards bajo el mismo marco', () => {
  for (const { ruta, nombre } of DIRECTORIOS) {
    test(`${nombre} usa el rail del marco y no declara pestañas propias`, async ({ page }) => {
      await abrirDirectorio(page, ruta);

      await expect(page.locator('.app-tabs')).toHaveCount(0);
      await expect(page.locator('[data-testid="public-nav-rail-link"]')).toHaveCount(8);
    });

    test(`${nombre} presenta cards, no renglones`, async ({ page }) => {
      await abrirDirectorio(page, ruta);

      expect(await page.locator('[app-centro-card]').count()).toBeGreaterThan(0);
      // `app-search-result` es la lista de renglones que las cuatro dejaron.
      await expect(page.locator('app-search-result')).toHaveCount(0);
    });
  }
});

test.describe('AC-06-3 · cada card tiene imagen, o degrada sin dejar un hueco', () => {
  for (const { ruta, nombre } of DIRECTORIOS) {
    test(`en ${nombre} ninguna card queda sin marca visual`, async ({ page }) => {
      await abrirDirectorio(page, ruta);
      const cards = page.locator('[app-centro-card]');

      for (let i = 0; i < Math.min(await cards.count(), 6); i += 1) {
        const card = cards.nth(i);
        const conFoto = await card.locator('.centro__foto img').count();
        const conIniciales = await card.locator('.centro__logo').count();

        // O foto, o el degradado con iniciales. Nunca las dos en cero: eso es
        // el hueco que AC-06-3 prohíbe.
        expect(conFoto + conIniciales, `card ${i} de ${nombre}`).toBeGreaterThan(0);
      }
    });
  }
});

test.describe('AC-06-5 a AC-06-8 · el desplegable se superpone y no empuja', () => {
  test('el disparador tiene nombre accesible y aria-expanded', async ({ page }) => {
    await abrirDirectorio(page, '/search/hospitals');
    const disparador = page.locator('[data-testid="card-detail-trigger"]').first();

    await expect(disparador).toHaveAttribute('aria-expanded', 'false');
    expect(await disparador.getAttribute('aria-label')).toBeTruthy();
  });

  test('abrirlo no mueve a la card siguiente ni un píxel', async ({ page }) => {
    await abrirDirectorio(page, '/search/hospitals');
    const cards = page.locator('[app-centro-card]');
    test.skip((await cards.count()) < 2, 'hace falta más de una card para medir el empuje');

    const antes = await cards.nth(1).boundingBox();
    await page.locator('[data-testid="card-detail-trigger"]').first().click();
    await page.locator('[data-testid="card-detail-panel"]').waitFor({ state: 'visible' });
    const despues = await cards.nth(1).boundingBox();

    expect(despues?.x).toBeCloseTo(antes?.x ?? 0, 0);
    expect(despues?.y).toBeCloseTo(antes?.y ?? 0, 0);
  });

  test('Escape lo cierra y devuelve el foco al disparador', async ({ page }) => {
    await abrirDirectorio(page, '/search/hospitals');
    const disparador = page.locator('[data-testid="card-detail-trigger"]').first();

    await disparador.click();
    await expect(disparador).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(disparador).toHaveAttribute('aria-expanded', 'false');
    await expect(disparador).toBeFocused();
  });

  test('un clic afuera también lo cierra', async ({ page }) => {
    await abrirDirectorio(page, '/search/hospitals');
    const disparador = page.locator('[data-testid="card-detail-trigger"]').first();

    await disparador.click();
    await page.locator('body').click({ position: { x: 5, y: 5 } });

    await expect(disparador).toHaveAttribute('aria-expanded', 'false');
  });

  test('AC-06-8 · en 390 px el panel no se sale del viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await abrirDirectorio(page, '/search/hospitals');

    await page.locator('[data-testid="card-detail-trigger"]').first().click();
    const panel = page.locator('[data-testid="card-detail-panel"]');
    await panel.waitFor({ state: 'visible' });

    const caja = await panel.boundingBox();
    expect(caja?.x ?? 0).toBeGreaterThanOrEqual(0);
    expect((caja?.x ?? 0) + (caja?.width ?? 0)).toBeLessThanOrEqual(390);
  });
});

test.describe('AC-06-9 a AC-06-12 · las farmacias de un medicamento, en modal', () => {
  test('«Ver farmacias» abre un modal con LISTA, no grilla, y un mapa', async ({ page }) => {
    await abrirDirectorio(page, '/search/medications');
    const boton = page.locator('[data-testid="vitrina-ver-farmacias"]').first();
    test.skip((await boton.count()) === 0, 'ningún medicamento del entorno tiene farmacias');

    await boton.click();
    const dialogo = page.locator('[data-testid="content-dialog"]');
    await expect(dialogo).toBeVisible();

    // La lista **es** la alternativa textual del mapa: por eso el pedido pide
    // lista y no grilla.
    await expect(dialogo.locator('[data-testid="pharmacies-list"]')).toBeVisible();
    await expect(dialogo.locator('app-map')).toHaveCount(1);
  });

  test('el mapa se monta después de abrir: Leaflet necesita layout real', async ({ page }) => {
    await abrirDirectorio(page, '/search/medications');
    const boton = page.locator('[data-testid="vitrina-ver-farmacias"]').first();
    test.skip((await boton.count()) === 0, 'ningún medicamento del entorno tiene farmacias');

    // Antes de abrir no hay mapa en ninguna parte de la página.
    await expect(page.locator('app-map')).toHaveCount(0);
    await boton.click();

    const mapa = page.locator('[data-testid="content-dialog"] app-map');
    await expect(mapa).toBeVisible();
    // Un mapa creado dentro de un `<dialog>` cerrado mide 0×0 y se dibuja gris.
    const caja = await mapa.boundingBox();
    expect(caja?.height ?? 0).toBeGreaterThan(0);
  });

  test('AC-06-12 · una farmacia sin coordenadas aparece con aviso, no se omite', async ({
    page,
  }) => {
    await abrirDirectorio(page, '/search/medications');
    const boton = page.locator('[data-testid="vitrina-ver-farmacias"]').first();
    test.skip((await boton.count()) === 0, 'ningún medicamento del entorno tiene farmacias');
    await boton.click();

    const sinMapa = page.locator('[data-testid="pharmacies-unmapped"]');
    test.skip(
      (await sinMapa.count()) === 0,
      'todas las farmacias del entorno tienen coordenadas: no hay caso que mirar',
    );
    // Está en la lista, y dice por qué no está en el mapa.
    await expect(sinMapa.first()).toBeVisible();
  });

  test('AC-06-11 · Escape cierra el modal y devuelve el foco', async ({ page }) => {
    await abrirDirectorio(page, '/search/medications');
    const boton = page.locator('[data-testid="vitrina-ver-farmacias"]').first();
    test.skip((await boton.count()) === 0, 'ningún medicamento del entorno tiene farmacias');

    await boton.click();
    await expect(page.locator('[data-testid="content-dialog"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="content-dialog"]')).toHaveCount(0);
    await expect(boton).toBeFocused();
  });
});

test.describe('AC-06-13 a AC-06-16 · «Cómo llegar»', () => {
  test('«Ver ficha» lleva a /o/:slug', async ({ page }) => {
    await abrirDirectorio(page, '/search/hospitals');
    await page.locator('[data-testid="facility-profile"]').first().click();

    await page.waitForURL(/\/o\/[^/]+$/);
  });

  test('centra el mapa en ESE establecimiento, no en la pantalla genérica', async ({ page }) => {
    await abrirDirectorio(page, '/search/hospitals');
    const boton = page.locator('[data-testid="facility-directions"]').first();
    test.skip(
      (await boton.count()) === 0,
      'ningún establecimiento del entorno tiene coordenadas',
    );

    await boton.click();
    await expect(page.locator('[data-testid="content-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="directions-facility"]')).toBeVisible();
    // No navegó a `/search/map`, que es la pantalla genérica.
    expect(page.url()).toContain('/search/hospitals');
  });

  test('AC-06-16 · denegar la ubicación no rompe la pantalla', async ({ page, context }) => {
    await context.clearPermissions();
    await abrirDirectorio(page, '/search/hospitals');
    const boton = page.locator('[data-testid="facility-directions"]').first();
    test.skip((await boton.count()) === 0, 'ningún establecimiento del entorno tiene coordenadas');
    await boton.click();

    await page.locator('[data-testid="directions-use-location"]').click();

    // Se dice, y queda la otra vía: marcar el punto a mano.
    await expect(page.locator('[data-testid="directions-location-denied"]')).toBeVisible();
    await expect(page.locator('[data-testid="directions-pick-on-map"]')).toBeVisible();
    await expect(page.locator('[data-testid="directions-facility"]')).toBeVisible();
  });

  test('AC-06-15 · si hay distancia, dice QUÉ distancia es', async ({ page }) => {
    await abrirDirectorio(page, '/search/hospitals');
    const distancia = page.locator('[data-testid="directions-distance"]').first();
    test.skip((await distancia.count()) === 0, 'ninguna card declara distancia');

    // Nunca se presenta una distancia recta como si fuera de trayecto.
    await expect(distancia).toContainText('línea recta');
  });
});

test.describe('AC-06-18 · sin scroll horizontal, con captura por viewport', () => {
  for (const viewport of VIEWPORTS) {
    for (const { ruta, nombre } of DIRECTORIOS) {
      test(`${nombre} en ${viewport.nombre}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await abrirDirectorio(page, ruta);

        const desborda = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        );
        expect(desborda, 'la página scrollea a lo ancho').toBe(false);

        // Es una tarea visual: sin captura el rung máximo es
        // VERIFIED_FUNCTIONAL_ONLY.
        await testInfo.attach(`${nombre}-${viewport.width}`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
      });
    }
  }
});

test.describe('AC-06-20 · la consola, que es donde se ve una CSP violada', () => {
  for (const { ruta, nombre } of DIRECTORIOS) {
    test(`${nombre} no reporta violaciones de CSP ni errores`, async ({ page }) => {
      const errores: string[] = [];
      page.on('console', (mensaje) => {
        if (mensaje.type() === 'error') {
          errores.push(mensaje.text());
        }
      });
      page.on('pageerror', (error) => errores.push(String(error)));

      await abrirDirectorio(page, ruta);

      // Una CSP violada bloquea en silencio: el recurso no carga, no hay error
      // visible, y la pantalla se ve «bien» con un mapa gris.
      const csp = errores.filter((e) => /Content Security Policy/i.test(e));
      expect(csp, csp.join('\n')).toEqual([]);
      expect(errores, errores.join('\n')).toEqual([]);
    });
  }
});

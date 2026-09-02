import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, urlDeApi } from './support/actores';

/**
 * Carril 01 — la publicación en la red social, vista pública.
 *
 * ## Qué prueba
 *
 * Los diecinueve criterios de la TAREA 01 que se pueden ver desde afuera: el
 * rail del marco, la fecha que dejó de ser enlace, el stepper de imágenes, el
 * modal de reacciones, el desplegable de comentarios y el menú de preferencias.
 *
 * Todo **sin sesión**: ni cookie, ni token, ni paso por login. No hay un solo
 * `route.fulfill` — el navegador habla con la API real del entorno E2E, que es
 * la única forma de que «el modal lista a quién reaccionó» signifique algo.
 *
 * ## Los tres viewports son obligatorios
 *
 * La ficha los fija: 390×844, 768×1024 y 1440×900. Un encabezado que no corta
 * en el ancho del config y sí corta en un teléfono es exactamente el defecto
 * que el propietario reportó, así que probarlo sólo a 1440 sería no probarlo.
 */

/** Los tres anchos de la ficha. El de escritorio es el del config. */
const VIEWPORTS = [
  { nombre: 'móvil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'escritorio', width: 1440, height: 900 },
] as const;

/** Las cuatro entradas que el propietario nombra, en su orden. */
const SECCIONES = ['Publicaciones', 'Buscar', 'Profesionales', '¿A quién consulto?'] as const;

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
 * Abre una ruta sin sesión y espera a que la aplicación pinte.
 *
 * **No usa `networkidle`.** Contra el servidor de desarrollo la red no se queda
 * quieta nunca —el socket de recarga en vivo sigue abierto—, así que la espera
 * agota el tiempo y deja el contexto sin poder cerrarse.
 */
async function abrirSinSesion(page: Page, ruta: string): Promise<void> {
  await page.goto(ruta, { waitUntil: 'domcontentloaded' });
  await page.locator('app-public-nav-rail').first().waitFor({ state: 'attached' });
}

test.describe('el marco público', () => {
  test('AC-01-2 · el rail dibuja las cuatro secciones como íconos con tooltip', async ({
    page,
  }) => {
    await abrirSinSesion(page, '/posts');

    const secciones = page.locator('[data-group="sections"] [data-testid="public-nav-rail-link"]');
    await expect(secciones).toHaveCount(4);

    for (const [i, rotulo] of SECCIONES.entries()) {
      const enlace = secciones.nth(i);
      await expect(enlace).toHaveAttribute('aria-label', rotulo);
      // El glifo sale del set cerrado, no es un `<svg>` escrito a mano.
      await expect(enlace.locator('app-nav-icon')).toHaveCount(1);
    }
  });

  test('AC-01-2 · el tooltip aparece con el puntero Y con el foco de teclado', async ({ page }) => {
    await abrirSinSesion(page, '/posts');
    const primera = page.locator('[data-testid="public-nav-rail-link"]').first();

    await primera.hover();
    await expect(page.locator('app-tooltip-panel')).toContainText('Publicaciones');

    await page.mouse.move(0, 0);
    await expect(page.locator('app-tooltip-panel')).toHaveCount(0);

    // Sin esto un rail de íconos es inalcanzable para quien navega con teclado.
    await primera.focus();
    await expect(page.locator('app-tooltip-panel')).toContainText('Publicaciones');
  });

  test('AC-01-3 · el rail marca la página actual una sola vez y sobrevive a la navegación', async ({
    page,
  }) => {
    await abrirSinSesion(page, '/posts');
    await expect(page.locator('[data-testid="public-nav-rail-link"][aria-current="page"]')).toHaveCount(
      1,
    );

    await page.locator('[data-route="/search/practitioners"]').click();
    await page.waitForURL('**/search/practitioners');

    const marcados = page.locator('[data-testid="public-nav-rail-link"][aria-current="page"]');
    await expect(marcados).toHaveCount(1);
    await expect(marcados).toHaveAttribute('data-route', '/search/practitioners');
  });

  for (const viewport of VIEWPORTS) {
    test(`AC-01-5 · en ${viewport.nombre} no hay botón hamburguesa`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await abrirSinSesion(page, '/posts');

      await expect(page.locator('[data-testid="header-menu"]')).toHaveCount(0);
      await expect(page.locator('.app-nav-toggle')).toHaveCount(0);
    });

    test(`AC-01-6 · en ${viewport.nombre} el encabezado no produce scroll horizontal`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await abrirSinSesion(page, '/posts');

      const desborda = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(desborda, 'la página scrollea a lo ancho').toBe(false);

      // Sin evidencia visual el rung máximo es VERIFIED_FUNCTIONAL_ONLY.
      await testInfo.attach(`publicaciones-${viewport.width}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    });
  }
});

test.describe('la tarjeta de publicación', () => {
  test('AC-01-1 · la fecha no es enlace ni entra en el orden de tabulación', async ({ page }) => {
    await abrirSinSesion(page, '/posts');
    const fecha = page.locator('.publicacion__fecha').first();
    await fecha.waitFor();

    await expect(fecha).toHaveJSProperty('tagName', 'TIME');
    await expect(page.locator('a.publicacion__fecha')).toHaveCount(0);
    await expect(fecha.locator('xpath=ancestor::a')).toHaveCount(0);
  });

  test('AC-01-7 y AC-01-8 · el carrusel tiene stepper, «n de N» y extremos deshabilitados', async ({
    page,
  }) => {
    await abrirSinSesion(page, '/posts');

    const conVarias = page.locator('.publicacion__medios[data-cantidad="varias"]').first();
    // El feed E2E puede no tener una publicación con dos imágenes: se dice, no
    // se da por verde algo que no se miró.
    test.skip(
      (await conVarias.count()) === 0,
      'ninguna publicación del feed tiene dos o más imágenes',
    );

    const tarjeta = conVarias.locator('xpath=ancestor::article');
    const anterior = tarjeta.locator('[data-testid="imagen-anterior"]');
    const siguiente = tarjeta.locator('[data-testid="imagen-siguiente"]');

    await expect(anterior).toBeDisabled();
    await expect(siguiente).toBeEnabled();
    await expect(tarjeta.locator('.publicacion__contador')).toContainText('1 de');

    await siguiente.click();
    await expect(anterior).toBeEnabled();
    await expect(tarjeta.locator('.publicacion__contador')).toContainText('2 de');
  });

  test('AC-01-9 y AC-01-10 · el contador de reacciones abre el modal de quién reaccionó', async ({
    page,
  }) => {
    await abrirSinSesion(page, '/posts');

    const contador = page.locator('[data-testid="publicacion-reacciones"]').first();
    test.skip((await contador.count()) === 0, 'ninguna publicación del feed tiene reacciones');

    await contador.click();
    const modal = page.locator('[data-testid="modal"]');
    await expect(modal).toBeVisible();

    // El foco arranca adentro: `showModal()` lo garantiza.
    await expect(modal.locator(':focus')).toHaveCount(1);

    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    await expect(contador).toBeFocused();
  });

  test('AC-01-11 · el contador de comentarios abre un desplegable en línea, no un modal', async ({
    page,
  }) => {
    await abrirSinSesion(page, '/posts');

    const contador = page.locator('[data-testid="publicacion-comentarios"]').first();
    test.skip((await contador.count()) === 0, 'ninguna publicación del feed tiene comentarios');

    await expect(contador).toHaveAttribute('aria-expanded', 'false');
    await contador.click();
    await expect(contador).toHaveAttribute('aria-expanded', 'true');

    // En línea: dentro de la tarjeta, y sin `<dialog>` de por medio.
    const desplegable = page.locator('app-publicacion-comentarios').first();
    await expect(desplegable).toBeVisible();
    await expect(desplegable.locator('dialog')).toHaveCount(0);

    const scrollea = await desplegable
      .locator('.comentarios')
      .evaluate((el) => getComputedStyle(el).overflow);
    expect(scrollea).toContain('auto');
  });
});

test.describe('el menú de preferencias', () => {
  test('AC-01-15 · tiene exactamente las siete entradas del pedido', async ({ page }) => {
    await abrirSinSesion(page, '/posts');

    await page.locator('[data-testid="post-preferences-trigger"]').first().click();
    const items = page.locator('app-menu-item');

    await expect(items).toHaveCount(7);
    await expect(items).toHaveText([
      'No ver más este tipo de publicaciones',
      'Denunciar',
      'Ir a la publicación',
      'Compartir',
      'Copiar enlace',
      'Contactarme con este doctor',
      'Ir al perfil del doctor',
    ]);
  });

  test('AC-01-18 · abre con teclado, cierra con Escape y devuelve el foco', async ({ page }) => {
    await abrirSinSesion(page, '/posts');
    const disparador = page.locator('[data-testid="post-preferences-trigger"]').first();

    await disparador.focus();
    await page.keyboard.press('Enter');
    await expect(disparador).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(disparador).toHaveAttribute('aria-expanded', 'false');
    await expect(disparador).toBeFocused();
  });

  test('AC-01-17 · sin sesión, «Denunciar» lleva a entrar con retorno', async ({ page }) => {
    await abrirSinSesion(page, '/posts');

    await page.locator('[data-testid="post-preferences-trigger"]').first().click();
    await page.locator('app-menu-item[data-action="report"]').click();

    await page.waitForURL(/\/auth\?returnUrl=/);
    expect(new URL(page.url()).searchParams.get('returnUrl')).toBe('/posts');
  });

  test('AC-01-16 · «Ir al perfil del doctor» navega a su ficha', async ({ page }) => {
    await abrirSinSesion(page, '/posts');

    await page.locator('[data-testid="post-preferences-trigger"]').first().click();
    await page.locator('app-menu-item[data-action="openProfile"]').click();

    await page.waitForURL(/\/p\/[^/]+$/);
  });
});

test.describe('AC-01-4 · las pantallas ya no declaran sus propias pestañas', () => {
  const RUTAS = [
    '/posts',
    '/search',
    '/search/practitioners',
    '/search/medications',
    '/search/hospitals',
    '/search/diagnostics',
    '/search/insurers',
  ];

  for (const ruta of RUTAS) {
    test(`${ruta} no dibuja un tablist propio`, async ({ page }) => {
      await abrirSinSesion(page, ruta);

      await expect(page.locator('.app-tabs')).toHaveCount(0);
      // Y el rail del marco sigue ahí, con las mismas entradas en todas.
      await expect(page.locator('[data-testid="public-nav-rail-link"]')).toHaveCount(8);
    });
  }
});

test.describe('AC-01-20 · la consola queda limpia', () => {
  test('recorrer /posts no produce errores de consola', async ({ page }) => {
    const errores: string[] = [];
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error') {
        errores.push(mensaje.text());
      }
    });
    page.on('pageerror', (error) => errores.push(String(error)));

    await abrirSinSesion(page, '/posts');
    await page.locator('[data-route="/search/practitioners"]').click();
    await page.waitForURL('**/search/practitioners');

    // Una violación de CSP bloquea EN SILENCIO: sólo se ve acá.
    expect(errores, errores.join('\n')).toEqual([]);
  });
});

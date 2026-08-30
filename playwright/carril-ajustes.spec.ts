import { expect, test, type Page } from '@playwright/test';

import { esperarAplicacionLista, entrar, irA } from './support/sesion';

/**
 * Ajustes — la vista que junta lo que estaba repartido.
 *
 * ## Qué comprueba, y por qué contra el producto de verdad
 *
 * Las pruebas unitarias ya fijan la lógica de la pantalla. Lo que no pueden ver
 * es lo que esta suite mira: que **el encabezado real** ofrece el ícono y ya no
 * el conmutador de tema, que **el menú real** dejó de ofrecer las preferencias
 * de aviso, que la dirección vieja **redirige** en el router de producción, y
 * que cambiar el tema estampa el atributo que la hoja de estilos lee. Todo eso
 * vive en el ensamblado, no en un componente aislado.
 *
 * ## Credenciales
 *
 * Del entorno, como el resto de la suite: el contrato de semillas exige
 * autenticación real y prohíbe fabricar tokens. Sin ellas la prueba se salta
 * diciendo qué falta, en vez de fallar por algo que no es del producto.
 */
const IDENTIFICADOR = process.env['E2E_ADMIN_EMAIL'];
const CLAVE = process.env['E2E_ADMIN_PASSWORD'];

test.describe('Ajustes', () => {
  test.skip(
    !IDENTIFICADOR || !CLAVE,
    'Faltan E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD: la suite no fabrica sesiones.',
  );

  // En serie y con una sola sesión: `POST /iam/auth/login` admite diez por
  // minuto y por IP, y entrar una vez por prueba gastaría el cupo.
  test.describe.configure({ mode: 'serial' });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await entrar(page, {
      rol: 'administrador',
      identificador: IDENTIFICADOR as string,
      clave: CLAVE as string,
      nombre: 'admin',
    });
  });

  test.afterAll(async () => {
    await page?.close();
  });

  test('el encabezado ofrece Ajustes, y el tema dejó de estar suelto ahí', async () => {
    const ajustes = page.getByTestId('header-ajustes');

    await expect(ajustes).toBeVisible();
    await expect(ajustes).toHaveAttribute('aria-label', 'Ajustes');
    // El conmutador se mudó adentro: suelto en el encabezado parecía la única
    // preferencia que el producto tiene.
    await expect(page.locator('[app-theme-toggle]')).toHaveCount(0);
    // La campana se queda: es lo único del encabezado que trae información
    // nueva, y no es una preferencia.
    await expect(page.getByTestId('campana')).toBeVisible();
  });

  test('el menú lateral ya no ofrece las preferencias de aviso, ni Ajustes', async () => {
    const menu = page.locator('[data-testid="nav-enlace"]');

    await expect(menu.filter({ hasText: 'Preferencias de avisos' })).toHaveCount(0);
    // Ajustes tampoco ocupa renglón: se entra por el ícono.
    await expect(page.locator('[data-testid="nav-enlace"][data-route="/ajustes"]')).toHaveCount(0);
    // Pero la bandeja sigue en su lugar: no se movió nada de lo que se lee.
    await expect(
      page.locator('[data-testid="nav-enlace"][data-route="/notification-center"]'),
    ).toHaveCount(1);
  });

  test('el ícono lleva a Ajustes, con sus tres secciones', async () => {
    await page.getByTestId('header-ajustes').click();
    await page.waitForURL(/\/ajustes/, { timeout: 30_000 });
    await esperarAplicacionLista(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Avisos' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Apariencia' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Permisos' })).toBeVisible();
  });

  test('el panel de avisos carga las preferencias de verdad, contra la API', async () => {
    await irA(page, '/ajustes');
    await esperarAplicacionLista(page);

    // Las cuatro categorías en lenguaje llano, que es lo que la pantalla
    // promete: si la llamada fallara, acá diría «No pudimos cargar…».
    await expect(page.getByTestId('pref-CLINICAL')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('pref-SCHEDULING')).toBeVisible();
    await expect(page.getByTestId('pref-MESSAGES')).toBeVisible();
    await expect(page.getByTestId('pref-SOCIAL')).toBeVisible();
    await expect(page.getByTestId('pref-guardar')).toBeVisible();
  });

  test('elegir un tema estampa el atributo que lee la hoja de estilos', async () => {
    await irA(page, '/ajustes');
    await esperarAplicacionLista(page);
    await page.getByRole('tab', { name: 'Apariencia' }).click();

    await page.getByTestId('tema-dark').click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByTestId('tema-light').click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
  });

  test('los permisos del navegador se muestran con su estado real', async () => {
    await irA(page, '/ajustes');
    await esperarAplicacionLista(page);
    await page.getByRole('tab', { name: 'Permisos' }).click();

    // Los tres, cada uno con una lectura del navegador. No se afirma cuál:
    // depende del perfil de Chromium con que corra la suite.
    await expect(page.getByTestId('permiso-avisos')).toBeVisible();
    await expect(page.getByTestId('permiso-ubicacion')).toBeVisible();
    await expect(page.getByTestId('permiso-camara')).toBeVisible();

    // Y la explicación de por qué no hay lista de quién ve tus datos.
    await expect(page.getByTestId('ajustes-accesos-nota')).toBeVisible();
  });

  test('a quien administra la seguridad le ofrece dónde administrar los permisos', async () => {
    await irA(page, '/ajustes');
    await esperarAplicacionLista(page);
    await page.getByRole('tab', { name: 'Permisos' }).click();

    await expect(page.getByTestId('ajustes-roles')).toBeVisible();
    // Acotado al contenido: el menú lateral también ofrece «Acceso delegado» a
    // este rol, y sin acotar el localizador encuentra los dos.
    await expect(
      page.locator('main a[href="/administration/delegated-access"]'),
    ).toBeVisible();
  });

  test('la dirección vieja de las preferencias sigue llevando a algún lado', async () => {
    // Estuvo en el menú, así que está en los favoritos de alguien: redirige en
    // vez de devolver un 404.
    await irA(page, '/my-account/notification-preferences');
    await page.waitForURL(/\/ajustes/, { timeout: 30_000 });

    await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible();
  });
});
